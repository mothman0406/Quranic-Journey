# NoorPath / Quranic Journey — Phase 2D Slice 5a Session 2 Handoff

**For: the next Claude conversation continuing this project**
**Last updated: 2026-04-27, late evening (Slice 5a Session 1 + 4 hotfixes shipped + tested; Slice 5a Session 2 is next)**

This handoff supersedes earlier handoff drafts.

---

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

---

## 2. The project

**NoorPath** is a Quran memorization/review/reading app for kids 3–18. Originally a web app at `artifacts/noor-path/` (frozen archival); now an iOS app at `artifacts/noor-mobile/` being shipped slice by slice.

### Repo
- GitHub: `https://github.com/mothman0406/Quranic-Journey`
- Local: `/Users/mothmanaurascape.ai/Desktop/Quranic-Journey/`
- Branches: `main` (deploy) and `feature/main-working-branch`. Every commit goes to both.

### Stack
- **Monorepo:** pnpm 9.15.9 (NOT 10).
- **Backend:** Express 5 + Drizzle + Neon Postgres + Better Auth, deployed at `https://workspaceapi-server-production-cc25.up.railway.app`. Live, healthy.
- **Web frontend** (`artifacts/noor-path/`): React 19 + Vite + shadcn/ui. **Frozen archival reference.** Don't edit.
- **iOS app** (`artifacts/noor-mobile/`): Expo SDK 54.0.33, Expo Router 6, RN 0.81.5. **The active build target.**
- **Apple Developer:** approved Apr 26. Team ID `M7KJJDN537`. iOS bundle identifier `com.mothman.noorpath`.
- **EAS project:** `@mothman123/noor-mobile`. First development build shipped Apr 27 evening; installed on Mohammad's registered iPhone with Developer Mode enabled.

---

## 3. Where the project is right now

**Phase 2D Slices 1–4 + Slice 5a Session 1 are shipped, hardware-tested, working very well.** Recite mode at parity with web. Multi-reciter playback works for all 7 reciters. Word tracking works for all (true QDC for Husary, fractional fallback w/ 500ms lead for others). Audio plays through iPhone silent switch. Theme + reciter pickers in settings sheet. Profile vs session settings split.

| Slice | Status | Commit | What |
|---|---|---|---|
| 2D-Core (1) | ✅ tested | `5650d9e` + `e752721` | Single-verse, Amiri, Husary word-by-word audio sync |
| 2D-Mushaf-Render (2a) | ✅ tested | `1dae113` | View mode toggle, page-level static rendering |
| 2D-Mushaf-Polish (2a-fix) | ✅ tested | `3a9307c` + tweak | Parchment chrome |
| 2D-Mushaf-Sync (2b) | ✅ tested | `ef7ae00` | Page-level word highlight, auto-advance, controls island |
| 2D-Practice (3) | ✅ tested | `e2f9be7` + `1c89b3b` + `948de29` | Settings sheet, repeat, delay, blind mode, blur mode |
| 2D-Recite (4) | ✅ tested (after 3 hotfixes) | `1f6557e` + `4100a1f` + `53675e6` + `74ce890` + `4b247eb` | On-device speech recognition |
| 2D-Polish 5a Session 1 | ✅ tested (after 4 hotfixes) | `b73ed60` + 4 hotfixes (latest at `d5d5f1f` then LEAD_MS=500) | Cleanup, AsyncStorage, 8 themes, 7 reciters, profile/session split, fractional fallback, anticipatory shift |
| **2D-Polish 5a Session 2** | 🔜 **next** | — | **Tajweed coloring + translation popup + playback rate** |
| 2D-Polish 5a Session 3 | after Session 2 | — | Cumulative review |
| 2D-Polish 5b | after Session 3 | — | Real `expo-blur` (requires EAS rebuild) |

`TODO.md` is current. Read it first.

---

## 4. The single most important file

`artifacts/noor-mobile/app/child/[childId]/memorization.tsx` — **the entire memorization product, ~1300 lines after Slice 5a Session 1**. Plus four supporting libs: `src/lib/memorization.ts`, `src/lib/quran.ts`, `src/lib/recite.ts`, `src/lib/mushaf-theme.ts`. Plus three new ones from Slice 5a: `src/lib/reciters.ts`, `src/lib/settings.ts`, and `src/lib/audio.ts` (now takes a `Reciter`).

