# NoorPath / Quranic Journey — Status & Next Steps

_Last updated: April 27, 2026 (Phase 2D Slice 4 shipped + tested + 3 hotfixes; Slice 5 next)_

---

## ✅ DONE — Infrastructure

- Apple Developer Program approved + App Store Connect access granted
- Backend deployed: <https://workspaceapi-server-production-cc25.up.railway.app>
- `BETTER_AUTH_URL` set to production URL
- `PROD_ALLOWED_ORIGINS` + `PROD_TRUSTED_ORIGINS` configured for CORS / Better Auth
- `/api/healthz` returns `{"status":"ok"}` (public, mounted above `requireAuth`)
- Three secrets rotated (Neon password, Better Auth secret, Hugging Face token)
- Both branches synced
- Typecheck baseline clean
- iOS bundle identifier registered: `com.mothman.noorpath`
- EAS project created at `@mothman123/noor-mobile`
- iOS distribution certificate generated (expires Apr 27 2027)
- `eas.json` committed with `development` / `preview` / `production` profiles
- `expo-dev-client` installed (auto-added by EAS during first dev build)
- First EAS development build shipped Apr 27 2026 — installed on registered iPhone, used to validate Slice 4 recite mode end-to-end

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

## ✅ DONE — Phase 2D — Memorization mode (Slices 1–4 of 5 shipped + tested)

### Phase 2D-Core (Slice 1) — `5650d9e` + `e752721`

Single-verse focused memorization screen with Husary word-by-word audio sync.

- Amiri Quran font bundled (`assets/fonts/AmiriQuran.ttf`, 133 KB)
- `src/lib/quran.ts` — Quran.com v4 word-level verse fetch
- `src/lib/memorization.ts` — dashboard fetch, QDC chapter timings (cached per surah), memorization POST
- `app/child/[childId]/memorization.tsx` — single-verse view, QDC word-by-word highlight via RAF, tap-to-seek, Prev/Next with auto-play, Mark Complete
- Dashboard Memorization card navigates to this screen

### Phase 2D-Mushaf-Render (Slice 2a) — `1dae113`

Full Mushaf static view mode added. View mode toggle ("Ayah by Ayah" / "Full Mushaf"), `fetchVersesByPage`, `pageWordsMap`, multi-page support.

### Phase 2D-Mushaf-Polish (Slice 2a-fix) — `3a9307c` + line-centering tweak

Visual repair of Slice 2a's wall-of-text rendering. Parchment page chrome ported from `noor-path` bayaan palette.

- `src/lib/mushaf-theme.ts` — `MUSHAF_PAGE_THEME` palette + `JUZ_START_PAGES` + `getJuzForPage`
- `fetchAllChapters()` with module-level Promise cache
- Line layout: `flexWrap: "wrap"` + `justifyContent: "center"` (canonical Mushaf line may wrap to 2 visual lines on phone; accepted)
- Font 20/lineHeight 38 (down from 22/44); end markers at 16
- Parchment page card with header bar (surah names + Juz), surah banners at transitions, page-number footer
- Out-of-scope words: `MUSHAF_PAGE_THEME.pageMuted` (`#b0a184`)

### Phase 2D-Mushaf-Sync (Slice 2b) — `ef7ae00`

Page-level audio sync + fixed controls island.

- Sequential auto-advance through in-scope range in Full Mushaf mode
- Page-level word highlighting via QDC RAF tick — parallel `highlightedPage` state keyed by `verseKey + 1-based ApiWord.position`
- Tap-to-seek on in-scope words; cross-verse taps switch `currentVerse` and seek after new verse loads via `pendingSeekPositionRef`
- Fixed-position controls island below ScrollView (Play / Mark Complete always reachable without scrolling)
- Auto-scroll on verse change (page mode) — best-effort `onLayout` Y; `lineLayoutMap` + `pageCardLayoutMap`

### Phase 2D-Practice (Slice 3) — `e2f9be7` + tweaks `1c89b3b`, `948de29`

Five settings + two mode buttons.

- Settings gear in header opens bottom sheet: repeat count (1–10), auto-advance delay (0–5s in 0.5s steps), autoplay-through-range toggle, blur-other-verses toggle
- Blind mode button in controls island: hides in-scope verses as `••••`. Toggle behavior — tap reveals, tap again hides (no auto-timer per `1c89b3b`). Reveals persist across audio auto-advance per `948de29`. Reveals reset only on view-mode change or blind-mode toggle. Tap-to-seek disabled while blind mode is on.
- Recite mode button placeholder (disabled) — wired in Slice 4
- Repeat count: per-verse counter resets on verse change; replays via `setPositionAsync(0)` + `playAsync` (no sound recreation)
- Auto-advance delay: `setTimeout`-gated, cancellable on pause / prev / next / unmount
- Blur mode: opacity 0.35 on non-active in-scope verses while playing; clears on pause

