import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { childrenTable, memorizationProgressTable, reviewScheduleTable, learningSessionsTable, childDuasTable, dailyProgressTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { SURAHS } from "../data/surahs.js";
import { resolvePageTarget, resolveSurahScopedPageTarget, getPageForVerse } from "../data/quran-meta.js";
import { STORIES } from "../data/stories.js";
import { DUAS } from "../data/duas.js";

const router: IRouter = Router();

function formatChild(c: typeof childrenTable.$inferSelect) {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    hideStories: !!c.hideStories,
    hideDuas: !!c.hideDuas,
  };
}

// Sorted by recommended learning order (Al-Fatihah first, then back from 114)
const SURAHS_IN_ORDER = [...SURAHS].sort((a, b) => a.recommendedOrder - b.recommendedOrder);

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

function getReviewPriorityRank(
  progress: typeof memorizationProgressTable.$inferSelect | undefined,
): number {
  if (!progress) return 2;
  const strength = progress.strength ?? 3;

  if (progress.status === "needs_review" && strength <= 1) return 0;
  if (progress.status === "needs_review") return 1;
  if (strength <= 1) return 0;
  if (strength <= 3) return 1;
  return 2;
}

function getAgeGroup(age: number): "toddler" | "child" | "preteen" | "teen" {
  if (age <= 6) return "toddler";
  if (age <= 10) return "child";
  if (age <= 14) return "preteen";
  return "teen";
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getAchievements(child: typeof childrenTable.$inferSelect, memProgress: (typeof memorizationProgressTable.$inferSelect)[]) {
  const memorizedSurahs = memProgress.filter(m => m.status === "memorized").length;
  const totalVersesMemorized = memProgress.reduce((sum, m) => sum + m.versesMemorized, 0);

  return [
    {
      id: "first_surah",
      title: "First Surah",
      description: "Memorize your first surah",
      icon: "⭐",
      earned: memorizedSurahs >= 1,
      earnedAt: memorizedSurahs >= 1 ? new Date().toISOString() : null,
      progress: Math.min(memorizedSurahs, 1),
      target: 1
    },
    {
      id: "three_surahs",
      title: "Growing Star",
      description: "Memorize 3 surahs",
      icon: "🌟",
      earned: memorizedSurahs >= 3,
      earnedAt: null,
      progress: Math.min(memorizedSurahs, 3),
      target: 3
    },
    {
      id: "ten_surahs",
      title: "Hafidh Journey",
      description: "Memorize 10 surahs",
      icon: "📖",
      earned: memorizedSurahs >= 10,
      earnedAt: null,
      progress: Math.min(memorizedSurahs, 10),
      target: 10
    },
    {
      id: "streak_7",
      title: "Week Warrior",
      description: "Practice 7 days in a row",
      icon: "🔥",
      earned: child.streakDays >= 7,
      earnedAt: null,
      progress: Math.min(child.streakDays, 7),
      target: 7
    },
    {
      id: "streak_30",
      title: "Month Champion",
      description: "Practice 30 days in a row",
      icon: "🏆",
      earned: child.streakDays >= 30,
      earnedAt: null,
      progress: Math.min(child.streakDays, 30),
      target: 30
    },
    {
      id: "100_verses",
      title: "Verse Collector",
      description: "Memorize 100 verses",
      icon: "💎",
      earned: totalVersesMemorized >= 100,
      earnedAt: null,
      progress: Math.min(totalVersesMemorized, 100),
      target: 100
    }
  ];
}

async function ownsChild(parentId: string, childId: number): Promise<boolean> {
  const [child] = await db.select({ parentId: childrenTable.parentId }).from(childrenTable).where(eq(childrenTable.id, childId));
  return !!child && child.parentId === parentId;
}

function generateAutoGoals(child: typeof childrenTable.$inferSelect, memorizedCount: number, practiceMinutes: number) {
  const today = new Date();
  const goals = [];

  // Based on pace: ~2 surahs per week at 20 min/day, more at higher minutes
  const surahsPerMonth = Math.max(2, Math.floor((practiceMinutes / 20) * 8));

  if (memorizedCount === 0) {
    // First goal: Al-Fatihah in 1 week
    const target = new Date(today);
    target.setDate(target.getDate() + 7);
    goals.push({
      id: "g1",
      title: "Memorize Al-Fatihah",
      description: "Complete your first surah — the foundation of every prayer",
      targetDate: formatDate(target),
      targetSurahCount: 1,
      currentCount: 0,
      type: "surah_count",
      autoGenerated: true
    });
  }

  // 3-month goal
  const threeMonthTarget = new Date(today);
  threeMonthTarget.setMonth(threeMonthTarget.getMonth() + 3);
  const threeMonthGoalCount = memorizedCount + (surahsPerMonth * 3);
  goals.push({
    id: "g2",
    title: `Memorize ${Math.min(threeMonthGoalCount, 15)} surahs`,
    description: `At ${practiceMinutes} min/day, you can memorize about ${surahsPerMonth} surahs per month`,
    targetDate: formatDate(threeMonthTarget),
    targetSurahCount: Math.min(threeMonthGoalCount, 15),
    currentCount: memorizedCount,
    type: "surah_count",
    autoGenerated: true
  });

  // Juz Amma goal (15 surahs in our app)
  if (memorizedCount < 15) {
    const remainingSurahs = 15 - memorizedCount;
    const monthsNeeded = Math.ceil(remainingSurahs / surahsPerMonth);
    const juzAmmaTarget = new Date(today);
    juzAmmaTarget.setMonth(juzAmmaTarget.getMonth() + monthsNeeded);
    goals.push({
      id: "g3",
      title: "Complete Juz Amma",
      description: `Memorize all short surahs — the first milestone for every Hafidh`,
      targetDate: formatDate(juzAmmaTarget),
      targetSurahCount: 15,
      currentCount: memorizedCount,
      type: "juz_amma",
      autoGenerated: true
    });
  }

  return goals;
}

router.get("/children", async (req, res) => {
  const children = await db.select().from(childrenTable)
    .where(eq(childrenTable.parentId, req.user.id))
    .orderBy(desc(childrenTable.createdAt));
  res.json({ children: children.map(formatChild) });
});

router.post("/children", async (req, res) => {
  const { name, age, gender, avatarEmoji, preMemorizedSurahIds, memorationStrength, practiceMinutesPerDay, memorizePagePerDay, reviewPagesPerDay } = req.body;
  const ageGroup = getAgeGroup(age);
  const practiceMinutes = practiceMinutesPerDay || 20;

  const [child] = await db.insert(childrenTable).values({
    parentId: req.user.id,
    name, age, gender, ageGroup,
    avatarEmoji: avatarEmoji || (gender === "female" ? "🌸" : "⭐"),
    lastActiveDate: new Date().toISOString().split("T")[0],
    practiceMinutesPerDay: practiceMinutes,
    memorizePagePerDay: memorizePagePerDay ?? 1.0,
    reviewPagesPerDay: reviewPagesPerDay ?? 2.0,
    onboardingCompleted: 1
  }).returning();

  const now = new Date();

  // Pre-populate memorization for already-known surahs
  if (preMemorizedSurahIds && Array.isArray(preMemorizedSurahIds) && preMemorizedSurahIds.length > 0) {
    const strength = memorationStrength || 3; // 1=weak, 3=solid
    const status = strength >= 3 ? "memorized" : "needs_review";

    for (const surahId of preMemorizedSurahIds) {
      const surahData = SURAHS.find(s => s.id === surahId);
      if (!surahData) continue;

      await db.insert(memorizationProgressTable).values({
        childId: child.id,
        surahId,
        versesMemorized: surahData.verseCount,
        status,
        lastPracticed: now,
        nextReviewDate: formatDate(addDays(now, strength >= 3 ? 7 : 1)),
        reviewCount: 1,
        strength
      });

      // Add to review schedule
      await db.insert(reviewScheduleTable).values({
        childId: child.id,
        surahId,
        dueDate: formatDate(addDays(now, strength >= 3 ? 7 : 1)),
        interval: strength >= 3 ? 7 : 1,
        easeFactor: 2.5,
        repetitionCount: 0
      });
    }
  }

  res.status(201).json(formatChild(child));
});

router.get("/children/:childId", async (req, res) => {
  const childId = parseInt(req.params.childId);
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) { res.status(404).json({ error: "Child not found" }); return; }
  if (child.parentId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(formatChild(child));
});

router.put("/children/:childId", async (req, res) => {
  const childId = parseInt(req.params.childId);
  const [existing] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!existing) { res.status(404).json({ error: "Child not found" }); return; }
  if (existing.parentId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  const updates: Record<string, unknown> = {};
  if (req.body.name) updates.name = req.body.name;
  if (req.body.age) { updates.age = req.body.age; updates.ageGroup = getAgeGroup(req.body.age); }
  if (req.body.avatarEmoji) updates.avatarEmoji = req.body.avatarEmoji;
  if (req.body.goals !== undefined) updates.goals = JSON.stringify(req.body.goals);
  if (req.body.practiceMinutesPerDay) updates.practiceMinutesPerDay = req.body.practiceMinutesPerDay;
  if (req.body.memorizePagePerDay != null) updates.memorizePagePerDay = req.body.memorizePagePerDay;
  if (req.body.reviewPagesPerDay != null) updates.reviewPagesPerDay = req.body.reviewPagesPerDay;
  if (req.body.hideStories !== undefined) updates.hideStories = req.body.hideStories ? 1 : 0;
  if (req.body.hideDuas !== undefined) updates.hideDuas = req.body.hideDuas ? 1 : 0;
  const [child] = await db.update(childrenTable).set(updates).where(eq(childrenTable.id, childId)).returning();
  res.json(formatChild(child));
});

router.get("/children/:childId/goals", async (req, res) => {
  const childId = parseInt(req.params.childId);
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) { res.status(404).json({ error: "Child not found" }); return; }
  if (child.parentId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const memProgress = await db.select().from(memorizationProgressTable).where(eq(memorizationProgressTable.childId, childId));
  const memorizedCount = memProgress.filter(m => m.status === "memorized").length;

  const storedGoals = child.goals ? JSON.parse(child.goals) : null;
  const autoGoals = generateAutoGoals(child, memorizedCount, child.practiceMinutesPerDay);

  res.json({
    goals: storedGoals || autoGoals,
    autoGoals,
    practiceMinutesPerDay: child.practiceMinutesPerDay,
    memorizedCount
  });
});

router.put("/children/:childId/goals", async (req, res) => {
  const childId = parseInt(req.params.childId);
  const { goals } = req.body;
  await db.update(childrenTable).set({ goals: JSON.stringify(goals) }).where(eq(childrenTable.id, childId));
  res.json({ success: true, goals });
});

router.get("/children/:childId/dashboard", async (req, res) => {
  const childId = parseInt(req.params.childId);
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) { res.status(404).json({ error: "Child not found" }); return; }
  if (child.parentId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const memProgress = await db.select().from(memorizationProgressTable).where(eq(memorizationProgressTable.childId, childId));
  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;

  const recentSessionsRaw = await db.select().from(learningSessionsTable)
    .where(eq(learningSessionsTable.childId, childId))
    .orderBy(desc(learningSessionsTable.createdAt))
    .limit(7);

  // All surahs that have been memorized in any form — not just fully memorized
  const workedSurahIds = memProgress
    .filter(m => m.status === "memorized" || m.status === "needs_review" || m.status === "in_progress")
    .map(m => m.surahId);

  // For finding nextSurahData (next to memorize = never touched at all)
  const nextSurahData = SURAHS_IN_ORDER.find(s => !workedSurahIds.includes(s.id));

  // Keep memorizedSurahIds as strictly memorized for achievement counts
  const memorizedSurahIds = memProgress.filter(m => m.status === "memorized").map(m => m.surahId);

  const totalVersesMemorized = memProgress.reduce((sum, m) => sum + m.versesMemorized, 0);
  const juzCompleted = Math.floor(totalVersesMemorized / 200);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyProgress = dayNames.map(day => ({ day, versesMemorized: 0, minutesPracticed: 0 }));

  const randomStory = child.hideStories ? null : (STORIES.find(s => s.ageGroup === child.ageGroup || s.ageGroup === "child") ?? null);
  const randomDua = child.hideDuas ? null : DUAS[0];

  const memorizedCount = memorizedSurahIds.length;
  const fullyDoneReviewableSurahIds = new Set(
    memProgress.filter(isFullyDoneReviewSurah).map((m) => m.surahId)
  );
  const dueReviews = (await db.select().from(reviewScheduleTable).where(
    eq(reviewScheduleTable.childId, childId)
  ))
    .filter((review) => fullyDoneReviewableSurahIds.has(review.surahId))
    .sort((a, b) => {
      const priorityDelta = getReviewPriorityRank(
        memProgress.find((m) => m.surahId === a.surahId),
      ) - getReviewPriorityRank(
        memProgress.find((m) => m.surahId === b.surahId),
      );
      if (priorityDelta !== 0) return priorityDelta;
      return (
        (SURAHS.find((s) => s.id === a.surahId)?.recommendedOrder ?? Number.MAX_SAFE_INTEGER) -
        (SURAHS.find((s) => s.id === b.surahId)?.recommendedOrder ?? Number.MAX_SAFE_INTEGER)
      );
    });

  // Surahs fully done (memorized or needs_review) — excluded from today's target
  const doneSurahIds = new Set(
    memProgress.filter(m => m.status === "memorized" || m.status === "needs_review").map(m => m.surahId)
  );

  // Auto goals for dashboard teaser
  const autoGoals = generateAutoGoals(child, memorizedCount, child.practiceMinutesPerDay);
  const storedGoals = child.goals ? JSON.parse(child.goals) : null;
  const activeGoals = storedGoals || autoGoals;

  // Selection rule: Al-Fatihah first if not done; otherwise farthest in Mushaf
  // (highest surah number) among all not-done surahs.
  const fatihah = SURAHS.find(s => s.number === 1)!;
  const fatiahDone = doneSurahIds.has(fatihah.id);

  let memorizationSurahData: typeof SURAHS[0] | undefined;
  let nextStartSurah = 1;
  let nextStartAyah = 1;
  let inProgressSurah: typeof memProgress[0] | undefined;

  if (!fatiahDone) {
    inProgressSurah = memProgress.find(m => m.surahId === fatihah.id && m.status === "in_progress");
    memorizationSurahData = fatihah;
    nextStartSurah = 1;
    nextStartAyah = (inProgressSurah && inProgressSurah.versesMemorized < fatihah.verseCount)
      ? inProgressSurah.versesMemorized + 1
      : 1;
  } else {
    // Pool: in_progress surahs + nextSurahData (the immediate next not-started surah).
    // Pick the farthest in the Mushaf (highest surah number).
    const inProgressIds = new Set(
      memProgress.filter(m => m.status === "in_progress").map(m => m.surahId)
    );
    const target = SURAHS
      .filter(s => s.number !== 1 && (inProgressIds.has(s.id) || s.id === nextSurahData?.id))
      .sort((a, b) => b.number - a.number)[0];

    if (target) {
      inProgressSurah = memProgress.find(m => m.surahId === target.id && m.status === "in_progress");
      memorizationSurahData = target;
      nextStartSurah = target.number;
      nextStartAyah = (inProgressSurah && inProgressSurah.versesMemorized < target.verseCount)
        ? inProgressSurah.versesMemorized + 1
        : 1;
    }
  }

  // Extend start backward on the same Mushaf page so the daily assignment
  // fills as close to memorizePagePerDay as possible (e.g. 0.75 pages on a
  // 15-verse page → prefer 11 verses over 6).
  // Use getPageForVerse(s, lastAyah) — not SURAH_START_PAGES — because
  // SURAH_START_PAGES has stale placeholder values (604) for surahs 91-100.
  if (memorizationSurahData && !inProgressSurah) {
    const surahPage = getPageForVerse(nextStartSurah, memorizationSurahData.verseCount);
    const totalVersesOnPage = SURAHS.reduce(
      (acc, s) => (getPageForVerse(s.number, s.verseCount) === surahPage ? acc + s.verseCount : acc), 0
    );
    if (totalVersesOnPage > 0) {
      const targetVerseCount = child.memorizePagePerDay * totalVersesOnPage;
      let accumulated = memorizationSurahData.verseCount - (nextStartAyah - 1);
      let bestStartSurah = nextStartSurah;

      for (let s = nextStartSurah - 1; s >= 2; s--) {
        const sd = SURAHS.find(ss => ss.number === s);
        if (!sd || doneSurahIds.has(sd.id)) break;
        if (getPageForVerse(s, sd.verseCount) !== surahPage) break;
        const newTotal = accumulated + sd.verseCount;
        if (Math.abs(targetVerseCount - newTotal) < Math.abs(targetVerseCount - accumulated)) {
          accumulated = newTotal;
          bestStartSurah = s;
        } else {
          break;
        }
      }

      if (bestStartSurah !== nextStartSurah) {
        const bestSurahData = SURAHS.find(ss => ss.number === bestStartSurah)!;
        const earlyInProg = memProgress.find(m => m.surahId === bestSurahData.id && m.status === 'in_progress');
        nextStartSurah = bestStartSurah;
        nextStartAyah = earlyInProg ? earlyInProg.versesMemorized + 1 : 1;
        memorizationSurahData = bestSurahData;
        inProgressSurah = earlyInProg;
      }
    }
  }

  const currentSurahName = memorizationSurahData?.nameTransliteration ?? null;

  const memTarget = memorizationSurahData
    ? (inProgressSurah
        ? resolveSurahScopedPageTarget(nextStartSurah, nextStartAyah, child.memorizePagePerDay)
        : resolvePageTarget(nextStartSurah, nextStartAyah, child.memorizePagePerDay))
    : null;

  let [todayProgress] = await db.select().from(dailyProgressTable)
    .where(and(eq(dailyProgressTable.childId, childId), eq(dailyProgressTable.date, today)));

  if (!todayProgress) {
    [todayProgress] = await db.insert(dailyProgressTable).values({
      childId,
      date: today,
      memTargetSurah: nextStartSurah,
      memTargetAyahStart: nextStartAyah,
      memTargetAyahEnd: memTarget?.endAyah ?? null,
      memTargetEndSurah: memTarget?.endSurah ?? nextStartSurah,
      memStatus: 'not_started',
      reviewTargetCount: null,
      reviewCompletedCount: 0,
      reviewStatus: 'not_started',
    }).returning();
  }

  // Serve frozen daily_progress target when in_progress or completed
  let displaySurahNumber = nextStartSurah;
  let displayAyahStart = nextStartAyah;
  let displayAyahEnd = memTarget?.endAyah ?? nextStartAyah;
  let displaySurahData = memorizationSurahData;

  if (todayProgress.memStatus !== 'not_started' && todayProgress.memTargetSurah) {
    displaySurahNumber = todayProgress.memTargetSurah;
    displayAyahStart = todayProgress.memTargetAyahStart ?? 1;
    displayAyahEnd = todayProgress.memTargetAyahEnd ?? displayAyahEnd;
    displaySurahData = SURAHS.find(s => s.number === todayProgress.memTargetSurah) ?? memorizationSurahData;
  }

  const displaySurahDataFinal = displaySurahData;

  const todaysPlan = {
    date: today,
    newMemorization: displaySurahDataFinal ? (() => {
      const frozen = todayProgress.memStatus !== 'not_started' && !!todayProgress.memTargetSurah;
      const endSurah = frozen
        ? (todayProgress.memTargetEndSurah ?? displaySurahNumber)
        : (memTarget?.endSurah ?? displaySurahNumber);
      const endSurahData = SURAHS.find(s => s.number === endSurah) ?? displaySurahDataFinal;
      const isSameSurah = endSurah === displaySurahNumber;
      // Learning order is descending: higher surah number (e.g. 114) is studied before lower (e.g. 113)
      const isDescending = endSurah > displaySurahNumber;
      const firstWorkData = isDescending ? endSurahData : displaySurahDataFinal;
      const lastWorkData = isDescending ? displaySurahDataFinal : endSurahData;

      // Current work = first incomplete surah in today's range (descending learning order).
      // Defaults to the last in learning order (displaySurahNumber) if all are done.
      let cwNum: number;
      let cwAyahStart: number;
      let cwAyahEnd: number;
      if (!isSameSurah && isDescending) {
        cwNum = displaySurahNumber;
        cwAyahStart = displayAyahStart;
        cwAyahEnd = displaySurahDataFinal.verseCount;
        for (let n = endSurah; n >= displaySurahNumber; n--) {
          const s = SURAHS.find(ss => ss.number === n);
          const mp = s ? memProgress.find(m => m.surahId === s.id) : undefined;
          if (!mp || mp.status !== 'memorized') {
            cwNum = n;
            cwAyahStart = n === displaySurahNumber ? displayAyahStart : 1;
            cwAyahEnd = n === endSurah ? (endSurahData?.verseCount ?? displayAyahEnd) : (s?.verseCount ?? displayAyahEnd);
            break;
          }
        }
      } else {
        cwNum = isDescending ? endSurah : displaySurahNumber;
        cwAyahStart = isDescending ? 1 : displayAyahStart;
        cwAyahEnd = isDescending ? (endSurahData?.verseCount ?? displayAyahEnd) : displayAyahEnd;
      }
      const cwData = SURAHS.find(s => s.number === cwNum);

      return {
        surahName: isSameSurah
          ? displaySurahDataFinal.nameTransliteration
          : `${firstWorkData?.nameTransliteration ?? ''} – ${lastWorkData?.nameTransliteration ?? ''}`,
        surahNumber: displaySurahDataFinal.number,
        currentWorkSurahNumber: cwNum,
        currentWorkSurahName: cwData?.nameTransliteration ?? displaySurahDataFinal.nameTransliteration,
        currentWorkAyahStart: cwAyahStart,
        currentWorkAyahEnd: cwAyahEnd,
        surahNameArabic: displaySurahDataFinal.nameArabic,
        ayahStart: displayAyahStart,
        ayahEnd: Math.min(displayAyahEnd, endSurahData?.verseCount ?? displayAyahEnd),
        endSurahNumber: endSurah,
        pageStart: getPageForVerse(displaySurahNumber, displayAyahStart),
        pageEnd: getPageForVerse(endSurah, displayAyahEnd),
        snapReason: frozen ? undefined : memTarget?.snapReason,
        estimatedMinutes: 10
      };
    })() : null,
    reviewSessions: dueReviews.slice(0, 3).map(r => {
      const surah = SURAHS.find(s => s.id === r.surahId);
      return { surahName: surah?.nameTransliteration || "Unknown", surahNumber: surah?.number || 0, ayahCount: surah?.verseCount || 0 };
    }),
    story: randomStory ? { id: randomStory.id, title: randomStory.title } : null,
    dua: randomDua ? { id: randomDua.id, arabic: randomDua.arabic, transliteration: randomDua.transliteration, translation: randomDua.translation } : null,
    totalEstimatedMinutes: child.practiceMinutesPerDay
  };

  res.json({
    child: formatChild(child),
    todaysPlan,
    memorizationStats: {
      totalSurahsMemorized: memorizedCount,
      totalVersesMemorized,
      juzCompleted,
      currentSurah: currentSurahName || null,
      longestStreak: child.streakDays,
      weeklyProgress
    },
    recentSessions: recentSessionsRaw.map(s => ({
      ...s,
      surahsWorked: JSON.parse(s.surahsWorked || "[]"),
      createdAt: s.createdAt.toISOString()
    })),
    reviewsDueToday: dueReviews.length,
    nextSurah: nextSurahData ? {
      id: nextSurahData.id,
      number: nextSurahData.number,
      nameArabic: nextSurahData.nameArabic,
      nameTransliteration: nextSurahData.nameTransliteration,
      nameTranslation: nextSurahData.nameTranslation,
      verseCount: nextSurahData.verseCount,
      juzStart: nextSurahData.juzStart,
      revelationType: nextSurahData.revelationType,
      difficulty: nextSurahData.difficulty,
      ageGroup: nextSurahData.ageGroup,
      recommendedOrder: nextSurahData.recommendedOrder
    } : null,
    achievements: getAchievements(child, memProgress),
    goals: activeGoals,
    todayProgress: {
      memStatus: todayProgress.memStatus,
      memTargetSurah: todayProgress.memTargetSurah,
      memTargetAyahStart: todayProgress.memTargetAyahStart,
      memTargetAyahEnd: todayProgress.memTargetAyahEnd,
      memCompletedAyahEnd: todayProgress.memCompletedAyahEnd,
      reviewStatus: todayProgress.reviewStatus,
      reviewTargetCount: todayProgress.reviewTargetCount,
      reviewCompletedCount: todayProgress.reviewCompletedCount,
    },
    upNextMemorization: (() => {
      const nextUp = SURAHS_IN_ORDER.find(s => !doneSurahIds.has(s.id));
      if (!nextUp) return null;

      const nextUpProgress = memProgress.find(m => m.surahId === nextUp.id);
      const ayahStart = nextUpProgress && nextUpProgress.status === "in_progress"
        ? Math.min(nextUpProgress.versesMemorized + 1, nextUp.verseCount)
        : 1;
      const nextUpTarget = resolveSurahScopedPageTarget(nextUp.number, ayahStart, child.memorizePagePerDay);
      const ayahEnd = Math.min(nextUpTarget.endAyah, nextUp.verseCount);

      return {
        surahName: nextUp.nameTransliteration,
        surahNumber: nextUp.number,
        ayahStart,
        ayahEnd,
        pageStart: getPageForVerse(nextUp.number, ayahStart),
      };
    })(),
  });
});

router.get("/children/:childId/plan", async (req, res) => {
  const childId = parseInt(req.params.childId);
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) { res.status(404).json({ error: "Child not found" }); return; }
  if (child.parentId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const memProgress = await db.select().from(memorizationProgressTable).where(eq(memorizationProgressTable.childId, childId));
  const memorizedCount = memProgress.filter(m => m.status === "memorized").length;
  const storedGoals = child.goals ? JSON.parse(child.goals) : null;
  const autoGoals = generateAutoGoals(child, memorizedCount, child.practiceMinutesPerDay);

  const plans: Record<string, object> = {
    toddler: {
      ageGroup: "toddler",
      description: "For ages 3–6: Focus on listening, repetition, and love for the Quran. Short sessions, fun and playful. Begin with Al-Fatihah and the short surahs of Juz Amma.",
      weeklyGoal: { memorizationDays: 3, reviewDays: 4, storyDays: 5, duasDays: 7 },
      currentPhase: {
        phaseName: "Seeds of Faith",
        description: "Plant the love of Quran through listening and repetition. No pressure, just joy.",
        surahs: ["Al-Fatihah", "Al-Nas", "Al-Falaq", "Al-Ikhlas", "Al-Kawthar"]
      },
      milestones: [
        { id: "m1", title: "Surah Al-Fatihah", description: "Learn the Opening — recited in every prayer", ageGroup: "toddler", targetSurahs: ["Al-Fatihah"], reward: "🌟 Golden Star Certificate" },
        { id: "m2", title: "First Juz Amma Surahs", description: "Memorize An-Nas, Al-Falaq, Al-Ikhlas", ageGroup: "toddler", targetSurahs: ["An-Nas", "Al-Falaq", "Al-Ikhlas"], reward: "📜 Mini Hafidh Badge" }
      ],
      tajweedRules: [
        { rule: "Listening First", description: "Listen to beautiful recitation before repeating", ageIntroduced: 3 },
        { rule: "Clear pronunciation", description: "Say each letter clearly and distinctly", ageIntroduced: 4 },
        { rule: "Stop and Breathe", description: "Learn where to pause (waqf) in short surahs", ageIntroduced: 5 }
      ]
    },
    child: {
      ageGroup: "child",
      description: "For ages 7–10: Build consistent daily practice. Learn Juz Amma systematically. Introduce tajweed rules through games and stories.",
      weeklyGoal: { memorizationDays: 5, reviewDays: 5, storyDays: 4, duasDays: 7 },
      currentPhase: {
        phaseName: "Building the Foundation",
        description: "Complete Juz Amma with proper tajweed. Review consistently to build strong memory.",
        surahs: ["Al-Fil", "Al-Maun", "Al-Asr", "Az-Zalzalah", "Al-Bayyinah"]
      },
      milestones: [
        { id: "m1", title: "Half of Juz Amma", description: "Memorize surahs 100-114", ageGroup: "child", targetSurahs: ["An-Nas to Al-Qadr"], reward: "🥇 Hafidh Medal" },
        { id: "m2", title: "Complete Juz Amma", description: "Memorize all 37 surahs of Juz Amma", ageGroup: "child", targetSurahs: ["All of Juz Amma"], reward: "🏆 Juz Amma Certificate" }
      ],
      tajweedRules: [
        { rule: "Ghunna", description: "Nasalization on noon and meem when doubled (mushaddad)", ageIntroduced: 7 },
        { rule: "Madd", description: "Elongation — short (2 counts), medium (4 counts), long (6 counts)", ageIntroduced: 7 },
        { rule: "Idghaam", description: "Merging — when noon sakinah is followed by certain letters", ageIntroduced: 8 },
        { rule: "Ikhfa", description: "Hiding — soften the noon sound before 15 letters", ageIntroduced: 8 },
        { rule: "Qalqalah", description: "Echo/bounce on letters ق ط ب ج د when unvoweled", ageIntroduced: 9 }
      ]
    },
    preteen: {
      ageGroup: "preteen",
      description: "For ages 11–14: Move to Juz 29 and work through longer surahs. Understand what you're reciting. Study tafsir of memorized surahs.",
      weeklyGoal: { memorizationDays: 6, reviewDays: 6, storyDays: 3, duasDays: 7 },
      currentPhase: {
        phaseName: "Deepening Understanding",
        description: "Memorize Juz 29, learn tafsir, and understand the messages of each surah.",
        surahs: ["Al-Mulk", "Al-Haqqah", "Al-Maarij", "Nuh", "Al-Jinn"]
      },
      milestones: [
        { id: "m1", title: "Juz 29 Complete", description: "Memorize the complete 29th Juz", ageGroup: "preteen", targetSurahs: ["All of Juz 29"], reward: "📚 Scholar's Certificate" },
        { id: "m2", title: "5 Juz Milestone", description: "Memorize 5 complete juz", ageGroup: "preteen", targetSurahs: ["5 Juz"], reward: "🎓 Hafidh Scholar Badge" }
      ],
      tajweedRules: [
        { rule: "Iqlab", description: "Convert noon sakinah to meem sound before ba", ageIntroduced: 11 },
        { rule: "Idghaam Bila Ghunna", description: "Merging without nasalization before lam and ra", ageIntroduced: 11 },
        { rule: "Makhaarij al-Huruf", description: "Precise articulation points for every Arabic letter", ageIntroduced: 12 },
        { rule: "Sifaat al-Huruf", description: "Characteristics of letters — heavy, light, strong, soft", ageIntroduced: 13 }
      ]
    },
    teen: {
      ageGroup: "teen",
      description: "For ages 15+: Work through the entire Quran systematically. Strong review cycle. Understand tafsir in depth. Aim for Hifz completion.",
      weeklyGoal: { memorizationDays: 6, reviewDays: 7, storyDays: 2, duasDays: 7 },
      currentPhase: {
        phaseName: "The Path to Hifz",
        description: "Systematic memorization with daily new pages, daily review, and weekly revision of all memorized content.",
        surahs: ["Al-Baqarah sections", "Al-Imran sections", "An-Nisa sections"]
      },
      milestones: [
        { id: "m1", title: "10 Juz", description: "Complete first 10 Juz", ageGroup: "teen", targetSurahs: ["10 Juz"], reward: "💫 10 Juz Hafidh Certificate" },
        { id: "m2", title: "Complete Quran", description: "Memorize the entire Quran", ageGroup: "teen", targetSurahs: ["Full Quran"], reward: "🕌 Hafidh Al-Quran Certificate" }
      ],
      tajweedRules: [
        { rule: "Complete Tajweed Mastery", description: "All rules applied perfectly in recitation", ageIntroduced: 15 },
        { rule: "Waqf and Ibtida", description: "Proper stopping and starting places", ageIntroduced: 15 },
        { rule: "Hafs 'an 'Asim", description: "The standard transmission of Quran recitation", ageIntroduced: 16 }
      ]
    }
  };

  res.json({
    ...(plans[child.ageGroup] || plans.child),
    goals: storedGoals || autoGoals,
    autoGoals,
    practiceMinutesPerDay: child.practiceMinutesPerDay
  });
});

router.delete("/children/:childId", async (req, res) => {
  const childId = parseInt(req.params.childId);
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) { res.status(404).json({ error: "Child not found" }); return; }
  if (child.parentId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(memorizationProgressTable).where(eq(memorizationProgressTable.childId, childId));
  await db.delete(reviewScheduleTable).where(eq(reviewScheduleTable.childId, childId));
  await db.delete(learningSessionsTable).where(eq(learningSessionsTable.childId, childId));
  await db.delete(childDuasTable).where(eq(childDuasTable.childId, childId));
  await db.delete(childrenTable).where(eq(childrenTable.id, childId));

  res.status(204).send();
});

router.post("/children/:childId/daily-progress", async (req, res) => {
  const childId = parseInt(req.params.childId);
  if (!await ownsChild(req.user.id, childId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
  const { memStatus, memCompletedAyahEnd, reviewStatus, reviewCompletedCount, reviewTargetCount } = req.body;
  let [row] = await db.select().from(dailyProgressTable)
    .where(and(eq(dailyProgressTable.childId, childId), eq(dailyProgressTable.date, today)));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  // Never downgrade a completed status — the /memorization route sets it authoritatively
  if (memStatus && !(row?.memStatus === 'completed' && memStatus !== 'completed')) updates.memStatus = memStatus;
  if (memCompletedAyahEnd != null) updates.memCompletedAyahEnd = memCompletedAyahEnd;
  // Preserve a completed review session for the day unless the client also reports completed.
  if (reviewStatus && !(row?.reviewStatus === 'completed' && reviewStatus !== 'completed')) updates.reviewStatus = reviewStatus;
  if (reviewCompletedCount != null) updates.reviewCompletedCount = reviewCompletedCount;
  if (reviewTargetCount != null) updates.reviewTargetCount = reviewTargetCount;
  if (row) {
    [row] = await db.update(dailyProgressTable).set(updates).where(eq(dailyProgressTable.id, row.id)).returning();
  }
  res.json(row);
});

router.get("/children/:childId/weekly-progress", async (req, res) => {
  const childId = parseInt(req.params.childId);
  if (!await ownsChild(req.user.id, childId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const rows = await db.select().from(dailyProgressTable)
    .where(eq(dailyProgressTable.childId, childId))
    .orderBy(desc(dailyProgressTable.date))
    .limit(7);
  res.json({ days: rows });
});

export default router;
