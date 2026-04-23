import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { childrenTable, memorizationProgressTable, reviewScheduleTable, dailyProgressTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { SURAHS } from "../data/surahs.js";
import { getPageForVerse } from "../data/quran-meta.js";
import {
  buildSurahMemorizationWorkflow,
  hasPendingIntraSurahWork,
  hasStartedIntraSurahWorkflow,
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

type ReviewPriority = "red" | "orange" | "green";

function getCanonicalReviewOrder(surahId: number): number {
  return SURAHS.find((s) => s.id === surahId)?.recommendedOrder ?? Number.MAX_SAFE_INTEGER;
}

function isFullyDoneReviewSurah(
  progress: typeof memorizationProgressTable.$inferSelect,
): boolean {
  const surah = SURAHS.find((s) => s.id === progress.surahId);
  if (!surah) return false;

  return (
    (progress.status === "memorized" || progress.status === "needs_review") &&
    progress.versesMemorized >= surah.verseCount
  );
}

function getReviewPriorityFromMemProgress(
  progress: typeof memorizationProgressTable.$inferSelect,
): ReviewPriority {
  const strength = progress.strength ?? 3;

  if (progress.status === "needs_review" && strength <= 1) {
    return "red";
  }
  if (progress.status === "needs_review") {
    return "orange";
  }
  if (strength <= 1) {
    return "red";
  }
  if (strength <= 3) {
    return "orange";
  }
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

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  if (!await ownsChild(req.user.id, childId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const progress = await db.select().from(memorizationProgressTable)
    .where(eq(memorizationProgressTable.childId, childId));

  console.log("[memorization GET] raw DB rows for child", childId, ":", progress.map(p => ({ id: p.id, surahId: p.surahId, status: p.status })));

  const result = SURAHS.sort((a, b) => a.recommendedOrder - b.recommendedOrder).map(surah => {
    const existing = progress.find(p => p.surahId === surah.id);
    if (existing) console.log("[memorization GET] joined surah", surah.id, "(number", surah.number, ") →", existing.status);
    const parsedAyahs: number[] = (() => { try { return JSON.parse(existing?.memorizedAyahs || "[]"); } catch { return []; } })();
    const normalizedAyahs =
      parsedAyahs.length > 0
        ? parsedAyahs
        : (existing?.versesMemorized || 0) > 0
        ? Array.from({ length: existing!.versesMemorized }, (_, i) => i + 1)
        : [];
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
      strength: existing?.strength || 1
    };
  });

  res.json({ progress: result });
});

router.post("/children/:childId/memorization", async (req, res) => {
  const childId = parseInt(req.params.childId);
  if (!await ownsChild(req.user.id, childId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { surahId, versesMemorized, memorizedAyahs: memorizedAyahsInput, status, qualityRating } = req.body;

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
    newMemoizedAyahs = memorizedAyahsInput;
    newVersesMemorized = memorizedAyahsInput.length;
  } else {
    newVersesMemorized = versesMemorized !== undefined ? versesMemorized : (existing?.versesMemorized || 0);
    // Reconstruct ayahs array as consecutive range if coming from legacy path
    const existingAyahs: number[] = (() => { try { return JSON.parse(existing?.memorizedAyahs || "[]"); } catch { return []; } })();
    if (existingAyahs.length > 0) {
      newMemoizedAyahs = existingAyahs;
    } else if (newVersesMemorized > 0) {
      newMemoizedAyahs = Array.from({ length: newVersesMemorized }, (_, i) => i + 1);
    } else {
      newMemoizedAyahs = [];
    }
  }

  const newStatus = status || (newVersesMemorized >= surah.verseCount ? "memorized" : newVersesMemorized > 0 ? "in_progress" : "not_started");
  const strength = qualityRating || existing?.strength || 1;
  const nextReview = formatDate(addDays(now, strength >= 4 ? 7 : strength >= 3 ? 3 : 1));

  let record;
  if (existing) {
    [record] = await db.update(memorizationProgressTable).set({
      versesMemorized: newVersesMemorized,
      memorizedAyahs: JSON.stringify(newMemoizedAyahs),
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
      .where(and(eq(dailyProgressTable.childId, childId), eq(dailyProgressTable.date, todayStr)));

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

  // Step 1 — Local date (not UTC)
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
    .map(m => ({ mem: m, schedule: scheduleRows.find(r => r.surahId === m.surahId) }))
    .filter((x): x is { mem: typeof memProgress[0]; schedule: typeof scheduleRows[0] } => !!x.schedule);

  const redSurahs = reviewableWithSchedule
    .filter(x => getReviewPriorityFromMemProgress(x.mem) === "red")
    .sort(compareByCanonicalReviewOrder);

  const orangeSurahs = reviewableWithSchedule
    .filter(x => getReviewPriorityFromMemProgress(x.mem) === "orange")
    .sort(compareByCanonicalReviewOrder);

  const greenSurahs = reviewableWithSchedule
    .filter(x => getReviewPriorityFromMemProgress(x.mem) === "green")
    .sort(compareByCanonicalReviewOrder);

  const orderedQueue = [...redSurahs, ...orangeSurahs, ...greenSurahs];

  const withinBudget: typeof scheduleRows = [];
  const overBudget: typeof scheduleRows = [];
  const coveredPages = new Set<number>();

  console.log('[review budget] reviewBudget:', reviewBudget,
    'red:', redSurahs.map(x => { const s = SURAHS.find(s2 => s2.id === x.schedule.surahId); const mem = memProgress.find(m => m.surahId === x.schedule.surahId); return `${s?.number}(${mem?.status},str=${mem?.strength})`; }),
    'orange:', orangeSurahs.map(x => { const s = SURAHS.find(s2 => s2.id === x.schedule.surahId); const mem = memProgress.find(m => m.surahId === x.schedule.surahId); return `${s?.number}(${mem?.status},str=${mem?.strength})`; }),
    'green:', greenSurahs.map(x => { const s = SURAHS.find(s2 => s2.id === x.schedule.surahId); const mem = memProgress.find(m => m.surahId === x.schedule.surahId); return `${s?.number}(${mem?.status},str=${mem?.strength})`; }));

  const tryIncludeInQueue = (
    r: typeof scheduleRows[0],
    group: ReviewPriority,
  ) => {
    const surah = SURAHS.find(s => s.id === r.surahId);
    if (!surah) {
      withinBudget.push(r);
      return true;
    }
    const startPage = getPageForVerse(surah.number, 1);
    const endPage = getPageForVerse(surah.number, surah.verseCount);
    const surahPageSet = new Set<number>();
    for (let p = startPage; p <= endPage; p++) surahPageSet.add(p);
    const newPages = [...surahPageSet].filter(p => !coveredPages.has(p));
    const currentUnder = reviewBudget - coveredPages.size;
    const wouldBeOver = (coveredPages.size + newPages.length) - reviewBudget;
    const closerToInclude = newPages.length > 0 && wouldBeOver <= currentUnder;
    const include = coveredPages.size < reviewBudget || newPages.length === 0 || closerToInclude;
    console.log(`[review budget] ${group} surah ${surah.number}: pages=${startPage}-${endPage} newPages=${newPages.length} coveredSize=${coveredPages.size} → ${include ? 'INCLUDE' : 'SKIP'}`);
    if (include) {
      newPages.forEach(p => coveredPages.add(p));
      withinBudget.push(r);
      return true;
    } else {
      overBudget.push(r);
      return false;
    }
  };

  // Step 5b — Walk the queue in canonical priority order and never skip ahead.
  let queueBlocked = false;
  for (const { schedule: r, mem } of orderedQueue) {
    const priority = getReviewPriorityFromMemProgress(mem);
    const surah = SURAHS.find((s) => s.id === r.surahId);
    if (queueBlocked) {
      if (surah) {
        console.log(`[review budget] ${priority} surah ${surah.number}: SKIP (earlier queue item was excluded)`);
      }
      overBudget.push(r);
      continue;
    }
    if (!tryIncludeInQueue(r, priority)) {
      queueBlocked = true;
    }
  }

  // Step 6 — Format response
  const formatReview = (r: typeof reviewScheduleTable.$inferSelect, isOverdue: boolean, priority: ReviewPriority) => {
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
      isOverdue,
      isWeak: priority !== "green",
      reviewPriority: priority,
    };
  };

  // Build todayRange from first ayah of first within-budget surah to last ayah of last
  let todayRange: { fromSurah: number; fromAyah: number; toSurah: number; toAyah: number } | null = null;
  if (withinBudget.length > 0) {
    const firstSurah = SURAHS.find(s => s.id === withinBudget[0].surahId);
    const lastSurah = SURAHS.find(s => s.id === withinBudget[withinBudget.length - 1].surahId);
    if (firstSurah && lastSurah) {
      todayRange = {
        fromSurah: firstSurah.number,
        fromAyah: 1,
        toSurah: lastSurah.number,
        toAyah: lastSurah.verseCount
      };
    }
  }

  const dueToday = withinBudget.map(r => {
    const mem = memProgress.find(m => m.surahId === r.surahId);
    return formatReview(
      r,
      r.dueDate < today,
      mem ? getReviewPriorityFromMemProgress(mem) : "green",
    );
  });

  const upcoming = [...overBudget]
    .map(r => {
      const mem = memProgress.find(m => m.surahId === r.surahId);
      return formatReview(
        r,
        false,
        mem ? getReviewPriorityFromMemProgress(mem) : "green",
      );
    });

  // reviewedToday = only surahs reviewed today that belong to THIS budget session.
  // Simulate the same budget logic on (reviewed-today candidates + withinBudget) combined
  // so that surahs from earlier sessions or prior days don't bleed in.
  const withinBudgetIds = new Set(withinBudget.map(r => r.surahId));

  const reviewedTodayCandidates = reviewableWithSchedule.filter(x =>
    x.schedule.lastReviewed != null &&
    localDateStr(x.schedule.lastReviewed) === today
  );

  const sessionCoveredPages = new Set<number>();
  const sessionSurahIds = new Set<number>();

  // Process reviewed-today first (they were reviewed earlier in the session),
  // then still-pending withinBudget entries — dedup by surahId
  const allSessionCandidates = [
    ...reviewedTodayCandidates,
    ...reviewableWithSchedule.filter(x => withinBudgetIds.has(x.schedule.surahId)),
  ];

  for (const { schedule: r } of allSessionCandidates) {
    if (sessionSurahIds.has(r.surahId)) continue;
    const surah = SURAHS.find(s => s.id === r.surahId);
    if (!surah) { sessionSurahIds.add(r.surahId); continue; }
    const startPage = getPageForVerse(surah.number, 1);
    const endPage = getPageForVerse(surah.number, surah.verseCount);
    const surahPages = new Set<number>();
    for (let p = startPage; p <= endPage; p++) surahPages.add(p);
    const newPagesForSession = [...surahPages].filter(p => !sessionCoveredPages.has(p));
    const currentUnder = reviewBudget - sessionCoveredPages.size;
    const wouldBeOver = (sessionCoveredPages.size + newPagesForSession.length) - reviewBudget;
    const fits = sessionCoveredPages.size < reviewBudget || newPagesForSession.length === 0 || wouldBeOver <= currentUnder;
    if (fits) {
      newPagesForSession.forEach(p => sessionCoveredPages.add(p));
      sessionSurahIds.add(r.surahId);
    }
  }

  const reviewedToday = reviewedTodayCandidates
    .filter(x => sessionSurahIds.has(x.schedule.surahId))
    .map(x => {
      const mem = memProgress.find(m => m.surahId === x.schedule.surahId);
      return formatReview(
        x.schedule,
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

  const [review] = await db.select().from(reviewScheduleTable)
    .where(and(eq(reviewScheduleTable.childId, childId), eq(reviewScheduleTable.surahId, surahId)));
  const [memProgressRow] = await db.select().from(memorizationProgressTable)
    .where(and(eq(memorizationProgressTable.childId, childId), eq(memorizationProgressTable.surahId, surahId)));

  const now = new Date();
  const { interval, easeFactor } = sm2(
    review?.easeFactor || 2.5,
    review?.interval || 1,
    qualityRating
  );

  const nextDate = localDateStr(new Date(now.getTime() + interval * 24 * 60 * 60 * 1000));

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

  if (memProgressRow) {
    const priority = getReviewPriorityFromQuality(qualityRating);
    const nextStatus =
      memProgressRow.status === "in_progress"
        ? "in_progress"
        : priority === "green"
          ? "memorized"
          : "needs_review";

    await db.update(memorizationProgressTable).set({
      status: nextStatus,
      strength: Math.max(0, Math.min(5, qualityRating)),
      lastPracticed: now,
      nextReviewDate: nextDate,
      updatedAt: now,
    }).where(eq(memorizationProgressTable.id, memProgressRow.id));
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
