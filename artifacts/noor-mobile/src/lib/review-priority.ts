import type { ReviewPriority } from "@/src/lib/reviews";

export type ReviewPriorityStyle = {
  label: string;
  text: string;
  bg: string;
  border: string;
  cardBg: string;
};

export const REVIEW_PRIORITY_STYLES: Record<ReviewPriority, ReviewPriorityStyle> = {
  red: {
    label: "Needs care",
    text: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    cardBg: "#fff7f7",
  },
  orange: {
    label: "Practice soon",
    text: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    cardBg: "#fffaf5",
  },
  green: {
    label: "Strong",
    text: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    cardBg: "#f7fff9",
  },
};

export function getReviewPriorityStyle(
  priority: ReviewPriority | string | null | undefined,
): ReviewPriorityStyle {
  if (priority === "red" || priority === "orange" || priority === "green") {
    return REVIEW_PRIORITY_STYLES[priority];
  }
  return REVIEW_PRIORITY_STYLES.green;
}
