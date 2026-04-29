# NoorPath / Quranic Journey — Phase 2G Web Parity Handoff

**For: the next Codex/Claude Code conversation continuing this project**
**Last updated: 2026-04-29 (Phase 2I.1 overview cards are implemented, but memorization save semantics/rating must be fixed before hardware QA; beta is still blocked by 2I/2J/2K parity before TestFlight readiness)**

This handoff supersedes earlier handoff drafts.

## Current work log — 2026-04-29

- Active branch/SHA at Phase 2H.1 start: `main` at `21535d4`. Phase 2H.1 mobile onboarding/profile management implementation commit: `5af7b9a`; docs sync: `c7c0a65`; follow-up onboarding polish commit: `3f43337`; current docs-sync HEAD contains this note.
- Remote sync status after this docs sync: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` should be synced to the current Phase 2H.1 complete HEAD. `safe-cumulative` was temporary archaeology and can be ignored.
- Active branch/SHA at Phase 2H.2 start: `main` at `7e1a24e`. Phase 2H.2 dashboard parity content implementation commit: `ab87771`. Mohammad hardware-tested the dashboard after the commit and reported it looks good. This docs update should be committed/synced as the next HEAD. Remote sync target after this docs sync: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2H.2 complete HEAD.
- Active branch/SHA at Phase 2H.3 start: `main` at `512d03c`. Phase 2H.3 settings/targets convergence is implemented locally in the active Expo app. Remote sync target after this implementation/docs commit: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2H.3 local-validation HEAD.
- Active branch/SHA after Phase 2H.3 implementation sync: `main` at `4f85482`. Mohammad hardware-tested Phase 2H.3 settings/targets convergence and reported it looks good. This docs update should be committed/synced as the next HEAD. Remote sync target after this docs sync: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2H.3 complete HEAD.
- Active branch/SHA at Phase 2H.4 start: `main` at `5872c58`. Phase 2H.4 review essentials parity is implemented locally in the active Expo app. Remote sync target after this implementation/docs commit: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2H.4 local-validation HEAD.
- Active branch/SHA after Phase 2H.4 implementation sync: `main` at `8873156`. Mohammad hardware-tested Phase 2H.4 review essentials parity and reported QA testing is good. This docs update should be committed/synced as the next HEAD. Remote sync target after this docs sync: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2H.4 complete HEAD.
- Active branch/SHA at Phase 2H.5 start: `main` at `24abba7`. Phase 2H.5 reading essentials parity is implemented locally in the active Expo app. Remote sync target after this implementation/docs commit: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2H.5 local-validation HEAD.
- Active branch/SHA after Phase 2H.5 implementation sync: `main` at `4ceab5b`. Mohammad hardware-tested Phase 2H.5 reading essentials parity and reported it looks good. This docs update should be committed/synced as the next HEAD. Remote sync target after this docs sync: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2H.5 complete HEAD.
- Active branch/SHA at Phase 2H.6 start: `main` at `1a08ec2`. Phase 2H.6 memorization discovery parity is implemented locally in the active Expo app. Remote sync target after this implementation/docs commit: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2H.6 local-validation HEAD.
- Active branch/SHA after Phase 2H.6 implementation sync: `main` at `1d187ad`. Mohammad hardware-tested Phase 2H.6 memorization discovery and reported QA passed. This docs update should be committed/synced as the next HEAD. Remote sync target after this docs sync: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2H.6 complete HEAD.
- Phase 2H.6 follow-up clarification: Mohammad confirmed QA passed but the beta is not done. The old "Phase 2K/TestFlight readiness next" plan was too early. Before TestFlight, mobile must close specific web-app parity gaps in Memorization, Review, and Full Quran/Mushaf. Phase 2I/2J/2K are now pre-TestFlight blockers, not optional content-depth work.
- Active branch/SHA at Phase 2I.1 start: `main` at `561910d`. Phase 2I.1 memorization overview cards are implemented locally in the active Expo app. Remote sync target after this implementation/docs commit: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2I.1 local-validation HEAD.
- QA status: Phase 2D memorization core through Slice 5b, Phase 2E dashboard polish, Phase 2F target-setting UI, Phase 2G.1 diagnostic cleanup, Phase 2G.2 mobile IA shell, Phase 2G.3 shared screen primitives, Phase 2H.1 mobile onboarding/profile management, Phase 2H.2 mobile dashboard parity content, Phase 2H.3 settings/targets convergence, Phase 2H.4 review essentials parity, Phase 2H.5 reading essentials parity, and Phase 2H.6 memorization discovery parity are hardware-tested. Phase 2G.4 local validation passed for API/codegen/mobile with `/Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/api-spec run codegen`, `/Users/mothmanaurascape.ai/Library/pnpm/pnpm run typecheck:libs`, `/Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/api-server run typecheck`, and `cd artifacts/noor-mobile && npx tsc --noEmit`. Phase 2H.1 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`; follow-up onboarding polish also passed the same two checks. Phase 2H.2 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Phase 2H.3 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Phase 2H.4 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Phase 2H.5 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Phase 2H.6 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Phase 2I.1 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`; hardware QA is pending. Full root `/Users/mothmanaurascape.ai/Library/pnpm/pnpm run typecheck` was previously attempted, but it stops in unrelated frozen/reference UI areas (`artifacts/noor-path/src/components/ui/button-group.tsx`, `artifacts/noor-path/src/components/ui/calendar.tsx`, `artifacts/mockup-sandbox/src/components/ui/calendar.tsx`, `artifacts/mockup-sandbox/src/components/ui/spinner.tsx`) on React type/ref baseline errors.
- Dev-server note: starting Expo inside the sandbox fails with `ERR_SOCKET_BAD_PORT` because sandboxed Node cannot bind local ports (`EPERM` on 8081). Run the dev server outside the sandbox/escalated when using this environment.
- TestFlight status: deferred. Do not start TestFlight readiness until the new pre-TestFlight parity blockers are complete and hardware-tested: Phase 2I Memorization parity completion, Phase 2J Review never-empty/ahead-day parity, and Phase 2K Full Quran/Mushaf Bayaan parity.
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
- Phase 2H.4 hardware QA notes: Mohammad tested the review essentials parity on iPhone and reported QA testing is good.
- Phase 2H.5 implementation notes: upgraded the active mobile Full Quran reader while preserving the streamed 604 page images, RTL FlatList paging, last-page resume, manual Save, debounced auto-save, and fixed page shortcuts. The reader now has local Mushaf page/surah/juz metadata, a jump sheet for page/surah/juz search, compact current-surah and saved-resume clarity, visible reading target progress with counted-today copy, previous/next controls, and JS-only per-child page bookmarks stored in AsyncStorage. No backend/spec/generated files, frozen web app files, tajweed implementation, recite matcher behavior, or native dependencies were touched.
- Phase 2H.5 validation notes: `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check` passed locally.
- Phase 2H.5 hardware QA notes: Mohammad tested the reading essentials parity on iPhone and reported it looks good.
- Phase 2H.6 implementation notes: added a mobile memorization discovery surface at the existing Memorize route. It loads dashboard current work, in-progress resume items, `/memorization` progress, and `/surahs`; provides search/filter chips; shows per-surah status, progress, ayah counts, strength dots, and compact ayah strength strips; and starts today's assignment, resume work, or a selected surah by entering the existing memorization session engine. The session engine remains in the same file and preserves ayah/page modes, audio highlighting, cumulative review, reciter settings, playback speed, blind/blur modes, translation popup, recite mode, and mark-complete persistence. `src/lib/quran.ts` now requests optional `page_number` so selected-surah sessions can derive exact page ranges when the Quran.com response provides them, with a local Mushaf fallback estimate. No backend/spec/generated files, frozen web app files, tajweed implementation, recite matcher behavior, or native dependencies were touched.
- Phase 2H.6 validation notes: `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check` passed locally.
- Phase 2H.6 hardware QA notes: Mohammad tested memorization discovery on iPhone and reported QA passed.
- Phase 2H.6 correction/research notes: frozen web reference still has required mobile parity not covered by 2H.6. `artifacts/noor-path/src/pages/memorization.tsx` has a top three-card row for `Today's Work`, `Current Work`/`Recitation Focus`, and `Next Up`, wired to dashboard `todaysPlan.newMemorization`, `todayProgress`, and `upNextMemorization`. `artifacts/noor-path/src/pages/quran-memorize.tsx` has setup/session/check flow with ayah From/To, repeat count, auto-advance, cumulative review, review repeat count, bookmark resume, Pause & Save, Save & Leave, Leave without saving, Recite to Teacher/NoorPath, and View in Full Mushaf. `artifacts/noor-path/src/pages/settings.tsx` and `src/hooks/use-settings.ts` define global defaults for confetti, auto-advance, default repeat count, cumulative review, default review repeat count, blur intensity, reciter, Mushaf theme, and font size. `artifacts/noor-path/src/pages/review.tsx` has local active-day review behavior, completed-today/completed-day sections, and a Continue Reviewing path into the next open review set so the user is not stuck with nothing to review. `artifacts/noor-path/src/pages/mushaf-reader.tsx` is a Bayaan-style Mushaf tool with fitted text pages, surah/bookmark search, recent reads, bookmarks, highlights, notes, translation/tafseer/word-by-word sheets, audio range playback, reciter/rate/repeat/range-repeat settings, blind/select/recite modes, mark-selected-ayahs-memorized, memorization handoffs, and reading-progress persistence.
- Phase 2I.1 implementation notes: added the web-style top three Memorize overview cards in the active mobile app: `Today's work`, `Current work`/`Recitation Focus`, and `Next up`. The cards read from dashboard `todaysPlan.newMemorization`, `todayProgress.memStatus`, and `upNextMemorization`; show understandable work labels, ayah ranges, page ranges, status, and actions; and route into the existing mobile memorization session engine. `Today's work` starts the full dashboard assignment range, while `Current work`/`Recitation Focus` starts the active current-work range. Dashboard Memorize entry behavior remains the existing overview route. No backend/spec/generated files, frozen web app files, tajweed implementation, recite matcher behavior, or native dependencies were touched.
- Phase 2I.1 validation notes: `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check` passed locally. Hardware QA is pending.
- Phase 2I.1 follow-up/save-semantics notes: Mohammad clarified the web behavior must be mirrored before hardware QA. Frozen web `artifacts/noor-path/src/pages/quran-memorize.tsx` does not advance today's card to the next day when saving today's work; after saving it posts `/api/children/:childId/daily-progress` so the same `todaysPlan.newMemorization` remains visible with `todayProgress.memStatus === "completed"` or `"in_progress"`. `upNextMemorization` may change as the child completes extra work beyond the required day, but the today's card should stay today's work and show done. The web check screen also requires a rating (`Needs Work` quality 2, `Good` quality 4, `Excellent` quality 5) before saving so the saved ayah strengths render red/yellow/green. Mobile currently misses this: `memorization.tsx` `handleMarkComplete` hardcodes `qualityRating: 5`, sends `status: "memorized"`, and does not update `/daily-progress`. This is not just a future nice-to-have; it is the immediate next fix before Phase 2I.1 hardware QA.
- Exact next checklist:
  1. Implement the Phase 2I.1 follow-up save fix in mobile memorization: add the web-style rating choice before save, save with the chosen quality rating, preserve existing memorized ayahs, set memorization status based on full-surah completion instead of always `"memorized"`, and post `/daily-progress` for today's assignment so today's work stays visible as done/in-progress.
  2. Preserve the 2I.1 overview cards, dashboard Memorize entry behavior, and the existing session engine; do not implement Pause & Save yet except where needed to reach the rating/save screen.
  3. Validate with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`.
  4. Then Mohammad hardware-tests Phase 2I.1: open Memorize from dashboard; confirm the three cards; complete/rate/save today's work; confirm today's card remains the same assignment marked done; confirm `Next up` can change if extra work is completed; smoke search/filter/resume/session flow.
  5. Do not start TestFlight readiness until Phase 2I, 2J, and 2K are complete and hardware-tested. Do not tighten recite matcher behavior and do not touch tajweed implementation unless only documenting it as missing/backlogged.

---

## Web-app parity audit — 2026-04-28

This audit compared the frozen web app (`artifacts/noor-path`) with the active Expo app (`artifacts/noor-mobile`) before TestFlight. The result: mobile has the memorization/review/reading core, but it does not yet expose enough of the web app's learning product surface.

Mobile already has:
- Mobile child creation/profile management through Phase 2H.1: create child, seed prior memorized surahs with per-surah strength and known ayah counts, add prior surahs by From/To range, edit profile settings/targets/practice minutes/visibility toggles, delete the selected child with confirmation, dismiss keyboard cleanly, and save without scrolling past all surahs. Hardware QA passed.
- Phase 2H.2 dashboard parity content is complete and hardware-tested: richer stats, goals, achievements, up-next memorization, story/du'a suggestions respecting visibility flags, better empty/completed states, and quick actions.
- Phase 2H.3 settings/targets convergence is complete and hardware-tested: Parent Settings now covers daily target bundles/fine tuning, practice minutes, visibility flags, profile entry, and JS-only default memorization session settings.
- Auth, existing-child profile picker, dashboard work cards, Parent Settings, memorization session engine, Phase 2H.6 memorization discovery, review queue/session with Phase 2H.4 essentials, a Full Quran page-image reader with Phase 2H.5 jump/search/progress/bookmark essentials, a first-pass Dashboard/Memorize/Review/More nav shell, shared screen primitives adopted by More and Review, and Phase 2G.4 API/spec foundation for upcoming content and progress pages.
- Memorization already includes ayah/page modes, cumulative review, repeats, reciters, themes, speed, blind/blur modes, translation popup, recite mode, and progress submission.
- Memorization discovery is complete and hardware-tested: the Memorize route now shows current/today work, resume cards, surah search/filter, per-surah progress/strength, and starts the existing session engine.
- Phase 2I.1 memorization overview cards are locally implemented: the Memorize route now has `Today's work`, `Current work`/`Recitation Focus`, and `Next up` cards backed by dashboard `todaysPlan.newMemorization`, `todayProgress`, and `upNextMemorization`. Hardware QA is pending until the save semantics/rating follow-up is fixed.
- Review now has queue summary, due/upcoming/reviewed sections, no-due/completed/empty states, sticky session controls, reciter/speed controls, focus refresh, and SM-2 ratings; Reading resumes/saves a page target and now exposes page/surah/juz jump/search, target progress, and page bookmarks.

