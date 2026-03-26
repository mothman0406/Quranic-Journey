import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { memorizationProgressTable, reviewScheduleTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { SURAHS } from "../data/surahs.js";

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

    const versesData = await versesRes.json();
    const verses: QuranComVerse[] = versesData.verses || [];

    let translationVerses: Array<{ text: string }> = [];
    if (translationRes.ok) {
      const translationData = await translationRes.json();
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

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
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
  const progress = await db.select().from(memorizationProgressTable)
    .where(eq(memorizationProgressTable.childId, childId));

  const result = SURAHS.sort((a, b) => a.recommendedOrder - b.recommendedOrder).map(surah => {
    const existing = progress.find(p => p.surahId === surah.id);
    return {
      id: existing?.id || 0,
      childId,
      surahId: surah.id,
      surahName: surah.nameTransliteration,
      surahNumber: surah.number,
      status: existing?.status || "not_started",
      versesMemorized: existing?.versesMemorized || 0,
      totalVerses: surah.verseCount,
      percentComplete: existing ? Math.round((existing.versesMemorized / surah.verseCount) * 100) : 0,
      lastPracticed: existing?.lastPracticed?.toISOString() || null,
      nextReviewDate: existing?.nextReviewDate || null,
      reviewCount: existing?.reviewCount || 0,
      strength: existing?.strength || 1
    };
  });

  res.json({ progress: result });
});

router.post("/children/:childId/memorization", async (req, res) => {
  const childId = parseInt(req.params.childId);
  const { surahId, versesMemorized, status, qualityRating } = req.body;

  const surah = SURAHS.find(s => s.id === surahId);
  if (!surah) { res.status(404).json({ error: "Surah not found" }); return; }

  const [existing] = await db.select().from(memorizationProgressTable)
    .where(and(eq(memorizationProgressTable.childId, childId), eq(memorizationProgressTable.surahId, surahId)));

  const now = new Date();
  const newVersesMemorized = versesMemorized !== undefined ? versesMemorized : (existing?.versesMemorized || 0);
  const newStatus = status || (newVersesMemorized >= surah.verseCount ? "memorized" : newVersesMemorized > 0 ? "in_progress" : "not_started");
  const strength = qualityRating || existing?.strength || 1;
  const nextReview = formatDate(addDays(now, strength >= 4 ? 7 : strength >= 3 ? 3 : 1));

  let record;
  if (existing) {
    [record] = await db.update(memorizationProgressTable).set({
      versesMemorized: newVersesMemorized,
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
      surahId,
      versesMemorized: newVersesMemorized,
      status: newStatus as "not_started" | "in_progress" | "memorized" | "needs_review",
      lastPracticed: now,
      nextReviewDate: nextReview,
      reviewCount: 1,
      strength: Math.min(5, Math.max(1, strength))
    }).returning();

    // Add to review schedule if memorized
    if (newStatus === "memorized") {
      const [existingReview] = await db.select().from(reviewScheduleTable)
        .where(and(eq(reviewScheduleTable.childId, childId), eq(reviewScheduleTable.surahId, surahId)));
      if (!existingReview) {
        await db.insert(reviewScheduleTable).values({
          childId,
          surahId,
          dueDate: formatDate(addDays(now, 1)),
          interval: 1,
          easeFactor: 2.5,
          repetitionCount: 0
        });
      }
    }
  }

  res.json({
    id: record.id,
    childId: record.childId,
    surahId: record.surahId,
    surahName: surah.nameTransliteration,
    surahNumber: surah.number,
    status: record.status,
    versesMemorized: record.versesMemorized,
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
  const today = new Date().toISOString().split("T")[0];

  const allReviews = await db.select().from(reviewScheduleTable)
    .where(eq(reviewScheduleTable.childId, childId));

  const dueToday = allReviews.filter(r => r.dueDate <= today).map(r => {
    const surah = SURAHS.find(s => s.id === r.surahId);
    return {
      id: r.id,
      childId: r.childId,
      surahId: r.surahId,
      surahName: surah?.nameTransliteration || null,
      surahNumber: surah?.number || 0,
      dueDate: r.dueDate,
      interval: r.interval,
      easeFactor: r.easeFactor,
      repetitionCount: r.repetitionCount,
      lastReviewed: r.lastReviewed?.toISOString() || null,
      isOverdue: r.dueDate < today
    };
  });

  const upcoming = allReviews.filter(r => r.dueDate > today).slice(0, 10).map(r => {
    const surah = SURAHS.find(s => s.id === r.surahId);
    return {
      id: r.id,
      childId: r.childId,
      surahId: r.surahId,
      surahName: surah?.nameTransliteration || null,
      surahNumber: surah?.number || 0,
      dueDate: r.dueDate,
      interval: r.interval,
      easeFactor: r.easeFactor,
      repetitionCount: r.repetitionCount,
      lastReviewed: r.lastReviewed?.toISOString() || null,
      isOverdue: false
    };
  });

  res.json({ dueToday, upcoming });
});

router.post("/children/:childId/reviews", async (req, res) => {
  const childId = parseInt(req.params.childId);
  const { surahId, qualityRating, durationMinutes } = req.body;

  const [review] = await db.select().from(reviewScheduleTable)
    .where(and(eq(reviewScheduleTable.childId, childId), eq(reviewScheduleTable.surahId, surahId)));

  const now = new Date();
  const { interval, easeFactor } = sm2(
    review?.easeFactor || 2.5,
    review?.interval || 1,
    qualityRating
  );

  const nextDate = formatDate(new Date(now.getTime() + interval * 24 * 60 * 60 * 1000));

  let updated;
  if (review) {
    [updated] = await db.update(reviewScheduleTable).set({
      dueDate: nextDate,
      interval,
      easeFactor,
      repetitionCount: (review.repetitionCount || 0) + 1,
      lastReviewed: now
    }).where(eq(reviewScheduleTable.id, review.id)).returning();
  } else {
    [updated] = await db.insert(reviewScheduleTable).values({
      childId,
      surahId,
      dueDate: nextDate,
      interval,
      easeFactor,
      repetitionCount: 1,
      lastReviewed: now
    }).returning();
  }

  const surah = SURAHS.find(s => s.id === surahId);
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
