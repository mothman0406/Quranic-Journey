# NoorPath / Quranic Journey — Status & Next Steps

_Last updated: April 27, 2026 (after Phase 1 complete)_

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

---

## ✅ DONE — Rendering architecture decided

| Context | Renderer | Reason |
|---|---|---|
| **Full Mushaf reader** | Page images + ayah bounding boxes | Authentic, pixel-perfect, zero rendering code |
| **Review** | Page images + highlight overlay on reviewed ayah range | Same visual the child memorized from; no layout work |
| **Memorization mode** | RN `<Text>` per word + audio-synced highlight | Word-level granularity for follow-along audio |

**Two renderers, three contexts.** Page images do double duty for Full Mushaf and Review (the latter just adds an overlay highlighting the in-scope ayahs). Memorization is the only screen that needs custom text rendering, and that's where word-level interactivity actually matters.

**Why pages images for Review (not RN Text):** the child memorizes from a specific visual layout. Testing them on a different layout (different line breaks, different positions) would hurt recall. Page images keep the visual identical to the source they memorized from.

**Why not Skia anywhere:** Skia's basic `<Text>` doesn't shape Arabic correctly (renders disconnected isolated glyphs LTR — verified on iPhone). Skia's Paragraph API would shape correctly but require 4-8 weeks of building a custom renderer. Not justified.

**AGPL-3.0 question is moot.** Not using Bayaan's renderer code. Page images are public domain (King Fahd Complex publishes the Madinah Mushaf). Memorization screen uses only standard Quran.com word-level API + the QCF fonts.

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
- ✅ Light mode forced (`userInterfaceStyle: "light"` in app.json — explicit colors throughout)

---

## ✅ DONE — Phase 1B: Child profile selector + dashboard skeleton

Commits: `ba10fc9`, `de6a2ae`

- ✅ Boilerplate Expo Router template content cleaned up (no more Explore tab, modal, themed components)
- ✅ Collapsed `(tabs)` group — no bottom tabs in skeleton phase
- ✅ `src/lib/api.ts` — typed `apiFetch<T>` helper using native `fetch`
- ✅ Session cookie attached to API requests via `authClient.getCookie()` (Better Auth Expo pattern — `credentials: "omit"` + manual `Cookie` header, since RN has no `document.cookie`)
- ✅ Child profile selector at `app/index.tsx` — fetches GET `/api/children`, renders cards with avatar emoji + name + age group
- ✅ Dashboard skeleton at `app/child/[childId].tsx` — three placeholder cards (Memorization, Review, Reading), back button works
- ✅ All 8 children load correctly on iPhone
- ✅ Typecheck clean

---

## 🔜 NEXT — Phase 1C (optional cleanup): Easy ports

Low-priority, mostly forms and lists. Can be skipped to jump straight to Phase 2.

- [ ] Settings screen
- [ ] Du'aas list screen
- [ ] Stories list screen
- [ ] Achievements / progress screen

---

## 🔜 NEXT — Phase 2: Page-image renderer + Review + Full Mushaf

### Phase 2A — Page image foundation (shared by Full Mushaf + Review)

**Status: ✅ DONE. Validated and shipped in Phase 2B (commit 4432f21).**

- [ ] Source 604 PNGs of Madinah 15-line Mushaf
  - First check Quran.com's image API (likely the easiest path)
  - Fallback: download from King Fahd Complex
  - Decide resolution: target ~80-100 MB total at retina, may downscale
- [ ] Source ayah bounding-box data
  - Quran.com v4 endpoint: `/quran/verses/by_page/{page}` returns each verse's position metadata for the standard 15-line layout
  - Or pre-generated JSON file if there's a public dataset (cleaner to ship as one file)
  - Total size: ~500 KB JSON for all 6,236 verses
- [ ] Decide bundling strategy:
  - Option 1: ship images in app bundle (simplest, cellular DL warning if >200MB)
  - Option 2: download on first launch (smaller initial bundle)
- [ ] Build a reusable `<MushafPage>` component:
  - Props: `pageNumber`, `highlightedAyahs?: { surahId, ayahStart, ayahEnd }`
  - Renders the page image + optional highlight overlay using ayah boxes
  - Used by both Full Mushaf reader and Review screen

### Phase 2B — Full Mushaf reader

**Status: ✅ DONE (commit 4432f21). Reading card on dashboard navigates
to a working Mushaf reader. 604 pages stream from raw.githubusercontent.com,
RTL paging via FlatList inverted prop, jump buttons (1/50/300/604) work,
manual Save Page button, 2s debounced auto-save on swipe, last-page-read
persists per child via POST /api/children/:childId/reading-progress and
restored from GET /api/children/:childId/dashboard's readingGoal.lastPage
on screen mount. Verified end-to-end on iPhone hardware.**