Biggest mobile gaps from web:
- Phase 2I.1 save semantics/rating follow-up: mobile must mirror web save behavior before hardware QA. Saving today's assignment should write daily progress and keep today's card as the same assignment marked done/in-progress; it should not appear to simply advance today's card to tomorrow's work. The user must choose Needs Work/Good/Excellent so saved strengths can show red/yellow/green instead of every save being hardcoded green.
- Memorization session/settings parity: mobile still needs the web's Pause & Save, Save & Leave, Leave without saving, View in Full Mushaf, bookmark/resume clarity, teacher/app recitation handoff, setup controls for ayah range/repeats/auto-advance/cumulative review/review repeat count, and a visible memorization settings page for defaults.
- Review never-empty parity: mobile still needs the web behavior where the Review page shows completed-today/completed-day work and always offers a way to continue into the next open review set when today's queue is empty or complete.
- Full Quran/Mushaf parity: mobile still lacks most Bayaan-derived reader tools: fitted Bayaan text pages or a mobile-equivalent tool layer, recent reads, highlights, notes, translation/tafsir/word-by-word sheets, audio range player, reciter/rate/repeat/range-repeat settings, select-to-mark-memorized, recite-from-page, memorization handoffs, and deeper page tools.
- Richer parent/content surfaces beyond these blockers, such as custom goal editing, deeper plan settings, Progress, Learning Plan, Stories, Du'aas, and dedicated content pages, remain future work after the pre-TestFlight blockers unless Mohammad explicitly pulls them forward.
- Visual system is functional but thin; port the web's dense, warm, kid-friendly but parent-usable working-app feel.

