export const TOTAL_MUSHAF_PAGES = 604;

export type ReadingStatus = "not_started" | "in_progress" | "completed";

type ReadingProgressRow = {
  id?: number;
  date: string;
  readingLastPage: number | null;
  readingCompletedPages?: number | null;
};

type ReadingCompletionInput = {
  currentPage: number;
  previousLastPage: number | null;
  previousCompletedPages: number | null;
  targetPages: number | null;
};

function normalizePage(page: number | null | undefined): number | null {
  if (!Number.isInteger(page) || page == null) return null;
  return Math.max(1, Math.min(TOTAL_MUSHAF_PAGES, page));
}

export function getNextReadingStartPage(
  rows: ReadingProgressRow[],
  today: string,
): number {
  const previousRead = rows
    .filter((row) => row.date < today && normalizePage(row.readingLastPage) != null)
    .sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return (b.id ?? 0) - (a.id ?? 0);
    })[0];

  const lastPage = normalizePage(previousRead?.readingLastPage);
  return lastPage == null ? 1 : Math.min(lastPage + 1, TOTAL_MUSHAF_PAGES);
}

export function getReadingGoalLastPage(
  todayProgress: ReadingProgressRow,
  rows: ReadingProgressRow[],
  today: string,
): number {
  return normalizePage(todayProgress.readingLastPage) ?? getNextReadingStartPage(rows, today);
}

export function calculateReadingCompletedPages({
  currentPage,
  previousLastPage,
  previousCompletedPages,
  targetPages,
}: ReadingCompletionInput): number {
  const safeCurrentPage = normalizePage(currentPage) ?? 1;
  const safePreviousLastPage = normalizePage(previousLastPage);
  const safePreviousCompletedPages = Math.max(0, previousCompletedPages ?? 0);

  const completedPages =
    safePreviousLastPage == null
      ? safePreviousCompletedPages + 1
      : safePreviousCompletedPages <= 0 && safeCurrentPage >= safePreviousLastPage
        ? safeCurrentPage - safePreviousLastPage + 1
        : safePreviousCompletedPages + Math.max(0, safeCurrentPage - safePreviousLastPage);

  return targetPages != null && targetPages > 0
    ? Math.min(completedPages, targetPages)
    : completedPages;
}

export function getReadingStatus(
  completedPages: number,
  targetPages: number | null,
  fallback: ReadingStatus,
): ReadingStatus {
  if (targetPages != null && targetPages > 0 && completedPages >= targetPages) {
    return "completed";
  }

  if (completedPages > 0) {
    return "in_progress";
  }

  return fallback;
}
