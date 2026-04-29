# NoorPath / Quranic Journey — Status & Next Steps

_Last updated: April 29, 2026 (Phase 2I.1 hardware QA pending; Bug A and Bug B hardware-tested/shipped; temporary Bug B diagnostics removed)_

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
- Active branch/SHA at Phase 2I.1 save-semantics follow-up start: `main` at `2d97b71`. The follow-up is implemented locally in the active Expo app; remote sync target after this implementation/docs commit is `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2I.1 save-semantics local-validation HEAD.
- Active branch/SHA at Phase 2I.1 cumulative schedule QA fix start: `main` at `7006124`. Mohammad found during hardware QA that the backend cumulative recitation rhythm was wrong. The scheduler now follows the required cadence: four new-work days, one block cumulative recitation for those four days; after two such blocks, one full cumulative recitation; the final full-surah test is always a separate final day; and a partial cumulative day is inserted before the final test only when 2+ leftover new-work sessions happened since the last cumulative review. Local validation passed with a focused scheduler smoke check, `cd artifacts/noor-mobile && npx tsc --noEmit`, and `git diff --check`. Remote sync target after this fix/docs commit: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2I.1 cumulative-schedule local-validation HEAD.
- Active branch/SHA at Phase 2I.1 moving-current-work QA fix start: `main` at `da5ae17`. Mohammad clarified that if today's assignment contains multiple surahs/ranges, all of them are `Today's work`; `Current work` should keep advancing to the next unfinished item inside that daily assignment and should not show `Complete` until the entire daily assignment is complete. Mobile save logic now keeps multi-surah daily progress `in_progress` until every surah in today's target range is memorized, and the `Current work` card only uses the daily `memStatus === "completed"` state for its completed UI. Local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Remote sync target after this fix/docs commit: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced to the final Phase 2I.1 moving-current-work local-validation HEAD.
- Phase 2I parity audit Apr 29: re-read `artifacts/noor-path/src/pages/quran-memorize.tsx` and `artifacts/noor-path/src/pages/memorization.tsx` against the current mobile `app/child/[childId]/memorization.tsx`. Identified additional web-only behaviors mobile still lacks beyond what the original 2I.2/2I.3 rows captured: (a) Pause & Save modal lets the parent pick the actual completed-to ayah before routing to recitation check, not just the current session range; (b) Save & Leave / Leave without saving / Keep practicing modal so leaving mid-session is an explicit choice instead of a discarded session; (c) a separate `phase: "check"` recitation check screen with score card for "Recite to NoorPath" runs and Needs Work / Good / Excellent rating, distinct from the current Mark-Complete-only entry point; (d) "Ready to Recite?" choice modal at session end that routes to teacher-check or self-recite; (e) per-session bookmark with current ayah, repeat count, autoAdvance, cumulativeReview, reviewRepeatCount so a session can resume mid-range from a "Resume where you left off" card; (f) View in Full Mushaf action from inside the session; (g) a separate session setup phase before playback starts with From/To inputs, repeat slider, auto-advance toggle, cumulative review toggle, review repeat count stepper, and surah navigation; (h) "Just Get Tested" shortcut for review-only sessions that skips memorization and routes straight to the recitation check; (i) Skip repeat and Skip ayah controls in the audio toolbar so the kid can move on without finishing all repeats; (j) confetti / celebration overlay for surah-complete and session-complete instead of a plain Alert; (k) tappable ayah end-marker that opens an ayah sheet with actions for that ayah; (l) word translation tooltip on tap (with a WBW audio play button using `audio.qurancdn.com/wbw/...`) in addition to the current long-press popup; (m) auto-flip mushaf page when recite mode crosses a page boundary; (n) Show Word and Skip Word floating affordances during recite mode for stuck words; (o) page navigation pills + "Current word →" link during multi-page recite sessions; (p) cumulative review / review repeat count in persisted memorization defaults via `useSettings`-style persistence (currently those two reset to off / 3 every session in mobile); (q) per-surah Tajweed Notes accordion (`surah.tajweedNotes`) on the discovery page; (r) red / orange / green review tone (`getReviewStrengthTone`) on each surah row driven by ayah-level strength, in addition to the existing status pill. These items are added below as new 2I.2/2I.3/2I.4 sub-rows; nothing was removed from the existing 2I.2/2I.3 rows.
- Hardware bugs found Apr 29: tapping the `Next up` card on the Memorize page sometimes landed on a screen that did not load (loading death spiral / circle of death); and on the Memorize page the surah search keyboard did not dismiss on scroll and had no Done / dismiss affordance, so it covered half the screen. Both bugs are now hardware-tested/shipped by Mohammad; temporary Bug B diagnostics have been removed. Resume the Phase 2I.1 hardware QA pass next.
- Active branch/SHA at Memorize search keyboard Bug A fix start: `main` at `97c62e5`. `feature/main-working-branch` was fast-forwarded to `main` before this work, so `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` were all at `97c62e5`. The active mobile `MemorizationDiscovery` scroll surface now dismisses the iOS keyboard on drag, lets taps on filters/rows be handled while the keyboard is up, and makes the search return key dismiss the keyboard. Local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Remote sync target after this fix/docs commit: all four refs synced to the final Bug A fix HEAD. Mohammad should hardware-test this keyboard fix in isolation before Bug B work starts.
- Bug A hardware QA result: Mohammad hardware-tested the Memorize search keyboard fix after commit `6a9e70f` and reported it is shipped.
- Bug B hardware QA/diagnostic cleanup result: Mohammad confirmed the Memorize `Next up` loading death spiral is fixed. Cleanup started on `main` at `4ce3585`, with `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` all synced. The temporary Noor memorization diagnostic console logs were removed from `artifacts/noor-mobile/app/child/[childId]/memorization.tsx` with no behavior changes. Local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Remote sync target after this cleanup/docs commit: all four refs synced to the final Bug B cleanup HEAD.
- QA status: Phase 2D memorization core through Slice 5b, Phase 2E dashboard polish, Phase 2F target-setting UI, Phase 2G.1 diagnostic cleanup, Phase 2G.2 mobile IA shell, Phase 2G.3 shared screen primitives, Phase 2H.1 mobile onboarding/profile management, Phase 2H.2 mobile dashboard parity content, Phase 2H.3 settings/targets convergence, Phase 2H.4 review essentials parity, Phase 2H.5 reading essentials parity, Phase 2H.6 memorization discovery parity, and the Apr 29 Memorize Bug A/B fixes are hardware-tested. Phase 2G.4 local validation passed for API/codegen/mobile with `/Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/api-spec run codegen`, `/Users/mothmanaurascape.ai/Library/pnpm/pnpm run typecheck:libs`, `/Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/api-server run typecheck`, and `cd artifacts/noor-mobile && npx tsc --noEmit`. Phase 2H.1 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`; follow-up onboarding polish also passed the same two checks. Phase 2H.2 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Phase 2H.3 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Phase 2H.4 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Phase 2H.5 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Phase 2H.6 local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`. Phase 2I.1 overview-card validation, save-semantics follow-up validation, and Bug B diagnostic cleanup validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`; full Phase 2I.1 hardware QA is pending. Full root `/Users/mothmanaurascape.ai/Library/pnpm/pnpm run typecheck` was previously attempted, but it stops in unrelated frozen/reference UI areas (`artifacts/noor-path/src/components/ui/button-group.tsx`, `artifacts/noor-path/src/components/ui/calendar.tsx`, `artifacts/mockup-sandbox/src/components/ui/calendar.tsx`, `artifacts/mockup-sandbox/src/components/ui/spinner.tsx`) on React type/ref baseline errors.
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
- Phase 2I.1 follow-up/save-semantics implementation notes: mobile `memorization.tsx` now opens a rating sheet before final save with `Needs Work` quality 2, `Good` quality 4, and `Excellent` quality 5. Saving fetches current memorization progress, unions the session ayahs with existing memorized ayahs, rates only the current session ayahs, and sets status to `"memorized"` only when the full surah is complete; otherwise it saves `"in_progress"`. For today's assigned memorization/recitation target, mobile posts `/api/children/:childId/daily-progress` with completed/in-progress status, `memCompletedAyahEnd`, and target fields so the same `Today's work` card stays visible with saved status while `Next up` can change after extra work. The flow returns to the Memorize overview and refreshes dashboard/progress/surah data. `src/lib/memorization.ts` now allows `"in_progress"` saves and exposes a `submitDailyProgress` helper. No frozen web app files, generated files, tajweed implementation, recite matcher behavior, or native dependencies were touched.
- Phase 2I.1 current-work status follow-up: the `Current work`/`Recitation Focus` overview card now treats current work as a moving pointer within the full daily assignment. If today's assignment spans multiple surahs/ranges, the card should advance to the next unfinished item as progress is saved and should not show `Complete` until all of `Today's work` is complete. The green completed card tone/action only appears when daily progress is completed.
- Intra-surah review clarification/fix: `buildSurahMemorizationWorkflow` now splits a long surah into page-target chunks and schedules cumulative recitation with the cadence Mohammad requested during Phase 2I.1 QA. The pattern is: Day 1-4 new work, Day 5 cumulative recitation of Days 1-4; Day 6-9 new work, Day 10 cumulative recitation of Days 6-9; Day 11 full cumulative recitation of all work so far; then repeat. The final full-surah test is always a separate final day. If 2+ new-work sessions happen after the last cumulative review before the final test, the second-to-last day becomes a partial cumulative recitation for those leftover sessions; if only one new-work session happened, the app goes straight to the final full-surah test. The dashboard returns these review-only items as `todaysPlan.newMemorization` with `isReviewOnly: true`, and mobile 2I.1 shows them as `Recitation Focus`/`Recitation` in the overview cards. What remains for 2I.2 is the richer web-style session UX around those review-only days: explicit Pause & Save / Save & Leave / Leave without saving, a clearer Finish Recitation affordance, and View in Full Mushaf.
- Exact next checklist:
  1. Open Memorize from dashboard.
  2. Confirm the three overview cards: `Today's work`, `Current work`/`Recitation Focus`, and `Next up`.
  3. Complete today's/current work.
  4. Choose Needs Work / Good / Excellent and save.
  5. Confirm `Today's work` stays the same assignment and shows done/in-progress.
  6. Confirm `Current work`/`Recitation Focus` advances through unfinished items inside today's assignment and only shows Complete when the last item in today's work is done.
  7. Confirm saved ayah strength shows red/yellow/green where applicable.
  8. Complete extra work if possible and confirm `Next up` can change while today/current remain frozen correctly.
  9. Return to dashboard and confirm dashboard refresh.
  10. Smoke search/filter/resume/session flow.
  11. After Phase 2I.1 hardware QA passes, document the result, then continue Phase 2I.2 Pause/save and session action parity, working through the 2I.2a-2I.2o sub-rows.
  12. After 2I.2 ships and is hardware-tested, do Phase 2I.3 (memorization defaults parity) and Phase 2I.4 (discovery polish: tajweed notes accordion, ayah-strength review tone on surah rows).
  13. Then Phase 2J Review never-empty/ahead-day parity, then Phase 2K Full Quran/Mushaf Bayaan parity. Do not start TestFlight readiness until 2I, 2J, and 2K are all complete and hardware-tested.
  14. Do not tighten recite matcher behavior. Do not touch tajweed implementation unless only documenting it as missing/backlogged.