Highest-risk gaps before TestFlight:
- Phase 2I Memorization parity completion is required before TestFlight: 2I.1 overview cards are implemented but need the immediate save-semantics/rating follow-up and hardware QA; then Pause & Save/session leave flow, View in Full Mushaf, setup/session settings, and a visible memorization settings/defaults page still need implementation.
- Phase 2J Review never-empty/ahead-day parity is required before TestFlight: the user should see completed-today work and should always be offered next-day/next-open work instead of an empty dead end.
- Phase 2K Full Quran/Mushaf Bayaan parity is required before TestFlight: the current page-image reader is usable, but it lacks the main reader tools that came from Bayaan in the web app.
- Phase 2G.4 fixed the child-du'a update bug and refreshed OpenAPI/generated clients for future mobile surfaces; authenticated production API smoke is still pending.
- Progress, Stories, Du'aas, Plan, achievements, and richer dedicated destination pages are still absent, but they are behind the three explicit pre-TestFlight blockers above unless Mohammad reorders them.
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
| 2H.4 | Complete Apr 29: queue summary, upcoming/reviewed/completed/no-due states, pull/focus refresh, sticky review-session controls, reciter/speed controls, and queue/dashboard refresh path after submit. | `review.tsx`, `review-session.tsx`, `src/components/screen-primitives.tsx` | Existing review endpoints; no backend/spec/generated changes | JS-only | Local mobile typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2H.5 | Complete Apr 29: page/surah/juz jump/search, resume clarity, reading target progress, better controls, and JS-only page bookmarks while preserving the page-image reader. | `mushaf.tsx`, `src/lib/mushaf.ts` | Existing `POST /reading-progress`, dashboard; no backend/spec/generated edits | JS-only | Mobile typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2H.6 | Complete Apr 29: Memorize now has current/today work, resume cards, surah search/filter, progress/strength, and starts the existing session engine. | `memorization.tsx`, `src/lib/memorization.ts`, `src/lib/quran.ts` | Existing `GET /surahs`, `GET /memorization`, dashboard; no backend/spec/generated edits | JS-only; no native | Mobile typecheck + `git diff --check` passed; Mohammad hardware QA passed |

