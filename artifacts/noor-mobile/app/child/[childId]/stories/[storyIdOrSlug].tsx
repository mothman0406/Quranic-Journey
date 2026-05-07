import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ChildBottomNav } from "@/src/components/child-bottom-nav";
import {
  BadgePill,
  ErrorState,
  LoadingState,
  ScreenContainer,
  ScreenHeader,
  ScreenScrollView,
} from "@/src/components/screen-primitives";
import { fetchStory, type StoryDetail, type StoryType } from "@/src/lib/stories";

type StoryDetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; story: StoryDetail };

const STORY_TYPE_LABELS: Record<StoryType, string> = {
  quranic_narrative: "Quran Story",
  seerah_context: "Seerah Context",
  companion_profile: "Companion Profile",
  moral_lesson: "Moral Lesson",
};

function isValidChildId(childId: string | undefined): childId is string {
  return typeof childId === "string" && /^\d+$/.test(childId);
}

function isValidStoryId(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : "This story could not load.";
}

export default function StoryDetailScreen() {
  const { childId, storyIdOrSlug, name } = useLocalSearchParams<{
    childId: string;
    storyIdOrSlug: string;
    name?: string;
  }>();
  const router = useRouter();
  const [state, setState] = useState<StoryDetailState>({ status: "loading" });

  const load = useCallback(async () => {
    if (!isValidChildId(childId) || !isValidStoryId(storyIdOrSlug)) {
      setState({ status: "error", message: "This story route is incomplete." });
      return;
    }

    setState((current) => current.status === "ready" ? current : { status: "loading" });
    try {
      const story = await fetchStory(storyIdOrSlug);
      setState({ status: "ready", story });
    } catch (error) {
      setState({ status: "error", message: describeError(error) });
    }
  }, [childId, storyIdOrSlug]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const title = state.status === "ready" ? state.story.title : "Story";

  return (
    <ScreenContainer>
      <ScreenHeader title={title} onBack={() => router.back()} />

      {state.status === "loading" ? (
        <LoadingState label="Loading story" />
      ) : state.status === "error" ? (
        <ErrorState message={state.message} onRetry={load} />
      ) : (
        <ScreenScrollView contentContainerStyle={styles.content}>
          <View style={styles.titleBlock}>
            <View style={styles.metaRow}>
              <BadgePill
                label={STORY_TYPE_LABELS[state.story.storyType]}
                color="#1d4ed8"
                backgroundColor="#eff6ff"
                borderColor="#bfdbfe"
              />
              <BadgePill label={`${state.story.readingTimeMinutes} min`} />
            </View>
            <Text style={styles.title}>{state.story.title}</Text>
            <Text style={styles.summary}>{state.story.summary}</Text>
          </View>

          <View style={styles.storyCard}>
            {(state.story.content ?? "").split("\n\n").map((paragraph, index) => (
              <Text key={index} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>

          {(state.story.morals?.length ?? 0) > 0 ? (
            <View style={styles.lessonCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="sparkles-outline" size={16} color="#b45309" />
                <Text style={styles.lessonTitle}>Lessons</Text>
              </View>
              {(state.story.morals ?? []).map((moral) => (
                <View key={moral} style={styles.bulletRow}>
                  <Text style={styles.lessonBullet}>•</Text>
                  <Text style={styles.lessonText}>{moral}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {(state.story.relatedAyahs?.length ?? 0) > 0 ? (
            <View style={styles.relatedCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="book-outline" size={16} color="#0f766e" />
                <Text style={styles.relatedTitle}>Related Ayahs</Text>
              </View>
              <View style={styles.relatedWrap}>
                {(state.story.relatedAyahs ?? []).map((ref) => (
                  <BadgePill
                    key={`${ref.surahNumber}-${ref.ayahStart}-${ref.ayahEnd}`}
                    label={ref.label ?? `${ref.surahNumber}:${ref.ayahStart}-${ref.ayahEnd}`}
                    color="#0f766e"
                    backgroundColor="#ecfdf5"
                    borderColor="#a7f3d0"
                  />
                ))}
              </View>
            </View>
          ) : null}

          {(state.story.discussionQuestions?.length ?? 0) > 0 ? (
            <View style={styles.questionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbubbles-outline" size={16} color="#475569" />
                <Text style={styles.questionTitle}>Talk About It</Text>
              </View>
              {(state.story.discussionQuestions ?? []).map((question, index) => (
                <View key={question} style={styles.questionRow}>
                  <View style={styles.questionNumber}>
                    <Text style={styles.questionNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.questionText}>{question}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {state.story.sources?.primary ? (
            <Text style={styles.sourceFooter}>Adapted from {state.story.sources?.primary}</Text>
          ) : null}
        </ScreenScrollView>
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
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  title: {
    color: "#111827",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
  },
  summary: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  storyCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  paragraph: {
    color: "#1f2937",
    fontSize: 15,
    lineHeight: 24,
  },
  lessonCard: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  relatedCard: {
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#99f6e4",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  questionCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  lessonTitle: {
    color: "#92400e",
    fontSize: 14,
    fontWeight: "900",
  },
  relatedTitle: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "900",
  },
  questionTitle: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "900",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  lessonBullet: {
    color: "#f59e0b",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "900",
  },
  lessonText: {
    flex: 1,
    color: "#92400e",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  relatedWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  questionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  questionNumberText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "900",
  },
  questionText: {
    flex: 1,
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
  },
  sourceFooter: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