### Web-app parity audit summary

Mobile already has:
- Better Auth sign-in, persisted session, existing-child profile picker, sign-out.
- Mobile child creation/profile management through Phase 2H.1: create child, seed prior memorized surahs with per-surah strength and known ayah counts, add prior surahs by From/To range, edit profile settings/targets/practice minutes/visibility toggles, delete the selected child with confirmation, dismiss keyboard cleanly, and save without scrolling past all surahs. Hardware QA passed.
- Child dashboard with today's memorization/review/reading cards, review previews, streak/points, pull-to-refresh, target entry point, fallback behavior that keeps the dashboard usable if today's plan flakes, and first-pass bottom nav.
- Phase 2H.2 dashboard parity content is complete and hardware-tested: richer stats, goals, achievements, up-next memorization, story/du'a suggestions respecting visibility flags, better empty/completed states, and quick actions.
- More screen exposing current Full Quran/Parent Settings/Profile routes plus planned Progress/Plan/Stories/Du'aas entries.
- Shared mobile screen primitives now exist and are adopted by More and Review.
- Parent Settings screen for `memorizePagePerDay`, `reviewPagesPerDay`, `readPagesPerDay`, `practiceMinutesPerDay`, `hideStories`, `hideDuas`, profile entry, daily target bundles, and JS-only default memorization session settings.
- API/spec foundation for upcoming content and progress pages: child target/create/delete/goals contracts, dashboard progress/reading fields, review `reviewedToday`/`todayRange`, daily/reading/weekly progress, and generated client outputs are aligned through Phase 2G.4.
- Memorization core with today's assignment fetch, ayah/page modes, word-level audio highlight, repeat controls, auto-advance delay, cumulative review, reciter selection, 8 themes, playback speed, blind mode, blur mode, translation popup, recite mode, and mark-complete persistence.
- Phase 2H.6 memorization discovery is complete and hardware-tested: the Memorize route now shows current/today work, resume cards, surah search/filter, per-surah progress/strength, and starts the existing session engine for today's work, in-progress work, or a selected surah.
- Phase 2I.1 memorization overview cards plus save semantics/rating follow-up are locally implemented: the Memorize route now has `Today's work`, `Current work`/`Recitation Focus`, and `Next up` cards backed by dashboard `todaysPlan.newMemorization`, `todayProgress`, and `upNextMemorization`, including backend-generated intra-surah review/test work for multi-day surahs. The backend cumulative schedule has been corrected to four new sessions, block cumulative, four new sessions, block cumulative, full cumulative, and a separate final whole-surah test. Session completion now requires a Needs Work/Good/Excellent rating before saving unioned ayah progress and today's daily-progress state. `Current work` remains a moving pointer through the daily assignment and only shows `Complete` when all of today's work is done. Hardware QA is pending.
- Review queue with red/orange/green priority cards, queue summary, due-today/upcoming/reviewed-today sections, no-due/completed/empty states, pull/focus refresh, and a page-image review session with sticky controls, reciter/speed settings, and 0-5 SM-2 rating submission.
- Full Quran reading shell with streamed 604 page images, RTL paging, last-page resume from `readingGoal`, manual Save Page, debounced auto-save, fixed page shortcuts, local page/surah/juz jump/search, saved-page clarity, reading target progress, and JS-only page bookmarks.

