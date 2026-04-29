# NoorPath / Quranic Journey — Phase 2G Web Parity Handoff

**For: the next Codex/Claude Code conversation continuing this project**
**Last updated: 2026-04-29 (Phase 2H.4 review essentials parity implemented locally; hardware QA pending; Phase 3/TestFlight deferred until Phase 2H must-have parity is triaged/completed)**

This handoff supersedes earlier handoff drafts.

## Current work log — 2026-04-29

- Active branch/SHA at Phase 2H.1 start: `main` at `21535d4`. Phase 2H.1 mobile onboarding/profile management implementation commit: `5af7b9a`; docs sync: `c7c0a65`; follow-up onboarding polish commit: `3f43337`; current docs-sync HEAD contains this note.
- Remote sync status after this docs sync: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` should be synced to the current Phase 2H.1 complete HEAD. `safe-cumulative` was temporary archaeology and can be ignored.
- Active branch/SHA at Phase 2H.2 start: `main` at `7e1a24e`. Phase 2H.2 dashboard parity content implementation commit: `ab87771`. Mohammad hardware-tested the dashboard after the commit and reported it looks good. This docs update should be committed/synced as the next HEAD. Remote sync target after this docs sync: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2H.2 complete HEAD.
- Active branch/SHA at Phase 2H.3 start: `main` at `512d03c`. Phase 2H.3 settings/targets convergence is implemented locally in the active Expo app. Remote sync target after this implementation/docs commit: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2H.3 local-validation HEAD.
- Active branch/SHA after Phase 2H.3 implementation sync: `main` at `4f85482`. Mohammad hardware-tested Phase 2H.3 settings/targets convergence and reported it looks good. This docs update should be committed/synced as the next HEAD. Remote sync target after this docs sync: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2H.3 complete HEAD.
- Active branch/SHA at Phase 2H.4 start: `main` at `5872c58`. Phase 2H.4 review essentials parity is implemented locally in the active Expo app. Remote sync target after this implementation/docs commit: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2H.4 local-validation HEAD.
- QA status: Phase 2D memorization core through Slice 5b, Phase 2E dashboard polish, Phase 2F target-setting UI, Phase 2G.1 diagnostic cleanup, Phase 2G.2 mobile IA shell, Phase 2G.3 shared screen primitives, Phase 2H.1 mobile onboarding/profile management, Phase 2H.2 mobile dashboard parity content, and Phase 2H.3 settings/targets convergence are hardware-tested. Phase 2H.4 is locally validated and awaits Mohammad hardware QA. Phase 2G.4 local validation passed for API/codegen/mobile with `/Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/api-spec run codegen`, `/Users/mothmanaurascape.ai/Library/pnpm/pnpm run typecheck:libs`, `/Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/api-server run typecheck`, and `cd artifacts/noor-mobile && npx tsc --noEmit`. Phase 2H.1 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`; follow-up onboarding polish also passed the same two checks. Phase 2H.2 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Phase 2H.3 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Phase 2H.4 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Full root `/Users/mothmanaurascape.ai/Library/pnpm/pnpm run typecheck` was previously attempted, but it stops in unrelated frozen/reference UI areas (`artifacts/noor-path/src/components/ui/button-group.tsx`, `artifacts/noor-path/src/components/ui/calendar.tsx`, `artifacts/mockup-sandbox/src/components/ui/calendar.tsx`, `artifacts/mockup-sandbox/src/components/ui/spinner.tsx`) on React type/ref baseline errors.
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
- Phase 2H.2 implementation notes: expanded the active mobile dashboard with API-backed memorization stats, goals preview, achievements preview, story and du'a suggestions that respect `hideStories`/`hideDuas`, up-next memorization preview from `upNextMemorization`/`nextSurah`, richer completed and empty states for memorization/review/reading, and quick actions for Targets, Full Quran, Profile, and More. Kept the work frontend-only in `artifacts/noor-mobile/app/child/[childId]/index.tsx`; no backend/spec/generated files, frozen web app files, tajweed implementation, recite matcher behavior, or native dependencies were touched.
- Phase 2H.2 validation notes: `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check` passed locally.
- Phase 2H.2 hardware QA notes: Mohammad tested the enriched dashboard and reported it looks good.
- Phase 2H.3 implementation notes: converted mobile `app/child/[childId]/targets.tsx` into a parent Settings surface while preserving the existing route. It now includes profile entry, practice minutes presets/stepper, daily target bundles plus individual memorize/review/read controls, content visibility toggles for `hideStories` and `hideDuas`, and JS-only memorization session defaults for repeat count, auto-advance delay, page-range autoplay, blind mode, and blur mode. `src/lib/settings.ts` now persists those defaults in AsyncStorage per child, and `memorization.tsx` hydrates them as starting values without changing the memorization engine or recite matcher. Profile-level memorization preferences now save immediately instead of via a debounce that could be lost on fast navigation. Dashboard/More labels now point users to Settings. No backend/spec/generated files, frozen web app files, tajweed implementation, recite matcher behavior, or native dependencies were touched.
- Phase 2H.3 validation notes: `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check` passed locally.
- Phase 2H.3 hardware QA notes: Mohammad tested the settings/targets convergence on iPhone and reported it looks good.
- Phase 2H.4 implementation notes: refreshed the active mobile Review screen with focus-refresh and pull-to-refresh, a dense queue summary, richer due-today cards, reviewed-today completed cards, no-due/completed/empty states, and an upcoming reviews section capped with overflow copy. The review session keeps the page-image review flow and 0-5 SM-2 submit path, adds a sticky bottom control bar, hydrates the child's memorization reciter preference as the review audio default, and adds JS-only reciter/playback-speed controls using existing mobile audio patterns. Submitting a rating returns to Review, whose focus refresh updates the queue; dashboard focus refresh continues to update the badge/count after returning. No backend/spec/generated files, frozen web app files, tajweed implementation, recite matcher behavior, or native dependencies were touched.
- Phase 2H.4 validation notes: `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check` passed locally.
- Phase 2H.4 hardware QA notes: pending Mohammad iPhone QA.
- Exact next checklist:
  1. Mohammad hardware QA for Phase 2H.4: submit 0-5 ratings, confirm Review queue refreshes after returning from the session, confirm dashboard review count/badge updates after returning, test no-due state, upcoming queue visibility, reviewed/completed sections, reciter/speed controls, and pull-to-refresh.
  2. Smoke the seeded-profile flows after Phase 2H.4: dashboard, settings/targets, memorization, review, More, Full Quran, profile picker, profile creation, profile settings, delete child, and pull-to-refresh.
  3. If Phase 2H.4 passes hardware QA, update this file and `TODO.md` to mark it complete/hardware-tested and sync both branches.
  4. Start Phase 2H.5 reading essentials parity only after 2H.4 is accepted or explicitly moved forward: page/surah/juz jump/search, saved-page resume clarity, reading target progress, better footer/header controls, and optional JS-only bookmarks.
  5. Keep Phase 3/TestFlight deferred until Phase 2H must-have parity is completed or explicitly moved to post-beta. Keep tajweed as documented backlog only; do not tighten recite matching; do not edit the frozen web app; do not edit generated files manually; keep future implementation JS-only unless a native rebuild is explicitly approved.

