import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
  STORY_PROPHETS,
  STORY_THEMES,
  type ListStoriesParams,
  type Story,
  type StoryAgeGroup,
  type StoryProphetId,
  type StoryThemeId,
  type StoryType,
} from "@/src/lib/stories";
import { MUSHAF_SURAHS } from "@/src/lib/mushaf";

type StoriesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      stories: Story[];
      allStories: Story[];
    };

type IconName = ComponentProps<typeof Ionicons>["name"];
type FilterSectionKey = "age" | "prophets" | "themes" | "surah";

const STORY_TYPE_META: Record<StoryType, { label: string; color: string; icon: IconName }> = {
  quranic_narrative: { label: "Quran Stories", color: "#0f766e", icon: "book-outline" },
  seerah_context: { label: "Seerah", color: "#2563eb", icon: "moon-outline" },
  companion_profile: { label: "Companions", color: "#7c3aed", icon: "people-outline" },
  moral_lesson: { label: "Lessons", color: "#be123c", icon: "sparkles-outline" },
};

const STORY_TYPE_ORDER: StoryType[] = [
  "quranic_narrative",
  "seerah_context",
  "companion_profile",
  "moral_lesson",
];

const AGE_GROUPS: StoryAgeGroup[] = ["toddler", "child", "preteen", "teen"];

const AGE_GROUP_LABELS: Record<StoryAgeGroup, string> = {
  toddler: "Toddler",
  child: "Child",
  preteen: "Preteen",
  teen: "Teen",
};

const PROPHET_LABELS: Record<StoryProphetId, string> = {
  adam: "Adam",
  idris: "Idris",
  nuh: "Nuh",
  hud: "Hud",
  salih: "Salih",
  ibrahim: "Ibrahim",
  lut: "Lut",
  ismail: "Ismail",
  ishaq: "Ishaq",
  yaqub: "Yaqub",
  yusuf: "Yusuf",
  ayyub: "Ayyub",
  shuaib: "Shuaib",
  musa: "Musa",
  harun: "Harun",
  "dhul-kifl": "Dhul-Kifl",
  dawud: "Dawud",
  sulayman: "Sulayman",
  ilyas: "Ilyas",
  "al-yasa": "Al-Yasa",
  yunus: "Yunus",
  zakariya: "Zakariya",
  yahya: "Yahya",
  isa: "Isa",
  muhammad: "Muhammad",
};

