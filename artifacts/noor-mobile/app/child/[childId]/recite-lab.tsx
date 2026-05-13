import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Constants from "expo-constants";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { MushafTestPageView } from "@/src/components/mushaf-test-page-view";
import { useAppTheme, type AppThemeColors } from "@/src/lib/app-theme";
import { clampMushafPage, getMushafPageForVerse } from "@/src/lib/mushaf";
import { fetchSurahVerses, type ApiWord } from "@/src/lib/quran";
import { stripTashkeel, tokenize } from "@/src/lib/recite";
import {
  compareReciteLabTokens,
  getReciteLabLiveProgress,
  getReciteLabPhraseTracker,
  RECITE_LAB_ALIGNMENT_VERSION,
  RECITE_LAB_PHRASE_TRACKER_VERSION,
  type ReciteLabAlignmentDecision,
  type ReciteLabAlignmentOp,
  type ReciteLabLiveEvent,
  type ReciteLabLiveStatus,
  type ReciteLabPhraseStatus,
} from "@/src/lib/recite-lab-align";
import {
  getReciteLabLoggingBaseURL,
  saveReciteLabAttempt,
  uploadReciteLabAudio,
  type ReciteLabAttemptLabel,
} from "@/src/lib/recite-lab";
import type { MushafViewMode } from "@/src/lib/settings";

type CaptureState = "idle" | "starting" | "listening" | "stopping";
type SaveState = "idle" | "saving" | "saved" | "error";
type AudioUploadState = "idle" | "uploading" | "uploaded" | "error" | "skipped";
type ExpectedScopeMode = "full" | "selectedAyah" | "customRange";

type LabWordTarget = {
  surah: number;
  ayah: number;
  position: number;
};

type ExpectedScopeTarget = {
  mode: ExpectedScopeMode;
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  label: string;
};

type LiveSnapshot = {
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
};

type PhraseSnapshot = {
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
};

const ATTEMPT_LABELS: Array<{ value: ReciteLabAttemptLabel; label: string }> = [
  { value: "correct", label: "Correct" },
  { value: "repeat", label: "Repeat" },
  { value: "skip", label: "Skip" },
  { value: "wrong", label: "Wrong" },
  { value: "noisy", label: "Noisy" },
];

const EXPECTED_SCOPE_OPTIONS: Array<{ value: ExpectedScopeMode; label: string }> = [
  { value: "full", label: "Full" },
  { value: "selectedAyah", label: "Ayah" },
  { value: "customRange", label: "Range" },
];

