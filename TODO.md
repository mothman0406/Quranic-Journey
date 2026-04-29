# NoorPath / Quranic Journey — Status & Next Steps

_Last updated: April 29, 2026 (Phase 2H.1 mobile onboarding/profile management complete and hardware-tested; Phase 3/TestFlight deferred until Phase 2H must-have parity is triaged/completed)_

---

## Documentation rule for every new action

After every meaningful action, update this file and `PHASE_2D_HANDOFF.md` before handing off:

- Update the "Last updated" line with the date and actual current state.
- Record the active branch, latest local SHA, and whether remote branches are synced or stale.
- Move completed work out of "next" sections and into the done/current-state section.
- Add any hardware QA results or known failures immediately.
- Make the next action checklist concrete enough that a fresh Codex/Claude chat can start without reconstructing context.

## Current work log — April 29, 2026

- Active branch/SHA at Phase 2H.1 start: `main` at `21535d4`. Phase 2H.1 mobile onboarding/profile management implementation commit: `5af7b9a`; docs sync: `c7c0a65`; follow-up onboarding polish commit: `3f43337`; current docs-sync HEAD contains this note.
- Remote sync status after this docs sync: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` should be synced to the current Phase 2H.1 complete HEAD. `safe-cumulative` was temporary archaeology and can be ignored.
- QA status: Phase 2D memorization core through Slice 5b, Phase 2E dashboard polish, Phase 2F target-setting UI, Phase 2G.1 diagnostic cleanup, Phase 2G.2 mobile IA shell, Phase 2G.3 shared screen primitives, and Phase 2H.1 mobile onboarding/profile management are hardware-tested. Phase 2G.4 local validation passed for API/codegen/mobile with `/Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/api-spec run codegen`, `/Users/mothmanaurascape.ai/Library/pnpm/pnpm run typecheck:libs`, `/Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/api-server run typecheck`, and `cd artifacts/noor-mobile && npx tsc --noEmit`. Phase 2H.1 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`; follow-up onboarding polish also passed the same two checks. Full root `/Users/mothmanaurascape.ai/Library/pnpm/pnpm run typecheck` was previously attempted, but it stops in unrelated frozen/reference UI areas (`artifacts/noor-path/src/components/ui/button-group.tsx`, `artifacts/noor-path/src/components/ui/calendar.tsx`, `artifacts/mockup-sandbox/src/components/ui/calendar.tsx`, `artifacts/mockup-sandbox/src/components/ui/spinner.tsx`) on React type/ref baseline errors.
- Dev-server note: starting Expo inside the sandbox fails with `ERR_SOCKET_BAD_PORT` because sandboxed Node cannot bind local ports (`EPERM` on 8081). Run the dev server outside the sandbox/escalated when using this environment.
- TestFlight status: **Phase 3/TestFlight is deferred** until the web-app parity audit's must-have mobile items are triaged and the Phase 2H pre-TestFlight items are completed or explicitly moved to post-beta.
- Inspection notes: initial Phase 2E inspection found `app/child/[childId]/index.tsx` was a three-card skeleton; `src/lib/api.ts` is a thin authenticated fetch helper; `/api/children/:id/dashboard` exposes `todaysPlan.newMemorization`, `todayProgress`, `reviewsDueToday`, and `readingGoal`; `/api/children/:id/reviews` exposes detailed queue items with `reviewPriority`.
- Implementation notes: mobile dashboard now fetches dashboard plus review queue data, the Memorization/Review/Reading cards show today's assigned work, review previews use shared red/orange/green priority styling, the review queue cards have matching priority rails/backgrounds, and the profile selector has richer child rows with age, streak, and points.
- Diff-review notes: removed new dashboard letter spacing and fixed streak pluralization before final QA.
- Phase 2F inspection notes: targets are stored on `children` as `memorizePagePerDay`, `reviewPagesPerDay`, and `readPagesPerDay`; `GET /api/children/:childId` returns them through `formatChild`; `PUT /api/children/:childId` accepts all three fields. Web reference options live in `artifacts/noor-path/src/pages/settings.tsx`.
- Phase 2F implementation notes: added `app/child/[childId]/targets.tsx`, registered it in the child stack, added a dashboard `Targets` entry point, and made the dashboard refresh on focus after returning from target edits. The screen uses preset chips plus minus/plus fine tuning and saves directly through `apiFetch`.
- Phase 2F hotfix notes: after screenshots showed the dashboard rendering API 500s for L and Joll, production was checked directly and returned 200 for both children. `apiFetch` now sends `x-local-date` from the phone and normalizes JSON/plain-text/HTML failures into short readable error messages instead of showing full HTML documents. The dashboard now retries `/dashboard` once and then falls back to child/profile plus review queue data, keeping Targets reachable if today's plan endpoint flakes. Fresh inspection found that if the fallback path itself fails, the full-screen error still only shows the original dashboard error, so the phone cannot distinguish stale JS, wrong API base, dashboard failure, review failure, or child fallback failure yet.
- Phase 2F diagnostic implementation notes: added `ApiError`, `getApiRuntimeInfo`, console request/response logs, and diagnostic marker `dashboard-diag-2026-04-28a` in mobile `apiFetch`. The dashboard now tracks primary/retry/fallback review/fallback child stages, renders a compact diagnostic panel on fallback/error, and if the child fallback fetch fails it renders a degraded shell from route params instead of the original full-screen dashboard 500.
- Phase 2F route bug diagnosis: dashboard `handleTargetsPress` used relative `pathname: "./targets"`, which Expo Router resolved as `/child/targets` instead of `/child/:childId/targets`. That made the dashboard route match `[childId] = "targets"` on return/reload, causing API calls to `/api/children/targets/*`.
- Phase 2F route fix notes: dashboard Targets navigation now uses absolute `pathname: "/child/[childId]/targets"`, and dashboard loading now rejects non-numeric child IDs before making API calls.
- Phase 2F hardware QA notes: Mohammad reported the QA check passed after the route fix. The child dashboard no longer gets stuck on `/api/children/targets/*`, and the Targets/dashboard flow is unblocked.
- Phase 2G.1 implementation notes: removed the temporary visible dashboard diagnostic panel, deleted the `[noor-api]` request/response/error console logs, and removed the temporary dashboard diagnostic marker/runtime helper. Preserved `ApiError`, readable API errors, `x-local-date`, Better Auth cookie handling, dashboard retry/fallback behavior, degraded fallback shell, and numeric route-param validation.
- Phase 2G.1 hardware QA notes: Mohammad reported dashboard load/refresh, Targets navigation, and fallback behavior work after the cleanup.
- Phase 2G.2 implementation notes: added a reusable `ChildBottomNav`, registered a new child `more` route, added bottom-nav access on dashboard and review, added a review-count badge where queue data is already loaded, and built a More screen exposing Full Quran, Targets, Profiles, plus planned Progress, Learning Plan, Stories, and Du'aas entries. Kept the memorization engine, review session, Mushaf controls, web app, tajweed, generated files, and native dependencies untouched.
- Phase 2G.2 hardware QA notes: Mohammad reported the bottom nav and More screen passed on iPhone.
- Phase 2G.3 implementation notes: added shared screen primitives in `src/components/screen-primitives.tsx` (`ScreenContainer`, `ScreenHeader`, `ScreenScrollView`, loading/empty/error states, inline error, section label, card group, badge pill, and list row). Adopted them on `more.tsx` and `review.tsx` only, keeping behavior and routes unchanged. Memorization, review session, Mushaf controls, tajweed, generated files, web app, and native dependencies were untouched.
- Phase 2G.3 hardware QA notes: Mohammad reported the shared screen primitives QA pass completed successfully.
- Phase 2G.4 implementation notes: fixed child du'a status updates to match by both `childId` and `duaId`, taught `POST /api/children` to honor `readPagesPerDay`, expanded `lib/api-spec/openapi.yaml` for child targets/create/delete/goals, dashboard `todayProgress`/`readingGoal`/`upNextMemorization`, reviews `todayRange`/`reviewedToday`, daily/reading/weekly progress, ayah strengths, and rated ayahs, then regenerated Orval outputs. Also resolved the non-generated `@workspace/api-zod` barrel export collision caused by regenerated Zod schemas without editing generated files manually.
- Phase 2H.1 implementation notes: added mobile child creation from the profile picker, a shared mobile child profile form, prior-memorized surah selection with per-surah known ayah counts and initial strength, daily targets (`memorizePagePerDay`, `reviewPagesPerDay`, `readPagesPerDay`), `practiceMinutesPerDay`, Stories/Du'aas visibility toggles, an existing-child Profile Settings route from More, and a destructive delete flow with confirmation that targets only the selected child. The mobile API helper now handles `204 No Content` responses so `DELETE /api/children/:childId` works cleanly. Follow-up polish after comparing the frozen web add-profile flow added From/To surah range selection, an always-reachable sticky Save button, keyboard drag dismissal, and an iOS Done accessory so name/age inputs no longer trap the keyboard over the form. No generated files, frozen web app files, tajweed implementation, recite matcher behavior, or native dependencies were touched.
- Phase 2H.1 hardware QA notes: Mohammad tested the onboarding/profile management flow after the range/sticky-save/keyboard polish and reported it looks good.
- Exact next checklist:
  1. Start Phase 2H.2 dashboard parity content: bring the mobile dashboard closer to the frozen web dashboard with stats, goals preview, achievements preview, story/dua cards respecting `hideStories`/`hideDuas`, next/up-next work, richer completed/empty states, and better quick actions.
  2. Validate Phase 2H.2 with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`; broaden to backend/spec checks only if backend or OpenAPI changes are needed.
  3. Mohammad hardware QA for Phase 2H.2: test dashboard with hide flags on/off, new child / in-progress / completed states, existing children, Dashboard → Memorize/Review/More/Targets/Full Quran routes, and pull-to-refresh.
  4. Keep Phase 3/TestFlight deferred until Phase 2H must-have parity is completed or explicitly moved to post-beta. Keep tajweed as documented backlog only; do not tighten recite matching; do not edit the frozen web app; do not edit generated files manually; keep future implementation JS-only unless a native rebuild is explicitly approved.

### Web-app parity audit summary

Mobile already has:
- Better Auth sign-in, persisted session, existing-child profile picker, sign-out.
- Mobile child creation/profile management through Phase 2H.1: create child, seed prior memorized surahs with per-surah strength and known ayah counts, add prior surahs by From/To range, edit profile settings/targets/practice minutes/visibility toggles, delete the selected child with confirmation, dismiss keyboard cleanly, and save without scrolling past all surahs. Hardware QA passed.
- Child dashboard with today's memorization/review/reading cards, review previews, streak/points, pull-to-refresh, target entry point, fallback behavior that keeps the dashboard usable if today's plan flakes, and first-pass bottom nav.
- More screen exposing current Full Quran/Targets/Profile routes plus planned Progress/Plan/Stories/Du'aas entries.
- Shared mobile screen primitives now exist and are adopted by More and Review.
- Targets screen for `memorizePagePerDay`, `reviewPagesPerDay`, and `readPagesPerDay`.
- API/spec foundation for upcoming content and progress pages: child target/create/delete/goals contracts, dashboard progress/reading fields, review `reviewedToday`/`todayRange`, daily/reading/weekly progress, and generated client outputs are aligned through Phase 2G.4.
- Memorization core with today's assignment fetch, ayah/page modes, word-level audio highlight, repeat controls, auto-advance delay, cumulative review, reciter selection, 8 themes, playback speed, blind mode, blur mode, translation popup, recite mode, and mark-complete persistence.
- Review queue with red/orange/green priority cards, reviewed-today section, and a page-image review session with Husary audio and 0-5 SM-2 rating submission.
- Full Quran reading shell with streamed 604 page images, RTL paging, last-page resume from `readingGoal`, manual Save Page, debounced auto-save, and fixed jump buttons.

Web has that mobile still lacks:
- Richer parent controls beyond the Phase 2H.1 profile/onboarding first pass.
- Richer navigation shell behavior beyond the first-pass Dashboard/Memorize/Review/More nav, including future real routes for Progress, Learning Plan, Stories, Du'aas, and Settings.
- Dashboard parity: story/dua cards, goals teaser, achievements preview, memorization stats, weekly activity, next-surah preview, richer quick actions, and web-like empty/completed states.
- Memorization overview/list page: current work/next up, surah search/jump, filters, ayah strength visualization, expanded ayah circles, Mark All Done, surah detail study cards, setup/chooser flow, resume bookmark, teacher/app recitation completion flow, and quality-rating-based completion. Mobile has the session engine but not the discovery/planning surface.
- Review richness: upcoming queue, completed-day/ahead-day local session behavior, flashcard mode, connected Mushaf batch review, sticky controls, reciter/speed settings inside review, richer fallback states, and web-like review celebration.
- Full Quran reader richness: search by surah/page/juz, recent reads, bookmarks, highlights, notes, translation/tafsir/word-by-word sheets, audio range player, select-to-mark-memorized, recite-from-page, and better page navigation.
- Progress/achievements: dedicated progress page, charts/bars, earned and in-progress badges, weekly/monthly/session history, memorized surah list, review strength visualization, and daily progress bars.
- Stories and du'aas: no mobile story list/detail, dua list/detail/status, category filters, learned/practice tracking UI, morals, or discussion questions.
- Plans/lessons: no mobile age-group learning plan page, milestone page, goals page, lesson flow, or surah-detail learning page. Tajweed notes are present on web but remain a backlog-only item for mobile.
- Visual system: web feels richer through patterned headers, compact stats, color-coded cards, badges, horizontal filters, achievement progress bars, and a clear bottom nav. Mobile is functional but thin and mostly white/gray cards.

Highest-risk missing items before TestFlight:
- Phase 2G.1 removed the temporary visible dashboard diagnostic panel and noisy API logs and is hardware-tested.
- Phase 2G.4 fixed the child-du'a update bug and refreshed OpenAPI/generated clients for the next mobile surfaces; authenticated production API smoke is still pending.
- New beta user onboarding/profile management is now hardware-tested in Phase 2H.1.
- Major product surfaces are now visible in More, but Progress, Stories, Du'aas, Plan, achievements, and richer settings routes are still absent.
- Stories, du'aas, progress, achievements, plan, and settings/profile controls are absent from mobile.
- The reading screen is too bare for real use beyond sequential paging.
- Mobile du'a status UI is still absent; when it is built, test toggling multiple du'as independently against the Phase 2G.4 route fix.
- Future API changes must keep `lib/api-spec/openapi.yaml` and Orval outputs in sync; never edit generated files manually.

### Area-by-area parity notes

1. Dashboard/child home: mobile has three work cards plus streak/points; web adds goals, achievements, stats, today story/dua, next surah, richer quick actions, and bottom nav.
2. Memorization: mobile has the core learner; web adds the chooser/overview, filters/search, ayah strength map, explicit teacher/app test flow, resume/setup, and richer completion. Do not touch recite matcher behavior. Do not pursue tajweed beyond documenting it as backlogged.
3. Review: mobile has queue/session/SM-2 rating; web adds local-day session grouping, upcoming/completed sections, flashcards, batch Mushaf review, reciter/speed/blur controls, and better fallback/celebration states.
4. Reading/full Quran: mobile has image paging and progress save; web adds search/jump, resume/recent reads, bookmarks, highlights, notes, translation/tafsir/word tools, audio range playback, memorization handoff, and recite/select modes.
5. Settings/targets/parent controls: mobile has target pages only; web has practice minutes, content visibility, child profile settings, daily goal presets, profile creation/deletion, and default practice settings.
6. Progress/streaks/goals/achievements: mobile surfaces streak/points only; web has a full progress page, chart, badges, session history, goals, memorized counts, and dashboard widgets.
7. Stories/du'aas: mobile has no routes; web has category filters, detail pages, learned status, practice counts, morals, and discussion questions.
8. Plans/lessons: mobile lacks plan/lesson/surah-detail flows; web has age-group plan, milestones, weekly goals, goals reset, and surah detail content.
9. Navigation/IA: mobile needs a child-level nav shell or More screen. Suggested first pass: Dashboard, Memorization, Review, More, with More exposing Reading, Progress, Plan, Stories, Du'aas, Settings/Targets.
10. Visual/layout parity: port the web's working-app richness, not a landing page. Favor dense but warm parent-usable cards, compact stats, kid-friendly color, clear sections, and no marketing hero layout.

### Prioritized mobile roadmap

#### Phase 2G — Diagnostic cleanup + web parity foundation

Pre-TestFlight: yes.

| Slice | Goal | Likely files | Backend/API deps | Risk | QA |
|---|---|---|---|---|---|
| 2G.1 Diagnostic cleanup | Complete Apr 29: removed visible dashboard diagnostic panel and noisy `[noor-api]` logs while keeping readable errors/fallbacks. | `artifacts/noor-mobile/src/lib/api.ts`, `app/child/[childId]/index.tsx` | None | JS-only | Local typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2G.2 Mobile IA shell | Complete Apr 29: first-pass bottom nav and More screen so existing and upcoming pages are discoverable. | `app/child/[childId]/_layout.tsx`, `index.tsx`, `review.tsx`, `more.tsx`, `src/components/child-bottom-nav.tsx` | `GET /children/:id`; existing review/dashboard queue data for badge | JS-only | Local typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2G.3 Shared screen primitives | Complete Apr 29: reusable header/container/scroll/list/pill/loading/empty/error primitives adopted on More and Review. | `src/components/screen-primitives.tsx`, `more.tsx`, `review.tsx` | None | JS-only | Local typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2G.4 API parity checklist | Implemented locally Apr 29: fixed child-du'a keying, aligned OpenAPI for dashboard/review/progress/goals/child targets, regenerated Orval outputs. | `lib/api-spec/openapi.yaml`, `artifacts/api-server/src/routes/children.ts`, `artifacts/api-server/src/routes/sessions.ts`, generated output via Orval | Dua status bug, `reviewedToday`, dashboard/reading/progress fields | JS/TS; no native | Codegen, libs typecheck, API-server typecheck, mobile tsc passed; root typecheck blocked by unrelated frozen/reference UI React type errors; production API smoke pending |

#### Phase 2H — Must-have mobile parity before TestFlight

Pre-TestFlight: yes, unless Mohammad explicitly narrows beta to existing seeded profiles.

| Slice | Goal | Likely files | Backend/API deps | Risk | QA |
|---|---|---|---|---|---|
| 2H.1 Mobile onboarding/profile management | Complete Apr 29: parents can create/edit/delete child profiles on mobile, including prior memorized surahs, From/To surah range selection, initial strength/known ayahs, daily targets, practice minutes, hide stories/duas, sticky save, and keyboard dismissal. | `app/index.tsx`, `app/profile/new.tsx`, `app/child/[childId]/profile.tsx`, `src/components/child-profile-form.tsx`, `src/lib/api.ts` | Existing `POST/PUT/DELETE /children`, `GET /surahs`; no generated edits | JS-only | Local mobile typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2H.2 Dashboard parity content | Bring mobile dashboard close to web: stats, goals preview, achievements preview, story/dua cards, next/up-next work, richer completed/empty states, quick actions. | `app/child/[childId]/index.tsx`, shared dashboard components | Existing `GET /dashboard`; maybe `GET /goals` | JS-only | Hardware with hide flags on/off, complete/in-progress/not-started states |
| 2H.3 Settings/targets convergence | Expand Targets into parent settings: practice minutes, content visibility, child profile edit, daily presets, default memorization session settings, and fix profile settings persistence. | `targets.tsx`, new settings/profile route, `src/lib/settings.ts`, `memorization.tsx` only for persistence wiring | `PUT /children/:id`, `PUT /goals` if custom goals included | JS-only | Save/return/force close/reopen persistence QA |
| 2H.4 Review essentials parity | Add upcoming queue, reviewed/completed states, better empty/fallback UI, sticky/floating session controls, reciter/speed in review session, and route refresh after submit. | `review.tsx`, `review-session.tsx`, `src/lib/reviews.ts`, `src/lib/reciters.ts` | Existing reviews endpoints; OpenAPI now includes `reviewedToday`/`todayRange` | JS-only | Submit 0-5 ratings, queue refresh, no due reviews, upcoming visible |
| 2H.5 Reading essentials parity | Add page/surah/juz jump/search, saved-page resume clarity, reading target progress, better footer/header controls, and maybe simple bookmarks if still JS-only. | `mushaf.tsx`, `src/lib/mushaf.ts`, `src/lib/quran.ts`, possible static surah metadata helper | `POST /reading-progress`, `GET /dashboard`; no generated edits | JS-only | Swipe/save/resume, jump by page/surah/juz, reading goal completion |
| 2H.6 Memorization discovery parity | Add a mobile memorization home/list so users can search/filter surahs, see progress/strength, start today's work, resume in-progress work, and enter the existing session engine. | Existing `memorization.tsx` may need split into home/session routes; `src/lib/memorization.ts`; new progress components | `GET /surahs`, `GET /children/:id/memorization`, `GET /dashboard` | JS-only; careful route migration | Start from dashboard and list; current assignment still works; mark-complete persists |

#### Phase 2I — Rich learning/content pages

Pre-TestFlight: optional after 2H triage; good beta candidate if time.

| Slice | Goal | Likely files | Backend/API deps | Risk | QA |
|---|---|---|---|---|---|
| 2I.1 Stories | Mobile stories list/detail with categories, age filtering, morals, discussion questions, and dashboard/More entry points respecting `hideStories`. | New `stories.tsx`, `story-detail.tsx`, More/dashboard links | `GET /stories`, `GET /stories/:id`, child hide flag | JS-only | Category filter, detail, hidden state |
| 2I.2 Du'aas | Mobile du'aas list/detail/status with category filter, learned toggle, practice count, Arabic/transliteration/translation/source. | New `duas.tsx`, shared content cards | Fix `POST /children/:childId/duas` to key by `duaId`; OpenAPI/codegen if using generated client later | JS/backend; no native | Toggle multiple du'as independently, practice count, hidden state |
| 2I.3 Plan/goals | Mobile learning plan with age-group description, weekly goals, milestones, long-term goals, reset-to-auto, and practice minutes. | New `plan.tsx`, possible `goals.tsx`, More/dashboard links | `GET /plan`, `GET/PUT /goals`, `PUT /children` | JS-only | Toddler/child/preteen/teen plans; reset goals |
| 2I.4 Lesson/surah detail | Mobile lesson/surah detail cards with Arabic, transliteration, translation, tafsir brief, audio entry, and memorization handoff. Tajweed notes stay backlog. | New `lesson.tsx`, `surah-detail.tsx`; `src/lib/quran.ts` | `GET /surahs/:id`, Quran.com fetchers | JS-only | Open from plan/memorization; audio/translation loads |

#### Phase 2J — Progress/achievements/parent dashboard

Pre-TestFlight: some dashboard widgets are 2H; full analytics can be beta/post-beta.

| Slice | Goal | Likely files | Backend/API deps | Risk | QA |
|---|---|---|---|---|---|
| 2J.1 Progress page | Stats, weekly bars, earned/in-progress achievements, memorized surah list, review strength, daily progress bars. Use simple RN bars before adding chart libs. | New `progress.tsx`, dashboard widgets | `GET /dashboard`, `GET /weekly-progress`, `GET /memorization` | JS-only; avoid chart native deps | Empty/new child, active child, completed surahs |
| 2J.2 Sessions/goals history | Recent sessions, monthly/weekly activity, goals detail/edit, custom goals if needed. | New `sessions.tsx` or sections inside progress/plan | `GET/POST /sessions`, `GET/PUT /goals` | JS-only | Session list, goal persistence |
| 2J.3 Parent overview | Improve profile picker into a parent dashboard with multi-child cards, aggregate progress, quick settings, add child. | `app/index.tsx`, onboarding routes | `GET /children`, per-child dashboard if needed | JS-only | Multiple children, no children, sign-out |

#### Phase 2K — Polish + TestFlight readiness

Pre-TestFlight: yes after 2H must-haves are triaged/completed.

| Slice | Goal | Likely files | Backend/API deps | Risk | QA |
|---|---|---|---|---|---|
| 2K.1 Visual polish pass | Apply richer web-inspired product feel across mobile: section hierarchy, badges, compact stats, empty states, kid-friendly but parent-usable colors, no marketing hero. | All touched mobile screens, shared components | None | JS-only | Hardware screenshots of every primary screen |
| 2K.2 App shell/assets | Final app icon/splash, bundle/version config, production API env, no temporary dev copy. | `app.json`, assets, EAS config | None | App config changes may require EAS rebuild | Install production build, launch smoke |
| 2K.3 TestFlight build/QA | Production EAS build, App Store Connect/TestFlight setup, QA matrix, beta notes. | `artifacts/noor-mobile/*`, docs | Backend production stability | Requires production build | Login, onboarding, dashboard, memorize, recite, review, read, settings, content, offline/error paths |

---

## ✅ DONE — Infrastructure

- Apple Developer Program approved + App Store Connect access granted
- Backend deployed: <https://workspaceapi-server-production-cc25.up.railway.app>
- `BETTER_AUTH_URL` set to production URL
- `PROD_ALLOWED_ORIGINS` + `PROD_TRUSTED_ORIGINS` configured for CORS / Better Auth
- `/api/healthz` returns `{"status":"ok"}` (public, mounted above `requireAuth`)
- Three secrets rotated (Neon password, Better Auth secret, Hugging Face token)
- Branch-sync note: `main` + `feature/main-working-branch` were synced at `c3d50ea` before Phase 2G.4. After this API parity commit, both branches should be synced to the current Phase 2G.4 HEAD. `safe-cumulative` was temporary archaeology and can be ignored.
- Validation note: Phase 2G.4 touched libs/API/mobile checks pass; full root typecheck currently stops in unrelated frozen/reference UI React type errors in `artifacts/noor-path` and `artifacts/mockup-sandbox`.
- iOS bundle identifier registered: `com.mothman.noorpath`
- EAS project created at `@mothman123/noor-mobile`
- iOS distribution certificate generated (expires Apr 27 2027)
- `eas.json` committed with `development` / `preview` / `production` profiles
- `expo-dev-client` installed (auto-added by EAS during first dev build)
- First EAS development build shipped Apr 27 2026 — installed on registered iPhone, used to validate Slice 4 + Slice 5a Sessions 1+2

---

## ✅ DONE — Rendering architecture decided

| Context | Renderer | Reason |
|---|---|---|
| **Full Mushaf reader** | Page images + ayah bounding boxes | Authentic, pixel-perfect, zero rendering code |
| **Review** | Page images + highlight overlay on reviewed ayah range | Same visual the child memorized from; no layout work |
| **Memorization mode** | RN `<Text>` per word + Amiri Quran font + audio-synced highlight | Word-level granularity for follow-along audio |

**Two renderers, three contexts.** Page images do double duty for Full Mushaf and Review (the latter just adds an overlay highlighting the in-scope ayahs). Memorization is the only screen that needs custom text rendering, and that's where word-level interactivity actually matters.

**Why pages images for Review (not RN Text):** the child memorizes from a specific visual layout. Testing them on a different layout (different line breaks, different positions) would hurt recall. Page images keep the visual identical to the source they memorized from.

**Why not Skia anywhere:** Skia's basic `<Text>` doesn't shape Arabic correctly (renders disconnected isolated glyphs LTR — verified on iPhone). Skia's Paragraph API would shape correctly but require 4-8 weeks of building a custom renderer. Not justified.

**Memorization font: Amiri Quran.** Validated on iPhone Apr 27 against Digital Khatt and iOS system default. Amiri renders all Quran words correctly including the shadda+vowel sequences that Digital Khatt breaks on (verses 1, 3, 5 of Al-Fatihah). 133 KB, OFL license.

---

## ✅ DONE — Phase 1A: Mobile app skeleton + auth

Commits: `1c881c1`, `bc6115c`

- ✅ `artifacts/noor-mobile/` created (Expo SDK 54, Expo Router 6, RN 0.81.5)
- ✅ Renamed to `@workspace/noor-mobile` (matches monorepo convention)
- ✅ Migrated to pnpm-only (deleted `package-lock.json`, regenerated `pnpm-lock.yaml`)
- ✅ Better Auth client wired up via `@better-auth/expo` + `expo-secure-store`
- ✅ Sign-in screen working end-to-end against Railway backend
- ✅ Sign-out works
- ✅ Session persisted in iOS Keychain via SecureStore
- ✅ Light mode forced (`userInterfaceStyle: "light"` in app.json)

---

## ✅ DONE — Phase 1B: Child profile selector + dashboard skeleton

Commits: `ba10fc9`, `de6a2ae`

- ✅ `src/lib/api.ts` — typed `apiFetch<T>` helper using native `fetch`
- ✅ Session cookie attached via `authClient.getCookie()` (RN-specific Better Auth pattern)
- ✅ Child profile selector at `app/index.tsx`
- ✅ Dashboard at `app/child/[childId]/index.tsx` — three feature cards (Memorization, Review, Reading)
- ✅ All 8 children load on iPhone

---

## 🔜 Phase 1C — optional cleanup, deferred

Settings screen, du'aas list, stories list, achievements/progress. Low-priority; skipped to focus on memorization core. Pick up in a quiet later session.

---

## ✅ DONE — Phase 2A/B/C — page-image renderer + Reading + Review

### Phase 2A — Page image foundation

Validated and shipped in 2B (`4432f21`). Streaming from `raw.githubusercontent.com/GovarJabbar/Quran-PNG`, RTL paging via FlatList `inverted`, page-image cache via `<Image>` automatic. No bundling needed.

### Phase 2B — Full Mushaf reader (`4432f21`)

Reading card on dashboard navigates to a working Mushaf reader. 604 pages stream, RTL paging works, jump buttons (1/50/300/604), 2s debounced auto-save on swipe, last-page-read persists per child. Verified on iPhone.

### Phase 2C — Review screen (`bf8cb9a` + `08a8804` + `metro.config.js` fix)

Review queue loads with red/orange/green priority pills; surah review session shows mushaf page image + Husary audio + 0–5 quality rating modal; submit hits SM-2 backend and updates schedule. Verified on iPhone.

---

## ✅ DONE — Phase 2D — Memorization mode (Slices 1–4 + Slice 5a Sessions 1–3 local)

### Phase 2D-Core (Slice 1) — `5650d9e` + `e752721`

Single-verse focused memorization screen with Husary word-by-word audio sync.

### Phase 2D-Mushaf-Render (Slice 2a) — `1dae113`

Full Mushaf static view mode added.

### Phase 2D-Mushaf-Polish (Slice 2a-fix) — `3a9307c` + line-centering tweak

Visual repair of Slice 2a's wall-of-text rendering. Parchment page chrome ported from `noor-path` bayaan palette.

### Phase 2D-Mushaf-Sync (Slice 2b) — `ef7ae00`

Page-level audio sync + fixed controls island.

### Phase 2D-Practice (Slice 3) — `e2f9be7` + tweaks `1c89b3b`, `948de29`

Five settings + two mode buttons.

### Phase 2D-Recite (Slice 4) — `1f6557e` + docs `4100a1f`

On-device speech recognition via `expo-speech-recognition`. **Requires EAS dev build to test on hardware.**

#### Slice 4 hotfixes

- **v1 (`53675e6`)** — Audio session conflict + concurrent play race
- **v2 (`74ce890`)** — Web-derived Arabic matching + play-during-load race
- **v3 (`4b247eb`)** — Replay after natural finish + verse-boundary highlight + match logs

### Phase 2D-Polish Slice 5a Session 1 — `b73ed60` (initial) + 4 hotfixes

JS-only ship over existing EAS dev build.

**Initial commit `b73ed60`:**
- Diagnostic log cleanup from Slice 4 result handler
- `src/lib/reciters.ts` — 7-reciter table with `Reciter` type, `RECITERS` array, `findReciter`
- `src/lib/audio.ts` — `ayahAudioUrl(reciter, surah, ayah)` using `reciter.folder`
- `src/lib/memorization.ts` — initial parallel v4 chapter fetcher + `fetchTimingsForReciter` router (Husary→QDC, others→v4)
- `src/lib/mushaf-theme.ts` — 8-theme `THEMES` map, `ThemeKey`, `MushafTheme`, `THEME_DISPLAY_NAMES`, `DEFAULT_THEME_KEY`
- `memorization.tsx` — `makeThemedStyles(theme)` factory at module scope, `themedStyles = useMemo`, theme/reciter pill scrollers in settings sheet
- `src/lib/settings.ts` — initial `ChildSettings` blob persistence

**Hotfix sequence (post-hardware-testing):**

- **5a v1** — Audio session for iOS silent switch (`Audio.setAudioModeAsync({ playsInSilentModeIOS: true })`); fixed three wrong everyayah folders for Sudais/Minshawi/Ajmi (canonical names verified against everyayah.com); replaced bulk parallel v4 fetch with on-demand per-verse fetcher (`fetchQuranComV4VerseTiming` cached + dedup'd); split settings into profile-level (themeKey/reciterId/viewMode persisted) vs session-level (repeat/delay/autoplay/blur/blind reset each session). New `ChapterTimings` discriminated union type.
- **5a v2 (diagnostic)** — Added logs at `[v4-fetch]`, `[timings-effect]`, `[play]`, `[tick]` to debug missing word tracking.
- **5a v3 (`45d58a3`)** — Diagnostic logs revealed Quran.com v4 `by_ayah` endpoint returns `segments: undefined` for all non-Husary reciter IDs. Fix: fractional fallback in RAF tick (`Math.floor(frac * wordCount)`) when `segsRef.current` is empty. Mirrors web app's behavior. Plus `setVolumeAsync(1.0)` on every Sound (Afasy noticeably quieter than Husary on everyayah). Removed all diagnostic logs.
- **5a v4 (`d5d5f1f`)** — `LEAD_MS = 300` constant time-shift in fractional-fallback branch so highlight runs slightly ahead of audio (matches Husary's anticipatory feel from QDC segment 1 starting at frac=0).
- **5a v5** — Bumped `LEAD_MS = 500` after 300ms still trailed Afasy. Confirmed working for short ayahs. Lag may reappear on longer verses (Al-Baqarah, Ayat al-Kursi) — accepted limitation.

**Slice 5a Session 1 status: works very well on iPhone.** All 7 reciters play; word tracking works for all (true QDC for Husary, fractional fallback for others); audio plays through iPhone silent switch; volumes normalized; theme + reciter pickers in settings sheet; profile vs session settings split.

### Phase 2D-Polish Slice 5a Session 2 — `18f054d`

JS-only. Three features in one commit:

- **Translation popup (working)** — `word_fields=translation` + `translations=131` (Sahih International) added to both `fetchSurahVerses` and `fetchVersesByPage`. `onLongPress` (delayLongPress=400) on in-scope words opens a centered fade Modal with Arabic + English. Inner `Pressable` with empty `onPress` absorbs tap so backdrop dismiss only fires outside the card. Short tap still triggers tap-to-seek.
- **Playback rate (working)** — `PLAYBACK_RATES = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5]` pill scroller in settings sheet (matches theme/reciter pattern). Skipped `@react-native-community/slider` since it has native code requiring a rebuild — discrete pill values are kid-friendlier anyway. `setRateAsync(rate, true)` (`shouldCorrectPitch=true`) called in `playVerse` after `createAsync`, plus a separate effect that pushes rate changes to the active sound mid-playback.
- **Tajweed coloring (broken — backlogged)** — created `src/lib/tajweed.ts` with 21-class `TAJWEED_COLORS` map and `extractTajweedColor` helper, added `text_uthmani_tajweed?` to `ApiWord`, included it in `word_fields` of both fetchers, wired tajweed toggle into settings sheet, applied colors via `extractTajweedColor` in both ayah and page word renderers. End markers and out-of-scope words skip coloring. **Doesn't visually color anything on hardware.** Likely cause: Quran.com v4 doesn't actually populate `text_uthmani_tajweed` as a `word_field` despite docs (the web app uses verse-level `text_uthmani_tajweed` + `splitTajweedIntoWords` parser, suggesting it's only available at the verse level). Wiring is in place; investigation deferred.

---

### Phase 2D-Polish Slice 5a Session 3 — cumulative review — `safe-cumulative` / synced

JS-only. Hardware-tested by Mohammad and synced to `main` + `feature/main-working-branch` on Apr 28.

Current local commits:
- `4599dff` — web-style cumulative review state machine (`internalPhase: "single" | "cumulative"`, `cumAyahIdx`, `cumPass`, `cumUpTo`, `playingVerseNumber`, `reviewRepeatCount`)
- `2eaad4b` — skip handling fix: Next from newest single verse enters cumulative instead of skipping review
- `34d0172` — final-verse Next starts final cumulative review instead of completing immediately
- `2147b07` — final-verse Next button enabled when cumulative review can start
- `b2b3186` — normal repeated verses show `Pass X/Y · Verse A of B` in the header

Behavior now mirrors the web retention flow:
- `cumulativeReview` toggle defaults false each screen mount.
- `reviewRepeatCount` defaults 3 and ranges 1-10.
- After each new verse finishes its normal repeats, cumulative review plays `ayahStart..currentVerse` for `reviewRepeatCount` passes.
- During cumulative review, each verse plays once (no per-verse repeats).
- Header shows `Pass X/Y · Ayahs A-B` during cumulative review.
- Header shows `Pass X/Y · Verse A of B` during normal repeated single-verse playback.
- `Next` during cumulative exits cumulative and advances/completes; `Prev` during cumulative bails back to single phase.
- `Mark Complete` remains submit + success alert; cumulative review happens during memorization, not after submit.

Hardware QA status:
- Mohammad tested the final cumulative review fixes and repeat-pass header and approved moving to 5b.
- Branches were synced afterward: `origin/main` and `origin/feature/main-working-branch` advanced to `7e56509`.

### Phase 2D-Polish Slice 5b — `expo-blur` — `aa004ff`

Goal: real blur via `expo-blur`, replacing the current opacity fallback (`styles.mushafWordBlurred { opacity: 0.35 }`) used by `blurMode` in `memorization.tsx`.

Completed and hardware-tested:
- Installed `expo-blur@~15.0.8` in `@workspace/noor-mobile` using pnpm.
- Updated `memorization.tsx` page-mode word rendering to use a `BlurView` overlay for inactive in-scope words while audio is playing.
- Removed the old opacity fallback from blurred words.
- Preserved `Pressable` handlers so tap-to-seek and long-press translation still route through the same word wrapper.
- Ran `cd artifacts/noor-mobile && npx tsc --noEmit` clean.
- EAS development build finished: `cfb3f406-5fec-405a-a150-e525a96ecff2`.
- User installed/tested the build and reported "All done."
- Metro initially showed a stale `Unable to resolve "expo-blur"` bundle error after native install; restarting `npx expo start --dev-client --clear` with the new dev build resolved the expected native-dependency refresh path.

Phase 2D is complete. Tajweed remains wired-but-not-rendering and is intentionally backlogged.

---

## ✅ DONE — Phase 2E — dashboard polish & today's-work content

Implemented, typechecked, and hardware-tested Apr 28, 2026.

- Mobile dashboard now loads `/api/children/:id/dashboard` plus `/api/children/:id/reviews`.
- Memorization, Review, and Reading cards show today's concrete queued work/status.
- Dashboard review previews and review queue cards share red/orange/green priority colors via `src/lib/review-priority.ts`.
- Review queue cards now have priority-colored rails/backgrounds, not just text pills.
- Profile selector rows now show richer child details: avatar bubble, age label, streak, points, and arrow affordance.
- No native dependencies added. Tajweed untouched.
- Local QA: `cd artifacts/noor-mobile && npx tsc --noEmit` passed clean.
- Hardware QA: Mohammad checked the profile/dashboard/review priority polish on iPhone and said it looks good.

## ✅ DONE — Phase 2F — target-setting UI

Implemented, committed, typechecked, route-fixed, and hardware-tested Apr 28, 2026.

- Added a mobile Targets screen at `app/child/[childId]/targets.tsx`.
- Parents can set memorization, review, and reading pages-per-day per child.
- Uses existing backend fields: `memorizePagePerDay`, `reviewPagesPerDay`, `readPagesPerDay`.
- Preset chips match the web reference; minus/plus controls allow fine tuning without keyboard input.
- Child dashboard has a `Targets` header action and refreshes when returning from the Targets screen.
- Shared mobile `apiFetch` now sends `x-local-date` and normalizes HTML API failures into readable messages, so transient server errors do not render raw HTML in-app.
- Child dashboard retries `/api/children/:id/dashboard` once, then falls back to child/profile plus review queue data so the dashboard remains usable and Targets stays reachable if today's plan endpoint flakes.
- No native dependencies added. Tajweed untouched.
- Local QA: `cd artifacts/noor-mobile && npx tsc --noEmit` passed clean after the target UI, after the API helper hotfix, and after the dashboard fallback.
- Production QA: authenticated production dashboard fetches for child L and Joll returned 200 after the screenshots, so the saved target values are not corrupting dashboard data.
- Hardware QA: Mohammad reported the Targets/dashboard route fix passed on iPhone; dashboard no longer gets stuck on `/api/children/targets/*`.

## 🔜 NEXT — Phase 2H.1 mobile onboarding/profile management

1. Build mobile child create/edit/delete flows from the active Expo app only.
2. Include prior memorized surah setup, initial strength/known ayah counts, daily memorization/review/reading targets, practice minutes, and story/du'a visibility toggles.
3. Keep the frozen web app read-only as reference; do not edit generated API clients manually.
4. After implementation, validate child creation seeds memorization/review rows, edit persists settings/targets, delete removes a test child only after confirmation, and existing seeded profiles still open dashboard/memorization/review/reading.

---

## ⏸ Phase 3 — TestFlight & polish deferred

Phase 3/TestFlight is intentionally deferred until Phase 2H must-have mobile parity is triaged and completed, or explicitly moved to post-beta by Mohammad. The TestFlight work remains:

- [ ] App icon, splash screen, launch screen
- [ ] Production API/env review
- [ ] EAS Build production profile → first `.ipa`
- [ ] App Store Connect setup
- [ ] TestFlight beta with wife + trusted users
- [ ] Bug fixes from beta feedback
- [ ] App Store submission
- [ ] Push notifications for review reminders (Expo Notifications) — requires explicit native/build approval if new native config is needed
- [ ] Native gestures + haptics only if already covered by installed dependencies or explicitly approved
- [ ] Make audio controls in `review-session` sticky / floating at bottom of screen
- [ ] Add ayah-bounding-box overlay in `review-session`
- [ ] Migrate from `expo-av` to `expo-audio`/`expo-video` later; do not block parity on this

---

## 🟡 Backlog

- **Tajweed coloring not rendering (Slice 5a Session 2)** — wiring is in place (`src/lib/tajweed.ts`, fetcher fields, toggle, both renderers) but no colors appear on hardware. Most likely Quran.com v4 doesn't expose `text_uthmani_tajweed` as a `word_field` — only as a verse-level field. Web app uses `splitTajweedIntoWords` to parse the verse-level HTML and split into per-word HTML chunks. Mobile fix path: (1) add `fields=text_uthmani_tajweed` (verse-level) to fetcher, (2) port `splitTajweedIntoWords` from `noor-path/src/components/mushaf/bayaan/bayaan-utils.ts` to mobile, (3) at fetch time, parse each verse's tajweed HTML into a `Map<wordIdx, color>` keyed by display index, (4) consult that map in the renderers instead of `word.text_uthmani_tajweed`. Lower priority — kid can memorize fine without it.
- **Persistence bug** — Slice 5a Session 1 split profile vs session settings, but profile-level still doesn't persist across app close. Likely a hydrate-effect ordering issue or `settingsLoaded` gate timing problem in `memorization.tsx`. Low priority per user.
- **Long-verse fractional lag** — `LEAD_MS = 500` works for short ayahs but trailing reappears on long verses (Al-Baqarah, Ayat al-Kursi). Root cause is equal-time-per-word approximation, not leading silence. Real fix requires per-word audio durations (Quran.com `wbw` endpoint or similar) — heavier work. Accepted limitation for now.
- Update `noor-path/src/lib/auth-client.ts` to support env-switchable baseURL
- Add Expo dev URL to `PROD_TRUSTED_ORIGINS` and `PROD_ALLOWED_ORIGINS` if RN dev needs LAN access
- Retire `feature/main-working-branch` once `main` becomes permanent working branch
- Delete `~/Desktop/skia-quran-test/` (no longer needed)
- Dashboard kid name shows just first letter when truncated (cosmetic, low priority)
- Investigate continuous-listening latency on slow networks once recite mode sees more real-world use
- Web-app parity deep dive completed Apr 28, 2026. Follow the Phase 2G-2K roadmap above before resuming Phase 3/TestFlight.

---

## 📚 Knowledge banked

### From infra session
- pnpm 10's `pnpm-workspace.yaml` overrides syntax doesn't work with pnpm 9. Use root `package.json`'s `pnpm.overrides` for compat.
- Railway/Railpack reads `packageManager` field for Corepack activation but ignores it for version selection.
- Railway's "Wait for CI" toggle silently blocks all webhook-triggered deploys when no GitHub Actions are configured.
- Railway's "Redeploy" replays a row's specific commit + config, NOT branch HEAD.
- Native fetch from RN sends no `Origin` header — existing CORS `if (!origin)` branch handles it.

### From rendering test
- RN's `<Text>` shapes Arabic correctly via the OS text engine when given a real Unicode font (Amiri). No HarfBuzz/Skia needed.
- Skia's basic `<Text>` does NOT shape Arabic — renders isolated glyphs LTR.
- Reanimated v4 was split: needs `react-native-worklets` as separate peer dep (added in Expo SDK 54, Sep 2025).
- Expo Go bundles Skia/Reanimated/Worklets for testing; production needs EAS Build (full Xcode required).

### From Phase 1 mobile app setup
- React Native has no `document.cookie`. `credentials: "include"` in `fetch` does nothing. Better Auth Expo pattern: `authClient.getCookie()` returns the cookie string from SecureStore, which must be manually added as `Cookie` header. With manual `Cookie` header, set `credentials: "omit"` (not "include") to avoid conflicts.
- `npx expo install` in a pnpm monorepo will run `pnpm add` at the workspace root, which can corrupt nested `node_modules` if there's also an `npm install` `package-lock.json` present. Fix: commit fully to pnpm.
- `@better-auth/expo@1.6.9` requires `expo-network` as a peer dependency. Not installed automatically.
- pnpm's `node_modules/.pnpm/` content-addressed store works fine with Metro/Expo without `node-linker=hoisted`.
- App-wide light mode: set `"userInterfaceStyle": "light"` in `app.json` AND use explicit colors in StyleSheet.

### From QPC font test (2026-04-27)
- QPC V1/V2 per-page fonts use Private Use Area codepoints, not real Unicode. Each word on a Mushaf page is encoded as a custom glyph at a PUA codepoint.
- Decision: NOT pursuing QPC font rendering. Sticking with PNG page images for Full Mushaf + Review.

### From page-image streaming test (2026-04-27)
- Streaming Mushaf pages from `raw.githubusercontent.com/GovarJabbar/Quran-PNG` works on iOS via `<Image>` + `<FlatList>`.
- URL: `https://raw.githubusercontent.com/GovarJabbar/Quran-PNG/master/{NNN}.png` (NNN zero-padded 001–604).
- Page aspect ratio ~1.45:1.
- For RTL navigation use FlatList with `inverted` prop.

### Metro + pnpm requires explicit config (2026-04-27)
- When adding native dependencies, Metro with pnpm-style symlinks fails to resolve packages by default.
- Fix: `artifacts/noor-mobile/metro.config.js` must set `config.watchFolders = [workspaceRoot]` and `config.resolver.nodeModulesPaths = [projectRoot/node_modules, workspaceRoot/node_modules]`.
- DO NOT set `disableHierarchicalLookup: true` — pnpm's deeply nested `.pnpm/` requires hierarchical lookup ON.
- After modifying `metro.config.js`, restart with `npx expo start --clear`.

### Memorization screen architecture (2026-04-27, Phase 2D + Slice 5a)
- One file: `app/child/[childId]/memorization.tsx`. ~1500 lines after Slice 5a Session 2.
- Audio state lives in refs because `expo-av` status callback closes over stale state. Pattern: `const fooRef = useRef(foo); useEffect(() => { fooRef.current = foo; }, [foo]);`
- Audio refs as of Slice 5a Session 2: `viewModeRef`, `currentVerseRef`, `ayahEndRef`, `isPlayingRef`, `isLoadingRef`, `pendingSeekPositionRef`, `repeatCountRef`, `autoAdvanceDelayRef`, `autoplayThroughRangeRef`, `reciteModeRef`, `reciteExpectedIdxRef`, `displayWordsMapRef`, `surahNumberRef`, `matchedWordCountRef`, `lastMatchedWordRef`, `lastMatchTimeRef`, `reciterRef`, `saveTimerRef`, `playbackRateRef`. Plus timer/raf/sound refs.
- Two render modes (`viewMode: "ayah" | "page"`). Two highlight states (`highlightedWord` for ayah, `highlightedPage: { verseKey, position }` for page).
- QDC segments are 1-indexed and skip non-word tokens (filter `char_type_name === "word"` first).
- Husary `qdcId: 6`, `quranComId: null`. Don't assume null `quranComId` means no timing data.
- iOS audio session conflict: `expo-av` and `expo-speech-recognition` can't both hold the session. `pauseAsync()` not enough — must `unloadAsync()`. `stopAudioCompletely()` is the single cleanup point.

### Reciter audio infrastructure (2026-04-27, Slice 5a Session 1)
- 7 reciters in `src/lib/reciters.ts`: husary, afasy, sudais, basit, minshawi, ghamdi, ajmi.
- everyayah folder names verified against the canonical `everyayah.com/recitations_pages.html` list. Three names in the original web table were stale: Sudais (`Sudais_192kbps` → `Abdurrahmaan_As-Sudais_192kbps`), Minshawi (`Minshawi_Murattal_128kbps` → `Minshawy_Murattal_128kbps` with y), Ajmi (`ahmed_ibn_ali_al-ajmy128kbps` → `Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net`).
- Quran.com v4 `by_ayah` endpoint returns `segments: undefined` for all 6 non-Husary reciter IDs (verified via diagnostic logging Apr 27). Web app uses same endpoint and gets same empty result — falls back to fractional approximation.
- Fractional fallback in `tick()`: `Math.floor(shiftedFrac * wordCount)` where `shiftedFrac = (pos + LEAD_MS) / dur, clamped to 1`. `LEAD_MS = 500` after tuning. Provides anticipatory feel similar to Husary's QDC segment 1 starting at frac=0.
- iOS audio session: `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })` mandatory — without it the silent switch silences playback through the speaker. AirPods always work because Bluetooth bypasses the switch.
- everyayah recordings have wildly different mastered volumes. Afasy_128kbps is significantly quieter than Husary_128kbps. Compensate with `setVolumeAsync(1.0)` on every Sound after `createAsync`.
- `setRateAsync(rate, /* shouldCorrectPitch */ true)` works on `expo-av` Sound. Range 0.75–1.5 is comfortable. `shouldCorrectPitch=true` keeps recitation pitch natural.

### Profile vs session settings (2026-04-27, Slice 5a Session 1)
- `src/lib/settings.ts` exports `loadProfileSettings`/`saveProfileSettings` (themeKey, reciterId, viewMode — persisted to AsyncStorage) and `DEFAULT_SESSION_SETTINGS` constants (repeatCount, autoAdvanceDelayMs, autoplayThroughRange, blurMode, blindMode — reset each session).
- Profile-level edited via future Profile Settings page (Phase 2E). For now, defaults hardcoded.
- Session 2 added `playbackRate` and `tajweedEnabled` as plain inline `useState` defaults (not added to `DEFAULT_SESSION_SETTINGS`); they reset on screen mount.
- Persistence currently buggy — profile settings don't survive app close. Likely hydrate-effect ordering. Low priority per user.

### Tajweed (2026-04-27, Slice 5a Session 2 — partial)
- `src/lib/tajweed.ts` has the 21-class `TAJWEED_COLORS` map (ported from `noor-path/src/components/mushaf/bayaan/bayaan-constants.ts` `TAJWEED_CSS`) plus `extractTajweedColor(html)` which extracts the first `class="..."` and looks up the hex.
- Mobile assumed Quran.com v4 supports `text_uthmani_tajweed` as a `word_field`. On hardware no colors render. Likely the field isn't populated at the word level — only at verse level (web app fetches `text_uthmani_tajweed` on the verse and uses `splitTajweedIntoWords` from `bayaan-utils.ts` to chunk it). Fix path documented in backlog.

### Translation popup (2026-04-27, Slice 5a Session 2)
- Quran.com v4 `word_fields=translation` + `translations=131` (Sahih International) populates a `translation` field on each word. May come back as a `{ text, language_name }` object OR a plain string — handle both.
- `onLongPress` with `delayLongPress={400}` is a comfortable threshold (short tap still fires `onPress`).
- RN backdrop-dismiss pattern: outer `Pressable` is the backdrop with `onPress={close}`; inner card is also a `Pressable` with `onPress={() => {}}` (empty) to absorb taps so they don't bubble to the backdrop. Plain `<View>` for the card would let taps fall through.

### Arabic fuzzy matching for on-device speech recognition (2026-04-27, Slice 4 hotfixes)
- iOS speech recognition returns plain Arabic — no hamza variants (أإآاٱ all collapse to ا), no ta-marbuta (ة → ه), no ya-with-hamza (ئ → ي), often without "ال" prefix.
- The web app's `stripTashkeel` does the full normalization.
- Multi-predicate match: equality, substring either direction, subsequence either direction, noun-vowel-stripped equality, word-final ت→ه swap. `ال` prefix stripping with ≥2-char fallback. 1-char heard tokens reject unless equal.
- iOS sends growing partial transcripts each event. Matcher walks full transcript from `matchedWordCountRef` forward.
- iOS recognition has 60s session limit + warm-up gibberish at restart. Multi-predicate matchers reject the gibberish naturally.

### EAS dev build (2026-04-27)
- Expo Go does not include native modules. Use `eas build --profile development --platform ios`.
- Use `npx eas-cli@latest <cmd>` (avoid global-install permission issues).
- iOS 16+ requires Developer Mode (Settings → Privacy & Security → Developer Mode → enable → restart).
- Trust developer profile in iPhone Settings → General → VPN & Device Management.
- Run dev server: `npx expo start --dev-client` (the `--dev-client` flag is critical).
- Re-run `eas build` only when adding new native deps or changing `app.json` plugin entries. Pure JS hot-reloads.

---

## 🔐 Environment / URLs reference

| Thing | Value |
|---|---|
| Backend (prod) | `https://workspaceapi-server-production-cc25.up.railway.app` |
| Health check | `https://workspaceapi-server-production-cc25.up.railway.app/api/healthz` |
| Backend (dev) | `http://localhost:3001` |
| Frontend (dev) | `http://localhost:5173` |
| Database | Neon serverless Postgres (rotated Apr 26) |
| Repo | `https://github.com/mothman0406/Quranic-Journey` |
| Branches | `main` (deploy) + `feature/main-working-branch`; both should be synced to the current Phase 2G.4 API parity commit. `safe-cumulative` was temporary archaeology and can be ignored. |
| Apple Developer | Approved Apr 26; Team ID `M7KJJDN537` |
| iOS bundle identifier | `com.mothman.noorpath` |
| EAS project | `@mothman123/noor-mobile` |
| Railway project | `humble-laughter` / `production` env |
| Mobile app HEAD | Phase 2D complete through Slice 5b, Phase 2E dashboard polish complete, Phase 2F targets complete, web parity audit docs complete, Phase 2G.1 diagnostic cleanup hardware-tested, Phase 2G.2 mobile IA shell hardware-tested, Phase 2G.3 shared screen primitives hardware-tested, and Phase 2G.4 API parity implemented locally at current `main` HEAD. EAS dev build `cfb3f406-5fec-405a-a150-e525a96ecff2` finished and was hardware-tested by Mohammad for earlier slices. Next work should start from `main` with Phase 2H.1 mobile onboarding/profile management. |
</content>