Web has that mobile still lacks:
- Phase 2I.1 hardware QA: mobile now mirrors the web save behavior locally, but Mohammad still needs to verify on iPhone that today's assignment stays frozen with done/in-progress status after a rated save and that ayah strengths show red/yellow/green.
- Memorization session/settings parity: mobile still needs the web's Pause & Save (with completed-to ayah picker), Save & Leave, Leave without saving, View in Full Mushaf, bookmark/resume clarity, teacher/app recitation handoff, recitation check phase with score card, "Ready to Recite?" choice modal, "Just Get Tested" shortcut for review-only sessions, separate session setup phase (From/To, repeat slider, auto-advance, cumulative review, review repeat count, surah navigation), Skip repeat / Skip ayah toolbar controls, ayah end-marker tap → ayah sheet, word translation tooltip on tap with WBW audio button, recite-mode page auto-flip across page boundaries, recite-mode Show Word / Skip Word affordances, multi-page recite navigation pills, confetti / celebration overlays, persisted memorization defaults including cumulative review and review repeat count, and a visible memorization settings page for those defaults.
- Discovery surface gaps: per-surah Tajweed Notes accordion driven by `surah.tajweedNotes`, and red/orange/green review-strength tone on surah rows derived from ayah-level strength (in addition to the existing status pill).
- Review never-empty parity: mobile still needs the web behavior where the Review page shows completed-today/completed-day work and always offers a way to continue into the next open review set when today's queue is empty or complete.
- Full Quran/Mushaf parity: mobile still lacks most Bayaan-derived reader tools: fitted Bayaan text pages or a mobile-equivalent tool layer, recent reads, highlights, notes, translation/tafsir/word-by-word sheets, audio range player, reciter/rate/repeat/range-repeat settings, select-to-mark-memorized, recite-from-page, memorization handoffs, and deeper page tools.
- Richer parent/content surfaces beyond these blockers, such as custom goal editing, deeper plan settings, Progress, Learning Plan, Stories, Du'aas, and dedicated content pages, remain future work after the pre-TestFlight blockers unless Mohammad explicitly pulls them forward.
- Progress/achievements: dedicated progress page, charts/bars, earned and in-progress badges, weekly/monthly/session history, memorized surah list, review strength visualization, and daily progress bars.
- Stories and du'aas: no mobile story list/detail, dua list/detail/status, category filters, learned/practice tracking UI, morals, or discussion questions.
- Plans/lessons: no mobile age-group learning plan page, milestone page, goals page, lesson flow, or surah-detail learning page. Tajweed notes are present on web but remain a backlog-only item for mobile beyond the per-surah accordion called out for Phase 2I.4.
- Visual system: web feels richer through patterned headers, compact stats, color-coded cards, badges, horizontal filters, achievement progress bars, and a clear bottom nav. Mobile is functional but thin and mostly white/gray cards.

