#!/usr/bin/env node

import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DRAFTS_DIR = path.join(ROOT, "drafts/stories");
const STORIES_PATH = path.join(ROOT, "artifacts/api-server/src/data/stories.json");

const storyTypes = new Set([
  "quranic_narrative",
  "seerah_context",
  "companion_profile",
  "moral_lesson",
]);
const ageGroups = new Set(["toddler", "child", "preteen", "teen"]);
const storyFields = [
  "id",
  "slug",
  "title",
  "previousStoryId",
  "storyType",
  "ageGroup",
  "summary",
  "readingTimeMinutes",
  "featuredCharacter",
  "morals",
  "content",
  "relatedAyahs",
  "discussionQuestions",
  "sources",
];

function fail(message) {
  throw new Error(message);
}

function assertObject(value, label) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string`);
  }
}

function assertPositiveInteger(value, label, { allowZero = false } = {}) {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isInteger(value) || value < minimum) {
    fail(`${label} must be a ${allowZero ? "non-negative" : "positive"} integer`);
  }
}

function assertNullablePositiveInteger(value, label) {
  if (value !== null && (!Number.isInteger(value) || value < 1)) {
    fail(`${label} must be a positive integer or null`);
  }
}

function assertStringArray(value, label, minLength = 0) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  if (value.length < minLength) fail(`${label} must contain at least ${minLength} item(s)`);
  value.forEach((item, index) => assertString(item, `${label}[${index}]`));
}

function validateSources(value, label) {
  assertObject(value, label);
  if (value.primary != null) assertString(value.primary, `${label}.primary`);
  if (value.notes != null) assertString(value.notes, `${label}.notes`);
  if (value.hadith != null) assertStringArray(value.hadith, `${label}.hadith`);
  if (value.seerah != null) assertStringArray(value.seerah, `${label}.seerah`);
}

function validateAyahRefs(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${label} must be a non-empty array`);
  }

  value.forEach((ref, index) => {
    const refLabel = `${label}[${index}]`;
    assertObject(ref, refLabel);
    assertPositiveInteger(ref.surahNumber, `${refLabel}.surahNumber`);
    assertPositiveInteger(ref.ayahStart, `${refLabel}.ayahStart`);
    assertPositiveInteger(ref.ayahEnd, `${refLabel}.ayahEnd`);
    if (ref.ayahEnd < ref.ayahStart) {
      fail(`${refLabel}.ayahEnd must be greater than or equal to ayahStart`);
    }
    if (ref.label != null) assertString(ref.label, `${refLabel}.label`);
  });
}

function validateStory(story, label, { allowZeroId = false } = {}) {
  assertObject(story, label);
  assertPositiveInteger(story.id, `${label}.id`, { allowZero: allowZeroId });
  assertString(story.slug, `${label}.slug`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(story.slug)) {
    fail(`${label}.slug must be kebab-case lowercase ASCII`);
  }
  assertString(story.title, `${label}.title`);
  assertNullablePositiveInteger(story.previousStoryId, `${label}.previousStoryId`);
  if (!storyTypes.has(story.storyType)) fail(`${label}.storyType is invalid`);
  if (!ageGroups.has(story.ageGroup)) fail(`${label}.ageGroup is invalid`);
  assertString(story.summary, `${label}.summary`);
  assertPositiveInteger(story.readingTimeMinutes, `${label}.readingTimeMinutes`);
  assertString(story.featuredCharacter, `${label}.featuredCharacter`);
  assertStringArray(story.morals, `${label}.morals`, 3);
  assertString(story.content, `${label}.content`);
  validateAyahRefs(story.relatedAyahs, `${label}.relatedAyahs`);
  assertStringArray(story.discussionQuestions, `${label}.discussionQuestions`, 3);
  validateSources(story.sources, `${label}.sources`);
}

function stripMetadata(draft) {
  const story = {};
  for (const field of storyFields) {
    if (draft[field] !== undefined) {
      story[field] = draft[field];
    }
  }
  return story;
}

function validatePreviousStoryReferences(stories, label) {
  const ids = new Set(stories.map((story) => story.id));
  stories.forEach((story) => {
    if (story.previousStoryId != null && !ids.has(story.previousStoryId)) {
      fail(`${label}.${story.slug}.previousStoryId references missing story id ${story.previousStoryId}`);
    }
  });
}

