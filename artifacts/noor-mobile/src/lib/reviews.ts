import { apiFetch } from "@/src/lib/api";

export type ReviewPriority = "red" | "orange" | "green";

export type ReviewQueueItem = {
  id: number;
  surahId: number;
  surahName: string | null;
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  pageStart: number;
  pageEnd: number;
  chunkIndex: number;
  chunkCount: number;
  isPartialReview: boolean;
  dueDate: string;
  isOverdue: boolean;
  isWeak: boolean;
  reviewPriority: ReviewPriority;
};

export type ReviewQueueResponse = {
  dueToday: ReviewQueueItem[];
  upcoming: ReviewQueueItem[];
  reviewedToday: ReviewQueueItem[];
};

function localDateHeaders(localDate?: string): HeadersInit | undefined {
  return localDate ? { "x-local-date": localDate } : undefined;
}

export async function fetchReviewQueue(
  childId: string,
  localDate?: string,
): Promise<ReviewQueueResponse> {
  return apiFetch<ReviewQueueResponse>(`/api/children/${childId}/reviews`, {
    headers: localDateHeaders(localDate),
  });
}

export async function submitReview(
  childId: string,
  surahId: number,
  qualityRating: number,
  localDate?: string,
): Promise<void> {
  await apiFetch(`/api/children/${childId}/reviews`, {
    method: "POST",
    headers: localDateHeaders(localDate),
    body: JSON.stringify({
      surahId,
      qualityRating,
      durationMinutes: 5,
    }),
  });
}
