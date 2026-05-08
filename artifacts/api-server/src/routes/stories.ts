import { Router, type IRouter } from "express";
import {
  STORIES,
  STORY_PROPHETS,
  STORY_THEMES,
  STORY_TYPE_LABELS,
  getStoriesForAyahRange,
  getStoryByIdOrSlug,
  includePreviousStory,
  summarizeStory,
  type StoryAgeGroup,
  type StoryProphetId,
  type StoryThemeId,
  type StoryType,
} from "../data/stories.js";

const router: IRouter = Router();

const STORY_TYPES: StoryType[] = [
  "quranic_narrative",
  "seerah_context",
  "companion_profile",
  "moral_lesson",
];
const AGE_GROUPS: StoryAgeGroup[] = ["toddler", "child", "preteen", "teen"];
const STORY_PROPHET_SET = new Set<StoryProphetId>(STORY_PROPHETS);
const STORY_THEME_SET = new Set<StoryThemeId>(STORY_THEMES);

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseStoryType(value: unknown): StoryType | null {
  return typeof value === "string" && STORY_TYPES.includes(value as StoryType)
    ? value as StoryType
    : null;
}

function parseAgeGroup(value: unknown): StoryAgeGroup | null {
  return typeof value === "string" && AGE_GROUPS.includes(value as StoryAgeGroup)
    ? value as StoryAgeGroup
    : null;
}

function parseQueryList(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function parseProphets(value: unknown): StoryProphetId[] {
  return parseQueryList(value).filter((item): item is StoryProphetId =>
    STORY_PROPHET_SET.has(item as StoryProphetId),
  );
}

function parseThemes(value: unknown): StoryThemeId[] {
  return parseQueryList(value).filter((item): item is StoryThemeId =>
    STORY_THEME_SET.has(item as StoryThemeId),
  );
}

router.get("/stories/categories", (_req, res) => {
  res.json({
    totalCount: STORIES.length,
    storyTypes: STORY_TYPES.map((storyType) => ({
      storyType,
      label: STORY_TYPE_LABELS[storyType],
      count: STORIES.filter((story) => story.storyType === storyType).length,
    })),
  });
});

router.get("/stories/contextual", (req, res) => {
  const surahNumber = parsePositiveInteger(req.query.surahNumber);
  const ayah = parsePositiveInteger(req.query.ayah);

  if (surahNumber === null) {
    res.status(400).json({ error: "surahNumber is required" });
    return;
  }

  const stories = getStoriesForAyahRange(
    surahNumber,
    ayah ?? undefined,
    ayah ?? undefined,
  ).map(summarizeStory);

  res.json({
    context: { surahNumber, ayah },
    stories,
  });
});

router.get("/stories", (req, res) => {
  const storyType = parseStoryType(req.query.storyType);
  const ageGroup = parseAgeGroup(req.query.ageGroup);
  const prophets = parseProphets(req.query.prophet);
  const themes = parseThemes(req.query.theme);
  const surahNumber = parsePositiveInteger(req.query.surahNumber);
  const ayah = parsePositiveInteger(req.query.ayah);

  let stories = [...STORIES];
  if (storyType) stories = stories.filter((story) => story.storyType === storyType);
  if (ageGroup) stories = stories.filter((story) => story.ageGroup === ageGroup);
  if (prophets.length > 0) {
    stories = stories.filter((story) => story.prophets.some((prophet) => prophets.includes(prophet)));
  }
  if (themes.length > 0) {
    stories = stories.filter((story) => story.themes.some((theme) => themes.includes(theme)));
  }
  if (surahNumber !== null) {
    stories = stories.filter((story) =>
      story.relatedAyahs.some((ref) => {
        if (ref.surahNumber !== surahNumber) return false;
        if (ayah === null) return true;
        return ref.ayahStart <= ayah && ref.ayahEnd >= ayah;
      }),
    );
  }

  res.json({ stories: stories.map(summarizeStory) });
});

router.get("/stories/:storyIdOrSlug", (req, res) => {
  const story = getStoryByIdOrSlug(req.params.storyIdOrSlug);
  if (!story) {
    res.status(404).json({ error: "Story not found" });
    return;
  }

  res.json(includePreviousStory(story));
});

export default router;