### Phase 2I — Memorization parity completion

Pre-TestFlight: yes. This phase corrects the gap Mohammad called out after 2H.6 QA. Use the frozen web implementation in `artifacts/noor-path/src/pages/memorization.tsx`, `artifacts/noor-path/src/pages/quran-memorize.tsx`, `artifacts/noor-path/src/pages/settings.tsx`, and `artifacts/noor-path/src/hooks/use-settings.ts` as the reference. Preserve the existing mobile session engine; wrap and extend it instead of rewriting it.

| Slice | Goal | Likely files | API deps | Risk | QA |
|---|---|---|---|---|---|
| 2I.1 | Implemented locally Apr 29, but needs immediate save-semantics follow-up before hardware QA: added top three mobile cards for `Today's work`, `Current work`/`Recitation Focus`, and `Next up`; next fix must ensure save/rating marks today's work done via daily progress instead of visually advancing today's card. | `memorization.tsx`, `src/lib/memorization.ts` if needed | Existing dashboard/memorization/surahs, `POST /daily-progress`, `POST /memorization`; no generated edits expected | JS-only | Local mobile typecheck + `git diff --check` passed for cards; save/rating fix and hardware QA pending |
| 2I.2 | Add web-style Pause & Save, Save & Leave, Leave without saving, review-only Finish Recitation handling, and View in Full Mushaf from the memorization session. Preserve ayah/page modes, audio highlighting, cumulative review, reciter/speed settings, blind/blur modes, translation popup, recite mode, and mark-complete persistence. | `memorization.tsx`, maybe `mushaf.tsx` route params | Existing progress/daily-progress routes | Medium session-state risk | Pause midway, choose completed-to ayah, go to recitation check/save, leave with/without saving, jump to Full Quran page and back |
| 2I.3 | Add a visible settings surface for memorization defaults: ayah/range preference if useful, repeat count/multiplier, auto-advance, cumulative review, review repeat count, blind/blur defaults, reciter, playback speed, theme, and any existing JS-only defaults. Decide whether to extend current Parent Settings or add a dedicated child memorization settings route, but make it discoverable from Memorize/session. | `targets.tsx` or new memorization settings route, `src/lib/settings.ts`, `memorization.tsx`, More/dashboard links | Existing child target/profile updates plus AsyncStorage settings | JS-only | Change defaults, start a new memorization session, verify defaults hydrate and persist per child |