Items still pending in this section (not blocking — Phase 2 polish):

- [ ] Mushaf reader screen — horizontal pager between pages
- [ ] Page bookmarks (existing DB schema: `readingLastPage`)
- [ ] Reading progress integration (existing `/reading-progress` endpoint)
- [ ] Long-press a page for "go to page" / "go to surah" jump menu

### Phase 2C — Review screen

**Status: ✅ DONE (commit bf8cb9a + metro.config.js fix). Review queue
loads, surah review session shows mushaf page image + audio playback +
"Finish & Rate" with 0-5 quality rating modal, submit hits SM-2 backend
and updates schedule. Verified end-to-end on iPhone.**

- [ ] Review session screen showing the active ayah range as a `<MushafPage>` with highlight overlay
- [ ] Audio playback for the in-scope verses (everyayah.com)
- [ ] Quality rating UI (1-5) → existing `/reviews` POST endpoint
- [ ] When the chunk spans multiple pages, paginate within the review screen

### Phase 2D — Memorization mode (the interactive one)

This is the only screen that needs custom text rendering:
- [ ] Use existing `fetchVersesFromApi` data (word-level array from Quran.com v4)
- [ ] Render each word as separate `<Text>` with `onPress`, in QCF font
- [ ] Load QCF fonts via `expo-font` (`digital-khatt.otf`, `quran-common.ttf`, `surah-name-qcf.ttf` — already in `noor-path/public/fonts/bayaan/`)
- [ ] Audio playback (everyayah.com URLs, install `expo-av`)
- [ ] Track current word index in component state during audio playback
- [ ] Apply highlight style to currently-playing word
- [ ] Tap a word to jump audio to that word
- [ ] Long-press a word for translation/meaning
- [ ] Mark surah memorized → existing `/memorization` POST endpoint

---

## 🔜 NEXT — Phase 3: Polish & TestFlight

