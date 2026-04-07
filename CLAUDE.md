# NoorPath — Quran Learning App for Children

## What This App Does

NoorPath is a full-stack Quran memorization and Islamic learning app for children ages 3–18. Parents create profiles for their children and receive personalized learning plans based on age group and prior memorization.

Core features:
- **Age-based learning plans**: Toddler (3–6), Child (7–10), Preteen (11–14), Teen (15+)
- **Hifz (memorization) tracking**: 15 surahs with Arabic text, transliteration, and tajweed notes
- **SM-2 spaced repetition**: Automatic review scheduling to reinforce memorization
- **Islamic stories**: 8 stories (prophets, companions, moral lessons)
- **Du'aas**: 18 essential du'aas categorized by occasion (morning, eating, sleeping, etc.)
- **Progress & achievements**: Streak tracking, points system, milestone badges
- **Multi-child parent dashboard**: Individual profiles with per-child progress

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Language | TypeScript 5.9 |
| Node version | 24 |
| Frontend | React 19 + Vite 7 + Tailwind CSS v4 + shadcn/ui |
| Backend | Express 5 |
| Database | PostgreSQL (Neon serverless) + Drizzle ORM |
| Validation | Zod (v4 API: `zod/v4`), drizzle-zod |
| API codegen | Orval (generates React Query hooks + Zod schemas from OpenAPI spec) |
| State / fetching | TanStack React Query v5 |
| Routing | Wouter |
| Charts | Recharts |

---

## Monorepo Structure

```
Quranic-Journey/
├── artifacts/
│   ├── api-server/          # Express 5 API — port 3001
│   │   └── src/
│   │       ├── routes/      # children, memorization, sessions, health
│   │       ├── data/        # surahs.ts, stories.ts, duas.ts (static JSON-like content)
│   │       └── app.ts       # Express app setup (cors, json, pino logger)
│   └── noor-path/           # React + Vite frontend — port 5173
│       └── src/
│           ├── pages/       # home, child-dashboard, lesson, review, memorize,
│           │                # stories, story-detail, duas, progress, plan, surah-detail
│           └── components/  # child-nav, shadcn/ui components
├── lib/
│   ├── api-spec/            # openapi.yaml + orval.config.ts
│   ├── api-client-react/    # Generated React Query fetch functions (from Orval)
│   ├── api-zod/             # Generated Zod schemas (from Orval)
│   └── db/                  # Drizzle ORM schema + DB connection (drizzle.config.ts)
└── scripts/
```

---

## Environment Files

### `artifacts/api-server/.env`

```
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
PORT=3001
```

### `artifacts/noor-path/.env`

```
PORT=5173
BASE_PATH=/
```

Both `.env` files are git-ignored. `BASE_PATH` is required by `vite.config.ts` (throws if missing). `PORT` is required by both servers (throws if missing).

---

## Running Locally

Both servers must run simultaneously. Open two terminals from the project root.

**Terminal 1 — API server:**
```bash
/Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/api-server run dev
```

**Terminal 2 — Frontend:**
```bash
/Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/noor-path run dev
```

Frontend is at `http://localhost:5173`. The Vite dev server proxies all `/api/*` requests to `http://localhost:3001` (configured in `artifacts/noor-path/vite.config.ts`).

**Other useful commands:**
```bash
# Run DB migrations (push schema to Neon)
DATABASE_URL="..." /Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/db push

# Regenerate API client from OpenAPI spec
/Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/api-spec run codegen

# Full typecheck from root
/Users/mothmanaurascape.ai/Library/pnpm/pnpm run typecheck
```

> Note: `pnpm` is not on the global PATH. Use the full path: `/Users/mothmanaurascape.ai/Library/pnpm/pnpm`

---

## Database Schema

All tables live in the Neon PostgreSQL database. Managed via Drizzle ORM in `lib/db/src/schema/`.

