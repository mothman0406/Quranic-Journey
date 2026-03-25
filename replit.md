# NoorPath — Muslim Parenting & Quran Learning App

## Overview

Full-stack Quran memorization and Islamic learning app for children ages 3–18. Built as a pnpm workspace monorepo using TypeScript.

## Product Features

- **Age-based learning plans**: Toddler (3–6), Child (7–10), Preteen (11–14), Teen (15+)
- **Hifz (memorization) tracking**: 15 surahs with Arabic text, transliteration, tajweed notes
- **SM-2 spaced repetition**: Automatic review scheduling to reinforce memorization
- **Islamic stories**: 8 stories (prophets, companions, Quran stories, moral lessons)
- **Du'aas**: 18 essential du'aas categorized by occasion (morning, eating, sleeping, etc.)
- **Progress & achievements**: Streak tracking, points system, milestone badges
- **Learning plan**: Per age-group curriculum with tajweed rules and milestones
- **Parent dashboard**: Multi-child profiles with individual progress tracking

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui
- **Charts**: Recharts (weekly progress bar chart)
- **Fonts**: Amiri (Arabic), Inter (UI) — loaded from Google Fonts via index.html

## Design System

- **Primary**: Deep emerald green `hsl(152, 55%, 25%)`
- **Accent**: Warm gold `hsl(43, 72%, 50%)`
- **Background**: Warm cream `hsl(40, 30%, 97%)`
- **Arabic text**: `.arabic-text` class with `font-family: Amiri, serif; direction: rtl`
- **Hero headers**: `.pattern-bg` — dark green with subtle gold radial gradients
- **Bottom nav**: Fixed, 56px tall, 5 items (Lesson, Memorize, Review, Stories, Du'aas)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── routes/     # children, memorization, sessions, health
│   │       └── data/       # surahs.ts, stories.ts, duas.ts (static content)
│   └── noor-path/          # React + Vite frontend
│       └── src/
│           ├── pages/      # home, child-dashboard, lesson, review, memorize,
│           │               # stories, story-detail, duas, progress, plan, surah-detail
│           └── components/ # child-nav, shadcn/ui components
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query fetch functions
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
└── scripts/                # Utility scripts
```

## DB Schema

- `children` — name, age, ageGroup, gender, avatarEmoji, streakDays, totalPoints, juzCompleted
- `memorization_progress` — child → surah progress (status, versesMemorized, qualityRating)
- `review_schedule` — SM-2 spaced repetition (interval, easeFactor, nextReviewDate)
- `learning_sessions` — session logs (type, duration, points earned)
- `child_duas` — per-child du'a learned status and practice count

## API Routes (all under `/api`)

- `GET/POST /children` — list/create children
- `GET /children/:id` — get child
- `GET /children/:id/dashboard` — full dashboard with today's plan, stats, achievements
- `GET /children/:id/plan` — age-group learning plan with milestones
- `GET /children/:id/memorization` — memorization progress per surah
- `PUT /children/:id/memorization` — update progress (triggers SM-2 scheduling)
- `GET /children/:id/reviews` — due reviews (dueToday + upcoming)
- `POST /children/:id/reviews` — complete a review session (SM-2 update)
- `GET /children/:id/duas` — du'aas with learned status
- `PUT /children/:id/duas` — mark dua as learned/unlearned
- `GET /surahs` — list all surahs (with optional filters)
- `GET /surahs/:id` — full surah with verses + tajweed notes
- `GET /stories` — list stories (with optional category filter)
- `GET /stories/:id` — full story with morals, discussion questions
- `GET /duas` — all duas (optional category filter)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. Always typecheck from root: `pnpm run typecheck`.

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — start API server
- `pnpm --filter @workspace/noor-path run dev` — start frontend
- `pnpm --filter @workspace/db run push` — run DB migrations
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client from OpenAPI spec