After Slice 5a Session 2 ships it'll likely be ~1500 lines. Don't refactor preemptively. If by Session 3 it's hard to follow, extract `lib/memorization-audio.ts` and `lib/memorization-recite.ts`.

### Architectural notes (current state, post-Slice-5a-Session-1)

**Two render modes** controlled by `viewMode: "ayah" | "page"`. Toggle pills under the header.

**Audio state lives in refs.** `expo-av`'s status callback closes over stale state. Pattern:
```ts
const [foo, setFoo] = useState(...);
const fooRef = useRef(foo);
useEffect(() => { fooRef.current = foo; }, [foo]);
```

All refs as of Slice 5a: `viewModeRef`, `currentVerseRef`, `ayahEndRef`, `isPlayingRef`, `isLoadingRef`, `pendingSeekPositionRef`, `repeatCountRef`, `autoAdvanceDelayRef`, `autoplayThroughRangeRef`, `reciteModeRef`, `reciteExpectedIdxRef`, `displayWordsMapRef`, `surahNumberRef`, `matchedWordCountRef`, `lastMatchedWordRef`, `lastMatchTimeRef`, `reciterRef`, `saveTimerRef`. Plus timer/raf/sound refs.

**`handlePlayPause` reads ONLY refs.** Critical. After Slice 4 hotfix v2 the function gates exclusively on `isPlayingRef.current` and `isLoadingRef.current` to close the load-completion race window.

**`stopAudioCompletely()`** is the single audio cleanup point. Used by recite-mode entry and component unmount.

**Two highlight states.** `highlightedWord: number` (0-based, ayah mode) and `highlightedPage: { verseKey, position } | null` (1-based to match `ApiWord.position`, page mode). Both updated from the same RAF tick.

**Verse-change effect (`[currentVerse]`)** behaves differently for recite vs Husary mode. In recite mode it sets highlight to word 0. In Husary mode it clears to -1.

