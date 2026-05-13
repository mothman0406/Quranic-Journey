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
  type ReciteLabAlignmentDecision,
  type ReciteLabAlignmentOp,
} from "@/src/lib/recite-lab-align";
import {
  getReciteLabLoggingBaseURL,
  saveReciteLabAttempt,
  type ReciteLabAttemptLabel,
} from "@/src/lib/recite-lab";
import type { MushafViewMode } from "@/src/lib/settings";

type CaptureState = "idle" | "starting" | "listening" | "stopping";
type SaveState = "idle" | "saving" | "saved" | "error";

type LabWordTarget = {
  surah: number;
  ayah: number;
  position: number;
};

const ATTEMPT_LABELS: Array<{ value: ReciteLabAttemptLabel; label: string }> = [
  { value: "correct", label: "Correct" },
  { value: "repeat", label: "Repeat" },
  { value: "skip", label: "Skip" },
  { value: "wrong", label: "Wrong" },
  { value: "noisy", label: "Noisy" },
];

function parseRouteInt(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatAyahRange(start: number, end: number) {
  return start === end ? `Ayah ${start}` : `Ayahs ${start}-${end}`;
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

function describeIssue(issue: ReciteLabAlignmentOp) {
  if (issue.type === "missing") return `Missing ${issue.expected ?? ""}`.trim();
  if (issue.type === "extra") return `Extra ${issue.heard ?? ""}`.trim();
  if (issue.type === "substitute") {
    return `${issue.expected ?? ""} -> ${issue.heard ?? ""}`.trim();
  }
  return "";
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
  const [expectedWords, setExpectedWords] = useState<string[]>([]);
  const [expectedLoading, setExpectedLoading] = useState(true);
  const [expectedError, setExpectedError] = useState<string | null>(null);
  const [attemptLabel, setAttemptLabel] = useState<ReciteLabAttemptLabel>("correct");
  const [autoSave, setAutoSave] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [lastSavedAttemptKey, setLastSavedAttemptKey] = useState<string | null>(null);
  const captureStartedAtRef = useRef<string | null>(null);
  const lastAutoSavedKeyRef = useRef<string | null>(null);
  const lastSavedAttemptKeyRef = useRef<string | null>(null);

  const normalizedTranscript = useMemo(() => stripTashkeel(transcript), [transcript]);
  const transcriptTokens = useMemo(
    () => tokenize(normalizedTranscript),
    [normalizedTranscript],
  );
  const comparison = useMemo(
    () => compareReciteLabTokens(expectedWords, transcriptTokens),
    [expectedWords, transcriptTokens],
  );
  const currentAttemptKey = useMemo(() => {
    const startedAt = captureStartedAtRef.current;
    const trimmedTranscript = transcript.trim();
    return startedAt && trimmedTranscript ? `${startedAt}:${trimmedTranscript}` : null;
  }, [transcript]);
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
    let cancelled = false;
    setExpectedLoading(true);
    setExpectedError(null);
    fetchSurahVerses(surahNumber)
      .then((verses) => {
        if (cancelled) return;
        const words = verses
          .filter((verse) => verse.verse_number >= ayahStart && verse.verse_number <= ayahEnd)
          .flatMap((verse) => verse.words)
          .filter((word) => word.char_type_name === "word")
          .map(normalizeExpectedWord)
          .filter(Boolean);
        setExpectedWords(words);
      })
      .catch((error) => {
        if (cancelled) return;
        setExpectedError(error instanceof Error ? error.message : "Expected words unavailable.");
      })
      .finally(() => {
        if (!cancelled) setExpectedLoading(false);
      });

    return () => {
      cancelled = true;
    };
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
        const clientRecordedAt = captureStartedAtRef.current ?? new Date().toISOString();
        const attemptKey = `${clientRecordedAt}:${trimmedTranscript}`;
        if (lastSavedAttemptKeyRef.current === attemptKey) {
          setSaveState("saved");
          if (saveMode === "manual") setSaveMessage("Already saved");
          return;
        }
        const result = await saveReciteLabAttempt({
          label: attemptLabel,
          saveMode,
          clientRecordedAt,
          clientSavedAt: new Date().toISOString(),
          route: {
            surahNumber,
            ayahStart,
            ayahEnd,
            endSurahNumber,
            page: currentPage,
            mushafViewMode,
          },
          expectedWords,
          expectedWordCount: expectedWords.length,
          transcript: trimmedTranscript,
          normalizedTranscript,
          transcriptTokens,
          heardTokenCount: transcriptTokens.length,
          comparison,
          audioUri,
          recordingSupported,
          deviceSessionId: Constants.sessionId ?? null,
        });
        lastSavedAttemptKeyRef.current = attemptKey;
        setLastSavedAttemptKey(attemptKey);
        setSaveState("saved");
        setSaveMessage(`Saved ${result.id.slice(0, 8)}`);
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
      lastSavedAttemptKey,
      mushafViewMode,
      normalizedTranscript,
      recordingSupported,
      surahNumber,
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
    const autoSaveKey = `${startedAt}:${transcript.trim()}`;
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
    saveCurrentAttempt,
    saveState,
    transcript,
  ]);

  useSpeechRecognitionEvent("start", () => {
    setCaptureState("listening");
    setCaptureError(null);
  });

  useSpeechRecognitionEvent("audiostart", (event) => {
    setAudioUri(event.uri);
  });

  useSpeechRecognitionEvent("audioend", (event) => {
    setAudioUri(event.uri);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const result = event.results?.[0];
    if (!result) return;
    setTranscript(result.transcript ?? "");
  });

  useSpeechRecognitionEvent("error", (event) => {
    setCaptureState("idle");
    setCaptureError(event.message ?? event.error ?? "Recognition error.");
  });

  useSpeechRecognitionEvent("end", () => {
    setCaptureState("idle");
  });

  async function startCapture() {
    try {
      setCaptureError(null);
      setAudioUri(null);
      setTranscript("");
      setSaveState("idle");
      setSaveMessage(null);
      setLastSavedAttemptKey(null);
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

  const listening = captureState === "listening" || captureState === "starting";
  const canSave =
    transcript.trim().length > 0 &&
    !expectedLoading &&
    expectedWords.length > 0 &&
    !currentAttemptSaved &&
    saveState !== "saving";
  const loggingLabel = loggingBaseURL ? loggingBaseURL.replace(/^https?:\/\//, "") : "off";
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
          onWordPress={setSelectedWord}
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
            <Text style={styles.detailLabel}>Audio</Text>
            <Text style={styles.detailValue}>
              {audioUri ? "Captured locally" : recordingSupported ? "Armed" : "Transcript only"}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Logging</Text>
            <Text style={styles.detailValue}>{loggingLabel}</Text>
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