| Table | Purpose |
|---|---|
| `children` | Child profiles — name, age, ageGroup, gender, avatarEmoji, streakDays, totalPoints, juzCompleted, practiceMinutesPerDay |
| `memorization_progress` | Per-child per-surah progress — status, versesMemorized, strength, nextReviewDate |
| `review_schedule` | SM-2 spaced repetition state — interval, easeFactor, dueDate |
| `learning_sessions` | Session logs — type, duration, pointsEarned, surahsWorked |
| `child_duas` | Per-child du'a learned status and practiceCount |

To apply schema changes: `pnpm --filter @workspace/db push` (uses `drizzle-kit push`, no migration files generated).

---

## API Routes

All routes are mounted under `/api` in `artifacts/api-server/src/app.ts`.

```
GET  /api/health
GET  /api/children                         list all children
POST /api/children                         create child (with optional pre-memorized surah setup)
GET  /api/children/:id                     get child
PUT  /api/children/:id                     update child
GET  /api/children/:id/dashboard           full dashboard (today's plan, stats, achievements)
GET  /api/children/:id/plan                age-group learning plan with milestones
GET  /api/children/:id/memorization        memorization progress per surah
PUT  /api/children/:id/memorization        update progress (triggers SM-2 scheduling)
GET  /api/children/:id/reviews             due reviews (dueToday + upcoming)
POST /api/children/:id/reviews             complete review session (SM-2 update)
GET  /api/children/:id/goals               goals (auto-generated + custom)
GET  /api/children/:id/sessions            learning session history
POST /api/children/:id/sessions            log a session
GET  /api/children/:id/duas                du'aas with per-child learned status
PUT  /api/children/:id/duas/:duaId         mark dua learned/unlearned
GET  /api/surahs                           list surahs
GET  /api/surahs/:id                       full surah with verses + tajweed notes
GET  /api/stories                          list stories (optional category filter)
GET  /api/stories/:id                      full story with morals + discussion questions
GET  /api/duas                             all duas (optional category filter)
```

---

## Important Codebase Notes

### Vite proxy is required
`artifacts/noor-path/vite.config.ts` must have the proxy block. Without it, every `/api/*` fetch returns a 404 HTML page from Vite and mutations fail silently (no error surfaced to the user):
```ts
server: {
  proxy: {
    "/api": "http://localhost:3001",
  },
}
```

### The `home.tsx` onboarding flow has 3 or 4 steps
Step 3 ("Memorization Strength") only appears when surahs are pre-selected in step 2. With no pre-selected surahs, the flow goes 1 → 2 → 4 (skips 3). The internal `step` state always goes up to 4; `displayStep` remaps it for the progress indicator. The "Start Their Journey" button appears at `step === 4` and calls `createMutation.mutate()`.

### `POST /api/children` seeds memorization data
When `preMemorizedSurahIds` is provided, the route inserts rows into both `memorization_progress` and `review_schedule` for each surah, using the `memorationStrength` value to set initial SM-2 state.

### Zod v4 import path
This project uses `zod/v4` (not `zod`). Always import as:
```ts
import { z } from "zod/v4";
```

### TypeScript composite projects
Every package extends `tsconfig.base.json` with `composite: true`. Always typecheck from the root: `pnpm run typecheck`. Never typecheck individual packages in isolation.

### Generated files — do not edit manually
`lib/api-client-react/src/generated/` and `lib/api-zod/` are generated by Orval from `lib/api-spec/openapi.yaml`. Edit the OpenAPI spec and re-run codegen instead.

### API server build step
`artifacts/api-server/src/` is TypeScript compiled to `dist/` via esbuild (`build.mjs`) before starting. The `dev` script runs `build && start` — there is no watch mode; restart the server after backend changes.

### Static content is in `data/` files
Surah text, stories, and du'aas are hardcoded in `artifacts/api-server/src/data/`. They are not stored in the database. The DB only stores per-child progress state.