---

## Web-app parity audit — 2026-04-28

This audit compared the frozen web app (`artifacts/noor-path`) with the active Expo app (`artifacts/noor-mobile`) before TestFlight. The result: mobile has the memorization/review/reading core, but it does not yet expose enough of the web app's learning product surface.

Mobile already has:
- Mobile child creation/profile management through Phase 2H.1: create child, seed prior memorized surahs with per-surah strength and known ayah counts, add prior surahs by From/To range, edit profile settings/targets/practice minutes/visibility toggles, delete the selected child with confirmation, dismiss keyboard cleanly, and save without scrolling past all surahs. Hardware QA passed.
- Phase 2H.2 dashboard parity content is complete and hardware-tested: richer stats, goals, achievements, up-next memorization, story/du'a suggestions respecting visibility flags, better empty/completed states, and quick actions.
- Phase 2H.3 settings/targets convergence is complete and hardware-tested: Parent Settings now covers daily target bundles/fine tuning, practice minutes, visibility flags, profile entry, and JS-only default memorization session settings.
- Auth, existing-child profile picker, dashboard work cards, Parent Settings, memorization session engine, review queue/session with Phase 2H.4 essentials, a basic full Quran page-image reader, a first-pass Dashboard/Memorize/Review/More nav shell, shared screen primitives adopted by More and Review, and Phase 2G.4 API/spec foundation for upcoming content and progress pages.
- Memorization already includes ayah/page modes, cumulative review, repeats, reciters, themes, speed, blind/blur modes, translation popup, recite mode, and progress submission.
- Review now has queue summary, due/upcoming/reviewed sections, no-due/completed/empty states, sticky session controls, reciter/speed controls, focus refresh, and SM-2 ratings; Reading already resumes/saves a page target.

Biggest mobile gaps from web:
- Richer parent controls beyond Phase 2H.3, such as custom goal editing, deeper plan settings, and dedicated content settings pages.
- More now exposes existing Full Quran/Targets/Profile routes and planned Progress/Plan/Stories/Du'aas entries, but those content routes are not implemented yet.
- Dashboard parity is now mostly covered locally through Phase 2H.2; weekly activity charts and dedicated destination pages for progress/stories/du'aas/plan remain future work.
- Memorization lacks the web overview/list/search/filter/strength-map/chooser/teacher-test flow around the strong session engine.
- Review still lacks completed-day/ahead-day local session behavior, flashcards, connected batch Mushaf review, and web-like review celebration.
- Reading lacks search/jump by surah/page/juz, recent reads, bookmarks/highlights/notes, translation/tafsir/word tools, range audio, recite/select modes, and better page navigation.
- No mobile progress/achievements page, stories pages, du'aas pages, plan/goals page, lesson page, or surah-detail learning page.
- Visual system is functional but thin; port the web's dense, warm, kid-friendly but parent-usable working-app feel.

Highest-risk gaps before TestFlight:
- Phase 2G.2 mobile IA shell is hardware-tested.
- Phase 2G.4 fixed the child-du'a update bug and refreshed OpenAPI/generated clients for the next mobile surfaces; authenticated production API smoke is still pending.
- New beta user onboarding/profile management is now hardware-tested in Phase 2H.1.
- Major pages are visible in More, but Progress, Stories, Du'aas, Plan, achievements, and richer dedicated destination pages are still absent.
- Content/progress/planning pages are absent, making the app feel much smaller than the web app.
- Phase 2H.4 review essentials parity is implemented locally and still needs Mohammad hardware QA before it is marked complete.
- Mobile du'a status UI is still absent; when it is built, test toggling multiple du'as independently against the Phase 2G.4 route fix.
- Future API changes must keep `lib/api-spec/openapi.yaml` and Orval outputs in sync; never edit generated files manually.

### Phase 2G — Diagnostic cleanup + web parity foundation

Pre-TestFlight: yes.

