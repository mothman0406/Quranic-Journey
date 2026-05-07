import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ChildBottomNav } from "@/src/components/child-bottom-nav";
import {
  ErrorState,
  LoadingState,
  ScreenContainer,
  ScreenHeader,
  ScreenScrollView,
} from "@/src/components/screen-primitives";
import {
  fetchChildDuas,
  fetchDua,
  fetchDuaCategories,
  markDuaLearned,
  type ChildDuaProgressEntry,
  type Dua,
} from "@/src/lib/duas";

type DuaDetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      dua: Dua;
      categoryName: string | null;
      progress: ChildDuaProgressEntry;
    };

function isValidChildId(childId: string | undefined): childId is string {
  return typeof childId === "string" && /^\d+$/.test(childId);
}

function parseDuaId(duaId: string | undefined) {
  const parsed = Number(duaId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : "This du'aa could not load.";
}

function defaultProgress(dua: Dua): ChildDuaProgressEntry {
  return {
    dua,
    learned: false,
    learnedAt: null,
    practicedCount: 0,
  };
}

function formatRepetitions(repetitions: number) {
  return `Recite ${repetitions} time${repetitions === 1 ? "" : "s"}`;
}

function formatPracticeCount(count: number) {
  return `Practiced ${count} time${count === 1 ? "" : "s"}`;
}

function ExpandableSection({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!value) return null;

  return (
    <View style={styles.expandableCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.expandableHeader}
        onPress={() => setExpanded((current) => !current)}
      >
        <Text style={styles.expandableTitle}>{title}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="#64748b"
        />
      </Pressable>
      {expanded ? <Text style={styles.expandableText}>{value}</Text> : null}
    </View>
  );
}

export default function DuaDetailScreen() {
  const { childId, duaId, name } = useLocalSearchParams<{
    childId: string;
    duaId: string;
    name?: string;
  }>();
  const router = useRouter();
  const [state, setState] = useState<DuaDetailState>({ status: "loading" });
  const [saving, setSaving] = useState(false);

  const parsedDuaId = useMemo(() => parseDuaId(duaId), [duaId]);

  const load = useCallback(async () => {
    if (!isValidChildId(childId) || parsedDuaId === null) {
      setState({ status: "error", message: "This du'aa route is incomplete." });
      return;
    }

    setState((current) => current.status === "ready" ? current : { status: "loading" });
    try {
      const [dua, categories, progressRows] = await Promise.all([
        fetchDua(parsedDuaId),
        fetchDuaCategories(),
        fetchChildDuas(childId),
      ]);
      const categoryName =
        categories.find((category) => category.slug === dua.categorySlug)?.nameEnglish ?? null;
      const progress = progressRows.find((entry) => entry.dua.id === dua.id) ?? defaultProgress(dua);
      setState({ status: "ready", dua, categoryName, progress });
    } catch (error) {
      setState({ status: "error", message: describeError(error) });
    }
  }, [childId, parsedDuaId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function toggleLearned() {
    if (state.status !== "ready" || saving || !isValidChildId(childId)) return;

    const previousProgress = state.progress;
    const nextLearned = !previousProgress.learned;
    const optimisticProgress: ChildDuaProgressEntry = {
      ...previousProgress,
      learned: nextLearned,
      learnedAt: nextLearned ? new Date().toISOString() : null,
      practicedCount: previousProgress.practicedCount + 1,
    };

    setSaving(true);
    setState((current) =>
      current.status === "ready" ? { ...current, progress: optimisticProgress } : current,
    );

    try {
      const updatedProgress = await markDuaLearned(childId, state.dua.id, nextLearned);
      setState((current) =>
        current.status === "ready" ? { ...current, progress: updatedProgress } : current,
      );
    } catch (error) {
      setState((current) =>
        current.status === "ready" ? { ...current, progress: previousProgress } : current,
      );
      Alert.alert("Could not update du'aa", describeError(error));
    } finally {
      setSaving(false);
    }
  }

  const title = state.status === "ready" ? state.dua.title : "Du'aa";

  return (
    <ScreenContainer>
      <ScreenHeader title={title} onBack={() => router.back()} />

      {state.status === "loading" ? (
        <LoadingState label="Loading du'aa" />
      ) : state.status === "error" ? (
        <ErrorState message={state.message} onRetry={load} />
      ) : (
        <>
          <ScreenScrollView contentContainerStyle={styles.content}>
            <View style={styles.titleBlock}>
              {state.categoryName ? (
                <Text style={styles.categoryLabel}>{state.categoryName}</Text>
              ) : null}
              <Text style={styles.title}>{state.dua.title}</Text>
            </View>

            <View style={styles.arabicCard}>
              <Text style={styles.arabicText}>{state.dua.arabic}</Text>
            </View>

            <View style={styles.textCard}>
              <Text style={styles.sectionKicker}>Transliteration</Text>
              <Text style={styles.transliteration}>{state.dua.transliteration}</Text>
            </View>

            <View style={styles.textCard}>
              <Text style={styles.sectionKicker}>Translation</Text>
              <Text style={styles.translation}>{state.dua.translation}</Text>
            </View>

            <View style={styles.metaWrap}>
              {state.dua.reference ? (
                <View style={styles.metaPill}>
                  <Ionicons name="library-outline" size={14} color="#475569" />
                  <Text style={styles.metaText}>{state.dua.reference}</Text>
                </View>
              ) : null}
              {state.dua.repetitions !== null ? (
                <View style={styles.metaPill}>
                  <Ionicons name="repeat-outline" size={14} color="#0f766e" />
                  <Text style={styles.metaText}>{formatRepetitions(state.dua.repetitions)}</Text>
                </View>
              ) : null}
              {state.progress.practicedCount > 0 ? (
                <View style={styles.metaPill}>
                  <Ionicons name="stats-chart-outline" size={14} color="#7c3aed" />
                  <Text style={styles.metaText}>
                    {formatPracticeCount(state.progress.practicedCount)}
                  </Text>
                </View>
              ) : null}
            </View>

            <ExpandableSection title="Benefits" value={state.dua.benefits} />
            <ExpandableSection title="Notes" value={state.dua.notes} />
          </ScreenScrollView>

          <View style={styles.actionWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ checked: state.progress.learned, disabled: saving }}
              disabled={saving}
              style={[
                styles.learnedButton,
                state.progress.learned && styles.learnedButtonActive,
                saving && styles.learnedButtonDisabled,
              ]}
              onPress={toggleLearned}
            >
              {saving ? (
                <ActivityIndicator
                  size="small"
                  color={state.progress.learned ? "#ffffff" : "#0f766e"}
                />
              ) : (
                <Ionicons
                  name={state.progress.learned ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={state.progress.learned ? "#ffffff" : "#0f766e"}
                />
              )}
              <Text
                style={[
                  styles.learnedButtonText,
                  state.progress.learned && styles.learnedButtonTextActive,
                ]}
              >
                {state.progress.learned ? "Learned" : "Mark as learned"}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <ChildBottomNav active="more" childId={childId} name={name ?? ""} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
  titleBlock: {
    gap: 5,
  },
  categoryLabel: {
    color: "#0891b2",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
  },
  arabicCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  arabicText: {
    color: "#111827",
    fontFamily: "AmiriQuran",
    fontSize: 30,
    lineHeight: 56,
    textAlign: "right",
    writingDirection: "rtl",
  },
  textCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    gap: 7,
  },
  sectionKicker: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  transliteration: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
  },
  translation: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  metaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  metaText: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  expandableCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  expandableHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  expandableTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  expandableText: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  actionWrap: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  learnedButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#99f6e4",
    backgroundColor: "#f0fdfa",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  learnedButtonActive: {
    borderColor: "#059669",
    backgroundColor: "#059669",
  },
  learnedButtonDisabled: {
    opacity: 0.7,
  },
  learnedButtonText: {
    color: "#0f766e",
    fontSize: 15,
    fontWeight: "900",
  },
  learnedButtonTextActive: {
    color: "#ffffff",
  },
});
