# NoorPath / Quranic Journey — Status & Next Steps

_Last updated: April 28, 2026 (malformed Targets navigation fix synced; mobile typecheck passed; hardware re-QA pending)_

---

## Documentation rule for every new action

After every meaningful action, update this file and `PHASE_2D_HANDOFF.md` before handing off:

- Update the "Last updated" line with the date and actual current state.
- Record the active branch, latest local SHA, and whether remote branches are synced or stale.
- Move completed work out of "next" sections and into the done/current-state section.
- Add any hardware QA results or known failures immediately.
- Make the next action checklist concrete enough that a fresh Codex/Claude chat can start without reconstructing context.

## Current work log — April 28, 2026

- Active branch/SHA: `main` at the latest docs sync/current branch HEAD; route fix commit is `0c1e088`; diagnostic fallback code commit is `ccbf1ec`. Phase 2F target-setting UI commit is `fe83e97`; API client hardening commit is `ce8b9f6`; previous dashboard fallback commit is `8fa113a`.
- Remote sync status: `main`, `origin/main`, `feature/main-working-branch`, and `origin/feature/main-working-branch` are synced at the latest docs sync/current branch HEAD. `safe-cumulative` is intentionally behind and can be ignored.
- QA status: `cd artifacts/noor-mobile && npx tsc --noEmit` passed clean after Phase 2F edits, after the API client hardening hotfix, after the dashboard fallback, after the diagnostic/fallback patch, and after the malformed Targets route fix. Production `/api/children/23/dashboard` and `/api/children/22/dashboard` returned 200 with the active Better Auth session; Joll also returned 200 across local-date headers `2026-04-24` through `2026-04-30`. Hardware screenshot from the diagnostic patch showed the real failure: the dashboard was mounted with `childId = "targets"` and called `/api/children/targets/dashboard`, `/reviews`, and child fetch.
- Dev-server note: starting Expo inside the sandbox fails with `ERR_SOCKET_BAD_PORT` because sandboxed Node cannot bind local ports (`EPERM` on 8081). Run the dev server outside the sandbox/escalated when using this environment.
- Inspection notes: initial Phase 2E inspection found `app/child/[childId]/index.tsx` was a three-card skeleton; `src/lib/api.ts` is a thin authenticated fetch helper; `/api/children/:id/dashboard` exposes `todaysPlan.newMemorization`, `todayProgress`, `reviewsDueToday`, and `readingGoal`; `/api/children/:id/reviews` exposes detailed queue items with `reviewPriority`.
- Implementation notes: mobile dashboard now fetches dashboard plus review queue data, the Memorization/Review/Reading cards show today's assigned work, review previews use shared red/orange/green priority styling, the review queue cards have matching priority rails/backgrounds, and the profile selector has richer child rows with age, streak, and points.
- Diff-review notes: removed new dashboard letter spacing and fixed streak pluralization before final QA.
- Phase 2F inspection notes: targets are stored on `children` as `memorizePagePerDay`, `reviewPagesPerDay`, and `readPagesPerDay`; `GET /api/children/:childId` returns them through `formatChild`; `PUT /api/children/:childId` accepts all three fields. Web reference options live in `artifacts/noor-path/src/pages/settings.tsx`.
- Phase 2F implementation notes: added `app/child/[childId]/targets.tsx`, registered it in the child stack, added a dashboard `Targets` entry point, and made the dashboard refresh on focus after returning from target edits. The screen uses preset chips plus minus/plus fine tuning and saves directly through `apiFetch`.
- Phase 2F hotfix notes: after screenshots showed the dashboard rendering API 500s for L and Joll, production was checked directly and returned 200 for both children. `apiFetch` now sends `x-local-date` from the phone and normalizes JSON/plain-text/HTML failures into short readable error messages instead of showing full HTML documents. The dashboard now retries `/dashboard` once and then falls back to child/profile plus review queue data, keeping Targets reachable if today's plan endpoint flakes. Fresh inspection found that if the fallback path itself fails, the full-screen error still only shows the original dashboard error, so the phone cannot distinguish stale JS, wrong API base, dashboard failure, review failure, or child fallback failure yet.
- Phase 2F diagnostic implementation notes: added `ApiError`, `getApiRuntimeInfo`, console request/response logs, and diagnostic marker `dashboard-diag-2026-04-28a` in mobile `apiFetch`. The dashboard now tracks primary/retry/fallback review/fallback child stages, renders a compact diagnostic panel on fallback/error, and if the child fallback fetch fails it renders a degraded shell from route params instead of the original full-screen dashboard 500.
- Phase 2F route bug diagnosis: dashboard `handleTargetsPress` used relative `pathname: "./targets"`, which Expo Router resolved as `/child/targets` instead of `/child/:childId/targets`. That made the dashboard route match `[childId] = "targets"` on return/reload, causing API calls to `/api/children/targets/*`.
- Phase 2F route fix notes: dashboard Targets navigation now uses absolute `pathname: "/child/[childId]/targets"`, and dashboard loading now rejects non-numeric child IDs before making API calls.
- Exact next checklist:
  1. Ask Mohammad to reload the JS bundle, go Back to the child picker if currently stuck on `/child/targets`, reopen L/Joll, then test Targets save and dashboard refresh.
  2. Verify the diagnostic panel no longer reports `/api/children/targets/*`.
  3. Verify Targets save for memorization, review, and reading targets.
  4. Return to the dashboard and verify the cards reflect the saved target values.
  5. If all good, remove or downgrade the temporary visible diagnostic panel in a follow-up.