| Slice | Goal | Likely files | API deps | Risk | QA |
|---|---|---|---|---|---|
| 2G.1 | Complete Apr 29: removed visible dashboard diagnostics and noisy API logs while preserving readable errors/fallbacks. | `src/lib/api.ts`, `app/child/[childId]/index.tsx` | None | JS-only | Local typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2G.2 | Complete Apr 29: first-pass bottom nav and More screen so current and future pages are discoverable. | `app/child/[childId]/_layout.tsx`, dashboard, review, new `more.tsx`, `src/components/child-bottom-nav.tsx` | Child profile fetch; existing review/dashboard queue data for badge | JS-only | Local typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2G.3 | Complete Apr 29: reusable header/container/scroll/list/pill/loading/empty/error primitives adopted on More and Review. | `src/components/screen-primitives.tsx`, `more.tsx`, `review.tsx` | None | JS-only | Local typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2G.4 | Implemented locally Apr 29: fixed child-du'a keying, aligned OpenAPI for dashboard/review/progress/goals/child targets, regenerated Orval outputs. | `lib/api-spec/openapi.yaml`, `artifacts/api-server/src/routes/children.ts`, `artifacts/api-server/src/routes/sessions.ts`, generated output only via codegen | Dua bug, `reviewedToday`, dashboard/reading/progress fields | JS/TS; no native | Codegen, libs typecheck, API-server typecheck, mobile tsc passed; root typecheck blocked by unrelated frozen/reference UI React type errors; production API smoke pending |

### Phase 2H — Must-have mobile parity before TestFlight

Pre-TestFlight: yes unless Mohammad explicitly narrows beta to existing seeded profiles.

| Slice | Goal | Likely files | API deps | Risk | QA |
|---|---|---|---|---|---|
| 2H.1 | Complete Apr 29: mobile onboarding/profile create/edit/delete with pre-memorized surahs, From/To surah range selection, strength/known ayah counts, targets, practice minutes, hide stories/duas, sticky save, and keyboard dismissal. | `app/index.tsx`, `app/profile/new.tsx`, `app/child/[childId]/profile.tsx`, `src/components/child-profile-form.tsx`, `src/lib/api.ts` | Existing `POST/PUT/DELETE /children`, `GET /surahs`; no generated edits | JS-only | Local mobile typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2H.2 | Complete Apr 29: mobile dashboard now shows API-backed stats, goals, achievements, story/du'a suggestions respecting visibility flags, next/up-next work, richer completed/empty states, and quick actions. | `app/child/[childId]/index.tsx` | `GET /dashboard`; no backend/spec changes | JS-only | Mobile typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2H.3 | Complete Apr 29: Parent Settings now covers practice minutes, visibility toggles, child profile entry, daily target bundles/fine tuning, JS-only memorization defaults, and immediate profile preference persistence. | `targets.tsx`, `src/lib/settings.ts`, `memorization.tsx`, dashboard/More labels | Existing `PUT /children/:id`; AsyncStorage for session defaults | JS-only; no native | Mobile typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2H.4 | Implemented locally Apr 29: queue summary, upcoming/reviewed/completed/no-due states, pull/focus refresh, sticky review-session controls, reciter/speed controls, and queue/dashboard refresh path after submit. | `review.tsx`, `review-session.tsx`, `src/components/screen-primitives.tsx` | Existing review endpoints; no backend/spec/generated changes | JS-only | Local mobile typecheck + `git diff --check` passed; Mohammad hardware QA pending |
| 2H.5 | Reading essentials: page/surah/juz jump/search, resume clarity, reading target progress, better controls, optional JS-only bookmarks. | `mushaf.tsx`, mushaf/quran helpers | `POST /reading-progress`, dashboard | JS-only | Save/resume/jump/goal complete |
| 2H.6 | Memorization discovery: mobile list/search/filter/progress/strength/current-work page that starts the existing session engine. | Existing `memorization.tsx` may need split; memorization libs | `GET /surahs`, `GET /memorization`, dashboard | JS-only; route migration care | Dashboard start and list start both work |

### Phase 2I — Rich learning/content pages

Pre-TestFlight: optional after 2H triage; strong beta candidate if time.

| Slice | Goal | Likely files | API deps | Risk | QA |
|---|---|---|---|---|---|
| 2I.1 | Stories list/detail with categories, age filters, morals, discussion questions, and hide-stories behavior. | New stories routes, More/dashboard links | `GET /stories`, `GET /stories/:id` | JS-only | Filters/detail/hidden state |
| 2I.2 | Du'aas list/detail/status with categories, learned toggle, practice count, Arabic/transliteration/translation/source. | New duas route/cards | Use Phase 2G.4 child-du'a update-by-`duaId` route fix | JS/backend; no native | Toggle multiple du'as independently |
| 2I.3 | Plan/goals page with age-group plan, milestones, weekly goals, long-term goals, reset-to-auto. | New plan/goals routes | `GET /plan`, `GET/PUT /goals` | JS-only | All age groups, reset |
| 2I.4 | Lesson/surah detail with Arabic, transliteration, translation, tafsir brief, audio handoff. Tajweed notes stay backlog. | New lesson/surah-detail routes | `GET /surahs/:id`, Quran.com | JS-only | Open from plan/memorization |

### Phase 2J — Progress/achievements/parent dashboard

Pre-TestFlight: dashboard widgets are 2H; full analytics can be beta/post-beta.

| Slice | Goal | Likely files | API deps | Risk | QA |
|---|---|---|---|---|---|
| 2J.1 | Progress page with stats, weekly bars, badges, memorized surah list, review strength, daily bars. Use simple RN bars before chart libs. | New `progress.tsx`, dashboard widgets | Dashboard, weekly progress, memorization | JS-only; avoid chart native deps | Empty/active/completed states |
| 2J.2 | Session history and goals detail/edit. | New sessions/goals sections | Sessions/goals endpoints | JS-only | Session list, goal persistence |
| 2J.3 | Parent overview profile picker with multi-child progress and add-child entry. | `app/index.tsx`, onboarding routes | Children and maybe per-child dashboard | JS-only | Multiple/no children |