const THEME_LABELS: Record<StoryThemeId, string> = {
  "worship-allah-alone": "Worship Allah Alone",
  "trust-in-allah": "Trust in Allah",
  patience: "Patience",
  repentance: "Repentance",
  gratitude: "Gratitude",
  truthfulness: "Truthfulness",
  humility: "Humility",
  courage: "Courage",
  justice: "Justice",
  mercy: "Mercy",
  forgiveness: "Forgiveness",
  family: "Family",
  friendship: "Friendship",
  generosity: "Generosity",
  "prayer-and-dua": "Prayer and Dua",
  obedience: "Obedience",
  "resisting-pressure": "Resisting Pressure",
  sacrifice: "Sacrifice",
  accountability: "Accountability",
  "seeking-knowledge": "Seeking Knowledge",
  "guidance-and-revelation": "Guidance and Revelation",
  "blessing-as-trust": "Blessing as Trust",
  "unseen-and-faith": "Unseen and Faith",
  community: "Community",
  "allahs-power": "Allah's Power",
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

function parseStoryType(value: string | undefined): StoryType | null {
  return typeof value === "string" && value in STORY_TYPE_META ? value as StoryType : null;
}

function getStoryTypeMeta(storyType: StoryType) {
  return STORY_TYPE_META[storyType] ?? STORY_TYPE_META.quranic_narrative;
}

function formatCount(count: number) {
  return `${count} ${count === 1 ? "story" : "stories"}`;
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toggleSelected<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function removeSelected<T extends string>(values: T[], value: T): T[] {
  return values.filter((item) => item !== value);
}

function buildFilterCounts(stories: Story[]) {
  const storyTypeCounts = new Map<StoryType, number>();
  const ageCounts = new Map<StoryAgeGroup, number>();
  const prophetCounts = new Map<StoryProphetId, number>();
  const themeCounts = new Map<StoryThemeId, number>();
  const surahCounts = new Map<number, number>();

  STORY_TYPE_ORDER.forEach((storyType) => storyTypeCounts.set(storyType, 0));
  AGE_GROUPS.forEach((ageGroup) => ageCounts.set(ageGroup, 0));
  STORY_PROPHETS.forEach((prophet) => prophetCounts.set(prophet, 0));
  STORY_THEMES.forEach((theme) => themeCounts.set(theme, 0));

  stories.forEach((story) => {
    storyTypeCounts.set(story.storyType, (storyTypeCounts.get(story.storyType) ?? 0) + 1);
    ageCounts.set(story.ageGroup, (ageCounts.get(story.ageGroup) ?? 0) + 1);

    new Set(story.prophets).forEach((prophet) => {
      prophetCounts.set(prophet, (prophetCounts.get(prophet) ?? 0) + 1);
    });
    new Set(story.themes).forEach((theme) => {
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    });
    new Set(story.relatedAyahs.map((ref) => ref.surahNumber)).forEach((storySurahNumber) => {
      surahCounts.set(storySurahNumber, (surahCounts.get(storySurahNumber) ?? 0) + 1);
    });
  });

  return {
    storyTypeCounts,
    ageCounts,
    prophetCounts,
    themeCounts,
    surahCounts,
    totalStories: stories.length,
  };
}

function getSurahLabel(storySurahNumber: number) {
  const surah = MUSHAF_SURAHS[storySurahNumber - 1];
  return surah ? `${surah.number}. ${surah.name}` : `Surah ${storySurahNumber}`;
}

function getSurahDetail(storySurahNumber: number) {
  const surah = MUSHAF_SURAHS[storySurahNumber - 1];
  return surah?.translation ?? "";
}

export default function StoriesScreen() {
  const { childId, name, storyType, surahNumber } = useLocalSearchParams<{
    childId: string;
    name?: string;
    storyType?: StoryType;
    surahNumber?: string;
  }>();
  const router = useRouter();
  const initialStoryType = useMemo(() => parseStoryType(storyType), [storyType]);
  const initialSurahNumber = useMemo(() => parseSurahNumber(surahNumber), [surahNumber]);
  const [selectedType, setSelectedType] = useState<StoryType | "all">(initialStoryType ?? "all");
  const [selectedAge, setSelectedAge] = useState<StoryAgeGroup | null>(null);
  const [selectedProphets, setSelectedProphets] = useState<StoryProphetId[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<StoryThemeId[]>([]);
  const [selectedSurahNumber, setSelectedSurahNumber] = useState<number | null>(initialSurahNumber);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [state, setState] = useState<StoriesState>({ status: "loading" });
  const loadRequestRef = useRef(0);

  useEffect(() => {
    setSelectedType(initialStoryType ?? "all");
  }, [initialStoryType]);

  useEffect(() => {
    setSelectedSurahNumber(initialSurahNumber);
  }, [initialSurahNumber]);

  const activeParams = useMemo<ListStoriesParams>(() => ({
    storyType: selectedType === "all" ? undefined : selectedType,
    ageGroup: selectedAge ?? undefined,
    prophet: selectedProphets.length > 0 ? selectedProphets : undefined,
    theme: selectedThemes.length > 0 ? selectedThemes : undefined,
    surahNumber: selectedSurahNumber ?? undefined,
  }), [selectedAge, selectedProphets, selectedSurahNumber, selectedThemes, selectedType]);

  const load = useCallback(async () => {
    if (!isValidChildId(childId)) {
      setState({ status: "error", message: "This stories route is missing a valid child id." });
      return;
    }

    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setState((current) => current.status === "ready" ? current : { status: "loading" });
    try {
      const [stories, allStories] = await Promise.all([
        fetchStories(activeParams),
        fetchStories(),
      ]);
      if (loadRequestRef.current === requestId) {
        setState({ status: "ready", stories, allStories });
      }
    } catch (error) {
      if (loadRequestRef.current === requestId) {
        setState({ status: "error", message: describeError(error) });
      }
    }
  }, [activeParams, childId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function openStory(story: Story) {
    if (!isValidChildId(childId)) return;
    router.push({
      pathname: "/child/[childId]/stories/[storyIdOrSlug]",
      params: { childId, storyIdOrSlug: story.slug || String(story.id), name: name ?? "" },
    } as unknown as Href);
  }

  function clearAllFilters() {
    setSelectedType("all");
    setSelectedAge(null);
    setSelectedProphets([]);
    setSelectedThemes([]);
    setSelectedSurahNumber(null);
  }

  const allStories = state.status === "ready" ? state.allStories : [];
  const counts = useMemo(() => buildFilterCounts(allStories), [allStories]);
  const activeSecondaryFilterCount = (
    (selectedAge ? 1 : 0) +
    selectedProphets.length +
    selectedThemes.length +
    (selectedSurahNumber ? 1 : 0)
  );
  const hasAnyFilter = selectedType !== "all" || activeSecondaryFilterCount > 0;
  const title = selectedSurahNumber ? "Related Stories" : "Stories";

  return (
    <ScreenContainer>
      <ScreenHeader title={title} onBack={() => router.back()} />

      {state.status === "loading" ? (
        <LoadingState label="Loading stories" />
      ) : state.status === "error" ? (
        <ErrorState message={state.message} onRetry={load} />
      ) : (
        <ScreenScrollView>
          <View style={styles.filterHeader}>
            <SectionLabel>Browse</SectionLabel>
            <Pressable
              accessibilityRole="button"
              onPress={() => setFiltersOpen(true)}
              style={styles.filtersButton}
            >
              <Ionicons name="options-outline" size={17} color="#1d4ed8" />
              <Text style={styles.filtersButtonText}>Filters</Text>
              {activeSecondaryFilterCount > 0 ? (
                <View style={styles.filtersBadge}>
                  <Text style={styles.filtersBadgeText}>{activeSecondaryFilterCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <View style={styles.filterWrap}>
            <FilterPill
              label={`All ${counts.totalStories}`}
              selected={selectedType === "all"}
              onPress={() => setSelectedType("all")}
            />
            {STORY_TYPE_ORDER.map((storyTypeOption) => (
              <FilterPill
                key={storyTypeOption}
                label={`${getStoryTypeMeta(storyTypeOption).label} ${counts.storyTypeCounts.get(storyTypeOption) ?? 0}`}
                selected={selectedType === storyTypeOption}
                onPress={() => setSelectedType(storyTypeOption)}
              />
            ))}
          </View>

          {hasAnyFilter ? (
            <View style={styles.activeFiltersWrap}>
              {selectedAge ? (
                <ActiveFilterChip
                  label={AGE_GROUP_LABELS[selectedAge]}
                  onPress={() => setSelectedAge(null)}
                />
              ) : null}
              {selectedProphets.map((prophet) => (
                <ActiveFilterChip
                  key={prophet}
                  label={PROPHET_LABELS[prophet]}
                  onPress={() => setSelectedProphets((current) => removeSelected(current, prophet))}
                />
              ))}
              {selectedThemes.map((theme) => (
                <ActiveFilterChip
                  key={theme}
                  label={THEME_LABELS[theme]}
                  onPress={() => setSelectedThemes((current) => removeSelected(current, theme))}
                />
              ))}
              {selectedSurahNumber ? (
                <ActiveFilterChip
                  label={getSurahLabel(selectedSurahNumber)}
                  onPress={() => setSelectedSurahNumber(null)}
                />
              ) : null}
              <Pressable accessibilityRole="button" onPress={clearAllFilters} style={styles.clearAllChip}>
                <Text style={styles.clearAllChipText}>Clear all</Text>
              </Pressable>
            </View>
          ) : null}

          <SectionLabel>{state.stories?.length ?? 0} stories</SectionLabel>
          {(state.stories?.length ?? 0) === 0 ? (
            <View style={styles.emptyWithAction}>
              <EmptyState title="No stories match these filters" detail="Try fewer filters." />
              <Pressable accessibilityRole="button" onPress={clearAllFilters} style={styles.emptyClearButton}>
                <Text style={styles.emptyClearButtonText}>Clear all filters</Text>
              </Pressable>
            </View>
          ) : (
            <CardGroup>
              {(state.stories ?? []).map((story) => {
                const meta = getStoryTypeMeta(story.storyType);
                return (
                  <ListRow
                    key={story.slug || String(story.id)}
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

          <StoryFiltersSheet
            visible={filtersOpen}
            counts={counts}
            selectedAge={selectedAge}
            selectedProphets={selectedProphets}
            selectedThemes={selectedThemes}
            selectedSurahNumber={selectedSurahNumber}
            onClose={() => setFiltersOpen(false)}
            onClearAll={clearAllFilters}
            onSelectAge={(ageGroup) => {
              setSelectedAge((current) => current === ageGroup ? null : ageGroup);
            }}
            onToggleProphet={(prophet) => {
              setSelectedProphets((current) => toggleSelected(current, prophet));
            }}
            onToggleTheme={(theme) => {
              setSelectedThemes((current) => toggleSelected(current, theme));
            }}
            onSelectSurah={(nextSurahNumber) => {
              setSelectedSurahNumber((current) => current === nextSurahNumber ? null : nextSurahNumber);
            }}
          />
        </ScreenScrollView>
      )}

      <ChildBottomNav active="more" childId={childId} name={name ?? ""} />
    </ScreenContainer>
  );
}

function StoryFiltersSheet({
  visible,
  counts,
  selectedAge,
  selectedProphets,
  selectedThemes,
  selectedSurahNumber,
  onClose,
  onClearAll,
  onSelectAge,
  onToggleProphet,
  onToggleTheme,
  onSelectSurah,
}: {
  visible: boolean;
  counts: ReturnType<typeof buildFilterCounts>;
  selectedAge: StoryAgeGroup | null;
  selectedProphets: StoryProphetId[];
  selectedThemes: StoryThemeId[];
  selectedSurahNumber: number | null;
  onClose: () => void;
  onClearAll: () => void;
  onSelectAge: (ageGroup: StoryAgeGroup) => void;
  onToggleProphet: (prophet: StoryProphetId) => void;
  onToggleTheme: (theme: StoryThemeId) => void;
  onSelectSurah: (surahNumber: number) => void;
}) {
  const [expandedSection, setExpandedSection] = useState<FilterSectionKey | null>("age");
  const [prophetQuery, setProphetQuery] = useState("");
  const [themeQuery, setThemeQuery] = useState("");
  const [surahQuery, setSurahQuery] = useState("");

  const filteredProphets = useMemo(() => {
    const query = normalizeSearchText(prophetQuery);
    return STORY_PROPHETS
      .map((id) => ({
        id,
        label: PROPHET_LABELS[id],
        count: counts.prophetCounts.get(id) ?? 0,
        searchText: normalizeSearchText(`${id} ${PROPHET_LABELS[id]}`),
      }))
      .filter((item) => item.count > 0)
      .filter((item) => !query || item.searchText.includes(query));
  }, [counts.prophetCounts, prophetQuery]);

  const filteredThemes = useMemo(() => {
    const query = normalizeSearchText(themeQuery);
    return STORY_THEMES
      .map((id) => ({
        id,
        label: THEME_LABELS[id],
        count: counts.themeCounts.get(id) ?? 0,
        searchText: normalizeSearchText(`${id} ${THEME_LABELS[id]}`),
      }))
      .filter((item) => item.count > 0)
      .filter((item) => !query || item.searchText.includes(query));
  }, [counts.themeCounts, themeQuery]);

  const filteredSurahs = useMemo(() => {
    const query = normalizeSearchText(surahQuery);
    return [...counts.surahCounts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([number, count]) => ({
        number,
        label: getSurahLabel(number),
        detail: getSurahDetail(number),
        count,
        searchText: normalizeSearchText(`${number} ${getSurahLabel(number)} ${getSurahDetail(number)}`),
      }))
      .filter((item) => item.count > 0)
      .filter((item) => !query || item.searchText.includes(query));
  }, [counts.surahCounts, surahQuery]);

  const selectedCount = (
    (selectedAge ? 1 : 0) +
    selectedProphets.length +
    selectedThemes.length +
    (selectedSurahNumber ? 1 : 0)
  );

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Filters</Text>
              <Text style={styles.sheetSubtitle}>
                {selectedCount > 0 ? `${selectedCount} active` : "Refine the story library"}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetCloseButton}>
              <Ionicons name="close" size={20} color="#475569" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <FilterAccordion
              title="Age"
              detail={selectedAge ? AGE_GROUP_LABELS[selectedAge] : "Any age"}
              expanded={expandedSection === "age"}
              onPress={() => setExpandedSection((current) => current === "age" ? null : "age")}
            >
              <View style={styles.ageOptions}>
                {AGE_GROUPS.map((ageGroup) => (
                  <FilterPill
                    key={ageGroup}
                    label={`${AGE_GROUP_LABELS[ageGroup]} ${counts.ageCounts.get(ageGroup) ?? 0}`}
                    selected={selectedAge === ageGroup}
                    onPress={() => onSelectAge(ageGroup)}
                  />
                ))}
              </View>
            </FilterAccordion>

            <FilterAccordion
              title="Prophets"
              detail={selectedProphets.length > 0 ? `${selectedProphets.length} selected` : "Any prophet"}
              expanded={expandedSection === "prophets"}
              onPress={() => setExpandedSection((current) => current === "prophets" ? null : "prophets")}
            >
              <FilterSearchInput
                value={prophetQuery}
                onChangeText={setProphetQuery}
                placeholder="Search prophets"
              />
              {filteredProphets.map((item) => (
                <FilterOptionRow
                  key={item.id}
                  label={item.label}
                  detail={formatCount(item.count)}
                  selected={selectedProphets.includes(item.id)}
                  multiple
                  onPress={() => onToggleProphet(item.id)}
                />
              ))}
            </FilterAccordion>

            <FilterAccordion
              title="Themes"
              detail={selectedThemes.length > 0 ? `${selectedThemes.length} selected` : "Any theme"}
              expanded={expandedSection === "themes"}
              onPress={() => setExpandedSection((current) => current === "themes" ? null : "themes")}
            >
              <FilterSearchInput
                value={themeQuery}
                onChangeText={setThemeQuery}
                placeholder="Search themes"
              />
              {filteredThemes.map((item) => (
                <FilterOptionRow
                  key={item.id}
                  label={item.label}
                  detail={formatCount(item.count)}
                  selected={selectedThemes.includes(item.id)}
                  multiple
                  onPress={() => onToggleTheme(item.id)}
                />
              ))}
            </FilterAccordion>

            <FilterAccordion
              title="Surah"
              detail={selectedSurahNumber ? getSurahLabel(selectedSurahNumber) : "Any surah"}
              expanded={expandedSection === "surah"}
              onPress={() => setExpandedSection((current) => current === "surah" ? null : "surah")}
            >
              <FilterSearchInput
                value={surahQuery}
                onChangeText={setSurahQuery}
                placeholder="Search surah name or number"
              />
              {filteredSurahs.map((item) => (
                <FilterOptionRow
                  key={item.number}
                  label={item.label}
                  detail={`${item.detail} · ${formatCount(item.count)}`}
                  selected={selectedSurahNumber === item.number}
                  onPress={() => onSelectSurah(item.number)}
                />
              ))}
            </FilterAccordion>
          </ScrollView>

          <View style={styles.sheetFooter}>
            <Pressable accessibilityRole="button" onPress={onClearAll} style={styles.sheetClearButton}>
              <Text style={styles.sheetClearButtonText}>Clear all</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetDoneButton}>
              <Text style={styles.sheetDoneButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FilterAccordion({
  title,
  detail,
  expanded,
  onPress,
  children,
}: {
  title: string;
  detail: string;
  expanded: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.accordion}>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.accordionHeader}>
        <View>
          <Text style={styles.accordionTitle}>{title}</Text>
          <Text style={styles.accordionDetail}>{detail}</Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color="#64748b" />
      </Pressable>
      {expanded ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
}

function FilterSearchInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchBox}>
      <Ionicons name="search-outline" size={16} color="#64748b" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.searchInput}
      />
    </View>
  );
}

function FilterOptionRow({
  label,
  detail,
  selected,
  multiple = false,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  multiple?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.optionRow}>
      <View style={styles.optionTextBlock}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionDetail}>{detail}</Text>
      </View>
      <Ionicons
        name={selected ? (multiple ? "checkbox" : "radio-button-on") : (multiple ? "square-outline" : "radio-button-off")}
        size={21}
        color={selected ? "#2563eb" : "#94a3b8"}
      />
    </Pressable>
  );
}

function ActiveFilterChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.activeChip}>
      <Text style={styles.activeChipText}>{label}</Text>
      <Ionicons name="close" size={13} color="#1d4ed8" />
    </Pressable>
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
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  filtersButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filtersButtonText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "900",
  },
  filtersBadge: {
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#2563eb",
    paddingHorizontal: 5,
  },
  filtersBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
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
  activeFiltersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  activeChip: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeChipText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "900",
  },
  clearAllChip: {
    minHeight: 32,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearAllChipText: {
    color: "#be123c",
    fontSize: 12,
    fontWeight: "900",
  },
  emptyWithAction: {
    gap: 10,
  },
  emptyClearButton: {
    alignSelf: "center",
    minHeight: 40,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyClearButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  sheet: {
    maxHeight: "86%",
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  sheetTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "900",
  },
  sheetSubtitle: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  sheetCloseButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  sheetScroll: {
    maxHeight: 520,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  accordion: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
  },
  accordionHeader: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  accordionTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "900",
  },
  accordionDetail: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  accordionBody: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    padding: 12,
    gap: 8,
  },
  ageOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  searchBox: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 9,
  },
  optionRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  optionTextBlock: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "900",
  },
  optionDetail: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  sheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  sheetClearButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 999,
    backgroundColor: "#fff1f2",
    paddingHorizontal: 16,
  },
  sheetClearButtonText: {
    color: "#be123c",
    fontSize: 13,
    fontWeight: "900",
  },
  sheetDoneButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
  },
  sheetDoneButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
});
