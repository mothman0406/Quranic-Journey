import { authClient } from "@/src/lib/auth-client";

const baseURL =
  process.env.EXPO_PUBLIC_API_URL ??
  "https://workspaceapi-server-production-cc25.up.railway.app";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookies = authClient.getCookie();
  const res = await fetch(`${baseURL}${path}`, {
    ...init,
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