### Phase 2K — Polish + TestFlight readiness

Pre-TestFlight: yes after 2H triage/completion.

| Slice | Goal | Likely files | API deps | Risk | QA |
|---|---|---|---|---|---|
| 2K.1 | Visual polish pass: web-inspired sections, badges, compact stats, warm kid/parent UI, polished empty states. | All primary mobile screens | None | JS-only | Screenshot every primary screen |
| 2K.2 | App shell/assets: icon, splash, bundle/version, production API env, remove dev copy. | `app.json`, assets, EAS config | None | App config may require EAS rebuild | Install production build |
| 2K.3 | TestFlight build/QA: production EAS build, App Store Connect, QA matrix, beta notes. | Mobile app/docs | Production backend stability | Requires production build | Login, onboarding, dashboard, memorize, recite, review, read, settings, content, offline/error paths |

Phase 3 remains deferred until Phase 2H must-have parity is triaged/completed.

## 1. The user (Mohammad)

You're working with a self-taught builder doing this project on weekends and evenings. Father of multiple kids he wants to teach Quran memorization to. Sharp product instincts, fast on the keyboard, treats Claude as a peer not a teacher.

- He hates UI work. Wants things to "be there by default."
- He prefers Claude Code (the agentic CLI) make all code changes. The pattern that works: I draft a precise prompt as a markdown block; he pastes it into a fresh Claude Code session at the repo root; Claude Code reports SHA + typecheck; we iterate. Direct filesystem edits from the chat assistant are reserved for tiny things (config files, doc updates).
- One terminal command at a time, not walls.
- "Let's keep going" / "next" / "good" means it. Don't suggest stopping.
- He pushes back hard when scope is wrong. Take it seriously, but don't preemptively scope down — ship the right slice and offer the slicing plan transparently.
- Test-then-ship. Every slice gets tested on hardware (EAS dev build) before the next prompt is drafted. Don't skip ahead.
- He's fine being told something is hard. Don't sandbag.
- **Critical convention: only ever LOOSEN matching/acceptance, never tighten without asking.** The recite mode matcher is at parity with the web app and works well in real testing. Don't make it stricter.
- He's pragmatic about partial wins. When tajweed didn't render in Session 2, his response was "let's add that to the queue as well: not one of the more important features." Don't try to over-investigate broken things if they're not blocking — note them and move on.

---

## 2. The project

**NoorPath** is a Quran memorization/review/reading app for kids 3–18. Originally a web app at `artifacts/noor-path/` (frozen archival); now an iOS app at `artifacts/noor-mobile/` being shipped slice by slice.

### Repo
- GitHub: `https://github.com/mothman0406/Quranic-Journey`
- Local: `/Users/mothmanaurascape.ai/Desktop/Quranic-Journey/`
- Normal branch policy: `main` (deploy) and `feature/main-working-branch` stay synced. `safe-cumulative` was temporary archaeology and can be ignored. At Phase 2H.4 start both tracked branches were synced at `5872c58`; after this review essentials commit they should be synced to the current Phase 2H.4 local-validation HEAD.

### Stack
- **Monorepo:** pnpm 9.15.9 (NOT 10).
- **Backend:** Express 5 + Drizzle + Neon Postgres + Better Auth, deployed at `https://workspaceapi-server-production-cc25.up.railway.app`. Live, healthy.
- **Web frontend** (`artifacts/noor-path/`): React 19 + Vite + shadcn/ui. **Frozen archival reference.** Don't edit.
- **iOS app** (`artifacts/noor-mobile/`): Expo SDK 54.0.33, Expo Router 6, RN 0.81.5. **The active build target.**
- **Apple Developer:** approved Apr 26. Team ID `M7KJJDN537`. iOS bundle identifier `com.mothman.noorpath`.
- **EAS project:** `@mothman123/noor-mobile`. First development build shipped Apr 27 evening; installed on Mohammad's registered iPhone with Developer Mode enabled.

---

## 3. Where the project is right now

**Phase 2D is complete through Slice 5b. Phase 2E dashboard polish is hardware-tested. Phase 2F target-setting UI is route-fixed and hardware-tested. Phase 2G.1 diagnostic cleanup, 2G.2 mobile IA shell, and 2G.3 shared screen primitives are hardware-tested. Phase 2H.1 onboarding/profile management, 2H.2 dashboard parity content, and 2H.3 settings/targets convergence are hardware-tested. Phase 2H.4 review essentials parity is implemented locally with mobile typecheck and `git diff --check` passing; hardware QA is pending. Phase 3/TestFlight is deferred until Phase 2H must-have parity is triaged/completed.** Recite mode is at parity with web. Multi-reciter playback works for all 7 reciters. Word tracking works for all (true QDC for Husary, fractional fallback w/ 500ms lead for others). Audio plays through iPhone silent switch. Theme + reciter pickers in settings sheet. Profile vs session settings split. **Long-press translation popup works.** **Playback rate (0.75x–1.5x discrete pills) works.** **Cumulative review works from hardware QA.** **Real blur mode via `expo-blur` is built and hardware-tested.** **Tajweed coloring is wired but doesn't render** (likely API field shape — backlogged; do not tackle unless Mohammad explicitly asks).

