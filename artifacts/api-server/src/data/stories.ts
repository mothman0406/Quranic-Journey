import storiesData from "./stories.json" with { type: "json" };

export type StoryType =
  | "quranic_narrative"
  | "seerah_context"
  | "companion_profile"
  | "moral_lesson";

export type StoryAgeGroup = "toddler" | "child" | "preteen" | "teen";

export interface StorySources {
  primary?: string;
  hadith?: string[];
  seerah?: string[];
  notes?: string;
}

export interface StoryAyahRef {
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  label?: string;
}

export interface StoryData {
  id: number;
  slug: string;
  title: string;
  previousStoryId: number | null;
  storyType: StoryType;
  ageGroup: StoryAgeGroup;
  summary: string;
  readingTimeMinutes: number;
  featuredCharacter: string;
  morals: string[];
  content: string;
  relatedAyahs: StoryAyahRef[];
  discussionQuestions: string[];
  sources: StorySources;
}

export type StorySummary = Omit<StoryData, "content" | "discussionQuestions">;
export type PreviousStorySummary = Pick<StoryData, "id" | "slug" | "title" | "summary">;
export type StoryDetail = StoryData & {
  previousStory: PreviousStorySummary | null;
};

export const STORIES: readonly StoryData[] = storiesData.stories as StoryData[];

export const STORY_TYPE_LABELS: Record<StoryType, string> = {
  quranic_narrative: "Quranic Narratives",
  seerah_context: "Seerah Context",
  companion_profile: "Companion Profiles",
  moral_lesson: "Moral Lessons",
};

export function summarizeStory(story: StoryData): StorySummary {
  const { content: _content, discussionQuestions: _discussionQuestions, ...summary } = story;
  return summary;
}

export function summarizePreviousStory(story: StoryData): PreviousStorySummary {
  const { id, slug, title, summary } = story;
  return { id, slug, title, summary };
}

export function includePreviousStory(story: StoryData): StoryDetail {
  const previousStory = story.previousStoryId == null
    ? null
    : STORIES.find((candidate) => candidate.id === story.previousStoryId);

  return {
    ...story,
    previousStory: previousStory ? summarizePreviousStory(previousStory) : null,
  };
}

export function getStoryByIdOrSlug(idOrSlug: string): StoryData | undefined {
  const numericId = Number(idOrSlug);
  if (Number.isInteger(numericId)) {
    return STORIES.find((story) => story.id === numericId);
  }

  return STORIES.find((story) => story.slug === idOrSlug);
}

export function getStoryById(id: number): StoryData | undefined {
  return STORIES.find((story) => story.id === id);
}

function ayahRangesOverlap(
  candidate: StoryAyahRef,
  surahNumber: number,
  ayahStart?: number,
  ayahEnd?: number,
): boolean {
  if (candidate.surahNumber !== surahNumber) return false;
  if (ayahStart == null || ayahEnd == null) return true;
  return candidate.ayahStart <= ayahEnd && candidate.ayahEnd >= ayahStart;
}

export function getStoriesForAyahRange(
  surahNumber: number,
  ayahStart?: number,
  ayahEnd?: number,
): StoryData[] {
  return STORIES.filter((story) =>
    story.relatedAyahs.some((ref) => ayahRangesOverlap(ref, surahNumber, ayahStart, ayahEnd)),
  );
}

export function getStoriesForSurahRange(
  ranges: Array<{ surahNumber: number; ayahStart?: number; ayahEnd?: number }>,
): StoryData[] {
  const seen = new Set<number>();
  const result: StoryData[] = [];

  for (const range of ranges) {
    for (const story of getStoriesForAyahRange(range.surahNumber, range.ayahStart, range.ayahEnd)) {
      if (seen.has(story.id)) continue;
      seen.add(story.id);
      result.push(story);
    }
  }

  return result;
}
