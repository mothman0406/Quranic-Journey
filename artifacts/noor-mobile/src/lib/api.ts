import { authClient } from "@/src/lib/auth-client";

const baseURL =
  process.env.EXPO_PUBLIC_API_URL ??
  "https://workspaceapi-server-production-cc25.up.railway.app";

export const API_DIAGNOSTIC_MARKER = "dashboard-diag-2026-04-28a";

export class ApiError extends Error {
  status: number;
  path: string;
  baseURL: string;
  localDate: string;
  hasCookie: boolean;

  constructor({
    message,
    status,
    path,
    localDate,
    hasCookie,
  }: {
    message: string;
    status: number;
    path: string;
    localDate: string;
    hasCookie: boolean;
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
    this.baseURL = baseURL;
    this.localDate = localDate;
    this.hasCookie = hasCookie;
  }
}

function localDateHeader() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtmlError(text: string) {
  const preMatch = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const source = preMatch?.[1] ?? titleMatch?.[1] ?? text;
  return decodeBasicHtmlEntities(source.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function readableErrorText(text: string, contentType: string | null) {
  const trimmed = text.trim();
  if (!trimmed) return "Request failed.";

  try {
    const parsed = JSON.parse(trimmed) as {
      error?: unknown;
      message?: unknown;
    };
    const message = parsed.error ?? parsed.message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  } catch {
    // Fall through to plain text / HTML handling.
  }

  const looksLikeHtml =
    contentType?.toLowerCase().includes("text/html") ||
    /^<!doctype html/i.test(trimmed) ||
    /^<html/i.test(trimmed);
  const readable = looksLikeHtml ? stripHtmlError(trimmed) : trimmed;
  return readable.length > 240 ? `${readable.slice(0, 237)}...` : readable;
}

export function getApiRuntimeInfo() {
  let hasCookie = false;
  try {
    hasCookie = !!authClient.getCookie();
  } catch {
    hasCookie = false;
  }

  return {
    marker: API_DIAGNOSTIC_MARKER,
    baseURL,
    localDate: localDateHeader(),
    hasCookie,
  };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookies = authClient.getCookie();
  const headers = new Headers(init?.headers);
  const localDate = localDateHeader();
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("x-local-date", localDate);
  if (cookies) {
    headers.set("Cookie", cookies);
  }

  console.log("[noor-api] request", {
    marker: API_DIAGNOSTIC_MARKER,
    path,
    baseURL,
    localDate,
    hasCookie: !!cookies,
  });

  const res = await fetch(`${baseURL}${path}`, {
    ...init,
    credentials: "omit",
    headers,
  });
  console.log("[noor-api] response", {
    marker: API_DIAGNOSTIC_MARKER,
    path,
    status: res.status,
  });
  if (!res.ok) {
    const text = await res.text();
    const message = `API ${res.status}: ${readableErrorText(text, res.headers.get("Content-Type"))}`;
    console.log("[noor-api] error", {
      marker: API_DIAGNOSTIC_MARKER,
      path,
      status: res.status,
      message,
    });
    throw new ApiError({
      message,
      status: res.status,
      path,
      localDate,
      hasCookie: !!cookies,
    });
  }
  return res.json() as Promise<T>;
}
