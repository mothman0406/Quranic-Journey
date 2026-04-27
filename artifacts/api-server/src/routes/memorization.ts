import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { childrenTable, memorizationProgressTable, reviewScheduleTable, dailyProgressTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { SURAHS } from "../data/surahs.js";
import { getPageForVerse } from "../data/quran-meta.js";
import { addDaysToLocalDate, getRequestLocalDate, localDateStr } from "../lib/local-date.js";
import {
  buildSurahPageChunks,
  buildSurahMemorizationWorkflow,
  hasPendingIntraSurahWork,
  hasStartedIntraSurahWorkflow,
  type SurahMemorizationChunk,
} from "../lib/memorization-workflow.js";

async function ownsChild(parentId: string, childId: number): Promise<boolean> {
  const [child] = await db.select({ parentId: childrenTable.parentId })
    .from(childrenTable).where(eq(childrenTable.id, childId));
  return child?.parentId === parentId;
}

// In-memory cache for dynamically fetched verses (surah number → verses array)
const versesCache = new Map<number, { number: number; arabic: string; transliteration: string; translation: string }[]>();

type QuranComVerse = {
  verse_number: number;
  verse_key: string;
  words?: Array<{
    char_type_name: string;
    transliteration?: { text: string | null };
    text_uthmani?: string;
  }>;
};

async function fetchVersesFromApi(surahNumber: number): Promise<{ number: number; arabic: string; transliteration: string; translation: string }[]> {
  try {
    // Fetch Arabic text with word-level data (for transliteration) and English translation in parallel
    const perPage = 300; // max verses in a surah is 286 (Al-Baqarah)
    const [versesRes, translationRes] = await Promise.all([
      fetch(
        `https://api.quran.com/api/v4/verses/by_chapter/${surahNumber}?words=true&word_fields=transliteration%2Ctext_uthmani&per_page=${perPage}&fields=text_uthmani`,
        { signal: AbortSignal.timeout(10000) }
      ),
      fetch(
        `https://api.quran.com/api/v4/quran/translations/20?chapter_number=${surahNumber}`,
        { signal: AbortSignal.timeout(8000) }
      )
    ]);

    if (!versesRes.ok) throw new Error(`Verses fetch failed: ${versesRes.status}`);

    const versesData = (await versesRes.json()) as { verses?: QuranComVerse[] };
    const verses: QuranComVerse[] = versesData.verses || [];

    let translationVerses: Array<{ text: string }> = [];
    if (translationRes.ok) {
      const translationData = (await translationRes.json()) as {
        translations?: Array<{ text: string }>;
      };
      translationVerses = translationData.translations || [];
    }

    return verses.map((verse, i) => {
      // Build transliteration by joining word-level transliterations (skip "end" marker words)
      const translit = (verse.words || [])
        .filter(w => w.char_type_name === "word" && w.transliteration?.text)
        .map(w => w.transliteration!.text!)
        .join(" ");

      // Build Arabic from word-level text_uthmani (or fall back to verse-level)
      const arabicWords = (verse.words || [])
        .filter(w => w.char_type_name === "word" && w.text_uthmani)
        .map(w => w.text_uthmani!);
      const arabic = arabicWords.length > 0 ? arabicWords.join(" ") : "";

      const rawTranslation = translationVerses[i]?.text || "";
      const cleanTranslation = rawTranslation.replace(/<[^>]+>/g, "").trim();

      return {
        number: verse.verse_number,
        arabic,
        transliteration: translit,
        translation: cleanTranslation
      };
    });
  } catch (err) {
    console.error(`Failed to fetch verses for surah ${surahNumber}:`, err);
    return [];
  }
}

const router: IRouter = Router();

type ReviewPriority = "red" | "orange" | "green";
type AyahStrengthMap = Record<string, number>;
type MemProgressRow = typeof memorizationProgressTable.$inferSelect;
type ReviewScheduleRow = typeof reviewScheduleTable.$inferSelect;
type SurahMeta = (typeof SURAHS)[number];

type ReviewChunkState = {
  chunks: SurahMemorizationChunk[];
  activeChunk: SurahMemorizationChunk;
  activeChunkIndex: number;
  nextChunk: SurahMemorizationChunk | null;
};

type ReviewableWithScheduleItem = {
  mem: MemProgressRow;
  schedule: ReviewScheduleRow;
  surah: SurahMeta;
  activeChunk: SurahMemorizationChunk;
  activeChunkIndex: number;
  chunkCount: number;
  nextChunk: SurahMemorizationChunk | null;
  reviewedChunk: SurahMemorizationChunk | null;
};

function isReviewContinuationSchedule(
  schedule: Pick<ReviewScheduleRow, "nextChunkAyahStart">,
): boolean {
  return (schedule.nextChunkAyahStart ?? 1) > 1;
}

function clampAyahStrength(value: number | undefined): number {
  if (!Number.isFinite(value)) return 3;
  return Math.max(0, Math.min(5, Math.round(value!)));
}

function parseAyahNumbers(raw: string | null | undefined): number[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    ).sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function buildNormalizedMemorizedAyahs(
  rawAyahs: string | null | undefined,
  versesMemorized: number,
): number[] {
  const parsedAyahs = parseAyahNumbers(rawAyahs);
  if (parsedAyahs.length > 0) return parsedAyahs;
  if (versesMemorized <= 0) return [];
  return Array.from({ length: versesMemorized }, (_, i) => i + 1);
}

function parseAyahStrengths(raw: string | null | undefined): AyahStrengthMap {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [Number(key), clampAyahStrength(Number(value))] as const)
        .filter(([ayah]) => Number.isInteger(ayah) && ayah > 0)
        .map(([ayah, value]) => [String(ayah), value]),
    );
  } catch {
    return {};
  }
}

