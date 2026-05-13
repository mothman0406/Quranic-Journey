import Constants from "expo-constants";
import type { ReciteLabComparison } from "@/src/lib/recite-lab-align";

export type ReciteLabAttemptLabel =
  | "correct"
  | "repeat"
  | "skip"
  | "wrong"
  | "noisy"
  | "unlabeled";

export type SaveReciteLabAttemptPayload = {
  label: ReciteLabAttemptLabel;
  saveMode: "auto" | "manual";
  clientRecordedAt: string;
  clientSavedAt: string;
  route: {
    surahNumber: number;
    ayahStart: number;
    ayahEnd: number;
    endSurahNumber: number;
    page: number;
    mushafViewMode: string;
  };
  expectedWords: string[];
  expectedWordCount: number;
  transcript: string;
  normalizedTranscript: string;
  transcriptTokens: string[];
  heardTokenCount: number;
  comparison: ReciteLabComparison;
  audioUri: string | null;
  recordingSupported: boolean;
  deviceSessionId: string | null;
};

export type SaveReciteLabAttemptResult = {
  ok: boolean;
  id: string;
  savedAt: string;
  file: string;
};

const PRIVATE_HOST_PATTERN =
  /^(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getHost(value: string) {
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`http://${value}`);
    return url.hostname;
  } catch {
    const host = value.replace(/^[a-z]+:\/\//i, "").split("/")[0]?.split(":")[0];
    return host || null;
  }
}

function isPrivateHostURL(value: string) {
  const host = getHost(value);
  return host ? PRIVATE_HOST_PATTERN.test(host) : false;
}

function getExpoDevServerBaseURL() {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  const host = getHost(hostUri);
  if (!host || !PRIVATE_HOST_PATTERN.test(host)) return null;
  return `http://${host}:3001`;
}

export function getReciteLabLoggingBaseURL() {
  const explicit = process.env.EXPO_PUBLIC_RECITE_LAB_API_URL?.trim();
  if (explicit) return trimTrailingSlash(explicit);

  const appApi = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (appApi && isPrivateHostURL(appApi)) return trimTrailingSlash(appApi);

  return getExpoDevServerBaseURL();
}

export async function saveReciteLabAttempt(
  payload: SaveReciteLabAttemptPayload,
): Promise<SaveReciteLabAttemptResult> {
  const baseURL = getReciteLabLoggingBaseURL();
  if (!baseURL) {
    throw new Error("Recite Lab logging URL unavailable.");
  }

  const response = await fetch(`${baseURL}/api/dev/recite-lab/attempts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.trim() || `Recite Lab logging failed: ${response.status}`);
  }

  return response.json() as Promise<SaveReciteLabAttemptResult>;
}
