import Constants from "expo-constants";
import type {
  ReciteLabComparison,
  ReciteLabLiveProgress,
  ReciteLabLiveStatus,
  ReciteLabPhraseStatus,
  ReciteLabPhraseTracker,
  ReciteLabWindowStatus,
  ReciteLabWindowTracker,
} from "@/src/lib/recite-lab-align";
import type { ReciteLabVerifierVerdict } from "@/src/lib/recite-lab-verdict";

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
  windowSnapshots: Array<{
    timestamp: string;
    elapsedMs: number | null;
    status: ReciteLabWindowStatus;
    acceptedCount: number;
    expectedCount: number;
    transcriptTokenCount: number;
    currentWindowIndex: number | null;
    confidence: number;
    passedWindowCount: number;
    uncertainWindowCount: number;
    blockedWindowCount: number;
    pendingWindowCount: number;
  }>;
  windowTracker: ReciteLabWindowTracker;
  verifierVerdict: ReciteLabVerifierVerdict;
  comparison: ReciteLabComparison;
  audioUri: string | null;
  recordingSupported: boolean;
  audioUploadPlan: {
    willUpload: boolean;
    reason: "audio_uri_present" | "no_audio_uri_at_save" | "recording_unsupported";
    audioUriPresent: boolean;
    recordingSupported: boolean;
  };
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
  localBytes: number;
  localContentType: string;
  localReadAttempts: number;
  durationMs: number;
};

export type ReciteLabAudioUploadErrorStep =
  | "base_url"
  | "read_local_audio"
  | "empty_local_audio"
  | "upload_request"
  | "server_response"
  | "parse_response";

export type ReciteLabAudioUploadErrorDetails = {
  step: ReciteLabAudioUploadErrorStep;
  audioUri?: string;
  localBytes?: number;
  localContentType?: string;
  localReadAttempts?: number;
  durationMs?: number;
  responseStatus?: number;
  responseText?: string;
  errorName?: string;
  errorMessage?: string;
};

export type LogReciteLabAudioUploadEventPayload = {
  status: "started" | "uploaded" | "skipped" | "error";
  clientEventAt: string;
  reason?: string;
  audioUriPresent: boolean;
  recordingSupported: boolean;
  audioStartedAt: string | null;
  audioEndedAt: string | null;
  audioDurationMs: number | null;
  uploadDurationMs?: number | null;
  bytes?: number | null;
  contentType?: string | null;
  localBytes?: number | null;
  localContentType?: string | null;
  localReadAttempts?: number | null;
  error?: ReciteLabAudioUploadErrorDetails | null;
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

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function describeUnknownError(error: unknown) {
  return {
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}

export class ReciteLabAudioUploadError extends Error {
  details: ReciteLabAudioUploadErrorDetails;

  constructor(message: string, details: ReciteLabAudioUploadErrorDetails) {
    super(message);
    this.name = "ReciteLabAudioUploadError";
    this.details = details;
  }
}

export function getReciteLabAudioUploadErrorDetails(
  error: unknown,
): ReciteLabAudioUploadErrorDetails {
  if (error instanceof ReciteLabAudioUploadError) return error.details;
  return {
    step: "upload_request",
    ...describeUnknownError(error),
  };
}

async function readAudioBlobWithRetry(audioUri: string) {
  const delays = [0, 350, 900];
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= delays.length; attempt += 1) {
    const delay = delays[attempt - 1] ?? 0;
    if (delay > 0) await wait(delay);

    try {
      const audioResponse = await fetch(audioUri);
      const blob = await audioResponse.blob();
      if (blob.size > 0) {
        return {
          blob,
          attempts: attempt,
        };
      }
      lastError = new Error("Captured audio file is empty.");
    } catch (error) {
      lastError = error;
    }
  }

  const last = describeUnknownError(lastError);
  throw new ReciteLabAudioUploadError(
    last.errorMessage || "Could not read captured audio file.",
    {
      step:
        last.errorMessage === "Captured audio file is empty."
          ? "empty_local_audio"
          : "read_local_audio",
      audioUri,
      localReadAttempts: delays.length,
      ...last,
    },
  );
}

export async function uploadReciteLabAudio(
  attemptId: string,
  audioUri: string,
): Promise<UploadReciteLabAudioResult> {
  const startedAtMs = Date.now();
  const baseURL = getReciteLabLoggingBaseURL();
  if (!baseURL) {
    throw new ReciteLabAudioUploadError("Recite Lab logging URL unavailable.", {
      step: "base_url",
      audioUri,
      durationMs: Date.now() - startedAtMs,
    });
  }

  const { blob, attempts } = await readAudioBlobWithRetry(audioUri);
  const contentType = getAudioContentType(audioUri, blob);

  let response: Response;
  try {
    response = await fetch(
      `${baseURL}/api/dev/recite-lab/attempts/${encodeURIComponent(attemptId)}/audio`,
      {
        method: "POST",
        headers: {
          "Content-Type": contentType,
        },
        body: blob,
      },
    );
  } catch (error) {
    throw new ReciteLabAudioUploadError("Could not upload captured audio.", {
      step: "upload_request",
      audioUri,
      localBytes: blob.size,
      localContentType: contentType,
      localReadAttempts: attempts,
      durationMs: Date.now() - startedAtMs,
      ...describeUnknownError(error),
    });
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new ReciteLabAudioUploadError(
      responseText.trim() || `Recite Lab audio upload failed: ${response.status}`,
      {
        step: "server_response",
        audioUri,
        localBytes: blob.size,
        localContentType: contentType,
        localReadAttempts: attempts,
        durationMs: Date.now() - startedAtMs,
        responseStatus: response.status,
        responseText: responseText.slice(0, 500),
      },
    );
  }

  try {
    const parsed = JSON.parse(responseText) as UploadReciteLabAudioResult;
    return {
      ...parsed,
      localBytes: blob.size,
      localContentType: contentType,
      localReadAttempts: attempts,
      durationMs: Date.now() - startedAtMs,
    };
  } catch (error) {
    throw new ReciteLabAudioUploadError("Could not parse audio upload response.", {
      step: "parse_response",
      audioUri,
      localBytes: blob.size,
      localContentType: contentType,
      localReadAttempts: attempts,
      durationMs: Date.now() - startedAtMs,
      responseText: responseText.slice(0, 500),
      ...describeUnknownError(error),
    });
  }
}

export async function logReciteLabAudioUploadEvent(
  attemptId: string,
  payload: LogReciteLabAudioUploadEventPayload,
): Promise<void> {
  const baseURL = getReciteLabLoggingBaseURL();
  if (!baseURL) return;

  await fetch(
    `${baseURL}/api/dev/recite-lab/attempts/${encodeURIComponent(attemptId)}/audio-events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}
