# NoorPath / Quranic Journey — Status & Next Steps

_Last updated: April 27, 2026 (after rendering architecture decision)_

---

## ✅ DONE — Infrastructure

- Apple Developer Program approved + App Store Connect access granted
- Backend deployed: <https://workspaceapi-server-production-cc25.up.railway.app>
- `BETTER_AUTH_URL` set to production URL
- `PROD_ALLOWED_ORIGINS` + `PROD_TRUSTED_ORIGINS` configured for CORS / Better Auth
- `/api/healthz` returns `{"status":"ok"}` (public, mounted above `requireAuth`)
- Three secrets rotated (Neon password, Better Auth secret, Hugging Face token)
- Both branches synced at `da6a09f`
- Typecheck baseline clean

---

## ✅ DONE — Rendering architecture decided

We tested three approaches in `~/Desktop/skia-quran-test/` and chose a hybrid:

| Context | Renderer | Reason |
|---|---|---|
| **Full Mushaf reader** | Page images (604 PNGs) | Authentic, pixel-perfect, zero rendering code |
| **Review screen** | RN `<Text>` + QCF font, ayah-by-ayah | Simple single-verse display, no layout needed |
| **Memorization mode** | RN `<Text>` per word + audio-synced highlight | Need word-level granularity for the "follow along while audio plays" feature |

**Why not Skia:** Skia's basic `<Text>` doesn't shape Arabic correctly (renders disconnected isolated glyphs LTR — verified on iPhone). Using Skia's Paragraph API for proper shaping would be 4-8 weeks of building a custom renderer, not justified by the use cases we actually need.

**Why not full RN-Text mushaf pages:** The continuous-justified mushaf-page mockup we built worked, but tuning the layout to match a real Mushaf line-by-line is real polish work. Page images give us pixel-perfect for free.

**AGPL-3.0 question is now moot.** We're not using Bayaan's renderer code. We're using the same font files (which they don't author), the U+06DD ayah-end character (Unicode standard, not their invention), and one architectural idea (use the Quran.com word-level API for memorization tracking, which is publicly documented). Architecture isn't copyrightable.

**Throwaway test project at `~/Desktop/skia-quran-test/`** can be archived or deleted — it served its purpose.

---

## 🔜 NEXT — Phase 1: Foundation + Auth

Get a functional skeleton mobile app hitting the deployed Railway backend.

### Phase 1A — Monorepo setup + auth (1-2 sessions)

- [ ] Create `artifacts/noor-mobile/` in the monorepo
- [ ] Initialize Expo (managed) + TypeScript + Expo Router
- [ ] Stack:
  - Expo Router for navigation
  - TanStack Query (already used in web)
  - Zustand for client state
  - Better Auth client (already used in web)
  - `react-native-mmkv` for persistent local storage
  - `expo-font` for QCF fonts (digital-khatt, quran-common, surah-name-qcf)
  - `expo-av` for audio playback
- [ ] Wire up workspace package imports (`lib/api-spec`, `lib/api-zod` — share types with backend)
- [ ] Sign-in screen (email/password) hitting Railway URL
- [ ] Add Expo dev URL to backend's `PROD_TRUSTED_ORIGINS` Railway env var
- [ ] Child profile selector screen
- [ ] Empty Dashboard skeleton (cards: memorization, review, reading)

### Phase 1B — Easy ports (1-2 sessions)

These screens are mostly forms and lists — no fancy rendering:
- [ ] Settings screen
- [ ] Du'aas list screen
- [ ] Stories list screen
- [ ] Achievements / progress screen

---

## 🔜 NEXT — Phase 2: The three rendering modes

### Phase 2A — Full Mushaf (page images)

- [ ] Source 604 page PNGs of the Madinah 15-line Mushaf
  - Likely from Quran.com's image CDN or King Fahd Complex
  - Decide on resolution: target ~80-100 MB total bundle, may need to optimize
- [ ] Decide bundling strategy:
  - Option 1: ship in app bundle (simplest, cellular download warning if >200MB)
  - Option 2: download on first launch (smaller initial bundle, requires connectivity)
