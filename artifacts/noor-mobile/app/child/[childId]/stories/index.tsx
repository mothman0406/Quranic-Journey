import { useCallback, useMemo, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { ChildBottomNav } from "@/src/components/child-bottom-nav";
import {
  BadgePill,
  CardGroup,
  EmptyState,
  ErrorState,
  ListRow,
  LoadingState,
  ScreenContainer,
  ScreenHeader,
  ScreenScrollView,
  SectionLabel,
} from "@/src/components/screen-primitives";
import {
  fetchStories,
  fetchStoryCategories,
  type Story,
  type StoryType,
  type StoryTypeSummary,
} from "@/src/lib/stories";

type StoriesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      stories: Story[];
      storyTypes: StoryTypeSummary[];
    };

type IconName = ComponentProps<typeof Ionicons>["name"];

const STORY_TYPE_META: Record<StoryType, { label: string; color: string; icon: IconName }> = {
  quranic_narrative: { label: "Quran Stories", color: "#0f766e", icon: "book-outline" },
  seerah_context: { label: "Seerah", color: "#2563eb", icon: "moon-outline" },
  companion_profile: { label: "Companions", color: "#7c3aed", icon: "people-outline" },
  moral_lesson: { label: "Lessons", color: "#be123c", icon: "sparkles-outline" },
};

function isValidChildId(childId: string | undefined): childId is string {
  return typeof childId === "string" && /^\d+$/.test(childId);
}

function parseSurahNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : "Stories could not load.";
}

function getStoryTypeMeta(storyType: StoryType) {
  return STORY_TYPE_META[storyType] ?? STORY_TYPE_META.quranic_narrative;
}

export default function StoriesScreen() {
  const { childId, name, storyType, surahNumber } = useLocalSearchParams<{
    childId: string;
    name?: string;
    storyType?: StoryType;
    surahNumber?: string;
  }>();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<StoryType | "all">(
    storyType && storyType in STORY_TYPE_META ? storyType : "all",
  );
  const [state, setState] = useState<StoriesState>({ status: "loading" });
  const parsedSurahNumber = useMemo(() => parseSurahNumber(surahNumber), [surahNumber]);

  const load = useCallback(async () => {
    if (!isValidChildId(childId)) {
      setState({ status: "error", message: "This stories route is missing a valid child id." });
      return;
    }

    setState((current) => current.status === "ready" ? current : { status: "loading" });
    try {
      const [stories, storyTypes] = await Promise.all([
        fetchStories({
          storyType: selectedType === "all" ? undefined : selectedType,
          surahNumber: parsedSurahNumber ?? undefined,
        }),
        fetchStoryCategories(),
      ]);
      setState({ status: "ready", stories, storyTypes });
    } catch (error) {
      setState({ status: "error", message: describeError(error) });
    }
  }, [childId, parsedSurahNumber, selectedType]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function openStory(story: Story) {
    if (!isValidChildId(childId)) return;
    router.push({
      pathname: "/child/[childId]/stories/[storyIdOrSlug]",
      params: { childId, storyIdOrSlug: story.slug, name: name ?? "" },
    } as unknown as Href);
  }

  const title = parsedSurahNumber ? "Related Stories" : "Stories";

  return (
    <ScreenContainer>
      <ScreenHeader title={title} onBack={() => router.back()} />

      {state.status === "loading" ? (
        <LoadingState label="Loading stories" />
      ) : state.status === "error" ? (
        <ErrorState message={state.message} onRetry={load} />
      ) : (
        <ScreenScrollView>
          {parsedSurahNumber ? (
            <View style={styles.contextBanner}>
              <Ionicons name="library-outline" size={18} color="#2563eb" />
              <Text style={styles.contextText}>Stories connected to Surah {parsedSurahNumber}</Text>
            </View>
          ) : null}

          <SectionLabel>Filter</SectionLabel>
          <View style={styles.filterWrap}>
            <FilterPill
              label="All"
              selected={selectedType === "all"}
              onPress={() => setSelectedType("all")}
            />
            {state.storyTypes.map((item) => (
              <FilterPill
                key={item.storyType}
                label={`${getStoryTypeMeta(item.storyType).label} ${item.count}`}
                selected={selectedType === item.storyType}
                onPress={() => setSelectedType(item.storyType)}
              />
            ))}
          </View>

          <SectionLabel>{state.stories.length} stories</SectionLabel>
          {state.stories.length === 0 ? (
            <EmptyState title="No stories yet" detail="Try another filter or browse all stories." />
          ) : (
            <CardGroup>
              {state.stories.map((story) => {
                const meta = getStoryTypeMeta(story.storyType);
                return (
                  <ListRow
                    key={story.slug}
                    title={story.title}
                    detail={story.summary}
                    iconName={meta.icon}
                    iconColor={meta.color}
                    detailNumberOfLines={2}
                    trailing={
                      <View style={styles.trailing}>
                        <BadgePill label={`${story.readingTimeMinutes} min`} />
                        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                      </View>
                    }
                    onPress={() => openStory(story)}
                  />
                );
              })}
            </CardGroup>
          )}
        </ScreenScrollView>
      )}

      <ChildBottomNav active="more" childId={childId} name={name ?? ""} />
    </ScreenContainer>
  );
}

function FilterPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filterPill, selected && styles.filterPillSelected]}
    >
      <Text style={[styles.filterPillText, selected && styles.filterPillTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contextBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 12,
  },
  contextText: {
    color: "#1e3a8a",
    fontSize: 13,
    fontWeight: "700",
  },
  filterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterPill: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterPillSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  filterPillText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
  },
  filterPillTextSelected: {
    color: "#1d4ed8",
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