| Slice | Status | Commit | What |
|---|---|---|---|
| 2D-Core (1) | ✅ tested | `5650d9e` + `e752721` | Single-verse, Amiri, Husary word-by-word audio sync |
| 2D-Mushaf-Render (2a) | ✅ tested | `1dae113` | View mode toggle, page-level static rendering |
| 2D-Mushaf-Polish (2a-fix) | ✅ tested | `3a9307c` + tweak | Parchment chrome |
| 2D-Mushaf-Sync (2b) | ✅ tested | `ef7ae00` | Page-level word highlight, auto-advance, controls island |
| 2D-Practice (3) | ✅ tested | `e2f9be7` + `1c89b3b` + `948de29` | Settings sheet, repeat, delay, blind mode, blur mode |
| 2D-Recite (4) | ✅ tested (after 3 hotfixes) | `1f6557e` + `4100a1f` + `53675e6` + `74ce890` + `4b247eb` | On-device speech recognition |
| 2D-Polish 5a Session 1 | ✅ tested (after 4 hotfixes) | `b73ed60` + 4 hotfixes (latest `45d58a3` then `d5d5f1f` then LEAD_MS=500) | Cleanup, AsyncStorage, 8 themes, 7 reciters, profile/session split, fractional fallback, anticipatory shift |
| 2D-Polish 5a Session 2 | ✅ tested (tajweed broken — backlogged) | `18f054d` | Translation popup, playback rate, tajweed wiring (no colors) |
| 2D-Polish 5a Session 3 | ✅ hardware-tested enough to proceed; synced | `4599dff` + fixes through `b2b3186`; docs sync `7e56509` | Web-style cumulative review during memorization, review repeat count, pass labels, final-verse skip fixes |
| **2D-Polish 5b** | ✅ tested; synced | `aa004ff` + docs | Real `expo-blur` overlay in page-mode blur. Tajweed explicitly deferred. |
| **2E Dashboard polish** | ✅ hardware-tested | `3a19f2f` + docs | Today's-work dashboard cards, review priority colors, profile selector polish |
| **2F Target-setting UI** | ✅ hardware-tested | `fe83e97` + `ce8b9f6` + `8fa113a` + `ccbf1ec` + `0c1e088` + docs `70c389c` | Mobile Targets screen for daily memorization/review/reading page targets; API helper sends local date and strips raw HTML errors; dashboard retries/falls back on plan errors; malformed Targets route fixed |
| **Web parity audit** | ✅ docs-only | `c57773f` | Compared `noor-path` and `noor-mobile`; added Phase 2G-2K roadmap; deferred Phase 3/TestFlight until Phase 2H must-have parity is triaged/completed |
| **2G.1 Diagnostic cleanup** | ✅ hardware-tested | `cf7b916` | Removed temporary dashboard diagnostic panel and `[noor-api]` logs while preserving API hardening, route validation, and dashboard fallback behavior |
| **2G.2 Mobile IA shell** | ✅ hardware-tested | `0af13be` | Added first-pass bottom nav plus More screen exposing existing and planned mobile surfaces |
| **2G.3 Shared screen primitives** | ✅ hardware-tested | `c3d50ea` | Added reusable screen primitives and adopted them on More and Review |
| **2G.4 API parity checklist** | ✅ local validation; production API smoke pending | current Phase 2G.4 HEAD | Fixed child-du'a keying, aligned OpenAPI with dashboard/review/progress/goals/targets, regenerated Orval outputs |
| **2H.1 Mobile onboarding/profile management** | ✅ hardware-tested | `5af7b9a` + docs/polish | Create/edit/delete child profiles with prior memorized surahs, targets, visibility toggles, sticky save, and keyboard polish |
| **2H.2 Dashboard parity content** | ✅ hardware-tested | `ab87771` + docs | Stats, goals, achievements, up-next work, story/du'a suggestions, richer dashboard empty/completed states |
| **2H.3 Settings/targets convergence** | ✅ hardware-tested | `4f85482` + docs `5872c58` | Parent Settings surface for targets, practice minutes, visibility toggles, profile entry, and JS-only memorization defaults |
| **2H.4 Review essentials parity** | ✅ local validation; hardware QA pending | current Phase 2H.4 local-validation HEAD | Queue summary, due/upcoming/reviewed/completed states, pull/focus refresh, sticky review-session controls, reciter/speed controls |

`TODO.md` is current. Read it first.

---

## 4. The single most important file

`artifacts/noor-mobile/app/child/[childId]/memorization.tsx` — **the entire memorization product, ~1500 lines after Slice 5a Session 3**. Plus supporting libs: `src/lib/memorization.ts`, `src/lib/quran.ts`, `src/lib/recite.ts`, `src/lib/mushaf-theme.ts`, `src/lib/reciters.ts`, `src/lib/settings.ts`, `src/lib/audio.ts`, `src/lib/tajweed.ts`.

Don't refactor preemptively. If it gets unwieldy after 5b, extract `lib/memorization-audio.ts` and `lib/memorization-recite.ts`.

### Architectural notes (current state, post-Slice-5a-Session-3 local)

**Two render modes** controlled by `viewMode: "ayah" | "page"`. Toggle pills under the header.

**Audio state lives in refs.** `expo-av`'s status callback closes over stale state. Pattern:
```ts
const [foo, setFoo] = useState(...);
const fooRef = useRef(foo);
useEffect(() => { fooRef.current = foo; }, [foo]);
```

Important refs as of Slice 5a Session 3: `viewModeRef`, `currentVerseRef`, `playingVerseNumberRef`, `ayahStartRef`, `ayahEndRef`, `isPlayingRef`, `isLoadingRef`, `pendingSeekPositionRef`, `repeatCountRef`, `autoAdvanceDelayRef`, `autoplayThroughRangeRef`, `internalPhaseRef`, `cumAyahIdxRef`, `cumPassRef`, `cumUpToRef`, `cumulativeReviewRef`, `reviewRepeatCountRef`, `reciteModeRef`, `reciteExpectedIdxRef`, `displayWordsMapRef`, `surahNumberRef`, `matchedWordCountRef`, `lastMatchedWordRef`, `lastMatchTimeRef`, `reciterRef`, `saveTimerRef`, `playbackRateRef`. Plus timer/raf/sound refs.