**Multi-reciter timing routing (Slice 5a):**
- `fetchTimingsForReciter(reciter, surah)` returns a `ChapterTimings` discriminated union:
  - `{ kind: "chapter", map: Map<verseKey, Segment[]> }` — Husary (QDC chapter-level fetch, cached)
  - `{ kind: "ondemand", fetch: (verse) => Promise<Segment[]> }` — all other reciters (per-verse v4 fetch, cached + dedup'd)
  - `{ kind: "chapter", map: new Map() }` — fallback for reciters with neither (currently none)
- `chapterTimings` state holds this union; the `[chapterTimings, surahNumber, currentVerse]` effect populates `segsRef.current`.
- Husary: synchronous lookup from chapter map.
- Others: triggers `chapterTimings.fetch(verse)` which resolves async (~500ms first time, instant from cache thereafter).

**Quran.com v4 segments are empty for non-Husary.** Verified via diagnostic logging Apr 27. The on-demand fetcher returns `[]` for these. `tick()` falls back to `Math.floor(shiftedFrac * wordCount)` where `shiftedFrac = (pos + LEAD_MS) / dur, clamped to 1`. `LEAD_MS = 500` tuned for short ayahs to match Husary's anticipatory feel. Works for short ayahs; trailing reappears on long verses (Al-Baqarah) — accepted limitation.

**iOS audio session:** `expo-av` and `expo-speech-recognition` can't both hold the session. `pauseAsync()` not enough — must `unloadAsync()`. Mandatory `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })` so audio plays through the iPhone silent switch. `setVolumeAsync(1.0)` on every Sound after `createAsync` to compensate for everyayah's wildly different mastered loudness levels.

**Auto-advance + delay, repeat count, blind mode, blur mode** — all preserved from earlier slices, behaviorally unchanged.

**Profile vs session settings (Slice 5a):**
- Profile-level (persist to AsyncStorage): `themeKey`, `reciterId`, `viewMode`. Edited via future Profile Settings page (Phase 2E).
- Session-level (reset each session): `repeatCount`, `autoAdvanceDelayMs`, `autoplayThroughRange`, `blurMode`, `blindMode`. Initialize from `DEFAULT_SESSION_SETTINGS` constants.
- Persistence currently buggy — profile settings don't survive app close. Hydrate-effect ordering or `settingsLoaded` gate timing. Low priority per user; investigate before Session 2 if quick.

### The recite matcher (`src/lib/recite.ts`)

This file is at parity with the web app. Don't tighten it without asking. Mohammad explicitly wants only loosening, never tightening.

Exports: `stripTashkeel(s)`, `SKIP_CHARS`, `wordMatches(heardNorm, expectedNorm, lastMatched)`, `stripAlPrefix(w)`, `tokenize(s)`. All carry-over from Slice 4 + hotfixes.

### The fixed controls island

Below the ScrollView. Three rows: Mode buttons (Blind, Recite), audio controls (Prev, Play, Next), Mark Complete (full width black).

### The settings sheet

Bottom modal, opened by gear icon top-right of header. Contains as of Slice 5a: repeat count stepper, auto-advance delay stepper, autoplay-through-range toggle, blur-other-verses toggle, theme picker pills (8 themes), reciter picker pills (7 reciters, last-name only).

Slice 5a Session 2 adds: tajweed toggle, playback rate slider.

---

## 5. Slice 5a Session 2 — what to ship next

In rough priority order. All JS-only; hot-reloads over the existing EAS dev build.

### 5a.S2.1 — Tajweed highlighting toggle

Quran.com v4 returns a `text_uthmani_tajweed` field that contains HTML-like tags wrapping colored sections (e.g. `<span class="madda_normal">...</span>`, `<span class="ham_wasl">...</span>`).

The CSS-class → color map is in `noor-path/src/components/mushaf/bayaan/bayaan-constants.ts` as `TAJWEED_CSS` (or wherever — search the noor-path tree).

Update `src/lib/quran.ts`:
- Add `text_uthmani_tajweed?: string` to `ApiWord` type
- Add `text_uthmani_tajweed` to `word_fields` in both `fetchSurahVerses` and `fetchVersesByPage` URLs

In `memorization.tsx`:
- Add `const [tajweedEnabled, setTajweedEnabled]` state, default `false`
- When rendering an in-scope word, if `tajweedEnabled && word.text_uthmani_tajweed`:
  - Parse the tag wrapping: extract outermost `class="..."` value
  - Look up color in a `TAJWEED_COLORS` map ported from web
  - Render the inner text with that color (RN `<Text>` color prop)
  - If parse fails, fall back to `pageText`
- Don't use `dangerouslySetInnerHTML` (web-only). Manual parse with a simple regex.

Add a tajweed toggle to the settings sheet (with the existing toggles).

### 5a.S2.2 — Long-press word for translation popup

Quran.com v4 supports word-level translation via `word_fields=translation`.

Update `src/lib/quran.ts`:
- Add `translation?: { text: string; language_name: string }` to `ApiWord`
- Add `translation` to `word_fields` in both fetchers

In `memorization.tsx`:
- Add `const [tappedWord, setTappedWord]` state for the popover
- On `onLongPress` of a word in either renderer, set the tapped word
- Render a small popover (RN doesn't have native popover — use `Modal` with `transparent` and centered content, or absolutely-positioned `View` near the word)
- Show: word's Uthmani, English translation, close button
- Close on tap outside

Long-press only — short tap stays tap-to-seek. Don't break that.

### 5a.S2.3 — Playback rate slider

`expo-av`'s `Audio.Sound.setRateAsync(rate, true /* shouldCorrectPitch */)`. Range 0.75x–1.5x in 0.05 steps. Slider in settings sheet.

In `memorization.tsx`:
- Add `const [playbackRate, setPlaybackRate]` state, default `1.0`
- Add `playbackRateRef` synced via effect
- After `Audio.Sound.createAsync` resolves in `playVerse`, call `sound.setRateAsync(playbackRateRef.current, true)`
- When `playbackRate` state changes during playback, also call `setRateAsync` on the current sound

RN Slider: use `@react-native-community/slider` (JS-only, may need `pnpm add` from inside `noor-mobile/`).

### Slicing inside Session 2

If too big for one Claude Code prompt, the natural split is:

- 5a.S2.1 (tajweed) alone — ~1 prompt, mostly bayaan port + JSX integration
- 5a.S2.2 (translations) + 5a.S2.3 (playback rate) — ~1 prompt

Recommend bundling all three if practical; split if Claude Code's context budget is tight.

### Things explicitly NOT in Session 2

- Cumulative review (Session 3)
- Real `expo-blur` (Slice 5b — requires rebuild)
- Profile Settings page (Phase 2E)
- App icon, splash screen — Phase 3
- `expo-av` → `expo-audio` migration — its own slice in Phase 3

---

## 6. Slice 5a Session 3 — cumulative review

After Mark Complete, optionally play through everything from `ayahStart` to the verse just memorized, sequentially. Most-loved feature on web for retention.

In `memorization.tsx`:
- Add `const [cumulativeReview, setCumulativeReview]` state, default `false`
- When true, after `submitMemorization` succeeds, instead of immediately showing the success alert, kick off a sequential play-through of `ayahStart..currentVerse` (use the existing autoplay-through-range machinery)
- After the cumulative pass finishes, then show the success alert

Most behaviorally complex item — interacts with auto-advance, repeat counts, and Mark Complete flow. If it's fighting the existing state machine, deferred to its own session is correct.

Add a cumulative review toggle to the settings sheet.

---

## 7. Slice 5b — after 5a Sessions 2 and 3

One thing: **real blur via `expo-blur`**. Replaces the opacity-0.35 fallback used by `blurMode`.

```
pnpm add expo-blur
```

Then `eas build --profile development --platform ios` (rebuild required). After install on iPhone, update `memorization.tsx` to render `<BlurView intensity={20} tint="light" />` (or the active theme's tint) over non-active verses while playing.

Optionally bundle in `expo-linear-gradient` for parchment shading if rebuild is happening anyway. Judgment call.

After 5b ships, Phase 2D is complete.

---

## 8. After Phase 2D

Per user (confirmed Apr 27 evening): Option A — finish Slice 5 first, then do 2E + 2F before TestFlight.

- **Phase 2E** — Dashboard polish (today's-work content on Mem/Review/Reading banners, red/orange/green surah quality colors, profile selector polish)
- **Phase 2F** — Target-setting UI (set memorization/review/reading targets by page number — backend already supports it via dashboard endpoint)
- **Then Phase 3** — TestFlight (app icon, splash, EAS production build, App Store Connect, TestFlight beta)

User also requested **deep-dive into web app's `noor-path/` for "lots of cool stuff that took a lot of work"** — to be done after Phase 2 completes. Consider during Phase 2E/2F drafting.

---

## 9. The conventions

These are stable across sessions.

### Workflow

- Claude Code prompts as markdown blocks. User pastes; reports back commit SHA + typecheck.
- **Test-then-ship.** Every slice gets tested on the EAS dev build before the next prompt is drafted.
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
- StyleSheet API (not styled-components or NativeWind)
- Color palette in non-Mushaf-mode UI: bg `#ffffff`, text `#111111`, secondary `#666666`, border `#e5e7eb`, primary `#2563eb`, danger `#dc2626`, card-bg `#f9fafb`. Mushaf-mode 8-theme palette in `src/lib/mushaf-theme.ts`.
- Card style: `borderRadius: 12`, padding `16`, `backgroundColor: "#f9fafb"`, `borderWidth: 1`, `borderColor: "#e5e7eb"`
- Header: `paddingTop: 60`, back button left, centered title, button or spacer right (60 wide)
- No state libraries. Plain `useState` + `useEffect` + `useRef`.
- No UI libraries. Plain RN components.
- API calls go through `apiFetch<T>` from `src/lib/api.ts` for the Railway backend.
- External APIs (Quran.com, QDC, GitHub raw, everyayah) use native `fetch` directly, no auth.

### Existing src/lib files

- `src/lib/api.ts` — `apiFetch<T>` typed helper, Better Auth cookie attached
- `src/lib/auth-client.ts` — Better Auth Expo client
- `src/lib/audio.ts` — `ayahAudioUrl(reciter, surah, ayah)` — takes a `Reciter`, uses `reciter.folder`
- `src/lib/mushaf.ts` — page-image URL helper for Reading mode
- `src/lib/mushaf-theme.ts` — 8-theme `THEMES` map, `ThemeKey`, `MushafTheme`, `THEME_DISPLAY_NAMES`, `DEFAULT_THEME_KEY`, `JUZ_START_PAGES`, `getJuzForPage`. Slice 5a Session 2 may add tajweed color map here or in a separate file.
- `src/lib/quran.ts` — Quran.com v4 surah/page/chapters fetch with module-level caches (Slice 5a Session 2 adds `text_uthmani_tajweed` + `translation` fields)
- `src/lib/memorization.ts` — dashboard fetch, QDC chapter timings, on-demand v4 fetcher, `fetchTimingsForReciter` router, `ChapterTimings` discriminated union, memorization POST
- `src/lib/recite.ts` — Arabic normalization + multi-predicate fuzzy match. **Don't tighten without asking.**
- `src/lib/reviews.ts` — typed review queue + submit (used by `review-session.tsx`)
- `src/lib/reciters.ts` — 7-reciter table, `Reciter` type, `RECITERS`, `findReciter`. Folder names verified against everyayah.com canonical list.
- `src/lib/settings.ts` — `ProfileSettings`, `loadProfileSettings`, `saveProfileSettings`, `DEFAULT_SESSION_SETTINGS`. Profile-level persisted; session-level constants reset each session.

### Known pitfalls

- **Metro + pnpm**: `metro.config.js` must set `watchFolders` and `nodeModulesPaths` per existing config. After native dep changes, `npx expo start --clear`.
- **`npx expo install` in pnpm monorepo** can create stray `package-lock.json` in `noor-mobile/`. If it appears, delete it and run `pnpm install` from repo root. For Slice 5a Session 2 JS-only adds, prefer `pnpm add` from inside `noor-mobile/`.
- **Cookie auth**: RN has no `document.cookie`. Existing `apiFetch` handles it.
- **Audio leaks**: always `unloadAsync()` `Audio.Sound` instances on cleanup. The `stopAudioCompletely()` helper is the single cleanup point.
- **iOS audio session**: `pauseAsync()` not enough to release for the mic. Must `unloadAsync()`. Recite-mode entry calls `stopAudioCompletely()`.
- **iOS silent switch**: `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })` is mandatory for speaker playback when mute switch is on.
- **everyayah folder names**: stale ones break audio with `AVPlayerItem -1100` (file not found). Verify against `https://www.everyayah.com/recitations_pages.html` before adding new reciters.
- **Quran.com v4 `by_ayah` segments**: returns `undefined` for non-Husary reciter IDs. The on-demand fetcher returns `[]`; `tick()` fractional fallback handles it.
- **EAS dev build for native deps**: `expo-blur` (Slice 5b), `expo-linear-gradient`, etc. require rebuild. Pure JS adds (slider, AsyncStorage, etc.) hot-reload.

### EAS Build basics

- CLI: `npx eas-cli@latest <cmd>`
- Build: `eas build --profile development --platform ios`
- After build, install via QR code on the build's "Install" page; trust developer profile in iPhone Settings → General → VPN & Device Management.
- iOS 16+ requires Developer Mode (toggle only appears AFTER an internal-distribution app has been installed once).
- Run dev server: `npx expo start --dev-client` (the `--dev-client` flag is critical).
- New native deps require rebuild. JS changes hot-reload.

---

## 10. What to do first in the next session

1. **Read `TODO.md` and this handoff.** This one supersedes earlier handoffs.
2. **Confirm with Mohammad whether to proceed with full Session 2 (tajweed + translations + rate) or split.** The §5 slicing recommendation is the starting offer.
3. **Start with tajweed (5a.S2.1).** Largest visual win. Read `noor-path` for the color map first.
4. **Then ship 5a.S2.2 + 5a.S2.3 as one prompt or two.** Mohammad's call.
5. **Test on hardware after each Claude Code commit.** Don't draft the next prompt until verified.
6. **If persistence still bothers Mohammad, a quick investigation** before Session 2: read the `loadProfileSettings` hydrate effect and the persist effect's `settingsLoaded` gate. Likely an ordering issue. Probably one short fix.
7. **Same Claude Code prompt pattern as throughout this project.**

---

## 11. The one important reminder

The whole reason this app exists is so Mohammad's kids can use it to memorize Quran with him. The app already works for that purpose — kid sits down with iPhone, opens NoorPath, picks themself, hits Memorization, sees today's verses, hits Play, follows their chosen reciter (Husary, Afasy, Sudais, Basit, Minshawi, Ghamdi, or Ajmi) word by word in the Madinah-themed Mushaf, marks complete, and it lands in Review. They can recite back to the app and get word-by-word feedback. They can switch themes. That's done.

Slice 5a Session 2 adds tajweed coloring (so kids can see the rules visually), translations (so they know what they're saying), and playback rate (so they can slow Husary to 0.75x). Session 3 adds cumulative review (the retention secret weapon). 5b adds real blur for cleaner blur mode.

Phase 3 takes it through TestFlight to the App Store.

Good luck.