---

## ✅ DONE — Infrastructure

- Apple Developer Program approved + App Store Connect access granted
- Backend deployed: <https://workspaceapi-server-production-cc25.up.railway.app>
- `BETTER_AUTH_URL` set to production URL
- `PROD_ALLOWED_ORIGINS` + `PROD_TRUSTED_ORIGINS` configured for CORS / Better Auth
- `/api/healthz` returns `{"status":"ok"}` (public, mounted above `requireAuth`)
- Three secrets rotated (Neon password, Better Auth secret, Hugging Face token)
- Branch-sync note: `main` + `feature/main-working-branch` are synced through Phase 2E code/docs. `safe-cumulative` was the temporary rescue branch and is now intentionally behind; ignore unless needed for archaeology. Phase 2E code commit is `3a19f2f`; latest docs refresh is current branch HEAD.
- Typecheck baseline clean
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

## ✅ DONE LOCALLY — Phase 2F — target-setting UI

Implemented, committed, and typechecked Apr 28, 2026. Hardware re-QA is still pending after dashboard 500 screenshots for L and Joll.

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

## 🔜 NEXT — Phase 2F hardware QA

1. Start Metro with `npx expo start --dev-client --clear --port 8081` outside the sandbox/escalated.
2. Open the installed development build on iPhone.
3. Reopen Joll's dashboard; confirm the dashboard loads normally or shows the temporary warning fallback instead of the full-screen API 500.
4. From a child dashboard, tap `Targets`.
5. Change memorization, review, and reading targets; confirm each save indicator appears.
6. Return to the dashboard and verify reading/review/memorization cards reflect the updated target data after refresh.
7. If approved, move to Phase 3 TestFlight polish or the planned web-app deep dive.

---

## 🔜 Phase 3 — TestFlight & polish

- [ ] Push notifications for review reminders (Expo Notifications)
- [ ] Native gestures + haptics
- [ ] App icon, splash screen, launch screen
- [ ] App Store Connect setup (only when there's an actual app to upload)
- [ ] EAS Build production profile → first .ipa
- [ ] TestFlight beta with wife + trusted users
- [ ] Bug fixes from beta feedback
- [ ] App Store submission
- [ ] Make audio controls in `review-session` sticky / floating at bottom of screen
- [ ] Add ayah-bounding-box overlay in `review-session`
- [ ] Migrate from `expo-av` to `expo-audio`/`expo-video` (deprecation warning surfaced in SDK 54)

**Estimated remaining: 3-5 weeks**

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
- Deep-dive into web app's `noor-path/` for "lots of cool stuff that took a lot of work" — user wants this after Phase 2 completes

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
| Branches | `main` (deploy) + `feature/main-working-branch`; both synced with Slice 5b code/docs. `safe-cumulative` currently matches but should not be the default working branch. |
| Apple Developer | Approved Apr 26; Team ID `M7KJJDN537` |
| iOS bundle identifier | `com.mothman.noorpath` |
| EAS project | `@mothman123/noor-mobile` |
| Railway project | `humble-laughter` / `production` env |
| Mobile app HEAD | Phase 2D complete through Slice 5b. Slice 5b code commit `aa004ff`; latest docs refresh is current branch HEAD. EAS build `cfb3f406-5fec-405a-a150-e525a96ecff2` finished and was hardware-tested by Mohammad. Next work should start from `main`. |
</content>