Highest-risk missing items before TestFlight:
- Phase 2I Memorization parity completion is required before TestFlight: 2I.1 overview cards plus save-semantics/rating follow-up are implemented locally and need hardware QA; then Pause & Save / leave flow, recitation check phase, "Ready to Recite?" choice, setup phase, View in Full Mushaf, bookmark/resume, Skip repeat / Skip ayah, ayah end-marker sheet, word translation tooltip + WBW audio, recite-mode page auto-flip, Show Word / Skip Word affordances, multi-page recite navigation, confetti, persisted memorization defaults, and the visible memorization settings/defaults page still need implementation.
- Phase 2J Review never-empty/ahead-day parity is required before TestFlight: the user should see completed-today work and should always be offered next-day/next-open work instead of an empty dead end.
- Phase 2K Full Quran/Mushaf Bayaan parity is required before TestFlight: the current page-image reader is usable, but it lacks the main reader tools that came from Bayaan in the web app.
- Phase 2G.4 fixed the child-du'a update bug and refreshed OpenAPI/generated clients for future mobile surfaces; authenticated production API smoke is still pending.
- Progress, Stories, Du'aas, Plan, achievements, and richer dedicated destination pages are still absent, but they are behind the three explicit pre-TestFlight blockers above unless Mohammad reorders them.
- Mobile du'a status UI is still absent; when it is built, test toggling multiple du'as independently against the Phase 2G.4 route fix.
- Future API changes must keep `lib/api-spec/openapi.yaml` and Orval outputs in sync; never edit generated files manually.

### Area-by-area parity notes

1. Dashboard/child home: mobile has three work cards plus streak/points; web adds goals, achievements, stats, today story/dua, next surah, richer quick actions, and bottom nav.
2. Memorization: mobile has the core learner, 2H.6 discovery, locally implemented 2I.1 overview cards, and the 2I.1 save semantics/rating follow-up. Intra-surah review for multi-day surahs is scheduled by the backend and surfaced in Memorize as `Recitation Focus`/`Recitation` cards using the corrected cadence: four new sessions, block cumulative, four new sessions, block cumulative, full cumulative, then repeat, with the final full-surah test always separate and a partial cumulative before the final test only when 2+ leftover new sessions require it. Web still defines the required next work after hardware QA: explicit setup/defaults, Pause & Save / leave flows, recitation check phase, "Ready to Recite?" choice, "Just Get Tested" shortcut, View in Full Mushaf, resume/bookmark clarity, Skip repeat / Skip ayah, ayah end-marker sheet, tap-tooltip translation with WBW audio, recite-mode page auto-flip, Show Word / Skip Word affordances, multi-page recite nav pills, confetti / celebration. Discovery still needs Tajweed Notes accordion and review-tone per surah row. Do not touch recite matcher behavior. Do not pursue tajweed coloring beyond documenting it as backlogged.
3. Review: mobile has queue summary, due/upcoming/reviewed sections, page-image session, reciter/speed controls, sticky controls, and SM-2 rating; web still adds local-day session grouping, completed-day sections, next-open-day continuation when empty/complete, flashcards, batch Mushaf review, and richer celebration states. The never-empty/next-day path is pre-TestFlight.
4. Reading/full Quran: mobile has image paging, progress save, page/surah/juz jump/search, saved-page clarity, target progress, basic controls, and page bookmarks; web still adds the Bayaan-style tool layer: recent reads, highlights, notes, translation/tafsir/word tools, audio range playback, memorization handoff, and recite/select modes. This is pre-TestFlight.
5. Settings/targets/parent controls: mobile now has a parent Settings surface for targets, practice minutes, visibility flags, profile entry, profile creation/deletion, and JS-only memorization defaults; web still has deeper custom-goal and content-management surfaces, and persists cumulative review / review repeat count which mobile does not.
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
| 2H.2 Dashboard parity content | Complete Apr 29: mobile dashboard now shows API-backed stats, goals, achievements, story/du'a suggestions respecting visibility flags, next/up-next work, richer completed/empty states, and quick actions. | `app/child/[childId]/index.tsx` | Existing `GET /dashboard`; no backend/spec changes | JS-only | Mobile typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2H.3 Settings/targets convergence | Complete Apr 29: converged Targets into parent Settings with practice minutes, visibility toggles, child profile entry, daily target bundles/fine tuning, JS-only memorization defaults, and immediate profile preference persistence. | `targets.tsx`, `src/lib/settings.ts`, `memorization.tsx`, dashboard/More labels | Existing `PUT /children/:id`; AsyncStorage for session defaults | JS-only; no native | Mobile typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2H.4 Review essentials parity | Complete Apr 29: added queue summary, upcoming/reviewed/completed/no-due states, pull/focus refresh, sticky review-session controls, reciter/speed controls, and queue/dashboard refresh path after submit. | `review.tsx`, `review-session.tsx`, `src/components/screen-primitives.tsx` | Existing reviews endpoints; no backend/spec/generated changes | JS-only | Local mobile typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2H.5 Reading essentials parity | Complete Apr 29: added page/surah/juz jump/search, saved-page resume clarity, reading target progress, better footer/header controls, and JS-only page bookmarks while preserving the page-image reader. | `mushaf.tsx`, `src/lib/mushaf.ts` | Existing `POST /reading-progress`, `GET /dashboard`; no backend/spec/generated edits | JS-only | Mobile typecheck + `git diff --check` passed; Mohammad hardware QA passed |
| 2H.6 Memorization discovery parity | Complete Apr 29: mobile Memorize now has current/today work, resume cards, surah search/filter, progress/strength, and starts the existing session engine. | `memorization.tsx`, `src/lib/memorization.ts`, `src/lib/quran.ts` | Existing `GET /surahs`, `GET /children/:id/memorization`, `GET /dashboard`; no backend/spec/generated edits | JS-only; no native | Mobile typecheck + `git diff --check` passed; Mohammad hardware QA passed |

#### Phase 2I — Memorization parity completion