**`handlePlayPause` reads ONLY refs.** Critical. After Slice 4 hotfix v2 the function gates exclusively on `isPlayingRef.current` and `isLoadingRef.current` to close the load-completion race window.

**`stopAudioCompletely()`** is the single audio cleanup point.

**Two highlight states.** `highlightedWord: number` (0-based, ayah mode) and `highlightedPage: { verseKey, position } | null` (1-based to match `ApiWord.position`, page mode). Both updated from the same RAF tick.

**Verse-change effect (`[currentVerse]`)** behaves differently for recite vs Husary mode. In recite mode it sets highlight to word 0. In Husary mode it clears to -1.

**Multi-reciter timing routing (Slice 5a Session 1):**
- `fetchTimingsForReciter(reciter, surah)` returns a `ChapterTimings` discriminated union
- Husary: `{ kind: "chapter", map: ... }` — synchronous lookup
- Others: `{ kind: "ondemand", fetch: (verse) => ... }` — per-verse v4 fetch (cached)
- v4 returns no segments for non-Husary → `tick()` falls back to fractional formula

**Fractional fallback (Slice 5a Session 1 final):**
```ts
const LEAD_MS = 500;
const shiftedPos = pos + LEAD_MS;
const shiftedFrac = Math.min(shiftedPos / dur, 1);
found = Math.min(Math.floor(shiftedFrac * wordCount), wordCount - 1);
```
Provides anticipatory feel. Works for short ayahs; trails on long ones — accepted limitation.

**iOS audio session:** `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })` mandatory. `setVolumeAsync(1.0)` on every Sound. `expo-av` and `expo-speech-recognition` can't both hold the session — `pauseAsync()` not enough, must `unloadAsync()`.

**Profile vs session settings (Slice 5a Session 1):**
- Profile-level (persist): `themeKey`, `reciterId`, `viewMode`. Persistence currently buggy.
- Session-level (`DEFAULT_SESSION_SETTINGS`): `repeatCount`, `autoAdvanceDelayMs`, `autoplayThroughRange`, `blurMode`, `blindMode`.
- Session 2 added `playbackRate` (default 1.0) and `tajweedEnabled` (default false) as plain inline `useState`, NOT in `DEFAULT_SESSION_SETTINGS`.

**Translation popup (Slice 5a Session 2):**
- `word_fields=translation` + `translations=131` (Sahih International) on both fetchers
- `translation` field on word may be `{ text, language_name }` or plain string — `getTranslationText` handles both
- `onLongPress` with `delayLongPress={400}`. Short tap still triggers tap-to-seek.
- Modal pattern: outer `Pressable` backdrop with `onPress={close}`, inner card is also `Pressable` with empty `onPress={() => {}}` to absorb taps. Plain `View` would let taps bubble.

**Playback rate (Slice 5a Session 2):**
- `PLAYBACK_RATES = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5]` discrete pill scroller
- Skipped `@react-native-community/slider` (has native code, would require rebuild)
- `setRateAsync(rate, true)` in `playVerse` after `createAsync`
- Separate effect pushes mid-playback rate changes to active sound

**Cumulative review (Slice 5a Session 3 local):**
- Web-style state machine, not a Mark Complete after-pass.
- `internalPhase: "single" | "cumulative"` drives whether the audio is playing the study verse or cumulative review.
- `currentVerse` remains the single-phase study cursor. `playingVerseNumber` is what actually plays/highlights; in cumulative phase it is `ayahStart + cumAyahIdx`.
- `cumulativeReview` toggle defaults false. `reviewRepeatCount` defaults 3 and ranges 1-10.
- After a new verse finishes normal repeats, if cumulative review is enabled and `currentVerse > ayahStart`, cumulative plays `ayahStart..currentVerse` for `reviewRepeatCount` passes.
- During cumulative, each verse plays once regardless of normal repeat count.
- Header labels:
  - single phase with repeat count > 1: `Pass X/Y · Verse A of B`
  - cumulative phase: `Pass X/Y · Ayahs A-B`
- `Next` during single phase enters cumulative if cumulative review is due, including on the final verse. `Next` during cumulative exits cumulative and advances/completes. `Prev` during cumulative bails back to single phase.
- Latest local commit for repeat-pass header: `b2b3186`.

**Tajweed (Slice 5a Session 2 — wired but not rendering):**
- `src/lib/tajweed.ts` has 21-class `TAJWEED_COLORS` map + `extractTajweedColor(html)` helper
- `text_uthmani_tajweed` added as `word_field` on both fetchers (likely the bug — see backlog in TODO.md)
- Toggle wired into settings sheet
- Both renderers call `extractTajweedColor(word.text_uthmani_tajweed)` for in-scope words
- **Doesn't color anything.** Probably need verse-level `text_uthmani_tajweed` + `splitTajweedIntoWords` parser like the web. Backlogged.

### The recite matcher (`src/lib/recite.ts`)

Parity with the web app. Don't tighten without asking. Carry-over from Slice 4 + hotfixes.

### The fixed controls island

Below the ScrollView. Three rows: Mode buttons (Blind, Recite), audio controls (Prev, Play, Next), Mark Complete (full width black).

### The settings sheet (current ordering)

Bottom modal, opened by gear icon top-right of header.

