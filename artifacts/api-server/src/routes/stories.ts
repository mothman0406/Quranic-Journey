import { Router, type IRouter } from "express";
import {
  STORIES,
  STORY_TYPE_LABELS,
  getStoriesForAyahRange,
  getStoryByIdOrSlug,
  summarizeStory,
  type StoryAgeGroup,
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
  const surahNumber = parsePositiveInteger(req.query.surahNumber);
  const ayah = parsePositiveInteger(req.query.ayah);

  let stories = [...STORIES];
  if (storyType) stories = stories.filter((story) => story.storyType === storyType);
  if (ageGroup) stories = stories.filter((story) => story.ageGroup === ageGroup);
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

  res.json(story);
});

export default router;