Pre-TestFlight: yes. This phase corrects the gap Mohammad called out after 2H.6 QA. Use the frozen web implementation in `artifacts/noor-path/src/pages/memorization.tsx`, `artifacts/noor-path/src/pages/quran-memorize.tsx`, `artifacts/noor-path/src/pages/settings.tsx`, and `artifacts/noor-path/src/hooks/use-settings.ts` as the reference. Preserve the existing mobile session engine; wrap and extend it instead of rewriting it.

| Slice | Goal | Likely files | Backend/API deps | Risk | QA |
|---|---|---|---|---|---|
| 2I.1 Memorization overview cards + save semantics | Implemented locally Apr 29: added top three mobile cards for `Today's work`, `Current work`/`Recitation Focus`, and `Next up`; added rating-before-save with Needs Work/Good/Excellent; saves unioned ayah progress with full-surah-based status; posts daily progress for today's target so the same frozen daily assignment stays visible; `Current work` keeps advancing through the unfinished items inside today's assignment and only shows complete after all of today's work is done. Intra-surah review/test days for multi-day surahs are generated by the backend with the corrected cadence: four new sessions, block cumulative, four new sessions, block cumulative, full cumulative, and a separate final whole-surah test. | `app/child/[childId]/memorization.tsx`, `src/lib/memorization.ts`, `artifacts/api-server/src/lib/memorization-workflow.ts` | Existing `GET /dashboard`, `GET /memorization`, `GET /surahs`, `POST /daily-progress`, `POST /memorization`; no generated edits | JS-only + backend scheduler | Focused scheduler smoke check, mobile typecheck, and `git diff --check` passed; hardware QA pending |
| 2I.2 Pause/save and session action parity (broad row, kept) | Add web-style Pause & Save, Save & Leave, Leave without saving, clearer review-only Finish Recitation affordances, and View in Full Mushaf from the memorization session. Preserve ayah/page modes, audio highlighting, cumulative review, reciter/speed settings, blind/blur modes, translation popup, recite mode, and mark-complete persistence. | `memorization.tsx`, maybe `mushaf.tsx` route params | Existing progress/daily-progress routes; no backend/spec changes unless a missing field is proven necessary | Medium session-state risk | Pause midway, choose completed-to ayah, go to recitation check/save, leave with/without saving, jump to Full Quran page and back |
| 2I.2a Pause & Save modal with completed-to ayah picker | Replace the current Mark Complete-only flow with a Pause & Save modal that asks "How far did you get?" and lets the parent pick the actual completed-to ayah (with stepper) before routing to the recitation check phase. Bound by `[fromAyah, toAyah]`. For review-only sessions, present the all-or-nothing "Go to Recitation Check" CTA against the assigned range. | `memorization.tsx`, possibly a new `pause-save-sheet.tsx` shared sheet | Existing memorization/daily-progress routes | Medium session-state risk | Pause mid-range, pick a smaller completed-to value, save, confirm only those ayahs are rated |
| 2I.2b Save & Leave / Leave without saving / Keep practicing modal | Add a leave confirmation modal so back/abort offers Save & Leave (routes to recitation check), Leave without saving, and Keep practicing. Hook to back gestures and the Back button. Review-only sessions show the all-or-nothing leave warning copy. | `memorization.tsx`, `_layout.tsx` if Expo Router back interception is needed | None | Medium navigation risk | Tap Back during session, see modal, each option does the right thing |
| 2I.2c Recitation Check phase with score card | Add a separate `phase: "check"` view after Mark Complete / Pause & Save / recite-finish that shows the rating selector (Needs Work / Good / Excellent → quality 2/4/5), the previously-implemented save semantics, and a score card when entered from Recite to NoorPath. Currently mobile only triggers the rating sheet from Mark Complete; web reaches the check phase from session-complete and recite-finish too. | `memorization.tsx`, possibly a new `recitation-check.tsx` route or in-file phase | Existing memorization/daily-progress routes | Medium state risk | Reach check phase from each entry point; rate; save; return to Memorize and confirm refresh |
| 2I.2d "Ready to Recite?" choice modal at session end | At session-complete (last verse done, optional cumulative review done) show a "Ready to Recite?" modal that routes to either `Recite to Teacher →` (jumps straight to recitation check) or `Recite to NoorPath →` (sets recite-mode trigger so the kid recites against the matcher; on finish it routes to check with the score card). Replace the current plain Alert. | `memorization.tsx` | None | JS-only, medium UX risk | Hit session-complete, see modal, both routes land in check phase correctly |
| 2I.2e "Just Get Tested" shortcut for review-only sessions | On the setup/discovery surface for review-only assignment days, expose a `Just Get Tested` action that skips memorization playback entirely and routes straight to the recitation check phase. | `memorization.tsx`, possibly the discovery overview cards | None | JS-only | Pick a review-only day, tap Just Get Tested, land in check |
| 2I.2f Pre-session setup phase | Add a setup phase before playback starts: From/To inputs (bounded by surah length), repeat count slider 1-10, auto-advance toggle, cumulative review toggle, review repeat count stepper (visible only when cumulative on), and surah navigation/dropdown. Today the kid jumps from a discovery card straight into playback; web lets the parent dial the session in first. Include "Start — Ayah X to Y" and (for review-only days) a "Just Get Tested" outline button. | `memorization.tsx`, possibly a new `memorization-setup.tsx` route | None | JS-only, medium state risk | Adjust each control before starting; confirm the session honors them |
| 2I.2g Bookmark / resume per session | Persist a per-child session bookmark to AsyncStorage on every state change inside the session: surah, fromAyah, toAyah, currentAyah, repeatCount, autoAdvance, cumulativeReview, reviewRepeatCount, savedAt. Add a "Resume where you left off" card to the discovery surface that hydrates the bookmark and jumps into the session at the saved ayah. | `memorization.tsx`, `src/lib/settings.ts` (new bookmark helpers) | None | JS-only | Quit mid-session, return to Memorize, see resume card, tap, land at the saved ayah with saved settings |
| 2I.2h View in Full Mushaf action from inside the session | Add a session action (kebab/menu in the controls island or settings sheet) that navigates to the Full Quran reader at the active page, and routes back into the session on return. | `memorization.tsx`, `mushaf.tsx` route params | None | JS-only | Tap action mid-session, land on correct page, back button returns to session |
| 2I.2i Skip repeat / Skip ayah toolbar controls | Add Skip Repeat (chevron-double-right) and Skip Ayah (skip-forward) buttons next to Prev/Play/Next so the kid can move on without finishing all repeats or finishing a verse. Cumulative-phase variant: Skip Repeat → next pass, Skip Ayah → exit cumulative review. Mirror web `handleSkipRepeat` / `skipAyah`. | `memorization.tsx` | None | JS-only, medium state risk | During single phase, Skip Repeat advances repeat count; during cumulative, Skip Repeat jumps pass; Skip Ayah behaves correctly in both phases |
| 2I.2j Tappable ayah end-marker → ayah sheet | The end-marker circle (`◆ {verseNum}`) should be tappable in non-recite, non-blind mode and open an ayah sheet with actions for that ayah (memorization handoff, view in full Mushaf, etc.). | `memorization.tsx`, possibly a new `ayah-sheet.tsx` component | None | JS-only | Tap end marker, see sheet, each action works |
| 2I.2k Tap-tooltip word translation + WBW audio button | In addition to the existing long-press translation popup, add a tap-tooltip that shows the Arabic word, English translation, position, and an audio play button using `https://audio.qurancdn.com/wbw/{surah}_{verse}_{position}.mp3` (zero-padded). Keep tap-to-seek as well; coordinate so single tap shows tooltip without breaking seek (web approach: dedicated tap target on the active verse only). | `memorization.tsx` | Quran.com WBW audio URLs | JS-only | Tap word in active verse, see tooltip with audio button; play button audibly plays single word |
| 2I.2l Recite-mode page auto-flip across page boundaries | When recite-mode advances across a mushaf page boundary, auto-flip the displayed page so the active recite verse stays on screen. | `memorization.tsx` | None | JS-only | Recite a multi-page session, confirm page flips |
| 2I.2m Recite-mode Show Word / Skip Word floating affordances | While recite mode is active, show floating pills above the controls island for `Show Word` (un-blurs the current expected word) and `Skip Word` (advances past it without matching). Mirror web's `handleShowWord` / `handleSkipWord` including reciteAttempts penalty bookkeeping. | `memorization.tsx` | None | JS-only, medium state risk | Stuck on a word, tap Show Word, see it unblur; tap Skip Word, advances |
| 2I.2n Multi-page recite navigation pills | When the recite session spans multiple pages, show prev/next page pills + a "Current word →" link if the displayed page differs from the page containing the active recite word. | `memorization.tsx` | None | JS-only | Recite multi-page session, confirm pills appear and behave correctly |
| 2I.2o Confetti / celebration overlay | Replace the current plain Alert at session-complete and surah-complete with a confetti / celebration overlay (mirror `CelebrationOverlay`). Respect a future `confetti` defaults toggle when 2I.3 lands. | `memorization.tsx`, possibly a new `celebration-overlay.tsx` component | None | JS-only | Finish a session, see overlay; finish a surah, see overlay |
| 2I.3 Memorization settings/defaults page (broad row, kept) | Add a visible settings surface for memorization defaults: ayah/range preference if useful, repeat count/multiplier, auto-advance, cumulative review, review repeat count, blind/blur defaults, reciter, playback speed, theme, and any existing JS-only defaults. Decide whether to extend current Parent Settings or add a dedicated child memorization settings route, but make it discoverable from Memorize/session. | `targets.tsx` or new memorization settings route, `src/lib/settings.ts`, `memorization.tsx`, More/dashboard links | Existing child target/profile updates plus AsyncStorage settings | JS-only | Change defaults, start a new memorization session, verify defaults hydrate and persist per child |
| 2I.3a Add cumulative review + review repeat count to persisted defaults | Today mobile resets `cumulativeReview` to off and `reviewRepeatCount` to 3 every screen mount. Web persists both via `useSettings`. Add them to `DEFAULT_SESSION_SETTINGS` plus the AsyncStorage payload, and hydrate on session start. Then expose stepper/toggle in the parent settings surface delivered by 2I.3. | `src/lib/settings.ts`, `memorization.tsx`, parent settings surface | None | JS-only | Change default, close app, reopen, start session, defaults survived |
| 2I.3b Add confetti default | Add a `confetti` toggle to `DEFAULT_SESSION_SETTINGS` so the 2I.2o overlay can be opted out by parents. | `src/lib/settings.ts`, parent settings surface, `memorization.tsx` | None | JS-only | Toggle off, finish session, no overlay |
| 2I.4 Discovery polish | Add the per-surah Tajweed Notes accordion and red/orange/green review-tone on each surah row, mirroring web `getReviewStrengthTone` and `surah.tajweedNotes`. Tajweed coloring inside the session itself stays backlogged. | `memorization.tsx` (discovery section), `src/lib/memorization.ts` if a new tone helper is needed | `GET /surahs/:id` if tajweed notes need a separate fetch; existing `/memorization` strength data | JS-only | Open Memorize, see review-tone rail/dot per surah; expand a surah, see tajweed notes accordion if any |