1. Repeat count stepper (1–10)
2. Auto-advance delay stepper (0–5s, 0.5s steps)
3. Autoplay-through-range toggle
4. Blur-other-verses toggle
5. Tajweed coloring toggle (wired but not rendering)
6. Cumulative review toggle
7. Review repeat count stepper (conditional; visible when cumulative review is on)
8. Playback speed pills (0.75x, 0.85x, 1x, 1.15x, 1.25x, 1.5x)
9. Theme pills (8 themes)
10. Reciter pills (7 reciters, last-name only)
11. Done button

---

## 5. Slice 5a Session 3 — done/current

Cumulative review is implemented through `b2b3186`, hardware-tested by Mohammad, and synced to both remotes via docs sync `7e56509`.

Canonical corrected chain:

- `4599dff` — real web-style cumulative review state machine
- `2eaad4b` — single-phase Next enters cumulative instead of skipping review
- `34d0172` — final-verse Next starts final cumulative review
- `2147b07` — final-verse Next button enabled for cumulative review
- `b2b3186` — normal repeated verses show `Pass X/Y · Verse A of B`

Hardware QA notes:
- Al-Nasr 1-4, `repeatCount=3`, `reviewRepeatCount=2`, cumulative on. Expected: verse 1 repeats 3x; verse 2 repeats 3x; cumulative 1-2 twice; verse 3 repeats 3x; cumulative 1-3 twice; verse 4 repeats 3x; cumulative 1-4 twice; then complete.
- On final verse, Next/skip must be enabled and start final cumulative review.
- Next during final cumulative should exit cumulative and complete the session.
- Prev during cumulative should bail to single phase and stay on the current study verse.
- Pause/resume during cumulative should resume the current cumulative verse.
- Single-verse range should never enter cumulative.
- `cumulativeReview=false` should preserve previous behavior.
- Header labels should show normal repeat pass (`Pass X/Y · Verse A of B`) and cumulative pass (`Pass X/Y · Ayahs A-B`).

---

## 6. Slice 5b — done/current

Goal: real blur via `expo-blur`. This replaces the opacity-0.35 fallback currently used by `blurMode` in `memorization.tsx`.

Completed in `aa004ff`:
- Installed `expo-blur@~15.0.8` in `@workspace/noor-mobile`.
- Imported `BlurView` in `memorization.tsx`.
- Replaced page-mode inactive-word opacity fallback with a real `BlurView` overlay.
- Kept the existing outer `Pressable`, so tap-to-seek and long-press translation should still work.
- Removed `styles.mushafWordBlurred`.
- Ran `cd artifacts/noor-mobile && npx tsc --noEmit` clean.
- EAS development build finished: `cfb3f406-5fec-405a-a150-e525a96ecff2`.
- User installed/tested the build and reported "All done."
- Metro initially showed a stale `Unable to resolve "expo-blur"` bundle error after native install; restarting the dev client/Metro with `npx expo start --dev-client --clear` is the right recovery path for this native dependency.

Scope reminders:
- Do **not** fix tajweed unless Mohammad explicitly reopens it.
- If per-word `BlurView` overlays cause layout shifts or weak blur later, revise with a stable per-line/per-verse overlay approach.
- Native dependencies now include `expo-blur`; future native dependency changes require another EAS dev build.

Phase 2D is complete.

---

## 7. Next: Phase 2H.4 hardware QA and reading parity

Phase 2D, 2E, 2F, 2G.1, 2G.2, 2G.3, 2H.1, 2H.2, and 2H.3 are complete and hardware-tested. Phase 2H.4 is implemented locally with mobile typecheck and `git diff --check` passing; Mohammad hardware QA is pending. Next work is Phase 2H.4 hardware QA, then Phase 2H.5 reading essentials parity before Phase 3 resumes.

- **Phase 2G foundation** — Diagnostic cleanup, IA shell, shared screen primitives, and API parity foundation are in place.
- **Phase 2H next** — Hardware-test review essentials, then continue with reading essentials and memorization discovery/list.
- **Phase 2I/2J after triage** — Rich content pages, plans/lessons, progress/achievements, and parent dashboard depth.
- **Phase 2K/Phase 3 after 2H** — Polish, production EAS build, App Store Connect, and TestFlight.

Do not restart Phase 3/TestFlight until the Phase 2H must-have list is completed or Mohammad explicitly moves specific items to post-beta.

---

## 8. The conventions

### Workflow

- Claude Code prompts as markdown blocks. User pastes; reports back commit SHA + typecheck.
- **Test-then-ship.** Every slice tested on EAS dev build before next prompt drafted.
- **Docs after every meaningful action.** Update `TODO.md` and `PHASE_2D_HANDOFF.md` with current date, active branch, latest local SHA, remote sync status, QA results, and the exact next checklist. Never leave a completed slice described as "next."
- Read existing files before writing. Don't guess data shapes.
- Both branches stay in sync. Every commit:
  ```
  git push origin main
  git checkout feature/main-working-branch
  git merge main
  git push origin feature/main-working-branch
  git checkout main
  ```
- **Heredoc trap:** never use bare `EOF` markers. Use `MEMO_EOF`, `LIB_EOF`, `THEME_EOF`, etc.

### Code style for noor-mobile

- Expo Router 6 file-based routing
- TypeScript strict
- StyleSheet API
- Color palette in non-Mushaf-mode UI: bg `#ffffff`, text `#111111`, secondary `#666666`, border `#e5e7eb`, primary `#2563eb`, danger `#dc2626`, card-bg `#f9fafb`. Mushaf 8-theme palette in `src/lib/mushaf-theme.ts`.
- Card style: `borderRadius: 12`, padding `16`, `backgroundColor: "#f9fafb"`, `borderWidth: 1`, `borderColor: "#e5e7eb"`
- Header: `paddingTop: 60`, back button left, centered title, button or spacer right (60 wide)
- No state libraries. Plain `useState` + `useEffect` + `useRef`.
- No UI libraries. Plain RN components.
- API calls go through `apiFetch<T>` from `src/lib/api.ts` for the Railway backend.
- External APIs (Quran.com, QDC, GitHub raw, everyayah) use native `fetch` directly, no auth.

