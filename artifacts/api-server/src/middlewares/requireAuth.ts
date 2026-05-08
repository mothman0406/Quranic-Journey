import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { auth } from "../auth.js";
import { logger } from "../lib/logger.js";

/*
 * Auth response contract:
 * - No valid session: 401 { error: "Unauthorized" }
 * - Retryable auth-store/DB failure: 503 + Retry-After, retryable body
 * - Unexpected failure: log and return 500
 */

type RetryableAuthErrorKind = "drizzle" | "pg" | "better-auth";

type RetryableAuthError = {
  kind: RetryableAuthErrorKind;
  message?: string;
  code?: string;
  cause?: unknown;
};

const PG_TRANSIENT_ERROR_CODES = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "40001",
  "40P01",
  "53300",
  "57P01",
  "57P02",
  "57P03",
  "58000",
  "58030",
  "XX000",
  "XX001",
  "XX002",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorName(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.name === "Error" ? error.constructor.name : error.name;
  }
  if (isRecord(error) && typeof error["name"] === "string") return error["name"];
  if (isRecord(error) && typeof error["constructor"] === "function") {
    return error["constructor"].name;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error["message"] === "string") return error["message"];
  return undefined;
}

function getErrorCode(error: unknown): string | undefined {
  if (isRecord(error) && typeof error["code"] === "string") return error["code"];
  return undefined;
}

function getErrorCause(error: unknown): unknown {
  if (error instanceof Error) return error.cause;
  if (isRecord(error)) return error["cause"];
  return undefined;
}

function getBetterAuthBodyCode(error: unknown): string | undefined {
  if (!isRecord(error) || !isRecord(error["body"])) return undefined;
  const body = error["body"];
  return typeof body["code"] === "string" ? body["code"] : undefined;
}

function isBetterAuthFailedSessionError(error: unknown): boolean {
  if (!isRecord(error)) return false;

  const statusCode = error["statusCode"];
  const status = error["status"];
  const bodyCode = getBetterAuthBodyCode(error);
  const isInternalError =
    statusCode === 500 || status === "INTERNAL_SERVER_ERROR";

  return isInternalError && bodyCode === "FAILED_TO_GET_SESSION";
}

function getErrorChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  let current: unknown = error;

  for (let i = 0; current && i < 8; i += 1) {
    chain.push(current);
    current = getErrorCause(current);
  }

  return chain;
}

function classifyRetryableAuthError(error: unknown): RetryableAuthError | null {
  for (const item of getErrorChain(error)) {
    const code = getErrorCode(item);

    if (item instanceof DrizzleQueryError || getErrorName(item) === "DrizzleQueryError") {
      return {
        kind: "drizzle",
        message: getErrorMessage(item),
        code,
        cause: getErrorCause(item),
      };
    }

    if (code && PG_TRANSIENT_ERROR_CODES.has(code)) {
      return {
        kind: "pg",
        message: getErrorMessage(item),
        code,
        cause: getErrorCause(item),
      };
    }

    if (isBetterAuthFailedSessionError(item)) {
      return {
        kind: "better-auth",
        message: getErrorMessage(item),
        code: getBetterAuthBodyCode(item),
        cause: getErrorCause(item),
      };
    }
  }

  return null;
}

// Augment Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;

  try {
    session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
  } catch (err) {
    const retryable = classifyRetryableAuthError(err);

    if (retryable) {
      logger.warn(
        {
          err,
          kind: retryable.kind,
          message: retryable.message,
          code: retryable.code,
          cause: retryable.cause,
        },
        "[requireAuth] retryable auth error",
      );
      res.setHeader("Retry-After", "5");
      res.status(503).json({
        error: "Service temporarily unavailable",
        retryable: true,
      });
      return;
    }

    logger.error({ err }, "[requireAuth] unexpected auth error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };

  next();
}