#### Phase 2J — Review never-empty/ahead-day parity

Pre-TestFlight: yes. The Review page should never strand the user with nothing to do. Use `artifacts/noor-path/src/pages/review.tsx` as the reference for `activeLocalDate`, completed-day sections, `reviewedToday`, daily-progress sync, and `Continue Reviewing`.

| Slice | Goal | Likely files | Backend/API deps | Risk | QA |
|---|---|---|---|---|---|
| 2J.1 Review completed-today and continue-next | Show what was already completed today, preserve reviewed-today rows, and when today's queue is empty/complete offer `Continue Reviewing` into the next open review day instead of an empty state. | `app/child/[childId]/review.tsx`, maybe `src/lib/review` if created | Existing `GET /reviews`, `reviewedToday`, `todayRange`, daily-progress endpoint | JS-only unless API cannot expose next date | Complete reviews, return to Review, see completed today, continue to next available work |
| 2J.2 Ahead-day local session behavior | Add web-like active local date/session persistence so if the child reviews ahead, completed prior days are grouped and the current active day stays understandable. Keep existing review-session route and SM-2 submission intact. | `review.tsx`, `review-session.tsx`, AsyncStorage helper if needed | Existing review endpoints; use `x-local-date` carefully | Medium state/refresh risk | Review multiple days in a row, see completed day grouping, dashboard/review counts remain sane |
| 2J.3 Review extras triage | After never-empty behavior is working, compare web flashcard mode, connected Mushaf batch review, and celebration states. Implement only if still considered must-have for beta; otherwise document as post-beta. | `review.tsx`, `review-session.tsx` | Existing review/surah endpoints | JS-only | Flashcard/batch smoke only if implemented |