### Existing src/lib files

- `src/lib/api.ts` — `apiFetch<T>` typed helper, Better Auth cookie attached
- `src/lib/auth-client.ts` — Better Auth Expo client
- `src/lib/audio.ts` — `ayahAudioUrl(reciter, surah, ayah)`
- `src/lib/mushaf.ts` — page-image URL helper for Reading mode
- `src/lib/mushaf-theme.ts` — 8-theme `THEMES` map, `ThemeKey`, `MushafTheme`, etc.
- `src/lib/quran.ts` — Quran.com v4 fetchers with `text_uthmani_tajweed` + `translation` word_fields + `translations=131`
- `src/lib/memorization.ts` — dashboard fetch, QDC chapter timings, on-demand v4 fetcher, `fetchTimingsForReciter` router, `ChapterTimings` discriminated union, memorization POST
- `src/lib/recite.ts` — Arabic normalization + multi-predicate fuzzy match. **Don't tighten without asking.**
- `src/lib/review-priority.ts` — shared red/orange/green review priority labels and colors for dashboard/review queue UI.
- `src/lib/reviews.ts` — typed review queue + submit
- `src/lib/reciters.ts` — 7-reciter table
- `src/lib/settings.ts` — `ProfileSettings`, `loadProfileSettings`, `saveProfileSettings`, `DEFAULT_SESSION_SETTINGS`
- `src/lib/tajweed.ts` — `TAJWEED_COLORS` map + `extractTajweedColor` helper (wiring shipped Session 2; coloring not rendering — see backlog)

### Known pitfalls

- **Metro + pnpm**: `metro.config.js` must set `watchFolders` and `nodeModulesPaths`. After native dep changes, `npx expo start --clear`.
- **`npx expo install` in pnpm monorepo** can create stray `package-lock.json` in `noor-mobile/`. Delete it and run `pnpm install` from repo root.
- **Cookie auth**: RN has no `document.cookie`. Existing `apiFetch` handles it.
- **Audio leaks**: always `unloadAsync()` `Audio.Sound` instances. Use `stopAudioCompletely()`.
- **iOS audio session**: `pauseAsync()` not enough to release for the mic. Must `unloadAsync()`.
- **iOS silent switch**: `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })` mandatory.
- **everyayah folder names**: stale ones break audio with `AVPlayerItem -1100`. Verify against `https://www.everyayah.com/recitations_pages.html`.
- **Quran.com v4 `by_ayah` segments**: returns `undefined` for non-Husary reciter IDs.
- **Quran.com v4 `text_uthmani_tajweed`**: likely only available at verse level, NOT word level (Session 2 tajweed broken because of this assumption).
- **EAS dev build for native deps**: required for `expo-blur`, `@react-native-community/slider`, etc. Pure JS hot-reloads.

### EAS Build basics

- CLI: `npx eas-cli@latest <cmd>`
- Build: `eas build --profile development --platform ios`
- After build, install via QR code on the build's "Install" page; trust developer profile in iPhone Settings → General → VPN & Device Management.
- iOS 16+ requires Developer Mode (toggle only appears AFTER an internal-distribution app installed once).
- Run dev server: `npx expo start --dev-client`.

---

## 9. What to do first in the next session

1. **Read `TODO.md` and this handoff.** This one supersedes earlier handoffs.
2. **Check git state.** `main` and `feature/main-working-branch` should both contain the current Phase 2H.4 local-validation commit. Start new work from `main`; `safe-cumulative` can be ignored.
3. **Hardware-test Phase 2H.4 review essentials.** Submit 0-5 ratings, confirm Review queue refresh, confirm dashboard badge/count refresh, test no-due/upcoming/reviewed states, test reciter/speed controls, and smoke seeded-profile flows.
4. **If Phase 2H.4 passes, mark it complete in docs and then start Phase 2H.5 reading essentials.**
5. **Run `cd artifacts/noor-mobile && npx tsc --noEmit` after future mobile changes.**
6. **Do not resume Phase 3/TestFlight** until Phase 2H must-have parity is completed or Mohammad explicitly moves individual items to post-beta.
7. **Keep future slices JS-only unless explicitly approved.** Do not touch tajweed. Do not tighten recite matching. Do not add native dependencies unless Mohammad explicitly approves a rebuild.
8. **Update `TODO.md` and this handoff after meaningful work** with current date, branch/SHA, remote sync status, QA status, and the exact next checklist.

---

## 10. The one important reminder

The whole reason this app exists is so Mohammad's kids can use it to memorize Quran with him. The app already works for that purpose — kid sits down with iPhone, opens NoorPath, picks themself, hits Memorization, sees today's verses, hits Play, follows their chosen reciter (Husary, Afasy, Sudais, Basit, Minshawi, Ghamdi, or Ajmi) word by word in the Madinah-themed Mushaf at their preferred speed (0.75x for slow learning, 1x for normal, faster for review), long-presses any word for an English translation, marks complete, and it lands in Review. They can recite back to the app and get word-by-word feedback. They can switch themes. That's done.

Slice 5a Session 3 added cumulative review. 5b added real blur. Phase 2D is done; dashboard polish (2E) is done; target setting (2F) is done; the web parity audit is done. The next job is turning the strong memorization core into a fuller mobile product before TestFlight.

Phase 3 takes it through TestFlight to the App Store, but only after the Phase 2H must-have parity call is made.

Good luck.
</content>