- [ ] Push notifications for review reminders (Expo Notifications)
- [ ] Native gestures + haptics
- [ ] App icon, splash screen, launch screen
- [ ] App Store Connect setup (only when there's an actual app to upload)
- [ ] EAS Build → first .ipa
- [ ] TestFlight beta with wife + trusted users
- [ ] Bug fixes from beta feedback
- [ ] App Store submission
- [ ] Make audio controls in review-session sticky / floating at bottom of
  screen — currently below the fold because Mushaf page image is tall
  (~600px). User has to scroll to find Play / Finish & Rate buttons.
- [ ] Add ayah-bounding-box overlay in review-session to highlight the active
  chunk's ayahs on the page image (deferred from Phase 2C MVP).

**Estimated remaining: 4-7 weeks** (Phase 1 complete, ~25% of total work done)

---

## 🟡 Backlog

- Update `noor-path/src/lib/auth-client.ts` to support env-switchable baseURL
- Add Expo dev URL to `PROD_TRUSTED_ORIGINS` and `PROD_ALLOWED_ORIGINS` when RN dev needs LAN access (only if needed; cookie-on-Railway works fine in production mode as proven today)
- Retire `feature/main-working-branch` once `main` becomes permanent working branch
- Delete `~/Desktop/skia-quran-test/` (no longer needed; Phase 1 confirmed page-image strategy works without further Skia experiments)

---

## 📚 Knowledge banked

### From infra session
- pnpm 10's `pnpm-workspace.yaml` overrides syntax doesn't work with pnpm 9. Use root `package.json`'s `pnpm.overrides` for compat.
- Railway/Railpack reads `packageManager` field for Corepack activation but ignores it for version selection.
- Railway's "Wait for CI" toggle silently blocks all webhook-triggered deploys when no GitHub Actions are configured.
- Railway's "Redeploy" replays a row's specific commit + config, NOT branch HEAD.
- Railway Settings input fields can silently appear filled (placeholder text) while actually being empty.
- Native fetch from RN sends no `Origin` header — existing CORS `if (!origin)` branch handles it.

### From rendering test
- RN's `<Text>` shapes Arabic correctly via the OS text engine when given the QCF font. No HarfBuzz/Skia needed for ayah-level display.
- Skia's basic `<Text>` does NOT shape Arabic — renders isolated glyphs LTR.
- Reanimated v4 was split: needs `react-native-worklets` as separate peer dep (added in Expo SDK 54, Sep 2025).
- `babel-preset-expo` auto-configures the Reanimated plugin when both packages are installed; manual plugin entry can cause errors on Expo SDK 54+.
- Expo Go bundles Skia/Reanimated/Worklets for testing; production needs EAS Build (full Xcode required).

### From Phase 1 mobile app setup
- React Native has no `document.cookie`. `credentials: "include"` in `fetch` does nothing. Better Auth Expo pattern: `authClient.getCookie()` returns the cookie string from SecureStore, which must be manually added as `Cookie` header. With manual `Cookie` header, set `credentials: "omit"` (not "include") to avoid conflicts.
- `npx expo install` in a pnpm monorepo will run `pnpm add` at the workspace root, which can corrupt nested `node_modules` if there's also an `npm install` `package-lock.json` present. Fix: commit fully to pnpm — delete `package-lock.json`, delete `noor-mobile/node_modules`, run `pnpm install` from the repo root.
- `@better-auth/expo@1.6.9` requires `expo-network` as a peer dependency. Not installed automatically by `npx expo install @better-auth/expo`. Must add separately.
- pnpm's `node_modules/.pnpm/` content-addressed store works fine with Metro/Expo without `node-linker=hoisted`. Don't preemptively add hoisting workarounds.
- App-wide light mode: set `"userInterfaceStyle": "light"` in `app.json` AND use explicit colors in StyleSheet (don't rely on `useColorScheme` defaults). Belt-and-suspenders.

### From QPC font test (2026-04-27)
- QPC V1/V2 per-page fonts (e.g. QCF_P001.TTF from `nuqayah/qpc-fonts`) are
  NOT standard Arabic-text fonts with ligature substitution. They use
  Private Use Area codepoints — each word on a Mushaf page is encoded as a
  custom glyph at a PUA codepoint. Rendering plain Arabic with a QPC page
  font produces empty boxes for every word.
- To use QPC fonts for Mushaf rendering you'd need a per-page lookup table
  mapping ayah verses to their PUA codepoint sequences for that page. The
  `qcf_quran` Flutter package bundles this; raw data not easily downloadable.
- Decision: NOT pursuing QPC font rendering. Sticking with PNG page images
  for Full Mushaf + Review. Memorization screen uses RN <Text> + Bayaan QCF
  fonts (which DO use real Unicode and DO shape correctly) for word-level
  interactivity.

### From page-image streaming test (2026-04-27)
- Streaming Mushaf pages from `raw.githubusercontent.com/GovarJabbar/Quran-PNG`
  works perfectly on iOS via `<Image>` + `<FlatList>`. No bundling needed.
- URL pattern: `https://raw.githubusercontent.com/GovarJabbar/Quran-PNG/master/{NNN}.png`
  where NNN is zero-padded page number (001-604).
- Source repo is the static output of `quran/quran.com-images` — same code
  Quran.com uses for their site. Public domain Madinah Mushaf imagery.
- Page aspect ratio ~1.45:1 (taller than wide, matching physical Mushaf).
- For RTL Mushaf navigation (swipe left = next page), use FlatList with
  `inverted` prop set to true. Pages 1-N data, automatic RTL math.
- For programmatic page jumps, use FlatList ref + scrollToIndex({index: page-1}).
- First-load latency for an uncached page is ~500ms-1s. Subsequent views of
  the same page are instant (RN's <Image> caches automatically).
- For Phase 2 production: keep streaming, no need to bundle. Add a small
  in-app message on first launch explaining "first browse needs internet".

### Metro + pnpm requires explicit config (2026-04-27)
- When adding native dependencies (e.g. expo-av) to noor-mobile, Metro
  bundler with pnpm-style symlinks fails to resolve packages by default.
- Fix: artifacts/noor-mobile/metro.config.js must set:
    config.watchFolders = [workspaceRoot]
    config.resolver.nodeModulesPaths = [
      path.resolve(projectRoot, "node_modules"),
      path.resolve(workspaceRoot, "node_modules"),
    ]
  DO NOT set disableHierarchicalLookup: true — pnpm's deeply nested
  .pnpm/ structure requires hierarchical lookup ON to find peer deps
  like @expo/metro-runtime that live inside expo-router's internal
  node_modules subtree.
- After modifying metro.config.js, always restart with `npx expo start
  --clear` to rebuild Metro's cache.

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
| Apple Developer | Approved Apr 26 |
| Railway project | `humble-laughter` / `production` env |
| Mobile app HEAD | `de6a2ae` (Phase 1 complete) |