#### Phase 2K — Full Quran/Mushaf Bayaan parity

Pre-TestFlight: yes. The current mobile Full Quran page-image reader is not enough for beta because the web Mushaf reader carries the Bayaan-derived feature set. Use `artifacts/noor-path/src/pages/mushaf-reader.tsx` and `artifacts/noor-path/src/components/mushaf/bayaan/*` as the reference. Do not add native dependencies without explicit approval/rebuild note.

| Slice | Goal | Likely files | Backend/API deps | Risk | QA |
|---|---|---|---|---|---|
| 2K.1 Mushaf tool shell | Add a mobile-appropriate tool layer on top of the existing reader: chrome controls, surah/page/juz/bookmark search, recent reads, blind mode, select mode, recite pick mode entry points, and ayah sheet trigger. Keep existing page-image paging/progress save unless replacing it is explicitly chosen. | `mushaf.tsx`, `src/lib/mushaf.ts`, new local storage helpers/components | Existing dashboard/reading-progress, Quran.com fetchers | Medium UI/state risk | Search/jump, recent read, blind reveal, select entry, recite entry, page progress save |
| 2K.2 Ayah sheet and annotations | Add Bayaan-style ayah actions: play from here, repeat, bookmark, highlight, note, translation, tafseer, word-by-word, copy/share where mobile APIs allow, and memorization handoff/open in memorization. | `mushaf.tsx`, new sheet/components, AsyncStorage | Quran.com translation/tafsir/WBW fetchers; existing memorization routes | Medium network/state risk | Long-press/tap ayah, bookmark/highlight/note persist, translation/word-by-word load, handoff opens memorization |
| 2K.3 Audio range/recite/select-to-memorize | Add Full Quran audio range playback with reciter, speed, per-ayah repeat and range-repeat settings; add recite-from-page behavior if feasible using existing recite matcher without tightening it; let selected ayahs be marked memorized. | `mushaf.tsx`, existing audio/recite libs if reusable | Existing `PUT /memorization`; Quran audio URLs | Higher complexity; no matcher tightening | Play a range, change speed/repeat, recite from page, mark selected ayahs memorized, dashboard/memorization refresh |

#### Phase 2L — Polish + TestFlight readiness

Pre-TestFlight: yes, but only after 2I/2J/2K are complete and hardware-tested.

| Slice | Goal | Likely files | Backend/API deps | Risk | QA |
|---|---|---|---|---|---|
| 2L.1 Visual polish pass | Apply richer web-inspired product feel across mobile: section hierarchy, badges, compact stats, empty states, kid-friendly but parent-usable colors, no marketing hero. | All touched mobile screens, shared components | None | JS-only | Hardware screenshots of every primary screen |
| 2L.2 App shell/assets | Final app icon/splash, bundle/version config, production API env, no temporary dev copy. | `app.json`, assets, EAS config | None | App config changes may require EAS rebuild | Install production build, launch smoke |
| 2L.3 TestFlight build/QA | Production EAS build, App Store Connect/TestFlight setup, QA matrix, beta notes. | `artifacts/noor-mobile/*`, docs | Backend production stability | Requires production build | Login, onboarding, dashboard, memorize, recite, review, read, settings, content, offline/error paths |

#### Phase 2M — Rich learning/content pages

Pre-TestFlight: deferred unless Mohammad explicitly reorders. These used to be labeled 2I/2J before the Apr 29 correction, but the immediate beta blockers are now Memorization, Review, and Mushaf parity.

| Slice | Goal | Likely files | Backend/API deps | Risk | QA |
|---|---|---|---|---|---|
| 2M.1 Stories | Mobile stories list/detail with categories, age filtering, morals, discussion questions, and dashboard/More entry points respecting `hideStories`. | New `stories.tsx`, `story-detail.tsx`, More/dashboard links | `GET /stories`, `GET /stories/:id`, child hide flag | JS-only | Category filter, detail, hidden state |
| 2M.2 Du'aas | Mobile du'aas list/detail/status with category filter, learned toggle, practice count, Arabic/transliteration/translation/source. | New `duas.tsx`, shared content cards | Use Phase 2G.4 child-du'a route fix; OpenAPI/codegen if using generated client later | JS/backend; no native | Toggle multiple du'as independently, practice count, hidden state |
| 2M.3 Plan/goals/progress | Mobile learning plan, goals, progress page, achievements, weekly bars, memorized surah list, session history, and parent overview upgrades. | New `plan.tsx`, `progress.tsx`, `sessions.tsx`, possible parent dashboard | Dashboard, plan, goals, weekly progress, memorization, sessions endpoints | JS-only; avoid chart native deps | Empty/new child, active child, completed surahs, all age groups |
| 2M.4 Lesson/surah detail | Mobile lesson/surah detail cards with Arabic, transliteration, translation, tafsir brief, audio entry, and memorization handoff. Tajweed notes stay backlog. | New `lesson.tsx`, `surah-detail.tsx`; `src/lib/quran.ts` | `GET /surahs/:id`, Quran.com fetchers | JS-only | Open from plan/memorization; audio/translation loads |

