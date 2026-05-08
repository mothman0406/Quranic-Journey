import { apiFetch } from "@/src/lib/api";

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

export interface Story {
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
  relatedAyahs: StoryAyahRef[];
  sources: StorySources;
}

export type PreviousStorySummary = Pick<Story, "id" | "slug" | "title" | "summary">;

export type StoryDetail = Story & {
  content: string;
  discussionQuestions: string[];
  previousStory?: PreviousStorySummary | null;
};

export interface StoryTypeSummary {
  storyType: StoryType;
  label: string;
  count: number;
}

export type ListStoriesParams = {
  storyType?: StoryType;
  ageGroup?: StoryAgeGroup;
  prophet?: StoryProphetId | StoryProphetId[];
  theme?: StoryThemeId | StoryThemeId[];
  surahNumber?: number;
  ayah?: number;
};

function appendArrayParam<T extends string>(search: URLSearchParams, key: string, value?: T | T[]) {
  if (value === undefined) return;
  const values = Array.isArray(value) ? value : [value];
  values.forEach((item) => search.append(key, item));
}

function buildQuery(params: ListStoriesParams) {
  const search = new URLSearchParams();
  if (params.storyType) search.set("storyType", params.storyType);
  if (params.ageGroup) search.set("ageGroup", params.ageGroup);
  appendArrayParam(search, "prophet", params.prophet);
  appendArrayParam(search, "theme", params.theme);
  if (params.surahNumber !== undefined) search.set("surahNumber", String(params.surahNumber));
  if (params.ayah !== undefined) search.set("ayah", String(params.ayah));
  const value = search.toString();
  return value ? `?${value}` : "";
}

function normalizeStory(story: Story): Story {
  return {
    ...story,
    previousStoryId: story.previousStoryId ?? null,
    morals: story.morals ?? [],
    prophets: story.prophets ?? [],
    themes: story.themes ?? [],
    relatedAyahs: story.relatedAyahs ?? [],
    sources: story.sources ?? {},
  };
}

function normalizeStoryDetail(story: StoryDetail): StoryDetail {
  return {
    ...normalizeStory(story),
    content: story.content ?? "",
    discussionQuestions: story.discussionQuestions ?? [],
    previousStory: story.previousStory ?? null,
  };
}

export async function fetchStoryCategories(): Promise<StoryTypeSummary[]> {
  const response = await apiFetch<{ storyTypes: StoryTypeSummary[] }>("/api/stories/categories");
  return response.storyTypes ?? [];
}

export async function fetchStories(params: ListStoriesParams = {}): Promise<Story[]> {
  const response = await apiFetch<{ stories: Story[] }>(`/api/stories${buildQuery(params)}`);
  return (response.stories ?? []).map(normalizeStory);
}

export async function fetchStory(idOrSlug: string): Promise<StoryDetail> {
  const story = await apiFetch<StoryDetail>(`/api/stories/${encodeURIComponent(idOrSlug)}`);
  return normalizeStoryDetail(story);
}
