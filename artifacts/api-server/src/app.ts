import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import router from "./routes/index.js";
import healthRouter from "./routes/health.js";
import { requireAuth } from "./middlewares/requireAuth.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

const PROD_ALLOWED_ORIGINS = (process.env.PROD_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedProdOrigin(origin: string): boolean {
  return PROD_ALLOWED_ORIGINS.includes(origin);
}

const DEV_FRONTEND_ORIGIN_PATTERNS = [
  /^http:\/\/localhost:5173$/,
  /^http:\/\/127\.0\.0\.1:5173$/,
  /^http:\/\/10(?:\.\d{1,3}){3}:5173$/,
  /^http:\/\/192\.168(?:\.\d{1,3}){2}:5173$/,
  /^http:\/\/172\.(1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}:5173$/,
];

function isAllowedDevOrigin(origin: string): boolean {
  return DEV_FRONTEND_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Allow requests from localhost and typical private-LAN frontend dev hosts.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedDevOrigin(origin) || isAllowedProdOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Blocked by CORS: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Better Auth handles all /api/auth/* routes (sign-in, sign-up, sign-out, session)
app.all("/api/auth/*splat", toNodeHandler(auth));

// Public health check — must be BEFORE requireAuth
app.use("/api", healthRouter);

// All other /api/* routes require a valid session
app.use("/api", requireAuth, router);

export default app;
