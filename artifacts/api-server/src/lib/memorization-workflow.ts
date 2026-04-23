import { getPageForVerse, resolveSurahScopedPageTarget } from "../data/quran-meta.js";

export type MemorizationWorkType =
  | "new_memorization"
  | "cumulative_block"
  | "cumulative_full"
  | "final_surah_test";

type SurahLike = {
  id: number;
  number: number;
  verseCount: number;
  nameTransliteration: string;
  nameArabic: string;
};

type ProgressLike = {
  versesMemorized: number;
  memorizedAyahs?: string | null;
};

type DailyProgressLike = {
  memStatus: string;
  memTargetSurah: number | null;
  memTargetAyahStart: number | null;
  memTargetAyahEnd: number | null;
  memTargetEndSurah: number | null;
};

export type SurahMemorizationChunk = {
  index: number;
  ayahStart: number;
  ayahEnd: number;
  pageStart: number;
  pageEnd: number;
};

export type SurahMemorizationWorkItem = {
  scheduleIndex: number;
  workType: MemorizationWorkType;
  workLabel: string;
  isReviewOnly: boolean;
  surahNumber: number;
  surahName: string;
  surahNameArabic: string;
  ayahStart: number;
  ayahEnd: number;
  pageStart: number;
  pageEnd: number;
  currentWorkSurahNumber: number;
  currentWorkSurahName: string;
  currentWorkAyahStart: number;
  currentWorkAyahEnd: number;
  chunkStartIndex: number;
  chunkEndIndex: number;
  estimatedMinutes: number;
};

export type SurahMemorizationWorkflow = {
  enabled: boolean;
  chunks: SurahMemorizationChunk[];
  schedule: SurahMemorizationWorkItem[];
};

const WHOLE_SURAH_TEST_LABEL = "Whole Surah Test";

function getWorkLabel(workType: MemorizationWorkType): string {
  switch (workType) {
    case "new_memorization":
      return "New Memorization";
    case "cumulative_block":
      return "Cumulative Recitation";
    case "cumulative_full":
      return "Full Cumulative Recitation";
    case "final_surah_test":
      return "Whole Surah Test";
  }
}

function parseMemorizedAyahs(raw: string | null | undefined): number[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
          .sort((a, b) => a - b)
      : [];
  } catch {
    return [];
  }
}

export function getConsecutiveMemorizedAyahEnd(
  progress: ProgressLike | undefined,
  verseCount: number,
): number {
  if (!progress) return 0;

  const parsedAyahs = parseMemorizedAyahs(progress.memorizedAyahs);
  if (parsedAyahs.length === 0) {
    return Math.max(0, Math.min(progress.versesMemorized, verseCount));
  }

  let expected = 1;
  for (const ayah of parsedAyahs) {
    if (ayah < expected) continue;
    if (ayah !== expected) break;
    expected += 1;
  }

  return Math.max(0, Math.min(expected - 1, verseCount));
}