### Phase 2D-Recite (Slice 4) — `1f6557e` + docs `4100a1f`

On-device speech recognition via `expo-speech-recognition`. **Requires EAS dev build to test on hardware** — Expo Go doesn't include the native module.

- `expo-speech-recognition` installed; iOS Info.plist via config plugin (microphone + speech recognition usage strings, kid-friendly copy)
- Continuous listening; auto-restart on iOS's 1-minute recognition limit
- Word-by-word advance: expected word N → fuzzy match → highlight N+1
- Recite mode pauses Husary and blocks Play (iOS audio session conflict — mic and speaker can't run simultaneously)
- Permission requested on first entry; denied → alert directing to Settings
- Header title shows "Recite Verse X of Y" while active
- Recognition errors displayed below controls island

#### Slice 4 hotfixes (post-hardware-testing)

**v1 hotfix (`53675e6`)** — Audio session conflict + concurrent play race:
- Added `isLoadingRef` guard to `playVerse` (rapid taps during initial load no longer spawn concurrent streams)
- New `stopAudioCompletely()` helper unloads sound + cancels RAF + resets all audio refs/state. Recite mode entry calls it unconditionally so `expo-av`'s audio session is fully released before `expo-speech-recognition` claims the mic

**v2 hotfix (`74ce890`)** — Web-derived Arabic matching + play-during-load race:
- Replaced naive `normalizeArabic`/Levenshtein with web's `stripTashkeel` (full letter-variant normalization — alef variants, ta-marbuta, ya-with-hamza, presentation forms, dagger alef)
- Multi-predicate `wordMatches` (equality, substring either direction, subsequence either direction, noun-vowel-stripped, word-final ت→ه)
- `stripAlPrefix` fallback for the common iOS-drops-"ال" case
- Transcript-walking loop: scans full accumulated transcript, advances `expectedIdx` as long as matches keep landing, tracks search position via `matchedWordCountRef`
- `handlePlayPause` now gates exclusively on `isPlayingRef` and `isLoadingRef` (no React state reads in audio paths) — closes the load-completion race window

**v3 hotfix (`4b247eb`)** — Replay after natural finish + verse-boundary highlight + match logs:
- `playVerse` status callback now unloads `soundRef.current` on natural finish when not auto-advancing (next Play creates a fresh sound from verse start)
- `[currentVerse]` effect now sets highlight to word 0 in recite mode (was clearing to -1 and making it look like the highlight skipped word 0 of the new verse)
- Per-match log inside the result handler loop shows intermediate matches, not just final advance summary

**Slice 4 status: works very well in real recitation testing on iPhone (Apr 27 evening).** Remaining diagnostic console.logs in `memorization.tsx` and `recite.ts` will be removed in Slice 5 cleanup.

---

## 🔜 Phase 2D-Polish (Slice 5) — final Phase 2D slice

### Slicing strategy

Splitting into two sub-slices around the EAS rebuild boundary:

**Slice 5a (next session) — JS-only, hot-reloads over existing dev build:**

- Diagnostic log cleanup (remove `[recite] transcript:` / `tokens:` / `scan:` / `match:` / `advanced:` from `memorization.tsx` and from `stripTashkeel` in `recite.ts`)
- AsyncStorage persistence for all settings (`@react-native-async-storage/async-storage` is JS-only)
- All 8 Mushaf themes (Madinah/Ottoman/Modern/Classic × Day/Night) — palette swap via theme picker in settings sheet
- Reciter picker (currently hardcoded Husary) — port reciters table from `noor-path/components/verse-player.tsx`
- Tajweed highlighting toggle (uses `text_uthmani_tajweed` field from Quran.com v4 + CSS-class → color map ported from `noor-path/components/mushaf/bayaan/bayaan-constants.ts`)
- Long-press word for translation popup — Quran.com v4 `word_fields=translation`
- Playback rate slider — `expo-av` `setRateAsync`
- Cumulative review mode — auto-review previously memorized verses

**Slice 5b (after 5a, requires EAS rebuild):**

- Real blur via `expo-blur` (replaces opacity-0.35 fallback used by `blurMode`)
- Possibly `expo-linear-gradient` for parchment shading if `expo-blur` rebuild is happening anyway — judgment call

After Slice 5b ships, Phase 2D is complete. Phase 3 (TestFlight prep) follows.

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
- [ ] Make audio controls in `review-session` sticky / floating at bottom of screen — currently below the fold because Mushaf page image is tall (~600 px). User has to scroll to find Play / Finish & Rate buttons.
- [ ] Add ayah-bounding-box overlay in `review-session` to highlight the active chunk's ayahs on the page image (deferred from Phase 2C MVP).
- [ ] Migrate from `expo-av` to `expo-audio`/`expo-video` (deprecation warning surfaced in SDK 54). Audio path is the most-tested code in the app — its own slice, not bundled into anything.

**Estimated remaining: 3-5 weeks** (Phase 1 + 2 complete; Phase 2D 4/5 slices complete and tested)

---

## 🟡 Backlog

- Update `noor-path/src/lib/auth-client.ts` to support env-switchable baseURL
- Add Expo dev URL to `PROD_TRUSTED_ORIGINS` and `PROD_ALLOWED_ORIGINS` if RN dev needs LAN access (cookie-on-Railway works fine in production mode)
- Retire `feature/main-working-branch` once `main` becomes permanent working branch
- Delete `~/Desktop/skia-quran-test/` (no longer needed; Amiri validated, page-image strategy locked in)
- Dashboard kid name shows just first letter when truncated (cosmetic, low priority)
- Investigate continuous-listening latency on slow networks once recite mode sees more real-world use

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
- `npx expo install` in a pnpm monorepo will run `pnpm add` at the workspace root, which can corrupt nested `node_modules` if there's also an `npm install` `package-lock.json` present. Fix: commit fully to pnpm — delete `package-lock.json`, delete `noor-mobile/node_modules`, run `pnpm install` from the repo root.
- `@better-auth/expo@1.6.9` requires `expo-network` as a peer dependency. Not installed automatically by `npx expo install @better-auth/expo`.
- pnpm's `node_modules/.pnpm/` content-addressed store works fine with Metro/Expo without `node-linker=hoisted`. Don't preemptively add hoisting workarounds.
- App-wide light mode: set `"userInterfaceStyle": "light"` in `app.json` AND use explicit colors in StyleSheet (don't rely on `useColorScheme` defaults).

### From QPC font test (2026-04-27)
- QPC V1/V2 per-page fonts (e.g. QCF_P001.TTF from `nuqayah/qpc-fonts`) use Private Use Area codepoints, not real Unicode. Each word on a Mushaf page is encoded as a custom glyph at a PUA codepoint. Rendering plain Arabic with a QPC page font produces empty boxes for every word.
- Decision: NOT pursuing QPC font rendering. Sticking with PNG page images for Full Mushaf + Review. Memorization screen uses RN `<Text>` + Amiri Quran for word-level interactivity.

### From page-image streaming test (2026-04-27)
- Streaming Mushaf pages from `raw.githubusercontent.com/GovarJabbar/Quran-PNG` works on iOS via `<Image>` + `<FlatList>`. No bundling needed.
- URL: `https://raw.githubusercontent.com/GovarJabbar/Quran-PNG/master/{NNN}.png` (NNN zero-padded 001–604). Public domain Madinah Mushaf imagery.
- Page aspect ratio ~1.45:1.
- For RTL navigation use FlatList with `inverted` prop.
- First-load latency ~500ms-1s, subsequent views instant.

### Metro + pnpm requires explicit config (2026-04-27)
- When adding native dependencies, Metro with pnpm-style symlinks fails to resolve packages by default.
- Fix: `artifacts/noor-mobile/metro.config.js` must set `config.watchFolders = [workspaceRoot]` and `config.resolver.nodeModulesPaths = [projectRoot/node_modules, workspaceRoot/node_modules]`.
- DO NOT set `disableHierarchicalLookup: true` — pnpm's deeply nested `.pnpm/` requires hierarchical lookup ON to find peer deps inside `expo-router`'s internal node_modules.
- After modifying `metro.config.js`, restart with `npx expo start --clear`.

### Memorization screen architecture (2026-04-27, Phase 2D)
- One file: `app/child/[childId]/memorization.tsx`. ~1100 lines after Slice 4. Mixes view mode logic, audio state machine, recognition controller, and renderers. If it grows another 30%, split: extract `lib/memorization-audio.ts` and `lib/memorization-recite.ts`.
- Audio state lives in refs (`isPlayingRef`, `isLoadingRef`, `viewModeRef`, `currentVerseRef`, etc.) because the `expo-av` status callback closes over stale state. Every new `useState` that the audio path reads needs a parallel ref synced via a tiny effect.
- Two renderers: Ayah-by-Ayah uses `displayWordsMap.get(currentVerse)` keyed by verse number. Full Mushaf uses `pageWordsMap.get(pageNum)` with words grouped by `line_number`. Both share the same audio loop; the highlight is shown via two parallel pieces of state (`highlightedWord` for ayah mode, `highlightedPage: { verseKey, position }` for page mode).
- QDC segments are 1-indexed and skip non-word tokens (end markers). When mapping to display indexes, filter `char_type_name === "word"` first.
- Husary `qdcId` is 6. The `quranComId` field in the reciters table is null for Husary, but the QDC API returns segment timings. Don't assume null `quranComId` means no timing data — check `qdcId`.
- iOS audio session conflict: `expo-av` and `expo-speech-recognition` both want exclusive audio session. `pauseAsync()` is not enough — must fully `unloadAsync()` before recognition can claim the mic. The `stopAudioCompletely()` helper is the single cleanup point used by recite-mode entry and unmount.

### Arabic fuzzy matching for on-device speech recognition (2026-04-27, Slice 4 hotfixes)
- iOS speech recognition returns plain Arabic — no hamza variants (أإآاٱ all collapse to ا), no ta-marbuta (ة → ه), no ya-with-hamza (ئ → ي), often without "ال" prefix. Quranic Uthmani text has all of these. Without normalization, transcripts almost never match.
- The web app's `stripTashkeel` does the full normalization: dagger alef → alef, tashkeel/harakat strip, tatweel strip, presentation-form decomposition, alef-variants → bare alef, alef-maqsura → ya, ta-marbuta → ha, waw/ya-with-hamza → bare letter, hamza → drop, multi-letter mada (ا+ → ا, و+ → و, ي+ → ي).
- Multi-predicate match (any one returns true): equality, substring either direction, subsequence either direction, noun-vowel-stripped (`نو` removed) equality, word-final `ت→ه` swap. `ال` prefix stripping with ≥2-char fallback. 1-char heard tokens reject unless equal.
- iOS sends growing partial transcripts each event ("قل", "قل هو", "قل هو الله", ...). Matcher walks full transcript from `matchedWordCountRef` forward, advances `expectedIdx` while matches keep landing. `lastMatchedWordRef` prevents re-matching same heard token. `lastMatchTimeRef` debounces rapid-fire interim events for 300ms after a successful match.
- iOS recognition has a 60s session limit + warm-up gibberish at restart. Matcher must reject the gibberish ("إغلاق لا لام قاف" type artifacts). The web's predicates do this naturally — no additional filtering needed.
- Skip pause marks (`SKIP_CHARS` regex covers `\u06D6-\u06ED \u0600-\u0605 \u061B \u061E \u061F \u06DD \u06DE \u06DF`) when iterating expected words — they look like words to splitters but recognition will never produce them.
- `console.log` at every decision point is invaluable for tuning. Logs go in for hardware testing, come out before ship.

### EAS dev build (2026-04-27)
- Expo Go does not include native modules from `expo-speech-recognition`, `expo-blur`, etc. To test these on hardware you need an EAS development build via `eas build --profile development --platform ios`.
- First build requires: `eas-cli` (use `npx eas-cli@latest <cmd>` to avoid global-install permission issues), Expo account, Apple Developer login during the build, distribution certificate generation, provisioning profile generation, device registration via the Website method (NOT Developer Portal — Developer Portal only imports devices already registered through Apple's web UI).
- Apple bundle identifier must be set in `app.json` under `expo.ios.bundleIdentifier` BEFORE running `eas build`. NoorPath uses `com.mothman.noorpath`.
- iOS 16+ requires **Developer Mode** (Settings → Privacy & Security → Developer Mode → enable → restart). The toggle only appears AFTER an internal-distribution app has been installed once. Until enabled, tapping the dev app gets "Developer Mode Required" alert.
- After install + Developer Mode + restart, trust the developer profile in iPhone Settings → General → VPN & Device Management.
- Free-tier builds queue 5–25 minutes before starting; build itself takes 10–15 minutes.
- After install, run `npx expo start --dev-client` from `noor-mobile/` to start the dev server. The `--dev-client` flag is critical — without it, the dev build can't connect.
- Re-run `eas build --profile development --platform ios` only when adding new native deps or changing `app.json` plugin entries. Pure JS changes hot-reload over the existing dev build.

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
| Branches | `main` (deploy), `feature/main-working-branch` |
| Apple Developer | Approved Apr 26; Team ID `M7KJJDN537` |
| iOS bundle identifier | `com.mothman.noorpath` |
| EAS project | `@mothman123/noor-mobile` |
| Railway project | `humble-laughter` / `production` env |
| Mobile app HEAD | `4b247eb` (Phase 2D Slice 4 + 3 hotfixes; tested on hardware) |
