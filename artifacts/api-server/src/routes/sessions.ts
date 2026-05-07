import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { learningSessionsTable, childrenTable, childDuasTable } from "@workspace/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { DUA_CATEGORIES, getDuasByCategory, type Dua } from "../data/duas.js";

function getAllDuas(): Dua[] {
  return DUA_CATEGORIES.flatMap((category) => getDuasByCategory(category.slug));
}

function getLegacyCategory(categorySlug: string): "morning" | "evening" | "general" | "prayer" {
  if (categorySlug === "morning-dhikr") return "morning";
  if (categorySlug === "evening-dhikr") return "evening";
  if (categorySlug === "dhikr-after-salah") return "prayer";
  return "general";
}

function formatChildProgressDua(dua: Dua) {
  return {
    ...dua,
    occasion: dua.title,
    category: getLegacyCategory(dua.categorySlug),
    ageGroup: "all" as const,
    source: dua.reference ?? "",
    importance: dua.repetitions && dua.repetitions > 1 ? "important" as const : "recommended" as const,
    memorizationOrder: dua.id,
  };
}

async function ownsChild(parentId: string, childId: number): Promise<boolean> {
  const [child] = await db.select({ parentId: childrenTable.parentId })
    .from(childrenTable).where(eq(childrenTable.id, childId));
  return child?.parentId === parentId;
}

const router: IRouter = Router();

router.get("/children/:childId/sessions", async (req, res) => {
  const childId = parseInt(req.params.childId);
  if (!await ownsChild(req.user.id, childId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const limit = parseInt(req.query.limit as string) || 30;
  const sessions = await db.select().from(learningSessionsTable)
    .where(eq(learningSessionsTable.childId, childId))
    .orderBy(desc(learningSessionsTable.createdAt))
    .limit(limit);
  res.json({
    sessions: sessions.map(s => ({
      ...s,
      surahsWorked: JSON.parse(s.surahsWorked || "[]"),
      createdAt: s.createdAt.toISOString()
    }))
  });
});

router.post("/children/:childId/sessions", async (req, res) => {
  const childId = parseInt(req.params.childId);
  if (!await ownsChild(req.user.id, childId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { sessionType, durationMinutes, surahsWorked, notes } = req.body;
  const points = durationMinutes * 2;
  const today = new Date().toISOString().split("T")[0];

  const [session] = await db.insert(learningSessionsTable).values({
    childId,
    date: today,
    sessionType,
    durationMinutes,
    pointsEarned: points,
    surahsWorked: JSON.stringify(surahsWorked || []),
    notes: notes || null
  }).returning();

  // Update child streak and points
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (child) {
    const lastActive = child.lastActiveDate;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const newStreak = lastActive === yesterdayStr ? child.streakDays + 1 : lastActive === today ? child.streakDays : 1;
    await db.update(childrenTable).set({
      streakDays: newStreak,
      totalPoints: child.totalPoints + points,
      lastActiveDate: today
    }).where(eq(childrenTable.id, childId));
  }

  res.status(201).json({
    ...session,
    surahsWorked: JSON.parse(session.surahsWorked || "[]"),
    createdAt: session.createdAt.toISOString()
  });
});

router.get("/children/:childId/duas", async (req, res) => {
  const childId = parseInt(req.params.childId);
  if (!await ownsChild(req.user.id, childId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const childDuaRecords = await db.select().from(childDuasTable).where(eq(childDuasTable.childId, childId));

  const result = getAllDuas().map(dua => {
    const record = childDuaRecords.find(r => r.duaId === dua.id);
    return {
      dua: formatChildProgressDua(dua),
      learned: record ? record.learned === 1 : false,
      learnedAt: record?.learnedAt?.toISOString() || null,
      practicedCount: record?.practicedCount || 0
    };
  });

  res.json({ duas: result });
});

router.post("/children/:childId/duas", async (req, res) => {
  const childId = parseInt(req.params.childId);
  if (!await ownsChild(req.user.id, childId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const duaId = Number(req.body.duaId);
  const { learned } = req.body;
  const dua = getAllDuas().find(d => d.id === duaId);
  if (!dua) { res.status(404).json({ error: "Dua not found" }); return; }

  const [existing] = await db.select().from(childDuasTable)
    .where(and(eq(childDuasTable.childId, childId), eq(childDuasTable.duaId, duaId)));

  const now = new Date();
  let record;
  if (existing) {
    [record] = await db.update(childDuasTable).set({
      learned: learned ? 1 : 0,
      learnedAt: learned ? now : null,
      practicedCount: existing.practicedCount + 1
    }).where(eq(childDuasTable.id, existing.id)).returning();
  } else {
    [record] = await db.insert(childDuasTable).values({
      childId,
      duaId,
      learned: learned ? 1 : 0,
      learnedAt: learned ? now : null,
      practicedCount: 1
    }).returning();
  }

  res.json({ dua: formatChildProgressDua(dua), learned: record.learned === 1, learnedAt: record.learnedAt?.toISOString() || null, practicedCount: record.practicedCount });
});

export default router;