### Phase 2J — Review never-empty/ahead-day parity

Pre-TestFlight: yes. The Review page should never strand the user with nothing to do. Use `artifacts/noor-path/src/pages/review.tsx` as the reference for `activeLocalDate`, completed-day sections, `reviewedToday`, daily-progress sync, and `Continue Reviewing`.

| Slice | Goal | Likely files | API deps | Risk | QA |
|---|---|---|---|---|---|
| 2J.1 | Show what was already completed today, preserve reviewed-today rows, and when today's queue is empty/complete offer `Continue Reviewing` into the next open review day instead of an empty state. | `review.tsx`, maybe `src/lib/review` if created | Existing reviews endpoint fields and daily-progress endpoint | JS-only unless API cannot expose next date | Complete reviews, return to Review, see completed today, continue to next available work |
| 2J.2 | Add web-like active local date/session persistence so if the child reviews ahead, completed prior days are grouped and the current active day stays understandable. Keep existing review-session route and SM-2 submission intact. | `review.tsx`, `review-session.tsx`, AsyncStorage helper if needed | Existing review endpoints; use `x-local-date` carefully | Medium state/refresh risk | Review multiple days in a row, see completed day grouping, dashboard/review counts remain sane |
| 2J.3 | After never-empty behavior is working, compare web flashcard mode, connected Mushaf batch review, and celebration states. Implement only if still considered must-have for beta; otherwise document as post-beta. | `review.tsx`, `review-session.tsx` | Existing review/surah endpoints | JS-only | Flashcard/batch smoke only if implemented |