export function buildSurahMemorizationWorkflow(
  surah: SurahLike,
  pagesTarget: number,
): SurahMemorizationWorkflow {
  const safePagesTarget = Math.max(pagesTarget, 0.25);
  const chunks: SurahMemorizationChunk[] = [];

  let ayahStart = 1;
  while (ayahStart <= surah.verseCount) {
    const target = resolveSurahScopedPageTarget(surah.number, ayahStart, safePagesTarget);
    const ayahEnd = Math.max(ayahStart, Math.min(target.endAyah, surah.verseCount));

    chunks.push({
      index: chunks.length,
      ayahStart,
      ayahEnd,
      pageStart: getPageForVerse(surah.number, ayahStart),
      pageEnd: getPageForVerse(surah.number, ayahEnd),
    });

    ayahStart = ayahEnd + 1;
  }

  const schedule: SurahMemorizationWorkItem[] = [];
  const pushWork = (
    workType: MemorizationWorkType,
    chunkStartIndex: number,
    chunkEndIndex: number,
    workLabel = getWorkLabel(workType),
  ) => {
    const firstChunk = chunks[chunkStartIndex];
    const lastChunk = chunks[chunkEndIndex];
    if (!firstChunk || !lastChunk) return;

    schedule.push({
      scheduleIndex: schedule.length,
      workType,
      workLabel,
      isReviewOnly: workType !== "new_memorization",
      surahNumber: surah.number,
      surahName: surah.nameTransliteration,
      surahNameArabic: surah.nameArabic,
      ayahStart: firstChunk.ayahStart,
      ayahEnd: lastChunk.ayahEnd,
      pageStart: firstChunk.pageStart,
      pageEnd: lastChunk.pageEnd,
      currentWorkSurahNumber: surah.number,
      currentWorkSurahName: surah.nameTransliteration,
      currentWorkAyahStart: firstChunk.ayahStart,
      currentWorkAyahEnd: lastChunk.ayahEnd,
      chunkStartIndex,
      chunkEndIndex,
      estimatedMinutes: 10,
    });
  };

  for (const chunk of chunks) {
    pushWork("new_memorization", chunk.index, chunk.index);
  }

  if (chunks.length > 1) {
    schedule.length = 0;

    const firstBlockEnd = Math.min(3, chunks.length - 1);
    for (let index = 0; index <= firstBlockEnd; index += 1) {
      pushWork("new_memorization", index, index);
    }

    if (chunks.length >= 4) {
      pushWork("cumulative_full", 0, firstBlockEnd, chunks.length === 4 ? WHOLE_SURAH_TEST_LABEL : undefined);
      if (chunks.length === 4) {
        return { enabled: true, chunks, schedule };
      }

      let cursor = 4;
      while (cursor < chunks.length) {
        const blockStart = cursor;
        const blockEnd = Math.min(cursor + 3, chunks.length - 1);
        for (let index = blockStart; index <= blockEnd; index += 1) {
          pushWork("new_memorization", index, index);
        }
        cursor = blockEnd + 1;

        // If the surah finishes at the same point as the next cumulative cycle,
        // the final full cumulative day doubles as the whole-surah test.
        if (cursor >= chunks.length) {
          const finalBlockLength = blockEnd - blockStart + 1;
          if (finalBlockLength > 1) {
            pushWork("cumulative_block", blockStart, blockEnd);
          }
          pushWork("cumulative_full", 0, blockEnd, WHOLE_SURAH_TEST_LABEL);
          return { enabled: true, chunks, schedule };
        }

        pushWork("cumulative_block", blockStart, blockEnd);
        pushWork("cumulative_full", 0, blockEnd);
      }
    }

    pushWork("final_surah_test", 0, chunks.length - 1);
    return { enabled: true, chunks, schedule };
  }

  return { enabled: false, chunks, schedule };
}

function matchesCompletedDailyRange(
  item: SurahMemorizationWorkItem,
  row: DailyProgressLike,
): boolean {
  const endSurah = row.memTargetEndSurah ?? row.memTargetSurah;
  return (
    row.memStatus === "completed" &&
    row.memTargetSurah === item.surahNumber &&
    endSurah === item.surahNumber &&
    row.memTargetAyahStart === item.ayahStart &&
    row.memTargetAyahEnd === item.ayahEnd
  );
}

export function findMatchingWorkItem(
  workflow: SurahMemorizationWorkflow,
  row: DailyProgressLike | null | undefined,
): SurahMemorizationWorkItem | null {
  if (!row) return null;

  return (
    workflow.schedule.find((item) => {
      const endSurah = row.memTargetEndSurah ?? row.memTargetSurah;
      return (
        row.memTargetSurah === item.surahNumber &&
        endSurah === item.surahNumber &&
        row.memTargetAyahStart === item.ayahStart &&
        row.memTargetAyahEnd === item.ayahEnd
      );
    }) ?? null
  );
}

export function hasStartedIntraSurahWorkflow(
  workflow: SurahMemorizationWorkflow,
  completedDailyRows: DailyProgressLike[],
): boolean {
  if (!workflow.enabled) return false;

  return completedDailyRows.some((row) => findMatchingWorkItem(workflow, row) != null);
}

export function isWorkItemComplete(
  item: SurahMemorizationWorkItem,
  progress: ProgressLike | undefined,
  verseCount: number,
  completedDailyRows: DailyProgressLike[],
): boolean {
  if (item.workType === "new_memorization") {
    return getConsecutiveMemorizedAyahEnd(progress, verseCount) >= item.ayahEnd;
  }

  return completedDailyRows.some((row) => matchesCompletedDailyRange(item, row));
}

export function findPendingWorkItem(
  workflow: SurahMemorizationWorkflow,
  progress: ProgressLike | undefined,
  verseCount: number,
  completedDailyRows: DailyProgressLike[],
  afterIndex = -1,
): SurahMemorizationWorkItem | null {
  for (let index = afterIndex + 1; index < workflow.schedule.length; index += 1) {
    const item = workflow.schedule[index];
    if (!isWorkItemComplete(item, progress, verseCount, completedDailyRows)) {
      return item;
    }
  }

  return null;
}

export function hasPendingIntraSurahWork(
  workflow: SurahMemorizationWorkflow,
  progress: ProgressLike | undefined,
  verseCount: number,
  completedDailyRows: DailyProgressLike[],
): boolean {
  if (!workflow.enabled) return false;
  return findPendingWorkItem(workflow, progress, verseCount, completedDailyRows) !== null;
}
