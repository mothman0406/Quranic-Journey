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

export async function fetchReviewQueue(childId: string): Promise<ReviewQueueResponse> {
  return apiFetch<ReviewQueueResponse>(`/api/children/${childId}/reviews`);
}

export async function submitReview(
  childId: string,
  surahId: number,
  qualityRating: number,
): Promise<void> {
  await apiFetch(`/api/children/${childId}/reviews`, {
    method: "POST",
    body: JSON.stringify({
      surahId,
      qualityRating,
      durationMinutes: 5,
    }),
  });
}