---

## ✅ DONE — Infrastructure

- Apple Developer Program approved + App Store Connect access granted
- Backend deployed: <https://workspaceapi-server-production-cc25.up.railway.app>
- `BETTER_AUTH_URL` set to production URL
- `PROD_ALLOWED_ORIGINS` + `PROD_TRUSTED_ORIGINS` configured for CORS / Better Auth
- `/api/healthz` returns `{"status":"ok"}` (public, mounted above `requireAuth`)
- Three secrets rotated (Neon password, Better Auth secret, Hugging Face token)
- Branch-sync note: `main` + `feature/main-working-branch` were synced at `7006124` before the Phase 2I.1 cumulative scheduler QA fix. After this fix/docs commit, both branches should be synced to the current docs HEAD. `safe-cumulative` was temporary archaeology and can be ignored.
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

## 🔜 NEXT — Phase 2I.1 Hardware QA

1. Open Memorize from dashboard and confirm `Today's work`, `Current work`/`Recitation Focus`, and `Next up`.
2. Complete today's/current work.
3. Choose Needs Work / Good / Excellent and save.
4. Confirm `Today's work` stays the same assignment and shows done/in-progress.
5. Confirm `Current work`/`Recitation Focus` advances through unfinished items inside today's assignment and only shows Complete when the last item in today's work is done.
6. Confirm saved ayah strength shows red/yellow/green where applicable.
7. Complete extra work if possible and confirm `Next up` can change while today/current remain frozen correctly.
8. Return to dashboard and confirm dashboard refresh.
9. Smoke search/filter/resume/session flow.
10. Keep tajweed as backlog-only unless Mohammad explicitly reopens it, and do not tighten recite matcher behavior.

---

## ⏭ Phase 2L / Phase 3 — TestFlight readiness after 2I/2J/2K

Phase 2H.6 is hardware-tested, but beta parity is not complete. Do not resume TestFlight readiness until Phase 2I Memorization parity completion, Phase 2J Review never-empty/ahead-day parity, and Phase 2K Full Quran/Mushaf Bayaan parity are complete and hardware-tested. The remaining TestFlight work after those blockers is:

- [ ] App icon, splash screen, launch screen
- [ ] Production API/env review
- [ ] EAS Build production profile → first `.ipa`
- [ ] App Store Connect setup
- [ ] TestFlight beta with wife + trusted users
- [ ] Bug fixes from beta feedback
- [ ] App Store submission
- [ ] Push notifications for review reminders (Expo Notifications) — requires explicit native/build approval if new native config is needed
- [ ] Native gestures + haptics only if already covered by installed dependencies or explicitly approved
- [x] Make audio controls in `review-session` sticky / floating at bottom of screen (Phase 2H.4 complete and hardware-tested)
- [ ] Add ayah-bounding-box overlay in `review-session`
- [ ] Migrate from `expo-av` to `expo-audio`/`expo-video` later; do not block parity on this

---

## ✅ Hardware bugs — found Apr 29, 2026 and cleared before Phase 2I.1 hardware QA

These were reported during the Apr 29 web→mobile parity audit conversation. Both are now hardware-tested/shipped by Mohammad, so Phase 2I.1 hardware QA can resume.

- **Memorize `Next up` card → loading death spiral.** Hardware-confirmed fixed by Mohammad. Temporary diagnostic logs were removed from `artifacts/noor-mobile/app/child/[childId]/memorization.tsx`; the cleanup made no behavior changes. JS-only. Local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`.
- **Memorize surah search keyboard sticks open.** Implemented Apr 29 in `artifacts/noor-mobile/app/child/[childId]/memorization.tsx` and hardware-tested/shipped by Mohammad after commit `6a9e70f`: the discovery `ScrollView` uses `keyboardDismissMode="on-drag"` and `keyboardShouldPersistTaps="handled"`, the horizontal filter scroller also preserves handled taps, and the search `TextInput` uses an explicit Done return key that dismisses the keyboard. JS-only. Local validation passed with `cd artifacts/noor-mobile && npx tsc --noEmit` and `git diff --check`.

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
- Web-app parity deep dive completed Apr 28, 2026; refreshed Apr 29 with the 2I.2/2I.3/2I.4 sub-rows. Follow the Phase 2G-2K roadmap above before resuming Phase 3/TestFlight.

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
| Branches | `main` (deploy) + `feature/main-working-branch`; both should be synced to the current Phase 2I.1 cumulative-scheduler fix/docs commit after this handoff. `safe-cumulative` was temporary archaeology and can be ignored. |
| Apple Developer | Approved Apr 26; Team ID `M7KJJDN537` |
| iOS bundle identifier | `com.mothman.noorpath` |
| EAS project | `@mothman123/noor-mobile` |
| Railway project | `humble-laughter` / `production` env |
| Mobile app HEAD | Phase 2D complete through Slice 5b, Phase 2E dashboard polish complete, Phase 2F targets complete, Phase 2G.1-2G.3 hardware-tested, Phase 2H.1-2H.6 hardware-tested, and Phase 2I.1 memorization overview cards plus save-semantics/rating follow-up locally implemented. Backend cumulative recitation scheduling was corrected during Phase 2I.1 QA. EAS dev build `cfb3f406-5fec-405a-a150-e525a96ecff2` finished and was hardware-tested by Mohammad for earlier slices. Beta is not done; next recommended work is to clear the two new Apr 29 hardware bugs, then Phase 2I.1 hardware QA, then Phase 2I.2/2I.3/2I.4 and Phase 2J/2K blockers before TestFlight readiness. |
</content>