function normalizeAyahStrengths(
  memorizedAyahs: number[],
  rawStrengths: string | null | undefined,
  fallbackStrength: number,
): AyahStrengthMap {
  const parsed = parseAyahStrengths(rawStrengths);
  const next: AyahStrengthMap = {};

  for (const ayah of memorizedAyahs) {
    next[String(ayah)] = parsed[String(ayah)] ?? clampAyahStrength(fallbackStrength);
  }

  return next;
}

function mergeAyahStrengths(params: {
  memorizedAyahs: number[];
  existingStrengths: AyahStrengthMap;
  fallbackStrength: number;
  ratedAyahs?: number[];
  qualityRating?: number;
  previousMemorizedAyahs?: number[];
}): AyahStrengthMap {
  const {
    memorizedAyahs,
    existingStrengths,
    fallbackStrength,
    ratedAyahs = [],
    qualityRating,
    previousMemorizedAyahs = [],
  } = params;
  const next = normalizeAyahStrengths(
    memorizedAyahs,
    JSON.stringify(existingStrengths),
    fallbackStrength,
  );
  const previousSet = new Set(previousMemorizedAyahs);
  const newAyahs = memorizedAyahs.filter((ayah) => !previousSet.has(ayah));

  if (qualityRating !== undefined && ratedAyahs.length > 0) {
    const strength = clampAyahStrength(qualityRating);
    for (const ayah of ratedAyahs) {
      if (memorizedAyahs.includes(ayah)) {
        next[String(ayah)] = strength;
      }
    }
  } else if (newAyahs.length > 0) {
    const strength =
      qualityRating !== undefined
        ? clampAyahStrength(qualityRating)
        : clampAyahStrength(fallbackStrength);
    for (const ayah of newAyahs) {
      next[String(ayah)] = strength;
    }
  }

  return next;
}

function getCanonicalReviewOrder(surahId: number): number {
  return SURAHS.find((s) => s.id === surahId)?.recommendedOrder ?? Number.MAX_SAFE_INTEGER;
}

function isFullyDoneReviewSurah(
  progress: typeof memorizationProgressTable.$inferSelect,
): boolean {
  const surah = SURAHS.find((s) => s.id === progress.surahId);
  if (!surah) return false;

  return progress.versesMemorized >= surah.verseCount;
}

function getReviewPriorityFromMemProgress(
  progress: typeof memorizationProgressTable.$inferSelect,
): ReviewPriority {
  const surah = SURAHS.find((candidate) => candidate.id === progress.surahId);
  const memorizedAyahs = buildNormalizedMemorizedAyahs(
    progress.memorizedAyahs,
    progress.versesMemorized,
  );
  const normalizedStrengths = normalizeAyahStrengths(
    memorizedAyahs,
    progress.ayahStrengths,
    progress.strength ?? 3,
  );

  const hasRedAyah = memorizedAyahs.some(
    (ayah) => (normalizedStrengths[String(ayah)] ?? progress.strength ?? 3) <= 1,
  );
  if (hasRedAyah) return "red";

  const isFullyMemorized =
    surah != null && memorizedAyahs.length >= surah.verseCount;
  if (!isFullyMemorized) return "orange";

  const hasOrangeAyah = memorizedAyahs.some(
    (ayah) => (normalizedStrengths[String(ayah)] ?? progress.strength ?? 3) <= 3,
  );
  if (hasOrangeAyah) return "orange";

  return "green";
}

function getReviewPriorityFromQuality(qualityRating: number): ReviewPriority {
  if (qualityRating <= 1) return "red";
  if (qualityRating <= 3) return "orange";
  return "green";
}

function compareByCanonicalReviewOrder<T extends { mem: typeof memorizationProgressTable.$inferSelect }>(
  a: T,
  b: T,
) {
  return getCanonicalReviewOrder(a.mem.surahId) - getCanonicalReviewOrder(b.mem.surahId);
}

function compareWithinReviewBucket<
  T extends {
    mem: typeof memorizationProgressTable.$inferSelect;
    schedule: Pick<ReviewScheduleRow, "nextChunkAyahStart" | "lastReviewed">;
  },
>(a: T, b: T) {
  const continuationDelta =
    Number(isReviewContinuationSchedule(b.schedule)) -
    Number(isReviewContinuationSchedule(a.schedule));
  if (continuationDelta !== 0) return continuationDelta;

  const lastReviewedA = a.schedule.lastReviewed?.getTime() ?? 0;
  const lastReviewedB = b.schedule.lastReviewed?.getTime() ?? 0;
  if (lastReviewedA !== lastReviewedB) return lastReviewedA - lastReviewedB;

  return compareByCanonicalReviewOrder(a, b);
}

