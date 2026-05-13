import Constants from "expo-constants";
import type {
  ReciteLabComparison,
  ReciteLabLiveProgress,
  ReciteLabLiveStatus,
  ReciteLabPhraseStatus,
  ReciteLabPhraseTracker,
} from "@/src/lib/recite-lab-align";

export type ReciteLabAttemptLabel =
  | "correct"
  | "repeat"
  | "skip"
  | "wrong"
  | "noisy"
  | "unlabeled";

export type SaveReciteLabAttemptPayload = {
  algorithmVersions: Record<string, string>;
  label: ReciteLabAttemptLabel;
  saveMode: "auto" | "manual";
  clientRecordedAt: string;
  clientSavedAt: string;
  timing: {
    captureStartedAt: string;
    recognitionStartedAt: string | null;
    audioStartedAt: string | null;
    firstResultAt: string | null;
    lastResultAt: string | null;
    audioEndedAt: string | null;
    recognitionEndedAt: string | null;
    clientSavedAt: string;
    firstResultLatencyMs: number | null;
    recognitionDurationMs: number | null;
    audioDurationMs: number | null;
    saveDelayMs: number | null;
  };
  route: {
    surahNumber: number;
    ayahStart: number;
    ayahEnd: number;
    endSurahNumber: number;
    page: number;
    mushafViewMode: string;
  };
  expectedScope: {
    mode: "full" | "selectedAyah" | "customRange";
    surahNumber: number;
    ayahStart: number;
    ayahEnd: number;
    label: string;
    routeAyahStart: number;
    routeAyahEnd: number;
    selectedWord: {
      surah: number;
      ayah: number;
      position: number;
    } | null;
  };
  expectedWords: string[];
  expectedWordCount: number;
  transcript: string;
  normalizedTranscript: string;
  transcriptTokens: string[];
  heardTokenCount: number;
  liveSnapshots: Array<{
    timestamp: string;
    elapsedMs: number | null;
    status: ReciteLabLiveStatus;
    acceptedCount: number;
    expectedCount: number;
    transcriptTokenCount: number;
    nextExpectedWord: string | null;
    nextExpectedIndex: number | null;
    lastHeardWord: string | null;
    repeatCount: number;
    skippedCount: number;
    mismatchCount: number;
    firstBlockingEventType: string | null;
  }>;
  liveProgress: ReciteLabLiveProgress;
  phraseSnapshots: Array<{
    timestamp: string;
    elapsedMs: number | null;
    status: ReciteLabPhraseStatus;
    acceptedCount: number;
    expectedCount: number;
    transcriptTokenCount: number;
    nextExpectedWord: string | null;
    nextExpectedIndex: number | null;
    confidence: number;
    recentPhrase: string;
  }>;
  phraseTracker: ReciteLabPhraseTracker;
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

export type UploadReciteLabAudioResult = {
  ok: boolean;
  id: string;
  receivedAt: string;
  file: string;
  bytes: number;
  contentType: string;
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

function getAudioContentType(audioUri: string, blob: Blob) {
  if (blob.type) return blob.type;
  const normalized = audioUri.split("?")[0]?.toLowerCase() ?? "";
  if (normalized.endsWith(".m4a")) return "audio/mp4";
  if (normalized.endsWith(".mp4")) return "audio/mp4";
  if (normalized.endsWith(".aac")) return "audio/aac";
  if (normalized.endsWith(".mp3")) return "audio/mpeg";
  if (normalized.endsWith(".caf")) return "audio/x-caf";
  return "audio/wav";
}

export async function uploadReciteLabAudio(
  attemptId: string,
  audioUri: string,
): Promise<UploadReciteLabAudioResult> {
  const baseURL = getReciteLabLoggingBaseURL();
  if (!baseURL) {
    throw new Error("Recite Lab logging URL unavailable.");
  }

  const audioResponse = await fetch(audioUri);
  const blob = await audioResponse.blob();
  if (blob.size === 0) {
    throw new Error("Captured audio file is empty.");
  }

  const contentType = getAudioContentType(audioUri, blob);
  const response = await fetch(
    `${baseURL}/api/dev/recite-lab/attempts/${encodeURIComponent(attemptId)}/audio`,
    {
      method: "POST",
      headers: {
        "Content-Type": contentType,
      },
      body: blob,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.trim() || `Recite Lab audio upload failed: ${response.status}`);
  }

  return response.json() as Promise<UploadReciteLabAudioResult>;
}