function storySortKey(story) {
  const firstRef = story.relatedAyahs[0] ?? { surahNumber: 999, ayahStart: 999 };
  return [
    story.storyType,
    String(firstRef.surahNumber).padStart(3, "0"),
    String(firstRef.ayahStart).padStart(3, "0"),
    story.slug,
  ].join("|");
}

function sortStories(stories) {
  return [...stories].sort((a, b) => storySortKey(a).localeCompare(storySortKey(b)));
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changedStoryFields(existing, incoming) {
  return storyFields.filter((field) => !valuesEqual(existing[field], incoming[field]));
}

function formatReplacementTarget(existing, incoming) {
  return existing.slug === incoming.slug ? incoming.slug : `${existing.slug} -> ${incoming.slug}`;
}

async function loadStories() {
  const data = JSON.parse(await readFile(STORIES_PATH, "utf8"));
  assertObject(data, "stories.json");
  if (!Array.isArray(data.stories)) fail("stories.json.stories must be an array");
  data.stories.forEach((story, index) => validateStory(story, `stories.json.stories[${index}]`));
  validatePreviousStoryReferences(data.stories, "stories.json.stories");
  return data;
}

async function loadDrafts() {
  const entries = await readdir(DRAFTS_DIR, { withFileTypes: true });
  const drafts = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".json")) continue;
    if (entry.name.startsWith("_")) continue;

    const filePath = path.join(DRAFTS_DIR, entry.name);
    const draft = JSON.parse(await readFile(filePath, "utf8"));
    assertObject(draft, entry.name);
    if (draft.reviewStatus !== "approved" && draft.reviewStatus !== "approved-replace") {
      continue;
    }

    const story = stripMetadata(draft);
    validateStory(story, entry.name, { allowZeroId: true });
    drafts.push({ filePath, filename: entry.name, draft, story });
  }

  return drafts.sort((a, b) => a.filename.localeCompare(b.filename));
}

async function main() {
  const data = await loadStories();
  const drafts = await loadDrafts();
  const stories = [...data.stories];
  const merged = [];
  const replaced = [];

  if (drafts.length === 0) {
    console.log("No approved story drafts found.");
    return;
  }

  for (const { filePath, filename, draft, story } of drafts) {
    if (draft.reviewStatus === "approved-replace") {
      assertPositiveInteger(draft.replaceStoryId, `${filename}.replaceStoryId`);
      const index = stories.findIndex((existing) => existing.id === draft.replaceStoryId);
      if (index === -1) {
        fail(`${filename} is approved-replace but no existing story has id ${draft.replaceStoryId}`);
      }

      const preservedId = stories[index].id;
      if (story.id !== 0 && story.id !== preservedId) {
        fail(`${filename}.id must be 0 or the preserved story id ${preservedId}`);
      }
      if (stories.some((existing) => existing.id !== preservedId && existing.slug === story.slug)) {
        fail(`${filename} would rename to duplicate slug "${story.slug}"`);
      }
      const replacement = { ...story, id: preservedId };
      const changedFields = changedStoryFields(stories[index], replacement);
      console.log(
        `[approved-replace] id ${preservedId} (${formatReplacementTarget(
          stories[index],
          replacement,
        )}): changed fields = [${changedFields.join(", ")}]`,
      );
      stories[index] = replacement;
      replaced.push({ filename, slug: story.slug, id: preservedId });
      await rm(filePath);
      continue;
    }

    if (stories.some((existing) => existing.slug === story.slug)) {
      fail(`${filename} is approved but slug "${story.slug}" already exists; use approved-replace`);
    }

    const nextId = Math.max(0, ...stories.map((existing) => existing.id)) + 1;
    const newStory = { ...story, id: nextId };
    stories.push(newStory);
    merged.push({ filename, slug: story.slug, id: nextId });
    await rm(filePath);
  }

  const output = { stories: sortStories(stories) };
  output.stories.forEach((story, index) => validateStory(story, `output.stories[${index}]`));
  validatePreviousStoryReferences(output.stories, "output.stories");
  await writeFile(STORIES_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log("Story draft merge complete.");
  console.log(`Merged new stories: ${merged.length}`);
  for (const item of merged) {
    console.log(`  + ${item.slug} (id ${item.id}) from ${item.filename}`);
  }
  console.log(`Replaced existing stories: ${replaced.length}`);
  for (const item of replaced) {
    console.log(`  ~ ${item.slug} (preserved id ${item.id}) from ${item.filename}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
