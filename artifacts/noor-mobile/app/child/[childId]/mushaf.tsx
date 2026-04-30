import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch } from "@/src/lib/api";
import {
  MUSHAF_JUZS,
  MUSHAF_SURAHS,
  clampMushafPage,
  getJuzForMushafPage,
  getMushafSurahForPage,
  mushafPageUrl,
  searchMushafSurahs,
  TOTAL_MUSHAF_PAGES,
  type MushafJuz,
  type MushafSurah,
} from "@/src/lib/mushaf";

const PAGE_ASPECT_RATIO = 1.45;
const PRESET_PAGES = [1, 50, 300, TOTAL_MUSHAF_PAGES] as const;
const BOOKMARK_LIMIT = 12;

type ReadingStatus = "not_started" | "in_progress" | "completed";

type ReadingGoal = {
  lastPage: number | null;
  status: ReadingStatus;
  completedPages: number;
  targetPages: number;
  isEnabled: boolean;
};

type DashboardResponse = {
  readingGoal: ReadingGoal | null;
};

type ReadingProgressResponse = {
  readingStatus: ReadingStatus;
  readingCompletedPages: number;
  readingLastPage: number | null;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";
type SearchParamValue = string | string[] | undefined;

function bookmarkStorageKey(childId: string | undefined) {
  return `noorpath:mushaf:bookmarks:${childId ?? "unknown"}`;
}

function formatPageCount(value: number) {
  const formatted = Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, "");
  return `${formatted} page${value === 1 ? "" : "s"}`;
}

function formatGoalCopy(goal: ReadingGoal | null) {
  if (!goal?.isEnabled) return "No reading target set";
  const completed = goal.completedPages ?? 0;
  const target = goal.targetPages ?? 0;
  if (goal.status === "completed") {
    return `Target complete: ${formatPageCount(completed)} of ${formatPageCount(target)} counted today`;
  }
  return `Today counted: ${formatPageCount(completed)} of ${formatPageCount(target)}`;
}

function progressRatio(goal: ReadingGoal | null) {
  if (!goal?.isEnabled || goal.targetPages <= 0) return 0;
  return Math.max(0, Math.min(1, (goal.completedPages ?? 0) / goal.targetPages));
}

function parsePositiveInteger(value: string) {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function singleParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePageParam(value: SearchParamValue) {
  const page = singleParam(value);
  if (!page) return null;
  const parsed = parsePositiveInteger(page);
  return parsed === null ? null : clampMushafPage(parsed);
}

function buildMemorizationContext({
  fromMemorization,
  surahNumber,
  ayahNumber,
}: {
  fromMemorization: SearchParamValue;
  surahNumber: SearchParamValue;
  ayahNumber: SearchParamValue;
}) {
  if (singleParam(fromMemorization) !== "1") return null;
  const surah = parsePositiveInteger(singleParam(surahNumber) ?? "");
  const ayah = parsePositiveInteger(singleParam(ayahNumber) ?? "");
  if (surah === null || ayah === null) return "Opened from Memorization";
  const surahMeta = MUSHAF_SURAHS.find((item) => item.number === surah);
  return `From Memorization · ${surahMeta?.name ?? `Surah ${surah}`} ${surah}:${ayah}`;
}

function PageView({ pageNumber, width }: { pageNumber: number; width: number }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const height = width * PAGE_ASPECT_RATIO;

  return (
    <View style={[styles.pageWrap, { width }]}>
      <View style={[styles.pageCard, { width: width - 32, height: height - 80 }]}>
        {!loaded && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.loadingText}>page {pageNumber}</Text>
          </View>
        )}
        {error && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTitle}>Failed</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        )}
        <Image
          source={{ uri: mushafPageUrl(pageNumber) }}
          style={styles.pageImage}
          resizeMode="contain"
          onLoad={() => setLoaded(true)}
          onError={(e) => setError(e.nativeEvent.error ?? "unknown error")}
        />
      </View>
      <Text style={styles.pageNumberLabel}>
        {pageNumber} / {TOTAL_MUSHAF_PAGES}
      </Text>
    </View>
  );
}

