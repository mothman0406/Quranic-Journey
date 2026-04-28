# NoorPath / Quranic Journey — Status & Next Steps

_Last updated: April 27, 2026 (Phase 2D Slice 5a Session 1 + 4 hotfixes shipped + tested; Slice 5a Session 2 next)_

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
- First EAS development build shipped Apr 27 2026 — installed on registered iPhone, used to validate Slice 4 + Slice 5a Session 1

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

## ✅ DONE — Phase 2D — Memorization mode (Slices 1–4 + Slice 5a Session 1)

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
- **5a v5 (latest)** — Bumped `LEAD_MS = 500` after 300ms still trailed Afasy. Confirmed working for short ayahs. Lag may reappear on longer verses (Al-Baqarah, Ayat al-Kursi) — accepted limitation; root cause is the equal-time-per-word approximation, not leading silence.

**Slice 5a Session 1 status: works very well in real testing on iPhone.** All 7 reciters play; word tracking works for all (true QDC for Husary, fractional fallback for others); audio plays through iPhone silent switch; volumes normalized; theme + reciter pickers in settings sheet; profile vs session settings split.

---

## 🔜 Phase 2D-Polish Slice 5a Session 2 — content polish (next)

Still JS-only, hot-reloads over existing dev build.

- **Tajweed highlighting toggle** — Quran.com v4 `text_uthmani_tajweed` field + CSS-class color map ported from `noor-path/components/mushaf/bayaan/bayaan-constants.ts`. Parse the inline tags into RN-compatible color spans (no `dangerouslySetInnerHTML`).
- **Long-press word for translation popup** — Quran.com v4 `word_fields=translation`. RN Modal or absolute-positioned View. Long-press only; short tap stays tap-to-seek.
- **Playback rate slider** — `expo-av` `setRateAsync(rate, true)`. Range 0.75x–1.5x in 0.05 steps. Likely needs `@react-native-community/slider` (JS-only).

## 🔜 Phase 2D-Polish Slice 5a Session 3 — cumulative review

The most behaviorally complex Session — interacts with auto-advance, repeat counts, and Mark Complete flow.

- **Cumulative review mode** — after Mark Complete, optionally play through `ayahStart..currentVerse` sequentially before showing the success alert. Reuse existing autoplay-through-range machinery. Settings toggle.

## 🔜 Phase 2D-Polish Slice 5b — `expo-blur` (requires EAS rebuild)

- Real blur via `expo-blur` (replaces opacity-0.35 fallback used by `blurMode`)
- Possibly `expo-linear-gradient` for parchment shading if rebuild is happening anyway — judgment call

After Slice 5b ships, Phase 2D is complete.

---

## 🔜 Phase 2E — dashboard polish & today's-work content

After Phase 2D, before TestFlight. User-requested:

- Today's-work content on the three dashboard cards (Memorization / Review / Reading banners — show what's queued)
- Red/orange/green surah quality coloring on review queue
- Profile selector polish

## 🔜 Phase 2F — target-setting UI

- UI to set memorization/review/reading targets by page number per child. Backend already supports it via dashboard endpoint.

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

- **Persistence bug** — Slice 5a Session 1 split profile vs session settings, but profile-level still doesn't persist across app close. User flagged as low priority. Likely a hydrate-effect ordering issue or `settingsLoaded` gate timing problem in `memorization.tsx`. Investigate before Session 2 if quick, defer otherwise.
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

### Memorization screen architecture (2026-04-27, Phase 2D + Slice 5a Session 1)
- One file: `app/child/[childId]/memorization.tsx`. ~1300 lines after Slice 5a Session 1.
- Audio state lives in refs because `expo-av` status callback closes over stale state. Pattern: `const fooRef = useRef(foo); useEffect(() => { fooRef.current = foo; }, [foo]);`
- All audio refs as of Slice 5a: `viewModeRef`, `currentVerseRef`, `ayahEndRef`, `isPlayingRef`, `isLoadingRef`, `pendingSeekPositionRef`, `repeatCountRef`, `autoAdvanceDelayRef`, `autoplayThroughRangeRef`, `reciteModeRef`, `reciteExpectedIdxRef`, `displayWordsMapRef`, `surahNumberRef`, `matchedWordCountRef`, `lastMatchedWordRef`, `lastMatchTimeRef`, `reciterRef`, `saveTimerRef`. Plus timer/raf/sound refs.
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

### Profile vs session settings (2026-04-27, Slice 5a Session 1)
- `src/lib/settings.ts` exports `loadProfileSettings`/`saveProfileSettings` (themeKey, reciterId, viewMode — persisted to AsyncStorage) and `DEFAULT_SESSION_SETTINGS` constants (repeatCount, autoAdvanceDelayMs, autoplayThroughRange, blurMode, blindMode — reset each session).
- Profile-level edited via future Profile Settings page (Phase 2E). For now, defaults hardcoded.
- Persistence currently buggy — profile settings don't survive app close. Likely hydrate-effect ordering. Low priority per user.

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
| Branches | `main` (deploy), `feature/main-working-branch` |
| Apple Developer | Approved Apr 26; Team ID `M7KJJDN537` |
| iOS bundle identifier | `com.mothman.noorpath` |
| EAS project | `@mothman123/noor-mobile` |
| Railway project | `humble-laughter` / `production` env |
| Mobile app HEAD | Slice 5a Session 1 latest hotfix (LEAD_MS=500) |