### Phase 2K — Full Quran/Mushaf Bayaan parity

Pre-TestFlight: yes. The current mobile Full Quran page-image reader is not enough for beta because the web Mushaf reader carries the Bayaan-derived feature set. Use `artifacts/noor-path/src/pages/mushaf-reader.tsx` and `artifacts/noor-path/src/components/mushaf/bayaan/*` as the reference. Do not add native dependencies without explicit approval/rebuild note.

| Slice | Goal | Likely files | API deps | Risk | QA |
|---|---|---|---|---|---|
| 2K.1 | Add a mobile-appropriate tool layer on top of the existing reader: chrome controls, surah/page/juz/bookmark search, recent reads, blind mode, select mode, recite pick mode entry points, and ayah sheet trigger. Keep existing page-image paging/progress save unless replacing it is explicitly chosen. | `mushaf.tsx`, `src/lib/mushaf.ts`, new local storage helpers/components | Existing dashboard/reading-progress, Quran.com fetchers | Medium UI/state risk | Search/jump, recent read, blind reveal, select entry, recite entry, page progress save |
| 2K.2 | Add Bayaan-style ayah actions: play from here, repeat, bookmark, highlight, note, translation, tafseer, word-by-word, copy/share where mobile APIs allow, and memorization handoff/open in memorization. | `mushaf.tsx`, new sheet/components, AsyncStorage | Quran.com translation/tafsir/WBW fetchers; existing memorization routes | Medium network/state risk | Long-press/tap ayah, bookmark/highlight/note persist, translation/word-by-word load, handoff opens memorization |
| 2K.3 | Add Full Quran audio range playback with reciter, speed, per-ayah repeat and range-repeat settings; add recite-from-page behavior if feasible using existing recite matcher without tightening it; let selected ayahs be marked memorized. | `mushaf.tsx`, existing audio/recite libs if reusable | Existing `PUT /memorization`; Quran audio URLs | Higher complexity; no matcher tightening | Play a range, change speed/repeat, recite from page, mark selected ayahs memorized, dashboard/memorization refresh |

### Phase 2L — Polish + TestFlight readiness

Pre-TestFlight: yes, but only after 2I/2J/2K are complete and hardware-tested.

| Slice | Goal | Likely files | API deps | Risk | QA |
|---|---|---|---|---|---|
| 2L.1 | Visual polish pass: web-inspired sections, badges, compact stats, warm kid/parent UI, polished empty states. | All primary mobile screens | None | JS-only | Screenshot every primary screen |
| 2L.2 | App shell/assets: icon, splash, bundle/version, production API env, remove dev copy. | `app.json`, assets, EAS config | None | App config may require EAS rebuild | Install production build |
| 2L.3 | TestFlight build/QA: production EAS build, App Store Connect, QA matrix, beta notes. | Mobile app/docs | Production backend stability | Requires production build | Login, onboarding, dashboard, memorize, recite, review, read, settings, content, offline/error paths |

### Phase 2M — Rich learning/content pages

Pre-TestFlight: deferred unless Mohammad explicitly reorders. These used to be labeled 2I/2J before the Apr 29 correction, but the immediate beta blockers are now Memorization, Review, and Mushaf parity.