function parseRouteInt(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatAyahRange(start: number, end: number) {
  return start === end ? `Ayah ${start}` : `Ayahs ${start}-${end}`;
}

function clampAyah(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeExpectedWord(word: ApiWord) {
  return stripTashkeel(word.text_uthmani);
}

function getRecordingSupport() {
  try {
    return ExpoSpeechRecognitionModule.supportsRecording();
  } catch {
    return false;
  }
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function diffMs(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const delta = Date.parse(end) - Date.parse(start);
  return Number.isFinite(delta) && delta >= 0 ? delta : null;
}

function formatDuration(ms: number | null) {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 100 ? 0 : 1)} KB`;
  const mib = kib / 1024;
  return `${mib.toFixed(mib >= 100 ? 0 : 1)} MB`;
}

function getDecisionLabel(decision: ReciteLabAlignmentDecision) {
  switch (decision) {
    case "pass":
      return "Pass";
    case "repeat":
      return "Repeat";
    case "skip":
      return "Skip";
    case "wrong":
      return "Wrong";
    case "empty":
      return "Waiting";
    case "uncertain":
      return "Unclear";
  }
}

function getLiveStatusLabel(status: ReciteLabLiveStatus) {
  switch (status) {
    case "waiting":
      return "Wait";
    case "advancing":
      return "Advance";
    case "complete":
      return "Complete";
    case "repeat":
      return "Repeat";
    case "skip":
      return "Skip";
    case "mismatch":
      return "Mismatch";
  }
}

function getPhraseStatusLabel(status: ReciteLabPhraseStatus) {
  switch (status) {
    case "waiting":
      return "Wait";
    case "tracking":
      return "Tracking";
    case "complete":
      return "Complete";
    case "repeat":
      return "Repeat";
    case "uncertain":
      return "Unclear";
    case "off_track":
      return "Off";
  }
}

function describeIssue(issue: ReciteLabAlignmentOp) {
  if (issue.type === "missing") return `Missing ${issue.expected ?? ""}`.trim();
  if (issue.type === "extra") return `Extra ${issue.heard ?? ""}`.trim();
  if (issue.type === "substitute") {
    return `${issue.expected ?? ""} -> ${issue.heard ?? ""}`.trim();
  }
  return "";
}

function describeLiveEvent(event: ReciteLabLiveEvent) {
  if (event.type === "match") return `Accepted ${event.heard}`;
  if (event.type === "repeat") return `Repeat ${event.heard}`;
  if (event.type === "extra") return `Extra ${event.heard}`;
  if (event.type === "skip") {
    const skipped = event.skippedWords?.join(" ") ?? "";
    return skipped ? `Skipped ${skipped}` : `Skipped to ${event.heard}`;
  }
  return `${event.expected ?? ""} -> ${event.heard}`.trim();
}

export default function ReciteLabScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    childId: string;
    name?: string;
    surahNumber?: string;
    ayahStart?: string;
    ayahEnd?: string;
    endSurahNumber?: string;
    page?: string;
    mushafViewMode?: MushafViewMode;
  }>();

  const surahNumber = parseRouteInt(params.surahNumber, 1);
  const ayahStart = parseRouteInt(params.ayahStart, 1);
  const ayahEnd = Math.max(ayahStart, parseRouteInt(params.ayahEnd, ayahStart));
  const endSurahNumber = parseRouteInt(params.endSurahNumber, surahNumber);
  const fallbackPage = getMushafPageForVerse(surahNumber, ayahStart) ?? 1;
  const initialPage = clampMushafPage(parseRouteInt(params.page, fallbackPage));
  const mushafViewMode =
    params.mushafViewMode === "scroll" || params.mushafViewMode === "swipe"
      ? params.mushafViewMode
      : "swipe";

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [transcript, setTranscript] = useState("");
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [recordingSupported, setRecordingSupported] = useState(false);
  const [selectedWord, setSelectedWord] = useState<LabWordTarget | null>(null);
  const [expectedWordsByAyah, setExpectedWordsByAyah] = useState<Record<number, string[]>>({});
  const [expectedScopeMode, setExpectedScopeMode] = useState<ExpectedScopeMode>("full");
  const [customScopeStartAyah, setCustomScopeStartAyah] = useState(ayahStart);
  const [customScopeEndAyah, setCustomScopeEndAyah] = useState(ayahEnd);
  const [expectedLoading, setExpectedLoading] = useState(true);
  const [expectedError, setExpectedError] = useState<string | null>(null);
  const [attemptLabel, setAttemptLabel] = useState<ReciteLabAttemptLabel>("correct");
  const [autoSave, setAutoSave] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [audioUploadState, setAudioUploadState] = useState<AudioUploadState>("idle");
  const [audioUploadMessage, setAudioUploadMessage] = useState<string | null>(null);
  const [lastSavedAttemptKey, setLastSavedAttemptKey] = useState<string | null>(null);
  const [firstResultAt, setFirstResultAt] = useState<string | null>(null);
  const [liveSnapshotCount, setLiveSnapshotCount] = useState(0);
  const [phraseSnapshotCount, setPhraseSnapshotCount] = useState(0);
  const captureStartedAtRef = useRef<string | null>(null);
  const recognitionStartedAtRef = useRef<string | null>(null);
  const audioStartedAtRef = useRef<string | null>(null);
  const audioEndedAtRef = useRef<string | null>(null);
  const firstResultAtRef = useRef<string | null>(null);
  const lastResultAtRef = useRef<string | null>(null);
  const recognitionEndedAtRef = useRef<string | null>(null);
  const expectedWordsRef = useRef<string[]>([]);
  const liveSnapshotsRef = useRef<LiveSnapshot[]>([]);
  const phraseSnapshotsRef = useRef<PhraseSnapshot[]>([]);
  const lastAutoSavedKeyRef = useRef<string | null>(null);
  const lastSavedAttemptKeyRef = useRef<string | null>(null);

  const expectedScopeTarget = useMemo<ExpectedScopeTarget>(() => {
    if (expectedScopeMode === "selectedAyah") {
      const selectedAyah =
        selectedWord?.surah === surahNumber
          ? clampAyah(selectedWord.ayah, ayahStart, ayahEnd)
          : ayahStart;
      return {
        mode: expectedScopeMode,
        surahNumber,
        ayahStart: selectedAyah,
        ayahEnd: selectedAyah,
        label: `${surahNumber}:${selectedAyah}`,
      };
    }

    if (expectedScopeMode === "customRange") {
      const start = clampAyah(customScopeStartAyah, ayahStart, ayahEnd);
      const end = clampAyah(Math.max(start, customScopeEndAyah), ayahStart, ayahEnd);
      return {
        mode: expectedScopeMode,
        surahNumber,
        ayahStart: start,
        ayahEnd: end,
        label: `${surahNumber}:${start}${start === end ? "" : `-${end}`}`,
      };
    }

    return {
      mode: expectedScopeMode,
      surahNumber,
      ayahStart,
      ayahEnd,
      label: `${surahNumber}:${ayahStart}${ayahStart === ayahEnd ? "" : `-${ayahEnd}`}`,
    };
  }, [
    ayahEnd,
    ayahStart,
    customScopeEndAyah,
    customScopeStartAyah,
    expectedScopeMode,
    selectedWord,
    surahNumber,
  ]);
  const expectedWords = useMemo(() => {
    const words: string[] = [];
    for (
      let ayah = expectedScopeTarget.ayahStart;
      ayah <= expectedScopeTarget.ayahEnd;
      ayah += 1
    ) {
      words.push(...(expectedWordsByAyah[ayah] ?? []));
    }
    return words;
  }, [expectedScopeTarget, expectedWordsByAyah]);

  const normalizedTranscript = useMemo(() => stripTashkeel(transcript), [transcript]);
  const transcriptTokens = useMemo(
    () => tokenize(normalizedTranscript),
    [normalizedTranscript],
  );
  const liveProgress = useMemo(
    () => getReciteLabLiveProgress(expectedWords, transcriptTokens),
    [expectedWords, transcriptTokens],
  );
  const phraseTracker = useMemo(
    () => getReciteLabPhraseTracker(expectedWords, transcriptTokens),
    [expectedWords, transcriptTokens],
  );
  const comparison = useMemo(
    () => compareReciteLabTokens(expectedWords, transcriptTokens),
    [expectedWords, transcriptTokens],
  );
  const currentAttemptKey = useMemo(() => {
    const startedAt = captureStartedAtRef.current;
    const trimmedTranscript = transcript.trim();
    return startedAt && trimmedTranscript
      ? `${startedAt}:${expectedScopeTarget.mode}:${expectedScopeTarget.ayahStart}-${expectedScopeTarget.ayahEnd}:${trimmedTranscript}`
      : null;
  }, [expectedScopeTarget, transcript]);
  const currentAttemptSaved =
    currentAttemptKey !== null && lastSavedAttemptKey === currentAttemptKey;
  const expectedContextStrings = useMemo(() => {
    const normalized = expectedWords.map((word) => stripTashkeel(word)).filter(Boolean);
    return Array.from(new Set([...expectedWords, ...normalized])).slice(0, 80);
  }, [expectedWords]);
  const loggingBaseURL = useMemo(() => getReciteLabLoggingBaseURL(), []);

  useEffect(() => {
    setRecordingSupported(getRecordingSupport());
  }, []);

  useEffect(() => {
    expectedWordsRef.current = expectedWords;
  }, [expectedWords]);

  useEffect(() => {
    let cancelled = false;
    setExpectedLoading(true);
    setExpectedError(null);
    fetchSurahVerses(surahNumber)
      .then((verses) => {
        if (cancelled) return;
        const wordsByAyah = Object.fromEntries(
          verses
            .filter((verse) => verse.verse_number >= ayahStart && verse.verse_number <= ayahEnd)
            .map((verse) => [
              verse.verse_number,
              verse.words
                .filter((word) => word.char_type_name === "word")
                .map(normalizeExpectedWord)
                .filter(Boolean),
            ]),
        );
        setExpectedWordsByAyah(wordsByAyah);
      })
      .catch((error) => {
        if (cancelled) return;
        setExpectedError(error instanceof Error ? error.message : "Expected words unavailable.");
        setExpectedWordsByAyah({});
      })
      .finally(() => {
        if (!cancelled) setExpectedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ayahEnd, ayahStart, surahNumber]);

  useEffect(() => {
    setExpectedScopeMode("full");
    setCustomScopeStartAyah(ayahStart);
    setCustomScopeEndAyah(ayahEnd);
    setSelectedWord(null);
  }, [ayahEnd, ayahStart, surahNumber]);

  useEffect(() => {
    return () => {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // Best-effort cleanup for this isolated lab route.
      }
    };
  }, []);

  function buildTiming(clientSavedAt: string, captureStartedAt: string) {
    return {
      captureStartedAt,
      recognitionStartedAt: recognitionStartedAtRef.current,
      audioStartedAt: audioStartedAtRef.current,
      firstResultAt: firstResultAtRef.current,
      lastResultAt: lastResultAtRef.current,
      audioEndedAt: audioEndedAtRef.current,
      recognitionEndedAt: recognitionEndedAtRef.current,
      clientSavedAt,
      firstResultLatencyMs: diffMs(captureStartedAt, firstResultAtRef.current),
      recognitionDurationMs: diffMs(
        recognitionStartedAtRef.current ?? captureStartedAt,
        recognitionEndedAtRef.current ?? clientSavedAt,
      ),
      audioDurationMs: diffMs(audioStartedAtRef.current, audioEndedAtRef.current),
      saveDelayMs: diffMs(lastResultAtRef.current ?? recognitionEndedAtRef.current, clientSavedAt),
    };
  }

  function appendLiveSnapshot(rawTranscript: string, timestamp: string) {
    const snapshotTokens = tokenize(stripTashkeel(rawTranscript));
    const snapshotProgress = getReciteLabLiveProgress(expectedWordsRef.current, snapshotTokens);
    const snapshotPhrase = getReciteLabPhraseTracker(expectedWordsRef.current, snapshotTokens);
    const snapshot: LiveSnapshot = {
      timestamp,
      elapsedMs: diffMs(captureStartedAtRef.current, timestamp),
      status: snapshotProgress.status,
      acceptedCount: snapshotProgress.acceptedCount,
      expectedCount: snapshotProgress.expectedCount,
      transcriptTokenCount: snapshotTokens.length,
      nextExpectedWord: snapshotProgress.nextExpectedWord,
      nextExpectedIndex: snapshotProgress.nextExpectedIndex,
      lastHeardWord: snapshotProgress.lastHeardWord,
      repeatCount: snapshotProgress.repeatCount,
      skippedCount: snapshotProgress.skippedCount,
      mismatchCount: snapshotProgress.mismatchCount,
      firstBlockingEventType: snapshotProgress.firstBlockingEvent?.type ?? null,
    };
    const previous = liveSnapshotsRef.current[liveSnapshotsRef.current.length - 1] ?? null;
    const liveDuplicate =
      previous &&
      previous.status === snapshot.status &&
      previous.acceptedCount === snapshot.acceptedCount &&
      previous.transcriptTokenCount === snapshot.transcriptTokenCount &&
      previous.nextExpectedIndex === snapshot.nextExpectedIndex &&
      previous.lastHeardWord === snapshot.lastHeardWord;
    if (!liveDuplicate) {
      liveSnapshotsRef.current = [...liveSnapshotsRef.current, snapshot].slice(-80);
      setLiveSnapshotCount(liveSnapshotsRef.current.length);
    }

    const phraseSnapshot: PhraseSnapshot = {
      timestamp,
      elapsedMs: diffMs(captureStartedAtRef.current, timestamp),
      status: snapshotPhrase.status,
      acceptedCount: snapshotPhrase.acceptedCount,
      expectedCount: snapshotPhrase.expectedCount,
      transcriptTokenCount: snapshotTokens.length,
      nextExpectedWord: snapshotPhrase.nextExpectedWord,
      nextExpectedIndex: snapshotPhrase.nextExpectedIndex,
      confidence: snapshotPhrase.confidence,
      recentPhrase: snapshotPhrase.recentPhrase,
    };
    const previousPhrase =
      phraseSnapshotsRef.current[phraseSnapshotsRef.current.length - 1] ?? null;
    if (
      previousPhrase &&
      previousPhrase.status === phraseSnapshot.status &&
      previousPhrase.acceptedCount === phraseSnapshot.acceptedCount &&
      previousPhrase.transcriptTokenCount === phraseSnapshot.transcriptTokenCount &&
      previousPhrase.nextExpectedIndex === phraseSnapshot.nextExpectedIndex
    ) {
      return;
    }

    phraseSnapshotsRef.current = [...phraseSnapshotsRef.current, phraseSnapshot].slice(-80);
    setPhraseSnapshotCount(phraseSnapshotsRef.current.length);
  }

  const saveCurrentAttempt = useCallback(
    async (saveMode: "auto" | "manual") => {
      const trimmedTranscript = transcript.trim();
      if (!trimmedTranscript) {
        if (saveMode === "manual") {
          setSaveState("error");
          setSaveMessage("Nothing to save yet.");
        }
        return;
      }
      if (expectedLoading || expectedWords.length === 0) {
        if (saveMode === "manual") {
          setSaveState("error");
          setSaveMessage("Expected words are still loading.");
        }
        return;
      }

      try {
        setSaveState("saving");
        setSaveMessage(null);
        const clientSavedAt = new Date().toISOString();
        const clientRecordedAt = captureStartedAtRef.current ?? clientSavedAt;
        const attemptKey = `${clientRecordedAt}:${expectedScopeTarget.mode}:${expectedScopeTarget.ayahStart}-${expectedScopeTarget.ayahEnd}:${trimmedTranscript}`;
        if (lastSavedAttemptKeyRef.current === attemptKey) {
          setSaveState("saved");
          if (saveMode === "manual") setSaveMessage("Already saved");
          return;
        }
        const result = await saveReciteLabAttempt({
          algorithmVersions: {
            alignment: RECITE_LAB_ALIGNMENT_VERSION,
            liveProgress: RECITE_LAB_ALIGNMENT_VERSION,
            phraseTracker: RECITE_LAB_PHRASE_TRACKER_VERSION,
            logging: "recite-lab-logging-v0.5",
          },
          label: attemptLabel,
          saveMode,
          clientRecordedAt,
          clientSavedAt,
          timing: buildTiming(clientSavedAt, clientRecordedAt),
          route: {
            surahNumber,
            ayahStart,
            ayahEnd,
            endSurahNumber,
            page: currentPage,
            mushafViewMode,
          },
          expectedScope: {
            mode: expectedScopeTarget.mode,
            surahNumber: expectedScopeTarget.surahNumber,
            ayahStart: expectedScopeTarget.ayahStart,
            ayahEnd: expectedScopeTarget.ayahEnd,
            label: expectedScopeTarget.label,
            routeAyahStart: ayahStart,
            routeAyahEnd: ayahEnd,
            selectedWord,
          },
          expectedWords,
          expectedWordCount: expectedWords.length,
          transcript: trimmedTranscript,
          normalizedTranscript,
          transcriptTokens,
          heardTokenCount: transcriptTokens.length,
          liveSnapshots: liveSnapshotsRef.current,
          liveProgress,
          phraseSnapshots: phraseSnapshotsRef.current,
          phraseTracker,
          comparison,
          audioUri,
          recordingSupported,
          deviceSessionId: Constants.sessionId ?? null,
        });
        lastSavedAttemptKeyRef.current = attemptKey;
        setLastSavedAttemptKey(attemptKey);
        setSaveState("saved");
        setSaveMessage(`Saved ${result.id.slice(0, 8)}`);

        if (audioUri) {
          setAudioUploadState("uploading");
          setAudioUploadMessage(null);
          try {
            const audioResult = await uploadReciteLabAudio(result.id, audioUri);
            setAudioUploadState("uploaded");
            setAudioUploadMessage(`Uploaded ${formatBytes(audioResult.bytes)}`);
          } catch (audioError) {
            setAudioUploadState("error");
            setAudioUploadMessage(
              audioError instanceof Error ? audioError.message : "Audio upload failed.",
            );
          }
        } else {
          setAudioUploadState("skipped");
          setAudioUploadMessage(recordingSupported ? "No audio file" : "Unsupported");
        }
      } catch (error) {
        setSaveState("error");
        setSaveMessage(error instanceof Error ? error.message : "Save failed.");
      }
    },
    [
      attemptLabel,
      audioUri,
      ayahEnd,
      ayahStart,
      comparison,
      currentPage,
      endSurahNumber,
      expectedWords,
      expectedLoading,
      expectedScopeTarget,
      lastSavedAttemptKey,
      liveProgress,
      phraseTracker,
      mushafViewMode,
      normalizedTranscript,
      recordingSupported,
      surahNumber,
      selectedWord,
      transcript,
      transcriptTokens,
    ],
  );

  useEffect(() => {
    if (
      !autoSave ||
      captureState !== "idle" ||
      expectedLoading ||
      expectedWords.length === 0 ||
      !transcript.trim()
    ) return;
    const startedAt = captureStartedAtRef.current;
    if (!startedAt) return;
    const autoSaveKey = `${startedAt}:${expectedScopeTarget.mode}:${expectedScopeTarget.ayahStart}-${expectedScopeTarget.ayahEnd}:${transcript.trim()}`;
    if (
      lastAutoSavedKeyRef.current === autoSaveKey ||
      lastSavedAttemptKeyRef.current === autoSaveKey ||
      saveState === "saving"
    ) return;

    const timeout = setTimeout(() => {
      lastAutoSavedKeyRef.current = autoSaveKey;
      void saveCurrentAttempt("auto");
    }, 650);

    return () => {
      clearTimeout(timeout);
    };
  }, [
    autoSave,
    captureState,
    expectedLoading,
    expectedWords.length,
    expectedScopeTarget,
    saveCurrentAttempt,
    saveState,
    transcript,
  ]);

  useSpeechRecognitionEvent("start", () => {
    recognitionStartedAtRef.current = new Date().toISOString();
    setCaptureState("listening");
    setCaptureError(null);
  });

  useSpeechRecognitionEvent("audiostart", (event) => {
    audioStartedAtRef.current = new Date().toISOString();
    setAudioUri(event.uri);
  });

  useSpeechRecognitionEvent("audioend", (event) => {
    audioEndedAtRef.current = new Date().toISOString();
    setAudioUri(event.uri);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const result = event.results?.[0];
    if (!result) return;
    const nextTranscript = result.transcript ?? "";
    const now = new Date().toISOString();
    if (!firstResultAtRef.current) {
      firstResultAtRef.current = now;
      setFirstResultAt(now);
    }
    lastResultAtRef.current = now;
    appendLiveSnapshot(nextTranscript, now);
    setTranscript(nextTranscript);
  });

  useSpeechRecognitionEvent("error", (event) => {
    recognitionEndedAtRef.current = new Date().toISOString();
    setCaptureState("idle");
    setCaptureError(event.message ?? event.error ?? "Recognition error.");
  });

  useSpeechRecognitionEvent("end", () => {
    recognitionEndedAtRef.current = new Date().toISOString();
    setCaptureState("idle");
  });

  async function startCapture() {
    try {
      setCaptureError(null);
      setAudioUri(null);
      setTranscript("");
      setSaveState("idle");
      setSaveMessage(null);
      setAudioUploadState("idle");
      setAudioUploadMessage(null);
      setLastSavedAttemptKey(null);
      setFirstResultAt(null);
      setLiveSnapshotCount(0);
      setPhraseSnapshotCount(0);
      recognitionStartedAtRef.current = null;
      audioStartedAtRef.current = null;
      audioEndedAtRef.current = null;
      firstResultAtRef.current = null;
      lastResultAtRef.current = null;
      recognitionEndedAtRef.current = null;
      liveSnapshotsRef.current = [];
      phraseSnapshotsRef.current = [];
      lastAutoSavedKeyRef.current = null;
      lastSavedAttemptKeyRef.current = null;
      captureStartedAtRef.current = new Date().toISOString();
      setCaptureState("starting");
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setCaptureState("idle");
        setCaptureError("Microphone or speech recognition permission denied.");
        Alert.alert(
          "Permission needed",
          "NoorPath needs microphone and speech recognition access for Recite Lab.",
        );
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: "ar-SA",
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: false,
        contextualStrings: expectedContextStrings,
        ...(recordingSupported ? { recordingOptions: { persist: true } } : {}),
      });
    } catch (error) {
      setCaptureState("idle");
      setCaptureError(error instanceof Error ? error.message : "Could not start Recite Lab.");
    }
  }

  function stopCapture() {
    setCaptureState("stopping");
    ExpoSpeechRecognitionModule.stop();
  }

  function scopeControlsLocked() {
    return captureState === "starting" || captureState === "listening" || captureState === "stopping";
  }

  function chooseExpectedScopeMode(mode: ExpectedScopeMode) {
    if (scopeControlsLocked()) return;
    setExpectedScopeMode(mode);
  }

  function adjustCustomScopeStart(delta: number) {
    if (scopeControlsLocked()) return;
    setCustomScopeStartAyah((current) => {
      const next = clampAyah(current + delta, ayahStart, customScopeEndAyah);
      return next;
    });
  }

  function adjustCustomScopeEnd(delta: number) {
    if (scopeControlsLocked()) return;
    setCustomScopeEndAyah((current) => {
      const next = clampAyah(current + delta, customScopeStartAyah, ayahEnd);
      return next;
    });
  }

  function handleWordPress(target: LabWordTarget) {
    setSelectedWord(target);
  }

  const listening = captureState === "listening" || captureState === "starting";
  const scopeLocked = scopeControlsLocked();
  const canSave =
    transcript.trim().length > 0 &&
    !expectedLoading &&
    expectedWords.length > 0 &&
    !currentAttemptSaved &&
    saveState !== "saving";
  const firstResultLatencyMs = diffMs(captureStartedAtRef.current, firstResultAt);
  const loggingLabel = loggingBaseURL ? loggingBaseURL.replace(/^https?:\/\//, "") : "off";
  const audioUploadLabel =
    audioUploadMessage ??
    (audioUploadState === "uploading"
      ? "Uploading..."
      : audioUploadState === "uploaded"
        ? "Uploaded"
        : audioUploadState === "error"
          ? "Failed"
          : audioUploadState === "skipped"
            ? "Skipped"
            : "Waiting");
  const decisionBadgeStyle = [
    styles.decisionBadge,
    comparison.decision === "pass" && styles.decisionBadgePass,
    comparison.decision === "repeat" && styles.decisionBadgeRepeat,
    comparison.decision === "skip" && styles.decisionBadgeSkip,
    comparison.decision === "wrong" && styles.decisionBadgeWrong,
  ];
  const decisionTextStyle = [
    styles.decisionBadgeText,
    comparison.decision === "pass" && styles.decisionBadgeTextPass,
    comparison.decision === "repeat" && styles.decisionBadgeTextRepeat,
    comparison.decision === "skip" && styles.decisionBadgeTextSkip,
    comparison.decision === "wrong" && styles.decisionBadgeTextWrong,
  ];
  const liveBadgeStyle = [
    styles.decisionBadge,
    (liveProgress.status === "advancing" || liveProgress.status === "complete") &&
      styles.decisionBadgePass,
    (liveProgress.status === "repeat" || liveProgress.status === "skip") &&
      styles.decisionBadgeRepeat,
    liveProgress.status === "mismatch" && styles.decisionBadgeWrong,
  ];
  const liveBadgeTextStyle = [
    styles.decisionBadgeText,
    (liveProgress.status === "advancing" || liveProgress.status === "complete") &&
      styles.decisionBadgeTextPass,
    (liveProgress.status === "repeat" || liveProgress.status === "skip") &&
      styles.decisionBadgeTextRepeat,
    liveProgress.status === "mismatch" && styles.decisionBadgeTextWrong,
  ];
  const phraseBadgeStyle = [
    styles.decisionBadge,
    (phraseTracker.status === "tracking" || phraseTracker.status === "complete") &&
      styles.decisionBadgePass,
    (phraseTracker.status === "repeat" || phraseTracker.status === "uncertain") &&
      styles.decisionBadgeRepeat,
    phraseTracker.status === "off_track" && styles.decisionBadgeWrong,
  ];
  const phraseBadgeTextStyle = [
    styles.decisionBadgeText,
    (phraseTracker.status === "tracking" || phraseTracker.status === "complete") &&
      styles.decisionBadgeTextPass,
    (phraseTracker.status === "repeat" || phraseTracker.status === "uncertain") &&
      styles.decisionBadgeTextRepeat,
    phraseTracker.status === "off_track" && styles.decisionBadgeTextWrong,
  ];
  const rangeLabel =
    endSurahNumber === surahNumber
      ? `${surahNumber} · ${formatAyahRange(ayahStart, ayahEnd)}`
      : `${surahNumber}:${ayahStart} to ${endSurahNumber}:${ayahEnd}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Return to memorization"
        >
          <Ionicons name="chevron-back" size={21} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Recite Lab</Text>
          <Text style={styles.headerSubtitle}>{rangeLabel}</Text>
        </View>
        <View style={styles.headerButtonPlaceholder} />
      </View>

      <View style={styles.mushafPane}>
        <MushafTestPageView
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          mushafViewMode={mushafViewMode}
          sessionFocusRange={{
            startSurah: surahNumber,
            startAyah: ayahStart,
            endSurah: endSurahNumber,
            endAyah: ayahEnd,
          }}
          onWordPress={handleWordPress}
        />
      </View>

      <View style={styles.labPanel}>
        <View style={styles.captureRow}>
          <Pressable
            style={[styles.primaryButton, listening && styles.stopButton]}
            onPress={listening ? stopCapture : startCapture}
            accessibilityRole="button"
            accessibilityLabel={listening ? "Stop Recite Lab capture" : "Start Recite Lab capture"}
          >
            {captureState === "starting" || captureState === "stopping" ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Ionicons
                name={listening ? "stop" : "mic-outline"}
                size={19}
                color="#ffffff"
              />
            )}
            <Text style={styles.primaryButtonText}>{listening ? "Stop" : "Start"}</Text>
          </Pressable>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, listening && styles.statusDotActive]} />
            <Text style={styles.statusText}>{listening ? "Listening" : "Ready"}</Text>
          </View>
        </View>

        <ScrollView style={styles.details} contentContainerStyle={styles.detailsContent}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Page</Text>
            <Text style={styles.detailValue}>{currentPage}</Text>
          </View>
          <View style={styles.scopeCard}>
            <View style={styles.scopeHeader}>
              <Text style={styles.scopeTitle}>Expected Scope</Text>
              <Text style={styles.scopeValue}>{expectedScopeTarget.label}</Text>
            </View>
            <View style={styles.scopeModeRow}>
              {EXPECTED_SCOPE_OPTIONS.map((option) => {
                const selected = expectedScopeMode === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.scopeModeButton,
                      selected && styles.scopeModeButtonSelected,
                      scopeLocked && styles.scopeModeButtonDisabled,
                    ]}
                    disabled={scopeLocked}
                    onPress={() => chooseExpectedScopeMode(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: scopeLocked }}
                    accessibilityLabel={`Use ${option.label} expected scope`}
                  >
                    <Text
                      style={[
                        styles.scopeModeButtonText,
                        selected && styles.scopeModeButtonTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {expectedScopeMode === "customRange" ? (
              <View style={styles.scopeStepperRow}>
                <View style={styles.scopeStepper}>
                  <Text style={styles.scopeStepperLabel}>Start</Text>
                  <View style={styles.scopeStepperControls}>
                    <Pressable
                      style={[
                        styles.scopeIconButton,
                        (scopeLocked || customScopeStartAyah <= ayahStart) &&
                          styles.scopeIconButtonDisabled,
                      ]}
                      disabled={scopeLocked || customScopeStartAyah <= ayahStart}
                      onPress={() => adjustCustomScopeStart(-1)}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease expected range start ayah"
                    >
                      <Ionicons name="remove" size={14} color={colors.text} />
                    </Pressable>
                    <Text style={styles.scopeStepperValue}>{expectedScopeTarget.ayahStart}</Text>
                    <Pressable
                      style={[
                        styles.scopeIconButton,
                        (scopeLocked || customScopeStartAyah >= customScopeEndAyah) &&
                          styles.scopeIconButtonDisabled,
                      ]}
                      disabled={scopeLocked || customScopeStartAyah >= customScopeEndAyah}
                      onPress={() => adjustCustomScopeStart(1)}
                      accessibilityRole="button"
                      accessibilityLabel="Increase expected range start ayah"
                    >
                      <Ionicons name="add" size={14} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.scopeStepper}>
                  <Text style={styles.scopeStepperLabel}>End</Text>
                  <View style={styles.scopeStepperControls}>
                    <Pressable
                      style={[
                        styles.scopeIconButton,
                        (scopeLocked || customScopeEndAyah <= customScopeStartAyah) &&
                          styles.scopeIconButtonDisabled,
                      ]}
                      disabled={scopeLocked || customScopeEndAyah <= customScopeStartAyah}
                      onPress={() => adjustCustomScopeEnd(-1)}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease expected range end ayah"
                    >
                      <Ionicons name="remove" size={14} color={colors.text} />
                    </Pressable>
                    <Text style={styles.scopeStepperValue}>{expectedScopeTarget.ayahEnd}</Text>
                    <Pressable
                      style={[
                        styles.scopeIconButton,
                        (scopeLocked || customScopeEndAyah >= ayahEnd) &&
                          styles.scopeIconButtonDisabled,
                      ]}
                      disabled={scopeLocked || customScopeEndAyah >= ayahEnd}
                      onPress={() => adjustCustomScopeEnd(1)}
                      accessibilityRole="button"
                      accessibilityLabel="Increase expected range end ayah"
                    >
                      <Ionicons name="add" size={14} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expected</Text>
            <Text style={styles.detailValue}>
              {expectedLoading
                ? "Loading..."
                : expectedError
                  ? "Unavailable"
                  : `${expectedWords.length} words`}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Heard</Text>
            <Text style={styles.detailValue}>{transcriptTokens.length} tokens</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>First result</Text>
            <Text style={styles.detailValue}>{formatDuration(firstResultLatencyMs)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Snapshots</Text>
            <Text style={styles.detailValue}>{liveSnapshotCount}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phrase snaps</Text>
            <Text style={styles.detailValue}>{phraseSnapshotCount}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Audio</Text>
            <Text style={styles.detailValue}>
              {audioUri ? "Captured locally" : recordingSupported ? "Armed" : "Transcript only"}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Audio upload</Text>
            <Text
              style={[
                styles.detailValue,
                audioUploadState === "uploaded" && styles.detailValueOk,
                audioUploadState === "error" && styles.detailValueError,
              ]}
              numberOfLines={1}
            >
              {audioUploadLabel}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Logging</Text>
            <Text style={styles.detailValue}>{loggingLabel}</Text>
          </View>
          <View style={styles.liveProgressCard}>
            <View style={styles.comparisonHeader}>
              <View>
                <Text style={styles.comparisonTitle}>Phrase Tracker</Text>
                <Text style={styles.comparisonMeta}>
                  Cursor {phraseTracker.acceptedCount}/{phraseTracker.expectedCount} |{" "}
                  {formatPercent(phraseTracker.confidence)}
                </Text>
              </View>
              <View style={phraseBadgeStyle}>
                <Text style={phraseBadgeTextStyle}>
                  {getPhraseStatusLabel(phraseTracker.status)}
                </Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(phraseTracker.progressRatio * 100)}%` },
                ]}
              />
            </View>
            <View style={styles.liveWordRow}>
              <View style={styles.liveWordBlock}>
                <Text style={styles.liveWordLabel}>Through</Text>
                <Text style={styles.liveWordValue} numberOfLines={1}>
                  {phraseTracker.acceptedThroughIndex
                    ? `${phraseTracker.acceptedThroughIndex}. ${
                        phraseTracker.acceptedThroughWord ?? ""
                      }`
                    : "-"}
                </Text>
              </View>
              <View style={styles.liveWordBlock}>
                <Text style={styles.liveWordLabel}>Next</Text>
                <Text style={styles.liveWordValue} numberOfLines={1}>
                  {phraseTracker.nextExpectedIndex
                    ? `${phraseTracker.nextExpectedIndex}. ${
                        phraseTracker.nextExpectedWord ?? ""
                      }`
                    : "-"}
                </Text>
              </View>
            </View>
            <Text style={styles.liveReason}>{phraseTracker.holdReason}</Text>
            <View style={styles.comparisonStatsRow}>
              <Text style={styles.comparisonStat}>
                Missing {phraseTracker.missingBeforeCursorCount}
              </Text>
              <Text style={styles.comparisonStat}>
                Extra {phraseTracker.extraBeforeCursorCount}
              </Text>
              <Text style={styles.comparisonStat}>
                Fuzzy {phraseTracker.substituteBeforeCursorCount}
              </Text>
            </View>
            {phraseTracker.leadingBismillahIgnored ? (
              <Text style={styles.comparisonNote}>
                Leading Bismillah ignored for phrase tracking.
              </Text>
            ) : null}
            {phraseTracker.recentPhrase ? (
              <Text style={styles.issueText} numberOfLines={1}>
                {phraseTracker.recentPhrase}
              </Text>
            ) : null}
          </View>
          <View style={styles.liveProgressCard}>
            <View style={styles.comparisonHeader}>
              <View>
                <Text style={styles.comparisonTitle}>Live Progress</Text>
                <Text style={styles.comparisonMeta}>
                  Accepted {liveProgress.acceptedCount}/{liveProgress.expectedCount}
                </Text>
              </View>
              <View style={liveBadgeStyle}>
                <Text style={liveBadgeTextStyle}>{getLiveStatusLabel(liveProgress.status)}</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(liveProgress.progressRatio * 100)}%` },
                ]}
              />
            </View>
            <View style={styles.liveWordRow}>
              <View style={styles.liveWordBlock}>
                <Text style={styles.liveWordLabel}>Through</Text>
                <Text style={styles.liveWordValue} numberOfLines={1}>
                  {liveProgress.acceptedThroughIndex
                    ? `${liveProgress.acceptedThroughIndex}. ${liveProgress.acceptedThroughWord ?? ""}`
                    : "-"}
                </Text>
              </View>
              <View style={styles.liveWordBlock}>
                <Text style={styles.liveWordLabel}>Next</Text>
                <Text style={styles.liveWordValue} numberOfLines={1}>
                  {liveProgress.nextExpectedIndex
                    ? `${liveProgress.nextExpectedIndex}. ${liveProgress.nextExpectedWord ?? ""}`
                    : "-"}
                </Text>
              </View>
            </View>
            <Text style={styles.liveReason}>{liveProgress.holdReason}</Text>
            <View style={styles.comparisonStatsRow}>
              <Text style={styles.comparisonStat}>Repeat {liveProgress.repeatCount}</Text>
              <Text style={styles.comparisonStat}>Skip {liveProgress.skippedCount}</Text>
              <Text style={styles.comparisonStat}>Mismatch {liveProgress.mismatchCount}</Text>
            </View>
            {liveProgress.leadingBismillahIgnored ? (
              <Text style={styles.comparisonNote}>Leading Bismillah ignored for live progress.</Text>
            ) : null}
            {liveProgress.recentEvents.length > 0 ? (
              <View style={styles.issueList}>
                {liveProgress.recentEvents.slice(-3).map((event, index) => (
                  <Text
                    key={`${event.type}-${event.expectedIndex ?? "x"}-${event.heardIndex}-${index}`}
                    style={styles.issueText}
                    numberOfLines={1}
                  >
                    {describeLiveEvent(event)}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonHeader}>
              <View>
                <Text style={styles.comparisonTitle}>Alignment</Text>
                <Text style={styles.comparisonMeta}>
                  {comparison.matchedCount}/{comparison.expectedCount} matched |{" "}
                  {formatPercent(comparison.score)}
                </Text>
              </View>
              <View style={decisionBadgeStyle}>
                <Text style={decisionTextStyle}>{getDecisionLabel(comparison.decision)}</Text>
              </View>
            </View>
            <View style={styles.comparisonStatsRow}>
              <Text style={styles.comparisonStat}>Missing {comparison.missingCount}</Text>
              <Text style={styles.comparisonStat}>Extra {comparison.extraCount}</Text>
              <Text style={styles.comparisonStat}>Wrong {comparison.substituteCount}</Text>
            </View>
            {comparison.leadingBismillahIgnored ? (
              <Text style={styles.comparisonNote}>Leading Bismillah ignored for this range.</Text>
            ) : null}
            {comparison.firstIssues.length > 0 ? (
              <View style={styles.issueList}>
                {comparison.firstIssues.slice(0, 3).map((issue, index) => (
                  <Text
                    key={`${issue.type}-${issue.expectedIndex ?? "x"}-${issue.heardIndex ?? "x"}-${index}`}
                    style={styles.issueText}
                    numberOfLines={1}
                  >
                    {describeIssue(issue)}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
          <View style={styles.labelRow}>
            {ATTEMPT_LABELS.map((item) => {
              const selected = attemptLabel === item.value;
              return (
                <Pressable
                  key={item.value}
                  style={[styles.labelPill, selected && styles.labelPillSelected]}
                  onPress={() => setAttemptLabel(item.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Mark attempt as ${item.label}`}
                >
                  <Text style={[styles.labelPillText, selected && styles.labelPillTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.saveRow}>
            <Pressable
              style={[styles.autoSavePill, autoSave && styles.autoSavePillActive]}
              onPress={() => setAutoSave((value) => !value)}
              accessibilityRole="button"
              accessibilityState={{ selected: autoSave }}
              accessibilityLabel={autoSave ? "Turn auto save off" : "Turn auto save on"}
            >
              <Ionicons
                name={autoSave ? "checkmark-circle" : "ellipse-outline"}
                size={15}
                color={autoSave ? colors.success : colors.textMuted}
              />
              <Text style={[styles.autoSaveText, autoSave && styles.autoSaveTextActive]}>
                Auto-save
              </Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
              disabled={!canSave}
              onPress={() => {
                void saveCurrentAttempt("manual");
              }}
              accessibilityRole="button"
              accessibilityLabel="Save Recite Lab attempt"
            >
              {saveState === "saving" ? (
                <ActivityIndicator color="#ffffff" />
              ) : currentAttemptSaved ? (
                <Ionicons name="checkmark" size={15} color="#ffffff" />
              ) : (
                <Ionicons name="save-outline" size={15} color="#ffffff" />
              )}
              <Text style={styles.saveButtonText}>
                {saveState === "saving" ? "Saving" : currentAttemptSaved ? "Saved" : "Save"}
              </Text>
            </Pressable>
          </View>
          {saveMessage ? (
            <Text
              style={[
                styles.saveMessage,
                saveState === "error" ? styles.saveMessageError : styles.saveMessageOk,
              ]}
            >
              {saveMessage}
            </Text>
          ) : null}
          {selectedWord ? (
            <View style={styles.wordCard}>
              <Text style={styles.wordCardLabel}>Selected word</Text>
              <Text style={styles.wordCardText}>
                {selectedWord.surah}:{selectedWord.ayah} word {selectedWord.position}
              </Text>
            </View>
          ) : null}
          {transcript ? (
            <View style={styles.transcriptCard}>
              <Text style={styles.transcriptLabel}>Transcript</Text>
              <Text style={styles.transcriptText}>{transcript}</Text>
            </View>
          ) : null}
          {captureError ? <Text style={styles.errorText}>{captureError}</Text> : null}
          {expectedError ? <Text style={styles.errorText}>{expectedError}</Text> : null}
        </ScrollView>
      </View>
    </View>
  );
}

function makeStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      minHeight: 72,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    headerButtonPlaceholder: {
      width: 42,
      height: 42,
    },
    headerTitleBlock: {
      flex: 1,
      alignItems: "center",
      gap: 2,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textMuted,
    },
    mushafPane: {
      flex: 1,
      minHeight: 260,
    },
    labPanel: {
      maxHeight: 330,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
    },
    captureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 10,
    },
    primaryButton: {
      minHeight: 44,
      borderRadius: 12,
      paddingHorizontal: 18,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    stopButton: {
      backgroundColor: colors.danger,
    },
    primaryButtonText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "900",
    },
    statusPill: {
      minHeight: 36,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.surfaceSubtle,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.textSubtle,
    },
    statusDotActive: {
      backgroundColor: colors.success,
    },
    statusText: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.textMuted,
    },
    details: {
      flexGrow: 0,
    },
    detailsContent: {
      gap: 8,
      paddingBottom: 4,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    detailLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textMuted,
    },
    detailValue: {
      flexShrink: 1,
      textAlign: "right",
      fontSize: 12,
      fontWeight: "900",
      color: colors.text,
    },
    detailValueOk: {
      color: colors.success,
    },
    detailValueError: {
      color: colors.danger,
    },
    scopeCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
      padding: 10,
      gap: 8,
    },
    scopeHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    scopeTitle: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.text,
    },
    scopeValue: {
      flexShrink: 1,
      textAlign: "right",
      fontSize: 12,
      fontWeight: "900",
      color: colors.primary,
    },
    scopeModeRow: {
      flexDirection: "row",
      gap: 6,
    },
    scopeModeButton: {
      flex: 1,
      minHeight: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    scopeModeButtonSelected: {
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primarySoft,
    },
    scopeModeButtonDisabled: {
      opacity: 0.6,
    },
    scopeModeButtonText: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.textMuted,
    },
    scopeModeButtonTextSelected: {
      color: colors.primary,
    },
    scopeStepperRow: {
      flexDirection: "row",
      gap: 8,
    },
    scopeStepper: {
      flex: 1,
      gap: 5,
    },
    scopeStepperLabel: {
      fontSize: 10,
      fontWeight: "900",
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    scopeStepperControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    scopeIconButton: {
      width: 30,
      height: 30,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    scopeIconButtonDisabled: {
      opacity: 0.4,
    },
    scopeStepperValue: {
      flex: 1,
      minWidth: 26,
      textAlign: "center",
      fontSize: 14,
      fontWeight: "900",
      color: colors.text,
    },
    liveProgressCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primarySoft,
      padding: 10,
      gap: 8,
    },
    progressTrack: {
      height: 7,
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: colors.surface,
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    liveWordRow: {
      flexDirection: "row",
      gap: 8,
    },
    liveWordBlock: {
      flex: 1,
      minWidth: 0,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      backgroundColor: colors.surface,
      padding: 8,
      gap: 3,
    },
    liveWordLabel: {
      fontSize: 10,
      fontWeight: "900",
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    liveWordValue: {
      fontSize: 14,
      fontWeight: "900",
      color: colors.text,
      textAlign: "right",
    },
    liveReason: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textMuted,
    },
    comparisonCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
      padding: 10,
      gap: 8,
    },
    comparisonHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    comparisonTitle: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.text,
    },
    comparisonMeta: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: "800",
      color: colors.textMuted,
    },
    decisionBadge: {
      minHeight: 30,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    decisionBadgePass: {
      borderColor: colors.successBorder,
      backgroundColor: colors.successSoft,
    },
    decisionBadgeRepeat: {
      borderColor: colors.warningBorder,
      backgroundColor: colors.warningSoft,
    },
    decisionBadgeSkip: {
      borderColor: colors.warningBorder,
      backgroundColor: colors.warningSoft,
    },
    decisionBadgeWrong: {
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSoft,
    },
    decisionBadgeText: {
      fontSize: 11,
      fontWeight: "900",
      color: colors.textMuted,
    },
    decisionBadgeTextPass: {
      color: colors.success,
    },
    decisionBadgeTextRepeat: {
      color: colors.warning,
    },
    decisionBadgeTextSkip: {
      color: colors.warning,
    },
    decisionBadgeTextWrong: {
      color: colors.danger,
    },
    comparisonStatsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
    },
    comparisonStat: {
      fontSize: 11,
      fontWeight: "900",
      color: colors.textMuted,
    },
    comparisonNote: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.primary,
    },
    issueList: {
      gap: 3,
    },
    issueText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.text,
      textAlign: "right",
    },
    labelRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      paddingTop: 2,
    },
    labelPill: {
      minHeight: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    labelPillSelected: {
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primarySoft,
    },
    labelPillText: {
      fontSize: 11,
      fontWeight: "900",
      color: colors.textMuted,
    },
    labelPillTextSelected: {
      color: colors.primary,
    },
    saveRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    autoSavePill: {
      minHeight: 36,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    autoSavePillActive: {
      borderColor: colors.successBorder,
      backgroundColor: colors.successSoft,
    },
    autoSaveText: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.textMuted,
    },
    autoSaveTextActive: {
      color: colors.success,
    },
    saveButton: {
      minHeight: 36,
      borderRadius: 999,
      paddingHorizontal: 13,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },
    saveButtonDisabled: {
      opacity: 0.48,
    },
    saveButtonText: {
      fontSize: 12,
      fontWeight: "900",
      color: "#ffffff",
    },
    saveMessage: {
      fontSize: 12,
      fontWeight: "800",
    },
    saveMessageOk: {
      color: colors.success,
    },
    saveMessageError: {
      color: colors.danger,
    },
    wordCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primarySoft,
      padding: 10,
      gap: 3,
    },
    wordCardLabel: {
      fontSize: 11,
      fontWeight: "900",
      color: colors.primary,
      textTransform: "uppercase",
    },
    wordCardText: {
      fontSize: 13,
      fontWeight: "900",
      color: colors.text,
    },
    transcriptCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
      padding: 10,
      gap: 4,
    },
    transcriptLabel: {
      fontSize: 11,
      fontWeight: "900",
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    transcriptText: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 26,
      textAlign: "right",
    },
    errorText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: "800",
    },
  });
}
