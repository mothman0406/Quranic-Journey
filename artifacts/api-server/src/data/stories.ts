import storiesData from "./stories.json" with { type: "json" };

export type StoryType =
  | "quranic_narrative"
  | "seerah_context"
  | "companion_profile"
  | "moral_lesson";

export type StoryAgeGroup = "toddler" | "child" | "preteen" | "teen";

export const STORY_PROPHETS = [
  "adam",
  "idris",
  "nuh",
  "hud",
  "salih",
  "ibrahim",
  "lut",
  "ismail",
  "ishaq",
  "yaqub",
  "yusuf",
  "ayyub",
  "shuaib",
  "musa",
  "harun",
  "dhul-kifl",
  "dawud",
  "sulayman",
  "ilyas",
  "al-yasa",
  "yunus",
  "zakariya",
  "yahya",
  "isa",
  "muhammad",
] as const;

export type StoryProphetId = (typeof STORY_PROPHETS)[number];

export const STORY_THEMES = [
  "worship-allah-alone",
  "trust-in-allah",
  "patience",
  "repentance",
  "gratitude",
  "truthfulness",
  "humility",
  "courage",
  "justice",
  "mercy",
  "forgiveness",
  "family",
  "friendship",
  "generosity",
  "prayer-and-dua",
  "obedience",
  "resisting-pressure",
  "sacrifice",
  "accountability",
  "seeking-knowledge",
  "guidance-and-revelation",
  "blessing-as-trust",
  "unseen-and-faith",
  "community",
  "allahs-power",
] as const;

export type StoryThemeId = (typeof STORY_THEMES)[number];

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
  prophets: StoryProphetId[];
  themes: StoryThemeId[];
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