| Slice | Goal | Likely files | API deps | Risk | QA |
|---|---|---|---|---|---|
| 2M.1 | Stories list/detail with categories, age filters, morals, discussion questions, and hide-stories behavior. | New stories routes, More/dashboard links | `GET /stories`, `GET /stories/:id` | JS-only | Filters/detail/hidden state |
| 2M.2 | Du'aas list/detail/status with categories, learned toggle, practice count, Arabic/transliteration/translation/source. | New duas route/cards | Use Phase 2G.4 child-du'a update-by-`duaId` route fix | JS/backend; no native | Toggle multiple du'as independently |
| 2M.3 | Plan/goals/progress pages with age-group plan, milestones, weekly goals, long-term goals, reset-to-auto, stats, weekly bars, badges, memorized surah list, review strength, session history, and parent overview upgrades. | New plan/progress/session routes, `app/index.tsx` | Dashboard, plan, goals, weekly progress, memorization, sessions endpoints | JS-only; avoid chart native deps | Empty/active/completed states, all age groups |
| 2M.4 | Lesson/surah detail with Arabic, transliteration, translation, tafsir brief, audio handoff. Tajweed notes stay backlog. | New lesson/surah-detail routes | `GET /surahs/:id`, Quran.com | JS-only | Open from plan/memorization |

Phase 2H.6 is hardware-tested, but Phase 2H did not finish beta parity. Phase 2I, 2J, and 2K are now required before Phase 2L/TestFlight readiness.

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
- Normal branch policy: `main` (deploy) and `feature/main-working-branch` stay synced. `safe-cumulative` was temporary archaeology and can be ignored. At Phase 2I.1 start both tracked branches were synced at `561910d`; after this save-semantics docs sync they should be synced to the current docs HEAD.

### Stack
- **Monorepo:** pnpm 9.15.9 (NOT 10).
- **Backend:** Express 5 + Drizzle + Neon Postgres + Better Auth, deployed at `https://workspaceapi-server-production-cc25.up.railway.app`. Live, healthy.
- **Web frontend** (`artifacts/noor-path/`): React 19 + Vite + shadcn/ui. **Frozen archival reference.** Don't edit.
- **iOS app** (`artifacts/noor-mobile/`): Expo SDK 54.0.33, Expo Router 6, RN 0.81.5. **The active build target.**
- **Apple Developer:** approved Apr 26. Team ID `M7KJJDN537`. iOS bundle identifier `com.mothman.noorpath`.
- **EAS project:** `@mothman123/noor-mobile`. First development build shipped Apr 27 evening; installed on Mohammad's registered iPhone with Developer Mode enabled.

---

## 3. Where the project is right now

**Phase 2D is complete through Slice 5b. Phase 2E dashboard polish is hardware-tested. Phase 2F target-setting UI is route-fixed and hardware-tested. Phase 2G.1 diagnostic cleanup, 2G.2 mobile IA shell, and 2G.3 shared screen primitives are hardware-tested. Phase 2H.1 onboarding/profile management, 2H.2 dashboard parity content, 2H.3 settings/targets convergence, 2H.4 review essentials parity, 2H.5 reading essentials parity, and 2H.6 memorization discovery parity are hardware-tested. Phase 2I.1 memorization overview cards are locally implemented, but save semantics/rating must be fixed before hardware QA. Beta/TestFlight is still blocked by required web parity: Phase 2I memorization completion, Phase 2J review never-empty/ahead-day behavior, and Phase 2K Full Quran/Mushaf Bayaan parity.** Recite mode is at parity with web. Multi-reciter playback works for all 7 reciters. Word tracking works for all (true QDC for Husary, fractional fallback w/ 500ms lead for others). Audio plays through iPhone silent switch. Theme + reciter pickers in settings sheet. Profile vs session settings split. **Long-press translation popup works.** **Playback rate (0.75x–1.5x discrete pills) works.** **Cumulative review works from hardware QA.** **Real blur mode via `expo-blur` is built and hardware-tested.** **Tajweed coloring is wired but doesn't render** (likely API field shape — backlogged; do not tackle unless Mohammad explicitly asks).

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
| **2H.4 Review essentials parity** | ✅ hardware-tested | `8873156` + docs | Queue summary, due/upcoming/reviewed/completed states, pull/focus refresh, sticky review-session controls, reciter/speed controls |
| **2H.5 Reading essentials parity** | ✅ hardware-tested | `4ceab5b` + docs | Page/surah/juz jump/search, saved-page clarity, reading target progress, improved controls, JS-only bookmarks |
| **2H.6 Memorization discovery parity** | ✅ hardware-tested | `1d187ad` + docs | Current/today work, resume cards, surah search/filter, progress/strength, starts existing session engine |
| **2I.1 Memorization overview cards** | ✅ cards local validation; save/rating follow-up pending before hardware QA | current Phase 2I.1 HEAD | Web-style `Today's work`, `Current work`/`Recitation Focus`, and `Next up` cards backed by dashboard work/progress/next fields; immediate next fix is daily-progress save semantics and rating |

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