- [ ] Mushaf reader screen — `<Image>` + horizontal swipe between pages
- [ ] Page bookmarks (already in DB schema as `readingLastPage`)
- [ ] Reading progress integration (existing `/reading-progress` endpoint)

### Phase 2B — Review (ayah-by-ayah)

- [ ] Review session screen — single verse display
- [ ] QCF font in centered prominent style
- [ ] Audio playback for the verse
- [ ] Quality rating UI (1-5) → existing `/reviews` POST endpoint
- [ ] Already have all backend logic from web app

### Phase 2C — Memorization (word-by-word with audio sync)

This is the most interesting screen:
- [ ] Use existing `fetchVersesFromApi` data (returns word-level array)
- [ ] Render each word as a separate `<Text>` with onPress
- [ ] Audio playback (everyayah.com URLs, already used in web)
- [ ] Track current word index in component state
- [ ] Apply highlight style to currently-playing word (background pill, color shift)
- [ ] Tap a word to jump audio to that word
- [ ] Long-press a word for translation/meaning
- [ ] Mark surah-as-memorized → existing `/memorization` POST endpoint

---

## 🔜 NEXT — Phase 3: Polish & TestFlight

- [ ] Push notifications for review reminders (Expo Notifications)
- [ ] Native gestures + haptics
- [ ] App icon, splash screen, launch screen
- [ ] App Store Connect setup (only now, when there's an actual app to upload):
  - Create app record, bundle ID, signing certificates, provisioning profiles
  - App Privacy questionnaire
  - Age rating (this app is 4+)
  - Export compliance
  - Screenshots for store listing
- [ ] EAS Build (Expo's build service) → first .ipa
- [ ] TestFlight beta with wife + a few trusted users
- [ ] Bug fixes from beta feedback
- [ ] App Store submission

**Estimated total: 6-10 weeks of focused work** from now to App Store live.

---

## 🟡 Backlog — small follow-ups

- Update `noor-path/src/lib/auth-client.ts` to support env-switchable baseURL
  (so web frontend can optionally hit Railway URL, not just localhost)
- Once RN dev needs LAN access from device, add Expo dev URL to
  `PROD_TRUSTED_ORIGINS` and `PROD_ALLOWED_ORIGINS` Railway vars
- Eventually retire `feature/main-working-branch` once `main` becomes the
  permanent working branch (currently kept in sync)
- Delete `~/Desktop/skia-quran-test/` once Phase 1 is set up

---

## 📚 Knowledge banked

### From infra session
- pnpm 10's `pnpm-workspace.yaml` overrides syntax doesn't work with pnpm 9.
  Overrides must live in root `package.json` under `"pnpm": { "overrides": ... }`.
- Railway/Railpack reads `packageManager` field for Corepack activation but
  ignores it for version selection.
- Railway's "Wait for CI" toggle silently blocks all webhook-triggered deploys
  when no GitHub Actions are configured.
- Railway's "Redeploy" replays a row's specific commit + config, NOT branch HEAD.
- Railway Settings input fields can silently appear filled (placeholder text)
  while actually being empty. Always verify by clicking the field.
- Native fetch from React Native sends no `Origin` header — existing CORS
  `if (!origin)` branch already handles this correctly.

### From rendering test
- React Native's `<Text>` shapes Arabic correctly via the OS text engine when
  given the QCF font. No HarfBuzz / Skia needed for ayah-level display.
- Skia's `<Text>` does NOT shape Arabic — renders isolated glyphs LTR.
- Reanimated v4 was split: needs `react-native-worklets` as separate peer dep
  (added in Expo SDK 54, Sep 2025).
- `babel-preset-expo` auto-configures the Reanimated plugin when both packages
  are installed; manual plugin entry in babel.config.js is unnecessary and
  can cause errors on Expo SDK 54+.
- Expo Go bundles Skia, Reanimated, Worklets — works for testing; for production
  EAS Build will compile native code with Xcode (which we'll need full Xcode for).

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
| Branches | `main` (deploy), `feature/main-working-branch` (kept in sync) |
| Apple Developer | Approved Apr 26 |
| Railway project | `humble-laughter` / `production` env |
| Skia test project | `~/Desktop/skia-quran-test/` (delete after Phase 1) |
