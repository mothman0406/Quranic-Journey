import { pgTable, serial, integer, text, timestamp, date, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pgEnum } from "drizzle-orm/pg-core";

export const memorizationStatusEnum = pgEnum("memorization_status", [
  "not_started",
  "in_progress",
  "memorized",
  "needs_review",
]);

export const memorizationProgressTable = pgTable("memorization_progress", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  surahId: integer("surah_id").notNull(),
  status: memorizationStatusEnum("status").notNull().default("not_started"),
  versesMemorized: integer("verses_memorized").notNull().default(0),
  memorizedAyahs: text("memorized_ayahs").notNull().default("[]"),
  ayahStrengths: text("ayah_strengths").notNull().default("{}"),
  reviewCount: integer("review_count").notNull().default(0),
  strength: integer("strength").notNull().default(1),
  lastPracticed: timestamp("last_practiced"),
  nextReviewDate: date("next_review_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const reviewScheduleTable = pgTable("review_schedule", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  surahId: integer("surah_id").notNull(),
  dueDate: date("due_date").notNull(),
  nextChunkAyahStart: integer("next_chunk_ayah_start"),
  interval: integer("interval").notNull().default(1),
  easeFactor: real("ease_factor").notNull().default(2.5),
  repetitionCount: integer("repetition_count").notNull().default(0),
  lastReviewed: timestamp("last_reviewed"),
  lastReviewedChunkAyahStart: integer("last_reviewed_chunk_ayah_start"),
  lastReviewedChunkAyahEnd: integer("last_reviewed_chunk_ayah_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quranVersesTable = pgTable("quran_verses", {
  id: serial("id").primaryKey(),
  surahNumber: integer("surah_number").notNull(),
  ayahNumber: integer("ayah_number").notNull(),
  pageNumber: integer("page_number").notNull(),
  textUthmani: text("text_uthmani").notNull().default(""),
  juzNumber: integer("juz_number").notNull().default(0),
});

export type QuranVerse = typeof quranVersesTable.$inferSelect;

export const dailyProgressTable = pgTable("daily_progress", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  date: text("date").notNull(),
  memTargetSurah: integer("mem_target_surah"),
  memTargetAyahStart: integer("mem_target_ayah_start"),
  memTargetAyahEnd: integer("mem_target_ayah_end"),
  memTargetEndSurah: integer("mem_target_end_surah"),
  memCompletedAyahEnd: integer("mem_completed_ayah_end"),
  memStatus: text("mem_status").notNull().default("not_started"),
  reviewTargetCount: integer("review_target_count"),
  reviewCompletedCount: integer("review_completed_count").notNull().default(0),
  reviewStatus: text("review_status").notNull().default("not_started"),
  readingTargetPages: real("reading_target_pages"),
  readingCompletedPages: real("reading_completed_pages").notNull().default(0.0),
  readingLastPage: integer("reading_last_page"),
  readingStatus: text("reading_status").notNull().default("not_started"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DailyProgress = typeof dailyProgressTable.$inferSelect;

export const insertMemorizationSchema = createInsertSchema(memorizationProgressTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMemorization = z.infer<typeof insertMemorizationSchema>;
export type MemorizationProgress = typeof memorizationProgressTable.$inferSelect;
export type ReviewSchedule = typeof reviewScheduleTable.$inferSelect;