## 7. Next: Phase 2I.1 Save Semantics/Rating Follow-Up

Phase 2D, 2E, 2F, 2G.1, 2G.2, 2G.3, and Phase 2H.1-2H.6 are complete and hardware-tested. Phase 2I.1 memorization overview cards are locally implemented, but Mohammad clarified the save behavior must match web before hardware QA. Next recommended work is the Phase 2I.1 save-semantics/rating follow-up, then Phase 2I.1 hardware QA, then Phase 2I.2 Pause & Save/session action parity.

- **Phase 2G foundation** — Diagnostic cleanup, IA shell, shared screen primitives, and API parity foundation are in place.
- **Phase 2H** — First-pass dashboard/settings/review/reading/memorization discovery parity is hardware-tested, but it did not finish beta parity.
- **Phase 2I next** — Memorization parity completion: fix save semantics/rating for the locally implemented three cards, hardware-test them, then build pause/save and leave flows, View in Full Mushaf, and a visible memorization settings/defaults page.
- **Phase 2J after 2I** — Review never-empty/ahead-day behavior: completed-today/completed-day visibility and Continue Reviewing into the next open day.
- **Phase 2K after 2J** — Full Quran/Mushaf Bayaan parity: reader tools, ayah sheets, annotations, audio range playback, recite/select modes, and memorization handoffs.
- **Phase 2L/Phase 3 after 2K** — Polish, production EAS build readiness, App Store Connect, and TestFlight.

The old 2I/2J content/progress roadmap is now Phase 2M and deferred unless Mohammad explicitly reorders it.

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
2. **Check git state.** `main` and `feature/main-working-branch` should both contain the current Phase 2I.1 save-semantics docs commit. Start new work from `main`; `safe-cumulative` can be ignored.
3. **Implement Phase 2I.1 save semantics/rating follow-up.** Read frozen web `quran-memorize.tsx`, then make mobile save today's work with daily progress and a Needs Work/Good/Excellent quality rating before hardware QA.
4. **Hardware-test Phase 2I.1 after the fix.** Open Memorize from dashboard; confirm the three cards; complete/rate/save today's work; confirm today's card remains the same assignment marked done; confirm `Next up` can change if extra work is completed; smoke search/filter/resume/session flow.
5. **Preserve sensitive behavior.** Do not touch tajweed except to document it as backlogged, and do not tighten recite matcher behavior.
6. **Run `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check` after future mobile/docs changes.**
7. **Keep future slices JS-only unless explicitly approved.** Do not touch tajweed. Do not tighten recite matching. Do not add native dependencies unless Mohammad explicitly approves a rebuild.
8. **Update `TODO.md` and this handoff after meaningful work** with current date, branch/SHA, remote sync status, QA status, and the exact next checklist.

---

## 10. The one important reminder

The whole reason this app exists is so Mohammad's kids can use it to memorize Quran with him. The app already works for that purpose — kid sits down with iPhone, opens NoorPath, picks themself, hits Memorization, sees today's verses, hits Play, follows their chosen reciter (Husary, Afasy, Sudais, Basit, Minshawi, Ghamdi, or Ajmi) word by word in the Madinah-themed Mushaf at their preferred speed (0.75x for slow learning, 1x for normal, faster for review), long-presses any word for an English translation, marks complete, and it lands in Review. They can recite back to the app and get word-by-word feedback. They can switch themes. That's done.

Slice 5a Session 3 added cumulative review. 5b added real blur. Phase 2D is done; dashboard polish (2E) is done; target setting (2F) is done; the web parity audit is done. The next job is turning the strong memorization core into a fuller mobile product before TestFlight.

Phase 3 takes it through TestFlight to the App Store, but only after the Phase 2H must-have parity call is made.

Good luck.
</content>
