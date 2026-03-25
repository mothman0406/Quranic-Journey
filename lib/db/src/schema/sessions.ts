import { pgTable, serial, integer, text, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionTypeEnum = pgEnum("session_type", [
  "memorization",
  "review",
  "reading",
  "listening",
  "story",
  "dua",
  "mixed",
]);

export const learningSessionsTable = pgTable("learning_sessions", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  date: date("date").notNull(),
  sessionType: sessionTypeEnum("session_type").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  pointsEarned: integer("points_earned").notNull().default(0),
  surahsWorked: text("surahs_worked").notNull().default("[]"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const childDuasTable = pgTable("child_duas", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  duaId: integer("dua_id").notNull(),
  learned: integer("learned").notNull().default(0),
  practicedCount: integer("practiced_count").notNull().default(0),
  learnedAt: timestamp("learned_at"),
});

export const insertSessionSchema = createInsertSchema(learningSessionsTable).omit({ id: true, createdAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type LearningSession = typeof learningSessionsTable.$inferSelect;