function prioritizeReviewableWithSchedule<
  T extends {
    mem: typeof memorizationProgressTable.$inferSelect;
    schedule: typeof reviewScheduleTable.$inferSelect;
  },
>(items: T[]) {
  const redSurahs = items
    .filter((item) => getReviewPriorityFromMemProgress(item.mem) === "red")
    .sort(compareWithinReviewBucket);

  const orangeSurahs = items
    .filter((item) => getReviewPriorityFromMemProgress(item.mem) === "orange")
    .sort(compareWithinReviewBucket);

  const greenSurahs = items
    .filter((item) => getReviewPriorityFromMemProgress(item.mem) === "green")
    .sort(compareWithinReviewBucket);

  return {
    redSurahs,
    orangeSurahs,
    greenSurahs,
    orderedQueue: [...redSurahs, ...orangeSurahs, ...greenSurahs],
  };
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getReviewChunksForSurah(
  surah: SurahMeta,
  pagesTarget: number,
): SurahMemorizationChunk[] {
  const chunks = buildSurahPageChunks(surah, pagesTarget);
  if (chunks.length > 0) return chunks;

  return [
    {
      index: 0,
      ayahStart: 1,
      ayahEnd: surah.verseCount,
      pageStart: getPageForVerse(surah.number, 1),
      pageEnd: getPageForVerse(surah.number, surah.verseCount),
    },
  ];
}

function resolveChunkByStartAyah(
  chunks: SurahMemorizationChunk[],
  startAyah: number | null | undefined,
): ReviewChunkState {
  let activeChunkIndex =
    startAyah != null
      ? chunks.findIndex((chunk) => chunk.ayahStart === startAyah)
      : 0;

  if (activeChunkIndex < 0 && startAyah != null) {
    activeChunkIndex = chunks.findIndex((chunk) => chunk.ayahStart >= startAyah);
  }
  if (activeChunkIndex < 0) {
    activeChunkIndex = 0;
  }

  const activeChunk = chunks[activeChunkIndex] ?? chunks[0];

  return {
    chunks,
    activeChunk,
    activeChunkIndex,
    nextChunk: chunks[activeChunkIndex + 1] ?? null,
  };
}

function getActiveReviewChunk(
  surah: SurahMeta,
  schedule: ReviewScheduleRow,
  pagesTarget: number,
): ReviewChunkState {
  return resolveChunkByStartAyah(
    getReviewChunksForSurah(surah, pagesTarget),
    schedule.nextChunkAyahStart ?? 1,
  );
}

function getReviewedChunk(
  surah: SurahMeta,
  schedule: ReviewScheduleRow,
  pagesTarget: number,
): SurahMemorizationChunk | null {
  if (
    schedule.lastReviewedChunkAyahStart == null ||
    schedule.lastReviewedChunkAyahEnd == null
  ) {
    return null;
  }

  const chunks = getReviewChunksForSurah(surah, pagesTarget);
  return (
    chunks.find(
      (chunk) =>
        chunk.ayahStart === schedule.lastReviewedChunkAyahStart &&
        chunk.ayahEnd === schedule.lastReviewedChunkAyahEnd,
    ) ??
    chunks.find((chunk) => chunk.ayahStart === schedule.lastReviewedChunkAyahStart) ??
    null
  );
}

// SM-2 spaced repetition algorithm
function sm2(easeFactor: number, interval: number, quality: number) {
  let newInterval: number;
  let newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEF = Math.max(1.3, newEF);

  if (quality < 3) {
    newInterval = 1;
  } else if (interval === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(interval * newEF);
  }

  return { interval: newInterval, easeFactor: newEF };
}

router.get("/surahs", async (req, res) => {
  const { ageGroup, juz } = req.query;
  let surahs = SURAHS;
  if (ageGroup) surahs = surahs.filter(s => s.ageGroup === ageGroup || s.ageGroup === "all");
  if (juz) surahs = surahs.filter(s => s.juzStart === parseInt(juz as string));
  surahs = surahs.sort((a, b) => a.recommendedOrder - b.recommendedOrder);
  res.json({ surahs: surahs.map(({ verses: _, tafsirBrief: __, tajweedNotes: ___, ...s }) => s) });
});

router.get("/surahs/:surahId", async (req, res) => {
  const surahId = parseInt(req.params.surahId);
  const surah = SURAHS.find(s => s.id === surahId);
  if (!surah) { res.status(404).json({ error: "Surah not found" }); return; }

  let verses = surah.verses;

  // If the surah has no static verses (placeholder), fetch dynamically from Quran.com
  if (!verses || verses.length === 0) {
    if (versesCache.has(surah.number)) {
      verses = versesCache.get(surah.number)!;
    } else {
      const fetched = await fetchVersesFromApi(surah.number);
      if (fetched.length > 0) {
        versesCache.set(surah.number, fetched);
        verses = fetched;
      }
    }
  }

  res.json({
    ...surah,
    verses: verses.map(v => ({ ...v, audioUrl: null, tajweedHighlights: [] }))
  });
});

router.get("/children/:childId/memorization", async (req, res) => {
  const childId = parseInt(req.params.childId);
  if (!await ownsChild(req.user.id, childId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const progress = await db.select().from(memorizationProgressTable)
    .where(eq(memorizationProgressTable.childId, childId));

  console.log("[memorization GET] raw DB rows for child", childId, ":", progress.map(p => ({ id: p.id, surahId: p.surahId, status: p.status })));

  const result = SURAHS.sort((a, b) => a.recommendedOrder - b.recommendedOrder).map(surah => {
    const existing = progress.find(p => p.surahId === surah.id);
    if (existing) console.log("[memorization GET] joined surah", surah.id, "(number", surah.number, ") →", existing.status);
    const normalizedAyahs = buildNormalizedMemorizedAyahs(
      existing?.memorizedAyahs,
      existing?.versesMemorized || 0,
    );
    const ayahStrengths = normalizeAyahStrengths(
      normalizedAyahs,
      existing?.ayahStrengths,
      existing?.strength || 3,
    );
    return {
      id: existing?.id || 0,
      childId,
      surahId: surah.id,
      surahName: surah.nameTransliteration,
      surahNumber: surah.number,
      status: existing?.status || "not_started",
      versesMemorized: existing?.versesMemorized || 0,
      memorizedAyahs: normalizedAyahs,
      totalVerses: surah.verseCount,
      percentComplete: existing ? Math.round((existing.versesMemorized / surah.verseCount) * 100) : 0,
      lastPracticed: existing?.lastPracticed?.toISOString() || null,
      nextReviewDate: existing?.nextReviewDate || null,
      reviewCount: existing?.reviewCount || 0,
      strength: existing?.strength || 1,
      ayahStrengths,
    };
  });

  res.json({ progress: result });
});

router.post("/children/:childId/memorization", async (req, res) => {
  const childId = parseInt(req.params.childId);
  if (!await ownsChild(req.user.id, childId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const {
    surahId,
    versesMemorized,
    memorizedAyahs: memorizedAyahsInput,
    ratedAyahs: ratedAyahsInput,
    status,
    qualityRating,
  } = req.body;

  console.log("[memorization POST] received body:", { surahId, versesMemorized, status, qualityRating, childId });

  // surahId must be the canonical Quran surah number (1–114)
  const surah = SURAHS.find(s => s.number === surahId);
  console.log("[memorization POST] SURAHS lookup by number:", surahId, "→", surah ? `found id=${surah.id} name=${surah.nameTransliteration}` : "NOT FOUND");
  if (!surah) { res.status(404).json({ error: "Surah not found" }); return; }

  // Store using the internal app ID so the GET join works consistently
  const normalizedSurahId = surah.id;
  console.log("[memorization POST] normalizedSurahId (internal):", normalizedSurahId);

  const [existing] = await db.select().from(memorizationProgressTable)
    .where(and(eq(memorizationProgressTable.childId, childId), eq(memorizationProgressTable.surahId, normalizedSurahId)));
  console.log("[memorization POST] existing DB record:", existing ? `id=${existing.id} status=${existing.status}` : "none (will insert)");

  const now = new Date();

  // If memorizedAyahs array is provided, derive versesMemorized from it
  // Otherwise fall back to explicit versesMemorized or existing value
  let newMemoizedAyahs: number[];
  let newVersesMemorized: number;
  if (Array.isArray(memorizedAyahsInput)) {
    newMemoizedAyahs = Array.from(
      new Set(
        memorizedAyahsInput
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value > 0 && value <= surah.verseCount),
      ),
    ).sort((a, b) => a - b);
    newVersesMemorized = newMemoizedAyahs.length;
  } else {
    newVersesMemorized = versesMemorized !== undefined ? versesMemorized : (existing?.versesMemorized || 0);
    // Reconstruct ayahs array as consecutive range if coming from legacy path
    const existingAyahs = buildNormalizedMemorizedAyahs(
      existing?.memorizedAyahs,
      existing?.versesMemorized || 0,
    );
    if (existingAyahs.length > 0) {
      newMemoizedAyahs = existingAyahs;
    } else if (newVersesMemorized > 0) {
      newMemoizedAyahs = Array.from({ length: newVersesMemorized }, (_, i) => i + 1);
    } else {
      newMemoizedAyahs = [];
    }
  }

  const newStatus = status || (newVersesMemorized >= surah.verseCount ? "memorized" : newVersesMemorized > 0 ? "in_progress" : "not_started");
  const strength = qualityRating ?? existing?.strength ?? 1;
  const nextReview = formatDate(addDays(now, strength >= 4 ? 7 : strength >= 3 ? 3 : 1));
  const previousMemorizedAyahs = buildNormalizedMemorizedAyahs(
    existing?.memorizedAyahs,
    existing?.versesMemorized || 0,
  );
  const existingAyahStrengths = parseAyahStrengths(existing?.ayahStrengths);
  const ratedAyahs = Array.isArray(ratedAyahsInput)
    ? Array.from(
        new Set(
          ratedAyahsInput
            .map((value: unknown) => Number(value))
            .filter((value: number) => Number.isInteger(value) && value > 0 && value <= surah.verseCount),
        ),
      ).sort((a, b) => a - b)
    : [];
  const ayahStrengths = mergeAyahStrengths({
    memorizedAyahs: newMemoizedAyahs,
    existingStrengths: existingAyahStrengths,
    fallbackStrength: existing?.strength ?? 3,
    ratedAyahs,
    qualityRating: qualityRating !== undefined ? Number(qualityRating) : undefined,
    previousMemorizedAyahs,
  });

  let record;
  if (existing) {
    [record] = await db.update(memorizationProgressTable).set({
      versesMemorized: newVersesMemorized,
      memorizedAyahs: JSON.stringify(newMemoizedAyahs),
      ayahStrengths: JSON.stringify(ayahStrengths),
      status: newStatus as "not_started" | "in_progress" | "memorized" | "needs_review",
      lastPracticed: now,
      nextReviewDate: nextReview,
      reviewCount: (existing.reviewCount || 0) + 1,
      strength: Math.min(5, Math.max(1, strength)),
      updatedAt: now
    }).where(eq(memorizationProgressTable.id, existing.id)).returning();
  } else {
    [record] = await db.insert(memorizationProgressTable).values({
      childId,
      surahId: normalizedSurahId,
      versesMemorized: newVersesMemorized,
      memorizedAyahs: JSON.stringify(newMemoizedAyahs),
      ayahStrengths: JSON.stringify(ayahStrengths),
      status: newStatus as "not_started" | "in_progress" | "memorized" | "needs_review",
      lastPracticed: now,
      nextReviewDate: nextReview,
      reviewCount: 1,
      strength: Math.min(5, Math.max(1, strength))
    }).returning();
  }

  // Long surahs stay inside the memorization workflow until their cumulative
  // recitation/test days are also complete.
  if (newStatus === "memorized") {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
    if (child) {
      const workflow = buildSurahMemorizationWorkflow(surah, child.memorizePagePerDay);
      const dailyRows = await db.select().from(dailyProgressTable).where(eq(dailyProgressTable.childId, childId));
      const completedMemRows = dailyRows.filter((row) => row.memStatus === "completed");
      const workflowStarted = hasStartedIntraSurahWorkflow(workflow, completedMemRows);

      if (!workflowStarted || !hasPendingIntraSurahWork(workflow, record, surah.verseCount, completedMemRows)) {
        const [existingReview] = await db.select().from(reviewScheduleTable)
          .where(and(eq(reviewScheduleTable.childId, childId), eq(reviewScheduleTable.surahId, normalizedSurahId)));
        if (!existingReview) {
          await db.insert(reviewScheduleTable).values({
            childId,
            surahId: normalizedSurahId,
            dueDate: nextReview,
            nextChunkAyahStart: 1,
            interval: strength >= 4 ? 7 : strength >= 3 ? 3 : 1,
            easeFactor: 2.5,
            repetitionCount: 0
          });
        }
      }
    }
  }

  console.log("[memorization POST] wrote to DB:", { id: record.id, surahId: record.surahId, status: record.status, versesMemorized: record.versesMemorized });

  // Auto-advance daily progress status so the assignment freezes once the session starts
  try {
    const _dd = new Date();
    const todayStr = `${_dd.getFullYear()}-${String(_dd.getMonth()+1).padStart(2,'0')}-${String(_dd.getDate()).padStart(2,'0')}`;
    const [todayProg] = await db.select().from(dailyProgressTable)
      .where(and(eq(dailyProgressTable.childId, childId), eq(dailyProgressTable.date, todayStr)))
      .orderBy(desc(dailyProgressTable.id));

    if (todayProg) {
      if (todayProg.memStatus === 'not_started') {
        await db.update(dailyProgressTable).set({ memStatus: 'in_progress', updatedAt: now })
          .where(eq(dailyProgressTable.id, todayProg.id));
      } else if (todayProg.memStatus === 'in_progress') {
        const targetNum = todayProg.memTargetSurah;
        const endNum = todayProg.memTargetEndSurah ?? targetNum;
        if (targetNum && endNum) {
          const rangeMin = Math.min(targetNum, endNum);
          const rangeMax = Math.max(targetNum, endNum);
          // Re-fetch AFTER the current save so we see the just-updated status
          const freshProg = await db.select().from(memorizationProgressTable)
            .where(eq(memorizationProgressTable.childId, childId));
          const allDone = Array.from({ length: rangeMax - rangeMin + 1 }, (_, i) => rangeMin + i).every(n => {
            const s = SURAHS.find(ss => ss.number === n);
            if (!s) return true;
            const mp = freshProg.find(m => m.surahId === s.id);
            return mp?.status === 'memorized';
          });
          if (allDone) {
            await db.update(dailyProgressTable).set({ memStatus: 'completed', updatedAt: now })
              .where(eq(dailyProgressTable.id, todayProg.id));
          }
        }
      }
    }
  } catch (e) {
    console.error('[memorization POST] failed to update daily progress status:', e);
  }

  const returnedAyahs: number[] = (() => { try { return JSON.parse(record.memorizedAyahs || "[]"); } catch { return []; } })();
  res.json({
    id: record.id,
    childId: record.childId,
    surahId: record.surahId,
    surahName: surah.nameTransliteration,
    surahNumber: surah.number,
    status: record.status,
    versesMemorized: record.versesMemorized,
    memorizedAyahs: returnedAyahs,
    totalVerses: surah.verseCount,
    percentComplete: Math.round((record.versesMemorized / surah.verseCount) * 100),
    lastPracticed: record.lastPracticed?.toISOString() || null,
    nextReviewDate: record.nextReviewDate || null,
    reviewCount: record.reviewCount,
    strength: record.strength
  });
});

router.get("/children/:childId/reviews", async (req, res) => {
  const childId = parseInt(req.params.childId);
  if (!await ownsChild(req.user.id, childId)) { res.status(403).json({ error: "Forbidden" }); return; }

  const [child] = await db.select({ reviewPagesPerDay: childrenTable.reviewPagesPerDay })
    .from(childrenTable).where(eq(childrenTable.id, childId));
  const reviewBudget = child?.reviewPagesPerDay ?? 2.0;

  // Step 1 — Client-local review date when provided, else server local date
  const today = getRequestLocalDate(req);

  // Step 2 — (removed: was deleting unreviewed entries, but Step 4 would immediately recreate
  // them on every refetch, causing new surahs to appear mid-session)

  // Step 3 — Fetch and classify all fully completed surahs that are eligible for review
  const memProgress = await db.select().from(memorizationProgressTable)
    .where(eq(memorizationProgressTable.childId, childId));

  const reviewable = memProgress.filter(isFullyDoneReviewSurah);

  // Step 4 — Auto-create missing review schedule entries
  let scheduleRows = await db.select().from(reviewScheduleTable)
    .where(eq(reviewScheduleTable.childId, childId));

  const scheduledSurahIds = new Set(scheduleRows.map(r => r.surahId));
  const missing = reviewable.filter(m => !scheduledSurahIds.has(m.surahId));
  if (missing.length > 0) {
    await db.insert(reviewScheduleTable).values(
      missing.map(m => ({
        childId,
        surahId: m.surahId,
        dueDate: today,
        nextChunkAyahStart: 1,
        interval: 1,
        easeFactor: 2.5,
        repetitionCount: 0
      }))
    );
    scheduleRows = await db.select().from(reviewScheduleTable)
      .where(eq(reviewScheduleTable.childId, childId));
  }

  // Step 5 — Build prioritized review list: red, then orange, then green.
  const reviewableWithSchedule = reviewable
    .map((mem) => {
      const schedule = scheduleRows.find((row) => row.surahId === mem.surahId);
      const surah = SURAHS.find((candidate) => candidate.id === mem.surahId);
      if (!schedule || !surah) return null;

      const chunkState = getActiveReviewChunk(surah, schedule, reviewBudget);
      return {
        mem,
        schedule,
        surah,
        activeChunk: chunkState.activeChunk,
        activeChunkIndex: chunkState.activeChunkIndex,
        chunkCount: chunkState.chunks.length,
        nextChunk: chunkState.nextChunk,
        reviewedChunk: getReviewedChunk(surah, schedule, reviewBudget),
      } satisfies ReviewableWithScheduleItem;
    })
    .filter((item): item is ReviewableWithScheduleItem => item != null);

  const dueReviewableWithSchedule = reviewableWithSchedule.filter(
    ({ schedule }) => schedule.dueDate <= today,
  );
  const futureReviewableWithSchedule = reviewableWithSchedule.filter(
    ({ schedule }) => schedule.dueDate > today,
  );

  const {
    redSurahs,
    orangeSurahs,
    greenSurahs,
    orderedQueue,
  } = prioritizeReviewableWithSchedule(dueReviewableWithSchedule);
  const { orderedQueue: futureQueue } = prioritizeReviewableWithSchedule(
    futureReviewableWithSchedule,
  );

  const withinBudget: ReviewableWithScheduleItem[] = [];
  const overBudget: ReviewableWithScheduleItem[] = [];
  const coveredPages = new Set<number>();

  console.log('[review budget] reviewBudget:', reviewBudget,
    'red:', redSurahs.map(x => { const s = SURAHS.find(s2 => s2.id === x.schedule.surahId); const mem = memProgress.find(m => m.surahId === x.schedule.surahId); return `${s?.number}(${mem?.status},str=${mem?.strength})`; }),
    'orange:', orangeSurahs.map(x => { const s = SURAHS.find(s2 => s2.id === x.schedule.surahId); const mem = memProgress.find(m => m.surahId === x.schedule.surahId); return `${s?.number}(${mem?.status},str=${mem?.strength})`; }),
    'green:', greenSurahs.map(x => { const s = SURAHS.find(s2 => s2.id === x.schedule.surahId); const mem = memProgress.find(m => m.surahId === x.schedule.surahId); return `${s?.number}(${mem?.status},str=${mem?.strength})`; }));

  const tryIncludeInQueue = (
    item: ReviewableWithScheduleItem,
    group: ReviewPriority,
  ) => {
    const chunkPageSet = new Set<number>();
    for (let p = item.activeChunk.pageStart; p <= item.activeChunk.pageEnd; p += 1) {
      chunkPageSet.add(p);
    }
    const newPages = [...chunkPageSet].filter((p) => !coveredPages.has(p));
    const currentUnder = reviewBudget - coveredPages.size;
    const wouldBeOver = (coveredPages.size + newPages.length) - reviewBudget;
    const closerToInclude = newPages.length > 0 && wouldBeOver <= currentUnder;
    const include = coveredPages.size < reviewBudget || newPages.length === 0 || closerToInclude;
    console.log(
      `[review budget] ${group} surah ${item.surah.number}: ayahs=${item.activeChunk.ayahStart}-${item.activeChunk.ayahEnd} pages=${item.activeChunk.pageStart}-${item.activeChunk.pageEnd} newPages=${newPages.length} coveredSize=${coveredPages.size} → ${include ? "INCLUDE" : "SKIP"}`,
    );
    if (include) {
      newPages.forEach((p) => coveredPages.add(p));
      withinBudget.push(item);
      return true;
    } else {
      overBudget.push(item);
      return false;
    }
  };

  // Step 5b — Walk the queue in canonical priority order and never skip ahead.
  let queueBlocked = false;
  for (const item of orderedQueue) {
    const { schedule: r, mem } = item;
    const priority = getReviewPriorityFromMemProgress(mem);
    const surah = item.surah;
    if (queueBlocked) {
      if (surah) {
        console.log(`[review budget] ${priority} surah ${surah.number}: SKIP (earlier queue item was excluded)`);
      }
      overBudget.push(item);
      continue;
    }
    if (!tryIncludeInQueue(item, priority)) {
      queueBlocked = true;
    }
  }

  // Step 6 — Format response
  const formatReview = (
    item: ReviewableWithScheduleItem,
    chunk: SurahMemorizationChunk,
    chunkIndex: number,
    isOverdue: boolean,
    priority: ReviewPriority,
  ) => {
    const { schedule: r, surah, chunkCount } = item;
    return {
      id: r.id,
      childId: r.childId,
      surahId: r.surahId,
      surahName: surah?.nameTransliteration || null,
      surahNumber: surah?.number || 0,
      ayahStart: chunk.ayahStart,
      ayahEnd: chunk.ayahEnd,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      chunkIndex: chunkIndex + 1,
      chunkCount,
      isPartialReview: chunkCount > 1,
      dueDate: r.dueDate,
      interval: r.interval,
      easeFactor: r.easeFactor,
      repetitionCount: r.repetitionCount,
      lastReviewed: r.lastReviewed?.toISOString() || null,
      isOverdue,
      isWeak: priority !== "green",
      reviewPriority: priority,
    };
  };

  // Build todayRange from first ayah of first within-budget surah to last ayah of last
  let todayRange: { fromSurah: number; fromAyah: number; toSurah: number; toAyah: number } | null = null;
  if (withinBudget.length > 0) {
    const firstItem = withinBudget[0];
    const lastItem = withinBudget[withinBudget.length - 1];
    const firstSurah = firstItem?.surah;
    const lastSurah = lastItem?.surah;
    if (firstSurah && lastSurah) {
      todayRange = {
        fromSurah: firstSurah.number,
        fromAyah: firstItem.activeChunk.ayahStart,
        toSurah: lastSurah.number,
        toAyah: lastItem.activeChunk.ayahEnd,
      };
    }
  }

  const dueToday = withinBudget.map((item) => {
    const mem = memProgress.find((m) => m.surahId === item.schedule.surahId);
    return formatReview(
      item,
      item.activeChunk,
      item.activeChunkIndex,
      item.schedule.dueDate < today,
      mem ? getReviewPriorityFromMemProgress(mem) : "green",
    );
  });

  const upcoming = [...overBudget]
    .map((item) => {
      const mem = memProgress.find((m) => m.surahId === item.schedule.surahId);
      return formatReview(
        item,
        item.activeChunk,
        item.activeChunkIndex,
        false,
        mem ? getReviewPriorityFromMemProgress(mem) : "green",
      );
    })
    .concat(
      futureQueue.map((item) =>
        formatReview(
          item,
          item.activeChunk,
          item.activeChunkIndex,
          false,
          getReviewPriorityFromMemProgress(item.mem),
        ),
      ),
    );

  const reviewedToday = reviewableWithSchedule
    .filter(
      (item) =>
        item.schedule.lastReviewed != null &&
        localDateStr(item.schedule.lastReviewed) === today &&
        item.reviewedChunk != null,
    )
    .map((item) => {
      const mem = memProgress.find((m) => m.surahId === item.schedule.surahId);
      return formatReview(
        item,
        item.reviewedChunk ?? item.activeChunk,
        item.reviewedChunk?.index ?? item.activeChunkIndex,
        false,
        mem ? getReviewPriorityFromMemProgress(mem) : "green",
      );
    });

  res.json({ dueToday, upcoming, todayRange, reviewedToday });
});

router.post("/children/:childId/reviews", async (req, res) => {
  const childId = parseInt(req.params.childId);
  if (!await ownsChild(req.user.id, childId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { surahId, qualityRating, durationMinutes } = req.body;

  const [child] = await db.select({ reviewPagesPerDay: childrenTable.reviewPagesPerDay })
    .from(childrenTable).where(eq(childrenTable.id, childId));
  const [review] = await db.select().from(reviewScheduleTable)
    .where(and(eq(reviewScheduleTable.childId, childId), eq(reviewScheduleTable.surahId, surahId)));
  const [memProgressRow] = await db.select().from(memorizationProgressTable)
    .where(and(eq(memorizationProgressTable.childId, childId), eq(memorizationProgressTable.surahId, surahId)));
  const surah = SURAHS.find((candidate) => candidate.id === surahId);
  if (!surah) { res.status(404).json({ error: "Surah not found" }); return; }

  const now = new Date();
  const today = getRequestLocalDate(req);
  const reviewPagesPerDay = child?.reviewPagesPerDay ?? 2.0;
  const reviewChunkState = review
    ? getActiveReviewChunk(surah, review, reviewPagesPerDay)
    : resolveChunkByStartAyah(getReviewChunksForSurah(surah, reviewPagesPerDay), 1);
  const reviewedAyahs = Array.from(
    {
      length:
        reviewChunkState.activeChunk.ayahEnd -
        reviewChunkState.activeChunk.ayahStart +
        1,
    },
    (_, index) => reviewChunkState.activeChunk.ayahStart + index,
  );
  const isFinalChunk = reviewChunkState.nextChunk == null;
  const { interval, easeFactor } = sm2(
    review?.easeFactor || 2.5,
    review?.interval || 1,
    qualityRating
  );

  const nextDate = addDaysToLocalDate(today, isFinalChunk ? interval : 1);

  let updated;
  if (review) {
    [updated] = await db.update(reviewScheduleTable).set({
      dueDate: nextDate,
      nextChunkAyahStart: reviewChunkState.nextChunk?.ayahStart ?? 1,
      interval: isFinalChunk ? interval : review.interval,
      easeFactor: isFinalChunk ? easeFactor : review.easeFactor,
      repetitionCount: isFinalChunk
        ? (review.repetitionCount || 0) + 1
        : review.repetitionCount,
      lastReviewed: now,
      lastReviewedChunkAyahStart: reviewChunkState.activeChunk.ayahStart,
      lastReviewedChunkAyahEnd: reviewChunkState.activeChunk.ayahEnd,
    }).where(eq(reviewScheduleTable.id, review.id)).returning();
  } else {
    [updated] = await db.insert(reviewScheduleTable).values({
      childId,
      surahId,
      dueDate: nextDate,
      nextChunkAyahStart: reviewChunkState.nextChunk?.ayahStart ?? 1,
      interval: isFinalChunk ? interval : 1,
      easeFactor: isFinalChunk ? easeFactor : 2.5,
      repetitionCount: isFinalChunk ? 1 : 0,
      lastReviewed: now,
      lastReviewedChunkAyahStart: reviewChunkState.activeChunk.ayahStart,
      lastReviewedChunkAyahEnd: reviewChunkState.activeChunk.ayahEnd,
    }).returning();
  }

  if (memProgressRow) {
    const priority = getReviewPriorityFromQuality(qualityRating);
    const memorizedAyahs = buildNormalizedMemorizedAyahs(
      memProgressRow.memorizedAyahs,
      memProgressRow.versesMemorized,
    );
    const isFullyMemorized = memorizedAyahs.length >= surah.verseCount;
    const nextStatus =
      isFullyMemorized
        ? priority === "green"
          ? "memorized"
          : "needs_review"
        : memProgressRow.status === "in_progress"
          ? "in_progress"
          : priority === "green"
            ? "memorized"
            : "needs_review";
    const ayahStrengths = mergeAyahStrengths({
      memorizedAyahs,
      existingStrengths: parseAyahStrengths(memProgressRow.ayahStrengths),
      fallbackStrength: memProgressRow.strength ?? 3,
      ratedAyahs: reviewedAyahs,
      qualityRating,
      previousMemorizedAyahs: memorizedAyahs,
    });

    await db.update(memorizationProgressTable).set({
      status: nextStatus,
      strength: Math.max(0, Math.min(5, qualityRating)),
      ayahStrengths: JSON.stringify(ayahStrengths),
      lastPracticed: now,
      nextReviewDate: nextDate,
      updatedAt: now,
    }).where(eq(memorizationProgressTable.id, memProgressRow.id));
  }

  res.json({
    id: updated.id,
    childId: updated.childId,
    surahId: updated.surahId,
    surahName: surah?.nameTransliteration || null,
    surahNumber: surah?.number || 0,
    dueDate: updated.dueDate,
    interval: updated.interval,
    easeFactor: updated.easeFactor,
    repetitionCount: updated.repetitionCount,
    lastReviewed: updated.lastReviewed?.toISOString() || null,
    isOverdue: false
  });
});

export default router;
