# NoorPath / Quranic Journey — Status & Next Steps

_Last updated: April 27, 2026 (after rendering architecture decision v2)_

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

## 🔜 NEXT — Phase 1: Foundation + Auth

### Phase 1A — Monorepo setup + auth (1-2 sessions)

- [ ] Create `artifacts/noor-mobile/` in the monorepo
- [ ] Initialize Expo (managed) + TypeScript + Expo Router
- [ ] Stack:
  - Expo Router for navigation
  - TanStack Query (already used in web)
  - Zustand for client state
  - Better Auth client (already used in web)
  - `react-native-mmkv` for persistent local storage
  - `expo-font` for QCF fonts (only needed in memorization screen, but loaded globally)
  - `expo-av` for audio playback
  - `expo-image` for fast page-image rendering with caching
- [ ] Wire up workspace package imports (`lib/api-spec`, `lib/api-zod`)
- [ ] Sign-in screen (email/password) hitting Railway URL
- [ ] Add Expo dev URL to backend's `PROD_TRUSTED_ORIGINS` Railway env var
- [ ] Child profile selector screen
- [ ] Empty Dashboard skeleton (cards: memorization, review, reading)

### Phase 1B — Easy ports (1-2 sessions)

- [ ] Settings screen
- [ ] Du'aas list screen
- [ ] Stories list screen
- [ ] Achievements / progress screen

---

## 🔜 NEXT — Phase 2: Page-image renderer + Review + Full Mushaf

### Phase 2A — Page image foundation (shared by Full Mushaf + Review)

- [ ] Source 604 PNGs of Madinah 15-line Mushaf
  - First check Quran.com's image API: `https://api.quran.com/api/v4/quran/image-by-page/N` or similar — they may host them at a known URL
  - Fallback: download from King Fahd Complex
  - Decide resolution: target ~80-100 MB total at retina, may downscale
- [ ] Source ayah bounding-box data
  - Quran.com v4 endpoint: `/quran/verses/by_page/{page}` returns each verse's `text_uthmani` plus position metadata for the standard 15-line layout
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

- [ ] Mushaf reader screen — horizontal pager between pages
- [ ] Page bookmarks (existing DB schema: `readingLastPage`)
- [ ] Reading progress integration (existing `/reading-progress` endpoint)
- [ ] Long-press a page for "go to page" / "go to surah" jump menu

### Phase 2C — Review screen

- [ ] Review session screen showing the active ayah range as a `<MushafPage>` with highlight overlay
- [ ] Audio playback for the in-scope verses (everyayah.com)
- [ ] Quality rating UI (1-5) → existing `/reviews` POST endpoint
- [ ] When the chunk spans multiple pages, paginate within the review screen

### Phase 2D — Memorization mode (the interactive one)

This is the only screen that needs custom text rendering:
- [ ] Use existing `fetchVersesFromApi` data (word-level array from Quran.com v4)
- [ ] Render each word as separate `<Text>` with `onPress`, in QCF font
- [ ] Audio playback (everyayah.com URLs)
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

**Estimated total: 5-8 weeks** (down from 6-10 — eliminating one renderer saves real time)

---

## 🟡 Backlog

- Update `noor-path/src/lib/auth-client.ts` to support env-switchable baseURL
- Add Expo dev URL to `PROD_TRUSTED_ORIGINS` and `PROD_ALLOWED_ORIGINS` when RN dev needs LAN access
- Retire `feature/main-working-branch` once `main` becomes permanent working branch
- Delete `~/Desktop/skia-quran-test/` once Phase 1 is set up

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
| Skia test project | `~/Desktop/skia-quran-test/` (delete after Phase 1) |
