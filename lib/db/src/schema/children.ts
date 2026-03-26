import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ageGroupEnum = pgEnum("age_group", ["toddler", "child", "preteen", "teen"]);
export const genderEnum = pgEnum("gender", ["male", "female"]);

export const childrenTable = pgTable("children", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  ageGroup: ageGroupEnum("age_group").notNull(),
  gender: genderEnum("gender").notNull(),
  avatarEmoji: text("avatar_emoji").notNull().default("⭐"),
  streakDays: integer("streak_days").notNull().default(0),
  totalPoints: integer("total_points").notNull().default(0),
  juzCompleted: integer("juz_completed").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  practiceMinutesPerDay: integer("practice_minutes_per_day").notNull().default(20),
  goals: text("goals"),
  onboardingCompleted: integer("onboarding_completed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChildSchema = createInsertSchema(childrenTable).omit({ id: true, createdAt: true, streakDays: true, totalPoints: true, juzCompleted: true });
export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof childrenTable.$inferSelect;