function JumpRow({
  title,
  detail,
  iconName,
  color,
  onPress,
  trailing,
}: {
  title: string;
  detail: string;
  iconName: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  trailing?: string;
}) {
  return (
    <Pressable style={styles.jumpRow} onPress={onPress}>
      <View style={[styles.jumpIcon, { backgroundColor: `${color}16` }]}>
        <Ionicons name={iconName} size={19} color={color} />
      </View>
      <View style={styles.jumpTextBlock}>
        <Text style={styles.jumpTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.jumpDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {trailing ? <Text style={styles.jumpTrailing}>{trailing}</Text> : null}
    </Pressable>
  );
}

function JuzChip({ item, onPress }: { item: MushafJuz; onPress: () => void }) {
  return (
    <Pressable style={styles.juzChip} onPress={onPress}>
      <Text style={styles.juzChipTitle}>Juz {item.number}</Text>
      <Text style={styles.juzChipDetail}>p. {item.startPage}</Text>
    </Pressable>
  );
}

export default function MushafScreen() {
  const params = useLocalSearchParams<{
    childId: string;
    name?: string;
    page?: string;
    fromMemorization?: string;
    surahNumber?: string;
    ayahNumber?: string;
  }>();
  const { childId, name } = params;
  const router = useRouter();
  const screenW = Dimensions.get("window").width;
  const requestedInitialPage = useMemo(() => parsePageParam(params.page), [params.page]);
  const memorizationContext = useMemo(
    () =>
      buildMemorizationContext({
        fromMemorization: params.fromMemorization,
        surahNumber: params.surahNumber,
        ayahNumber: params.ayahNumber,
      }),
    [params.fromMemorization, params.surahNumber, params.ayahNumber],
  );

  const [initialPage, setInitialPage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [readingGoal, setReadingGoal] = useState<ReadingGoal | null>(null);
  const [lastSavedPage, setLastSavedPage] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpQuery, setJumpQuery] = useState("");
  const [pageInput, setPageInput] = useState("");
  const [bookmarkedPages, setBookmarkedPages] = useState<number[]>([]);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);

  const listRef = useRef<FlatList<number>>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const data = useMemo(
    () => Array.from({ length: TOTAL_MUSHAF_PAGES }, (_, i) => i + 1),
    [],
  );
  const currentSurah = getMushafSurahForPage(currentPage);
  const currentJuz = getJuzForMushafPage(currentPage);
  const ratio = progressRatio(readingGoal);
  const goalCopy = formatGoalCopy(readingGoal);
  const isBookmarked = bookmarkedPages.includes(currentPage);
  const parsedQuery = parsePositiveInteger(jumpQuery);
  const pageResult =
    parsedQuery !== null && parsedQuery >= 1 && parsedQuery <= TOTAL_MUSHAF_PAGES
      ? parsedQuery
      : null;
  const surahResult =
    parsedQuery !== null && parsedQuery >= 1 && parsedQuery <= MUSHAF_SURAHS.length
      ? MUSHAF_SURAHS[parsedQuery - 1]
      : null;
  const juzResult =
    parsedQuery !== null && parsedQuery >= 1 && parsedQuery <= MUSHAF_JUZS.length
      ? MUSHAF_JUZS[parsedQuery - 1]
      : null;
  const surahResults = useMemo(
    () => searchMushafSurahs(jumpQuery).slice(0, jumpQuery.trim() ? 24 : MUSHAF_SURAHS.length),
    [jumpQuery],
  );
  const juzResults = useMemo(() => {
    const q = jumpQuery.trim().toLowerCase();
    if (!q) return MUSHAF_JUZS;
    return MUSHAF_JUZS.filter((juz) => {
      const label = `juz ${juz.number} page ${juz.startPage}`;
      return String(juz.number) === q || label.includes(q);
    });
  }, [jumpQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialPage() {
      try {
        const dashboard = await apiFetch<DashboardResponse>(
          `/api/children/${childId}/dashboard`,
        );
        if (cancelled) return;

        const goal = dashboard.readingGoal;
        const savedPage =
          goal?.lastPage != null && goal.lastPage >= 1
            ? clampMushafPage(goal.lastPage)
            : 1;
        const startPage = requestedInitialPage ?? savedPage;

        setReadingGoal(goal);
        setLastSavedPage(goal?.lastPage ?? null);
        setCurrentPage(startPage);
        setInitialPage(startPage);
      } catch {
        if (cancelled) return;
        const fallbackPage = requestedInitialPage ?? 1;
        setCurrentPage(fallbackPage);
        setInitialPage(fallbackPage);
      }
    }

    async function loadBookmarks() {
      try {
        const raw = await AsyncStorage.getItem(bookmarkStorageKey(childId));
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return;
        const pages = parsed
          .map((page) => Number(page))
          .filter((page) => Number.isInteger(page) && page >= 1 && page <= TOTAL_MUSHAF_PAGES)
          .slice(0, BOOKMARK_LIMIT);
        setBookmarkedPages(Array.from(new Set(pages)));
      } catch {
        if (!cancelled) setBookmarkError("Bookmarks could not load.");
      }
    }

    loadInitialPage();
    loadBookmarks();

    return () => {
      cancelled = true;
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
    };
  }, [childId, requestedInitialPage]);

  function goToPage(page: number, closeJump = false) {
    const target = clampMushafPage(page);
    setCurrentPage(target);
    setSaveError(null);
    setSaveStatus("idle");
    listRef.current?.scrollToIndex({ index: target - 1, animated: false });
    if (closeJump) {
      setJumpOpen(false);
      setJumpQuery("");
      setPageInput("");
    }
  }

  async function savePage(page: number) {
    const target = clampMushafPage(page);
    setSaveStatus("saving");
    setSaveError(null);

    try {
      const result = await apiFetch<ReadingProgressResponse>(
        `/api/children/${childId}/reading-progress`,
        {
          method: "POST",
          body: JSON.stringify({ currentPage: target }),
        },
      );

      setReadingGoal((current) => ({
        targetPages: current?.targetPages ?? 0,
        completedPages: result.readingCompletedPages ?? current?.completedPages ?? 0,
        lastPage: result.readingLastPage ?? target,
        status: result.readingStatus ?? current?.status ?? "not_started",
        isEnabled: current?.isEnabled ?? false,
      }));
      setLastSavedPage(result.readingLastPage ?? target);
      setSaveStatus("saved");
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
      saveStatusTimer.current = setTimeout(() => setSaveStatus("idle"), 1500);
    } catch (e) {
      setSaveStatus("error");
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
  }

  function scheduleAutoSave(page: number) {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void savePage(page);
    }, 2000);
  }

  function submitPageInput() {
    const page = parsePositiveInteger(pageInput);
    if (page === null) return;
    goToPage(page, true);
  }

  function jumpToSurah(surah: MushafSurah) {
    goToPage(surah.startPage, true);
  }

  function jumpToJuz(juz: MushafJuz) {
    goToPage(juz.startPage, true);
  }

  function toggleBookmark() {
    const page = currentPage;
    setBookmarkError(null);
    setBookmarkedPages((current) => {
      const next = current.includes(page)
        ? current.filter((savedPage) => savedPage !== page)
        : [page, ...current.filter((savedPage) => savedPage !== page)].slice(0, BOOKMARK_LIMIT);
      AsyncStorage.setItem(bookmarkStorageKey(childId), JSON.stringify(next)).catch(() => {
        setBookmarkError("Bookmark could not save.");
      });
      return next;
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={19} color="#2563eb" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Full Quran</Text>
          <Text style={styles.headerSubtitle}>
            Page {currentPage} · Juz {currentJuz}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton} onPress={toggleBookmark}>
            <Ionicons
              name={isBookmarked ? "bookmark" : "bookmark-outline"}
              size={18}
              color={isBookmarked ? "#0f766e" : "#2563eb"}
            />
          </Pressable>
          <Pressable
            style={[styles.saveButton, saveStatus === "saving" && styles.saveButtonDisabled]}
            onPress={() => savePage(currentPage)}
            disabled={saveStatus === "saving"}
          >
            <Text
              style={[
                styles.saveText,
                saveStatus === "saving" && styles.saveTextMuted,
                saveStatus === "saved" && styles.saveTextConfirm,
              ]}
            >
              {saveStatus === "saving" ? "Saving" : saveStatus === "saved" ? "Saved" : "Save"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statusPanel}>
        <View style={styles.statusTopRow}>
          <View style={styles.surahBlock}>
            <Text style={styles.surahTitle} numberOfLines={1}>
              {currentSurah.number}. {currentSurah.name}
            </Text>
            <Text style={styles.surahMeta} numberOfLines={1}>
              {currentSurah.translation} · pages {currentSurah.startPage}-{currentSurah.endPage}
            </Text>
          </View>
          <View style={styles.resumePill}>
            <Text style={styles.resumePillText}>
              {lastSavedPage ? `Saved p. ${lastSavedPage}` : "No saved page"}
            </Text>
          </View>
        </View>
        {memorizationContext ? (
          <View style={styles.sourceContextPill}>
            <Ionicons name="reader-outline" size={14} color="#0369a1" />
            <Text style={styles.sourceContextText} numberOfLines={1}>
              {memorizationContext}
            </Text>
          </View>
        ) : null}
        <View style={styles.progressRow}>
          <View style={styles.progressTextBlock}>
            <Text style={styles.progressLabel}>{goalCopy}</Text>
            <Text style={styles.progressHint} numberOfLines={1}>
              {name ? `${name}'s reading` : "Daily reading"}
            </Text>
          </View>
          <Text style={styles.progressPercent}>{Math.round(ratio * 100)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>
      </View>

      {saveStatus === "error" && saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{saveError}</Text>
        </View>
      )}
      {bookmarkError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{bookmarkError}</Text>
        </View>
      )}

      {initialPage === null ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingCenterText}>Loading saved page</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(page) => String(page)}
          horizontal
          pagingEnabled
          inverted
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialPage - 1}
          getItemLayout={(_, index) => ({
            length: screenW,
            offset: screenW * index,
            index,
          })}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: false });
            }, 80);
          }}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / screenW);
            const page = clampMushafPage(idx + 1);
            setCurrentPage(page);
            scheduleAutoSave(page);
          }}
          renderItem={({ item }) => <PageView pageNumber={item} width={screenW} />}
        />
      )}

      <View style={styles.footer}>
        <View style={styles.footerControls}>
          <Pressable
            style={[styles.footerButton, currentPage <= 1 && styles.footerButtonDisabled]}
            onPress={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <Ionicons name="chevron-back" size={17} color={currentPage <= 1 ? "#9ca3af" : "#2563eb"} />
            <Text style={[styles.footerButtonText, currentPage <= 1 && styles.footerButtonTextDisabled]}>
              Prev
            </Text>
          </Pressable>
          <Pressable style={styles.footerButtonPrimary} onPress={() => setJumpOpen(true)}>
            <Ionicons name="search" size={17} color="#ffffff" />
            <Text style={styles.footerButtonPrimaryText}>Jump</Text>
          </Pressable>
          <Pressable
            style={[
              styles.footerButton,
              currentPage >= TOTAL_MUSHAF_PAGES && styles.footerButtonDisabled,
            ]}
            onPress={() => goToPage(currentPage + 1)}
            disabled={currentPage >= TOTAL_MUSHAF_PAGES}
          >
            <Text
              style={[
                styles.footerButtonText,
                currentPage >= TOTAL_MUSHAF_PAGES && styles.footerButtonTextDisabled,
              ]}
            >
              Next
            </Text>
            <Ionicons
              name="chevron-forward"
              size={17}
              color={currentPage >= TOTAL_MUSHAF_PAGES ? "#9ca3af" : "#2563eb"}
            />
          </Pressable>
        </View>
        <View style={styles.presetRow}>
          {PRESET_PAGES.map((page) => (
            <Pressable
              key={page}
              style={[styles.presetButton, currentPage === page && styles.presetButtonActive]}
              onPress={() => goToPage(page)}
            >
              <Text
                style={[
                  styles.presetButtonText,
                  currentPage === page && styles.presetButtonTextActive,
                ]}
              >
                Page {page}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Modal visible={jumpOpen} animationType="slide" onRequestClose={() => setJumpOpen(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Pressable style={styles.sheetClose} onPress={() => setJumpOpen(false)}>
              <Ionicons name="chevron-down" size={22} color="#2563eb" />
            </Pressable>
            <View style={styles.sheetTitleBlock}>
              <Text style={styles.sheetTitle}>Jump in Quran</Text>
              <Text style={styles.sheetSubtitle}>Page, surah, juz, or saved bookmark</Text>
            </View>
            <View style={styles.sheetHeaderSpacer} />
          </View>

          <View style={styles.pageJumpCard}>
            <Text style={styles.sectionLabel}>Page jump</Text>
            <View style={styles.pageInputRow}>
              <TextInput
                value={pageInput}
                onChangeText={setPageInput}
                placeholder={`Current ${currentPage}`}
                keyboardType="number-pad"
                returnKeyType="go"
                onSubmitEditing={submitPageInput}
                style={styles.pageInput}
              />
              <Pressable style={styles.pageInputButton} onPress={submitPageInput}>
                <Text style={styles.pageInputButtonText}>Go</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#6b7280" />
            <TextInput
              value={jumpQuery}
              onChangeText={setJumpQuery}
              placeholder="Search surahs, pages, or juz"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {jumpQuery ? (
              <Pressable onPress={() => setJumpQuery("")}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            {pageResult !== null || surahResult || juzResult ? (
              <View style={styles.resultGroup}>
                <Text style={styles.sectionLabel}>Quick match</Text>
                {pageResult !== null ? (
                  <JumpRow
                    title={`Page ${pageResult}`}
                    detail={`Juz ${getJuzForMushafPage(pageResult)} · ${
                      getMushafSurahForPage(pageResult).name
                    }`}
                    iconName="reader-outline"
                    color="#2563eb"
                    trailing={`p. ${pageResult}`}
                    onPress={() => goToPage(pageResult, true)}
                  />
                ) : null}
                {surahResult ? (
                  <JumpRow
                    title={`${surahResult.number}. ${surahResult.name}`}
                    detail={`${surahResult.translation} · ${surahResult.verseCount} ayahs`}
                    iconName="book-outline"
                    color="#0f766e"
                    trailing={`p. ${surahResult.startPage}`}
                    onPress={() => jumpToSurah(surahResult)}
                  />
                ) : null}
                {juzResult ? (
                  <JumpRow
                    title={`Juz ${juzResult.number}`}
                    detail={`Pages ${juzResult.startPage}-${juzResult.endPage}`}
                    iconName="albums-outline"
                    color="#7c3aed"
                    trailing={`p. ${juzResult.startPage}`}
                    onPress={() => jumpToJuz(juzResult)}
                  />
                ) : null}
              </View>
            ) : null}

            {bookmarkedPages.length > 0 ? (
              <View style={styles.resultGroup}>
                <Text style={styles.sectionLabel}>Bookmarks</Text>
                {bookmarkedPages.map((page) => {
                  const surah = getMushafSurahForPage(page);
                  return (
                    <JumpRow
                      key={page}
                      title={`Page ${page}`}
                      detail={`${surah.number}. ${surah.name} · Juz ${getJuzForMushafPage(page)}`}
                      iconName="bookmark-outline"
                      color="#0f766e"
                      trailing={`p. ${page}`}
                      onPress={() => goToPage(page, true)}
                    />
                  );
                })}
              </View>
            ) : null}

            <View style={styles.resultGroup}>
              <Text style={styles.sectionLabel}>Juz jump</Text>
              <View style={styles.juzGrid}>
                {juzResults.map((juz) => (
                  <JuzChip key={juz.number} item={juz} onPress={() => jumpToJuz(juz)} />
                ))}
              </View>
            </View>

            <View style={styles.resultGroup}>
              <Text style={styles.sectionLabel}>Surahs</Text>
              {surahResults.map((surah) => (
                <JumpRow
                  key={surah.number}
                  title={`${surah.number}. ${surah.name}`}
                  detail={`${surah.translation} · ${surah.verseCount} ayahs · Juz ${surah.juzStart}`}
                  iconName="book-outline"
                  color={surah.number === currentSurah.number ? "#2563eb" : "#111827"}
                  trailing={`p. ${surah.startPage}`}
                  onPress={() => jumpToSurah(surah)}
                />
              ))}
              {surahResults.length === 0 ? (
                <View style={styles.emptyResults}>
                  <Text style={styles.emptyResultsTitle}>No surahs found</Text>
                  <Text style={styles.emptyResultsDetail}>Try a page number, juz number, or surah name.</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    width: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  backText: {
    fontSize: 15,
    color: "#2563eb",
    fontWeight: "700",
  },
  headerTitleBlock: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111111",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#666666",
    fontWeight: "700",
  },
  headerActions: {
    width: 104,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#ccfbf1",
  },
  saveButton: {
    minWidth: 56,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  saveButtonDisabled: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
  },
  saveText: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "800",
  },
  saveTextMuted: {
    color: "#999999",
  },
  saveTextConfirm: {
    color: "#16a34a",
  },
  statusPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  statusTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  surahBlock: {
    flex: 1,
    minWidth: 0,
  },
  surahTitle: {
    fontSize: 15,
    color: "#111111",
    fontWeight: "800",
  },
  surahMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
  },
  resumePill: {
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resumePillText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "800",
  },
  sourceContextPill: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bae6fd",
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourceContextText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
    color: "#0369a1",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  progressLabel: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "800",
  },
  progressHint: {
    marginTop: 2,
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "600",
  },
  progressPercent: {
    fontSize: 16,
    color: "#0f766e",
    fontWeight: "900",
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#0f766e",
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  errorBannerText: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "700",
  },
  loadingCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  loadingCenterText: {
    fontSize: 13,
    color: "#666666",
    fontWeight: "700",
  },
  pageWrap: {
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pageCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  pageImage: {
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  loadingText: {
    fontSize: 11,
    color: "#666666",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fef2f2",
  },
  errorTitle: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "700",
    marginBottom: 4,
  },
  errorBody: {
    fontSize: 11,
    color: "#dc2626",
    textAlign: "center",
  },
  pageNumberLabel: {
    fontSize: 11,
    color: "#666666",
    marginTop: 6,
    textTransform: "uppercase",
    fontWeight: "800",
  },
  footer: {
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 22,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  footerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  footerButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  footerButtonDisabled: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
  },
  footerButtonText: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "800",
  },
  footerButtonTextDisabled: {
    color: "#9ca3af",
  },
  footerButtonPrimary: {
    flex: 1.15,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  footerButtonPrimaryText: {
    fontSize: 13,
    color: "#ffffff",
    fontWeight: "900",
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
  },
  presetButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  presetButtonActive: {
    backgroundColor: "#ecfeff",
    borderColor: "#67e8f9",
  },
  presetButtonText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "800",
  },
  presetButtonTextActive: {
    color: "#0e7490",
  },
  sheet: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  sheetHeader: {
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetClose: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitleBlock: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 20,
    color: "#111111",
    fontWeight: "900",
  },
  sheetSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#666666",
    fontWeight: "700",
  },
  sheetHeaderSpacer: {
    width: 38,
  },
  pageJumpCard: {
    margin: 16,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 8,
  },
  pageInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  pageInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#111111",
    fontWeight: "700",
  },
  pageInputButton: {
    minWidth: 70,
    borderRadius: 9,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  pageInputButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  searchBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111111",
    fontWeight: "600",
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 16,
  },
  resultGroup: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "900",
    textTransform: "uppercase",
  },
  jumpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  jumpIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  jumpTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  jumpTitle: {
    fontSize: 14,
    color: "#111111",
    fontWeight: "900",
  },
  jumpDetail: {
    marginTop: 2,
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
  },
  jumpTrailing: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "900",
  },
  juzGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  juzChip: {
    width: "23%",
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  juzChipTitle: {
    fontSize: 12,
    color: "#111111",
    fontWeight: "900",
  },
  juzChipDetail: {
    fontSize: 10,
    color: "#666666",
    fontWeight: "700",
  },
  emptyResults: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 4,
  },
  emptyResultsTitle: {
    fontSize: 15,
    color: "#111111",
    fontWeight: "900",
  },
  emptyResultsDetail: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
  },
});
