# NoorPath / Quranic Journey — Phase 2D Slice 5 Handoff

**For: the next Claude conversation continuing this project**
**Last updated: 2026-04-27, late evening (Slice 4 + 3 hotfixes shipped + tested; Slice 5a is next)**

This handoff supersedes earlier handoff drafts. Where they conflict, this one wins.

---

## 1. The user (Mohammad)

You're working with a self-taught builder doing this project on weekends and evenings. Father of multiple kids he wants to teach Quran memorization to. Sharp product instincts, fast on the keyboard, treats Claude as a peer not a teacher. Things that have stayed true across many sessions:

- He hates UI work. Wants things to "be there by default."
- He prefers Claude Code (the agentic CLI) make all code changes. The pattern that works: I draft a precise prompt as a markdown block; he pastes it into a fresh Claude Code session at the repo root; Claude Code reports SHA + typecheck; we iterate. Direct filesystem edits from the chat assistant are reserved for tiny things (config files, doc updates, manual git commits).
- One terminal command at a time, not walls.
- "Let's keep going" / "next" / "good" means it. Don't suggest stopping.
- He pushes back hard when scope is wrong. Take it seriously, but don't preemptively scope down — ship the right slice, and offer the slicing plan transparently.
- Test-then-ship. Every slice gets tested on Expo (or now on the EAS dev build) before the next prompt is drafted. Don't skip ahead.
- He's fine being told something is hard or that a tradeoff exists. Don't sandbag.
- **Critical convention: only ever LOOSEN matching/acceptance, never tighten without asking.** This came up explicitly during Slice 4 hotfix work. The recite mode matcher is at parity with the web app and works well in real testing. Don't make it stricter.

---

## 2. The project

**NoorPath** is a Quran memorization/review/reading app for kids 3–18. Originally a web app at `artifacts/noor-path/` (frozen archival); now an iOS app at `artifacts/noor-mobile/` being shipped slice by slice.

### Repo
- GitHub: `https://github.com/mothman0406/Quranic-Journey`
- Local: `/Users/mothmanaurascape.ai/Desktop/Quranic-Journey/`
- Branches: `main` (deploy) and `feature/main-working-branch` (legacy safety branch). Every commit goes to both.

### Stack
- **Monorepo:** pnpm 9.15.9 (NOT 10).
- **Backend:** Express 5 + Drizzle + Neon Postgres + Better Auth, deployed at `https://workspaceapi-server-production-cc25.up.railway.app`. Live, healthy.
- **Web frontend** (`artifacts/noor-path/`): React 19 + Vite + shadcn/ui. **Frozen archival reference.** Don't edit.
- **iOS app** (`artifacts/noor-mobile/`): Expo SDK 54.0.33, Expo Router 6, RN 0.81.5. **The active build target.**
- **Apple Developer:** approved Apr 26. Team ID `M7KJJDN537`. iOS bundle identifier `com.mothman.noorpath`.
- **EAS project:** `@mothman123/noor-mobile`. First development build shipped Apr 27 evening; installed on Mohammad's registered iPhone with Developer Mode enabled.

---

## 3. Where the project is right now

**Phase 2D Slices 1–4 are shipped, hardware-tested, and working very well.** Slice 4 (recite mode) has had 3 follow-up hotfixes addressing iOS-specific issues that surfaced only on real hardware. The recite mode now correctly handles iOS speech recognition's quirks (no hamza variants, dropped "ال" prefix, growing partial transcripts, audio session conflicts).

**Slice 5 (Polish) is the next and final Phase 2D slice.** It's split into 5a (JS-only, no rebuild) and 5b (`expo-blur`, requires rebuild).

| Slice | Status | Commit | What |
|---|---|---|---|
| 2D-Core (1) | ✅ tested | `5650d9e` + `e752721` | Single-verse view, Amiri font, Husary word-by-word audio sync, tap-to-seek, Mark Complete |
| 2D-Mushaf-Render (2a) | ✅ tested | `1dae113` | View mode toggle, page-level static rendering |
| 2D-Mushaf-Polish (2a-fix) | ✅ tested | `3a9307c` + line-centering tweak | Parchment chrome, surah banners, centered lines |
| 2D-Mushaf-Sync (2b) | ✅ tested | `ef7ae00` | Page-level word highlight, sequential auto-advance, fixed controls island |
| 2D-Practice (3) | ✅ tested | `e2f9be7` + `1c89b3b` + `948de29` | Settings sheet, repeat counts, auto-advance delay, blind mode, blur mode |
| 2D-Recite (4) | ✅ tested (after 3 hotfixes) | `1f6557e` + `4100a1f` + `53675e6` + `74ce890` + `4b247eb` | On-device speech recognition with web-derived Arabic matching |
| **2D-Polish (5a)** | 🔜 **next** | — | **Diag log cleanup, AsyncStorage, themes, reciter picker, tajweed, translations, playback rate, cumulative review** |
| 2D-Polish (5b) | after 5a | — | Real `expo-blur` (requires EAS rebuild) |

`TODO.md` is current. Read it first.

---

## 4. The single most important file

`artifacts/noor-mobile/app/child/[childId]/memorization.tsx` — **the entire memorization product, ~1100 lines as of Slice 4 + hotfixes**. Everything Phase 2D ships is in this one file (plus four supporting libs: `src/lib/memorization.ts`, `src/lib/quran.ts`, `src/lib/recite.ts`, `src/lib/mushaf-theme.ts`).

After Slice 5a ships it'll likely be 1300–1500 lines. Don't refactor preemptively. If by Slice 5b it's hard to follow, extract `lib/memorization-audio.ts` (audio state machine + RAF + repeat/auto-advance) and `lib/memorization-recite.ts` (recognition controller + result handler).

### Architectural notes (current state, post-Slice-4 hotfixes)

**Two render modes** controlled by `viewMode: "ayah" | "page"`. Toggle pills under the header.

**Audio state lives in refs.** `expo-av`'s status callback closes over stale state. Pattern:
```ts
const [foo, setFoo] = useState(...);
const fooRef = useRef(foo);
useEffect(() => { fooRef.current = foo; }, [foo]);
```
Refs as of Slice 4 + hotfixes: `viewModeRef`, `currentVerseRef`, `ayahEndRef`, `isPlayingRef`, `isLoadingRef`, `pendingSeekPositionRef`, `repeatCountRef`, `autoAdvanceDelayRef`, `autoplayThroughRangeRef`, `reciteModeRef`, `reciteExpectedIdxRef`, `displayWordsMapRef`, `surahNumberRef`, `matchedWordCountRef`, `lastMatchedWordRef`, `lastMatchTimeRef`. Plus the timer/raf/sound refs (`rafIdRef`, `advanceTimeoutRef`, `soundRef`, `segsRef`, `currentRepeatRef`, `autoPlayRef`, `positionRef`, `durationRef`).

**`handlePlayPause` reads ONLY refs**, never React state. This is critical. After Slice 4 hotfix v2 the function gates exclusively on `isPlayingRef.current` and `isLoadingRef.current` to close the load-completion race window.

**`stopAudioCompletely()`** is the single audio cleanup point. Used by recite-mode entry and component unmount. Unloads sound, cancels RAF + advance timeout, resets all audio refs/state including `isLoadingRef`. Don't bypass it.

**Two highlight states.** `highlightedWord: number` (0-based, ayah mode) and `highlightedPage: { verseKey, position } | null` (1-based to match `ApiWord.position`, page mode). Both updated from the same RAF tick during Husary playback. In recite mode they're updated by the speech recognition result handler.

**Verse-change effect (`[currentVerse]`)** behaves differently for recite vs Husary mode. In recite mode it sets highlight to word 0 (the next-to-say). In Husary mode it clears to -1. This was a Slice 4 hotfix v3 fix.

**QDC segments are 1-indexed and skip non-word tokens.** Husary `qdcId: 6`. The reciters table has `quranComId: null` for Husary, but QDC has segment timings. `quranComId === null` doesn't mean no timing data.

**Audio session conflict on iOS.** `expo-av` and `expo-speech-recognition` can't both hold the audio session. Recite mode entry calls `stopAudioCompletely()` to fully release `expo-av`. `pauseAsync()` is NOT enough — must `unloadAsync()`. Same applies to anything else that wants the mic in the future (e.g. memorization-by-recording would have the same issue).

**Auto-advance + delay:** `setTimeout`-gated, tracked in `advanceTimeoutRef`. Cancelled on pause / Prev / Next / unmount.

**Repeat count:** per-verse counter `currentRepeatRef`. Resets on verse change. Replays via `setPositionAsync(0)` + `playAsync` (no sound recreation).

**Blind mode:** hides in-scope verses as `••••`. Toggle behavior — tap reveals, tap again hides. Reveals persist across audio auto-advance. Tap-to-seek disabled while blind mode is on. Reveals reset on view-mode change and on blind-mode toggle, NOT on verse change.

**Blur mode:** opacity 0.35 on non-active in-scope verses while playing. Real `expo-blur` is Slice 5b.

**Recite mode (Slice 4 + hotfixes):** `expo-speech-recognition`, continuous listening, word-by-word advance via `wordMatches` from `src/lib/recite.ts`. Auto-restarts on iOS's 60s recognition limit. Pauses + unloads Husary on entry. Permission requested first time. Diagnostic logs print to Metro on every transcript event — Slice 5a removes them.

### The recite matcher (`src/lib/recite.ts`)

This file is at parity with the web app's `stripTashkeel` + `wordMatches` logic. Don't tighten it without asking. Mohammad explicitly wants only loosening, never tightening.

Exports:
- `stripTashkeel(s)` — full Arabic normalization. Dagger alef → alef, tashkeel strip, tatweel strip, presentation-form decomposition, alef variants → bare alef, alef-maqsura → ya, ta-marbuta → ha, waw/ya-with-hamza → bare letter, hamza → drop, multi-letter mada collapse.
- `SKIP_CHARS` — regex matching Quranic pause marks / sajda marks / verse-end glyphs.
- `wordMatches(heardNorm, expectedNorm, lastMatched)` — multi-predicate (equality | substring either way | subsequence either way | noun-vowel-stripped equality | word-final ت→ه swap). Rejects 1-char heard tokens unless equal. Rejects re-matches of same heard token (via `lastMatched`).
- `stripAlPrefix(w)` — strips leading "ال" if ≥2 chars remain (iOS often drops the article).
- `tokenize(s)` — splits normalized string into Arabic-letter runs.

The result handler in `memorization.tsx` walks the full accumulating transcript using `matchedWordCountRef` as the search start position. iOS sends partials like "قل", "قل هو", "قل هو الله", ... — each event sees the full accumulated string. The walker advances `expectedIdx` while matches keep landing within a single result event.

### The fixed controls island

Below the ScrollView (NOT inside it). Three rows top-to-bottom:
1. Mode buttons row: Blind, Recite (both pill-shaped, 50/50 width)
2. Audio controls row: Prev, Play, Next
3. Mark Complete button (full width, black)

This was added in Slice 2b explicitly so the user never has to scroll past a long Mushaf page to reach Play / Mark Complete.

### The settings sheet

Bottom modal, opened by gear icon top-right of header. Contains as of Slice 4: repeat count stepper (1–10), auto-advance delay stepper (0–5s, 0.5s increments), autoplay-through-range toggle, blur-other-verses toggle.

Slice 5a adds: theme picker, reciter picker, playback rate slider, tajweed toggle, cumulative review toggle.

---

## 5. Slice 5a — what to ship next

In rough priority order. All JS-only; hot-reloads over the existing EAS dev build.

### 5a.1 — Diagnostic log cleanup

Remove the Slice 4 hotfix diagnostic logs. They were essential during hardware testing but are noisy now.

In `memorization.tsx`'s `useSpeechRecognitionEvent("result", ...)` handler:
- Remove `console.log("[recite] transcript:", ...)`
- Remove `console.log("[recite] tokens:", ...)`
- Remove `console.log("[recite] scan:", ...)`
- Remove `console.log("[recite] match: heard token ...")`
- Remove `console.log("[recite] advanced to expectedIdx:", ...)`

In `src/lib/recite.ts`:
- Check if there are any leftover `console.log` from `stripTashkeel` debugging. If so, remove them.

Keep the structure of the result handler, just strip the logs.

### 5a.2 — AsyncStorage persistence

Add `@react-native-async-storage/async-storage` (JS-only, no rebuild).

```
cd artifacts/noor-mobile
pnpm add @react-native-async-storage/async-storage
```

Persist these settings, keyed per child:
- repeat count
- auto-advance delay
- autoplay-through-range
- blur mode
- blind mode
- view mode (ayah / page)
- theme key
- reciter id
- tajweed toggle
- playback rate
- cumulative review toggle

Key prefix: `noorpath:settings:${childId}:*` (one key per setting, OR a single JSON blob — let Claude Code pick whichever is cleaner). Load on mount in a single effect; save on each setting change.

### 5a.3 — All 8 Mushaf themes

Currently shipped is Madinah Day (the `MUSHAF_PAGE_THEME` const in `src/lib/mushaf-theme.ts`). Web has 8 themes — Madinah / Ottoman / Modern / Classic, each in Day and Night. Web's palette is in `noor-path/src/pages/quran-memorize.tsx` under `MUSHAF_THEMES`. Port that map to mobile.

Refactor `mushaf-theme.ts`:
- Define a `MushafTheme` type matching the existing `MUSHAF_PAGE_THEME` shape
- Define a `THEMES: Record<ThemeKey, MushafTheme>` map with all 8 themes
- The 4 day themes use parchment-like backgrounds; the 4 night themes use dark backgrounds with warm-toned text

In `memorization.tsx`:
- Add `const [themeKey, setThemeKey]` state, default `"madinah_day"`
- Replace direct uses of the `T` import with a derived `theme = THEMES[themeKey]`
- Add a theme picker row to the settings sheet — horizontal pills with theme names

The web's 8 keys: `teal` (Madinah), `maroon` (Ottoman), `navy` (Modern), `forest` (Classic), `madinah_dark`, `ottoman_dark`, `modern_dark`, `classic_dark`. Use clearer keys for mobile: `madinah_day`, `ottoman_day`, `modern_day`, `classic_day`, `madinah_night`, `ottoman_night`, `modern_night`, `classic_night`.

### 5a.4 — Reciter picker

Currently hardcoded Husary (`HUSARY_QDC_ID = 6`). Web has a reciters table in `noor-path/src/components/verse-player.tsx` (search for `RECITERS`). Each reciter has `id`, `display name`, `folder` (everyayah CDN folder), `qdcId` (for word timing), `quranComId` (alternate timing API). Some have neither — those play but get no word-level highlight.

Port to `src/lib/reciters.ts`:
```ts
export type Reciter = {
  id: string;
  name: string;
  folder: string;
  qdcId: number | null;
  quranComId: number | null;
};
export const RECITERS: Reciter[] = [/* ported list */];
```

Update `src/lib/audio.ts` `ayahAudioUrl(surahNumber, ayahNumber)` to take a `Reciter` (or `folder` string) and use the right CDN folder.

Update `memorization.tsx`:
- Add `const [reciterId, setReciterId]` state, default `"husary"`
- Derive `reciter = RECITERS.find(r => r.id === reciterId)!`
- Replace `HUSARY_QDC_ID` constant with `reciter.qdcId`
- Re-fetch QDC timings when reciter changes (or fetch on demand)
- If `reciter.qdcId === null` and `reciter.quranComId === null`, no word-level highlight — verse plays through, highlight stays at -1, that's fine

Add a reciter picker row to the settings sheet.

### 5a.5 — Tajweed highlighting toggle

Quran.com v4 returns a `text_uthmani_tajweed` field that contains HTML-like tags wrapping colored sections (e.g. `<span class="madda_normal">...</span>`). The CSS-class → color map is in `noor-path/src/components/mushaf/bayaan/bayaan-constants.ts` as `TAJWEED_CSS` (or wherever — search the noor-path tree for the color rules).

Update `src/lib/quran.ts`:
- Add `text_uthmani_tajweed?: string` to `ApiWord` type
- Add `text_uthmani_tajweed` to `word_fields` in both `fetchSurahVerses` and `fetchVersesByPage` URLs

In `memorization.tsx`:
- Add `const [tajweedEnabled, setTajweedEnabled]` state, default `false`
- When rendering an in-scope word, if `tajweedEnabled && word.text_uthmani_tajweed`, parse the tag wrapping the word and apply the corresponding color from a `TAJWEED_COLORS` map. Don't try to use `dangerouslySetInnerHTML` (that's web-only) — parse the HTML-ish into RN-compatible color spans.
- A simple approach: extract the outermost `class="..."` value, look up the color in a map, render the inner text with that color. If parse fails, fall back to `pageText`.

Add a tajweed toggle to the settings sheet.

### 5a.6 — Long-press word for translation popup

Quran.com v4 supports word-level translation via `word_fields=translation`. Add it.

Update `src/lib/quran.ts`:
- Add `translation?: { text: string; language_name: string }` to `ApiWord`
- Add `translation` to `word_fields` in both fetchers

In `memorization.tsx`:
- Add `const [tappedWord, setTappedWord]` state for the popover
- On `onLongPress` of a word in either renderer, set the tapped word
- Render a small popover (RN doesn't have native popover — use a `Modal` with `transparent` and centered content, or absolutely-positioned `View` near the word)
- Show: word's Uthmani, English translation, close button
- Close on tap outside

Long-press only — short tap stays tap-to-seek. Don't break that.

### 5a.7 — Playback rate slider

`expo-av`'s `Audio.Sound.setRateAsync(rate, true /* shouldCorrectPitch */)`. Range 0.75x–1.5x in 0.05 steps. Slider in settings sheet.

In `memorization.tsx`:
- Add `const [playbackRate, setPlaybackRate]` state, default `1.0`
- Add a `playbackRateRef` synced via effect (audio callbacks need it)
- After `Audio.Sound.createAsync` resolves in `playVerse`, call `sound.setRateAsync(playbackRateRef.current, true)`
- When `playbackRate` state changes during playback, also call `setRateAsync` on the current sound

RN Slider: use `@react-native-community/slider` (JS-only, may need `pnpm add`).

### 5a.8 — Cumulative review mode

After Mark Complete, optionally play through everything from `ayahStart` to the verse just memorized, sequentially. This is the most-loved feature on the web app for retention.

In `memorization.tsx`:
- Add `const [cumulativeReview, setCumulativeReview]` state, default `false`
- When true, after `submitMemorization` succeeds, instead of immediately showing the success alert, kick off a sequential play-through of `ayahStart..currentVerse` (use the existing autoplay-through-range machinery).
- After the cumulative pass finishes, then show the success alert.

This is the most behaviorally complex item in 5a — it interacts with auto-advance, repeat counts, and the existing Mark Complete flow. If it's fighting the existing state machine, defer to 5c.

Add a cumulative review toggle to the settings sheet.

### Things explicitly NOT in 5a

- Real `expo-blur` — Slice 5b.
- App icon, splash screen, push notifications — Phase 3.
- `expo-av` → `expo-audio` migration — its own slice in Phase 3.
- Cumulative review with separate "review repeat count" setting (web has it). Just plain cumulative for now; tune later.

### Slicing inside 5a

If 5a is too big for a single Claude Code session, the natural sub-split is:

- 5a.1 (cleanup) + 5a.2 (persistence) + 5a.3 (themes) + 5a.4 (reciter picker) — settings/theming foundation, ~1 session
- 5a.5 (tajweed) + 5a.6 (translations) + 5a.7 (playback rate) — content polish, ~1 session
- 5a.8 (cumulative review) — its own session if tricky

Recommend starting with the first chunk. After it ships and is tested, plan the next chunk based on how the file size + complexity is trending.

---

## 6. Slice 5b — after 5a

One thing: **real blur via `expo-blur`**. Replaces the opacity-0.35 fallback used by `blurMode`.

```
pnpm add expo-blur
```

Then `eas build --profile development --platform ios` (rebuild required). After install on iPhone, update `memorization.tsx` to render `<BlurView intensity={20} tint="light" />` (or the active theme's tint) over non-active verses while playing.

Optionally bundle in `expo-linear-gradient` for parchment shading if the rebuild is happening anyway. Judgment call — skip if the Madinah parchment looks fine flat (it does as of Slice 4).

After 5b ships, Phase 2D is complete. Move to Phase 3 (TestFlight).

---

## 7. The conventions

These are mostly stable across sessions. Reproduced here so this doc stands alone.

### Workflow

- Claude Code prompts as markdown blocks. User pastes; reports back commit SHA + typecheck.
- **Test-then-ship.** Every slice gets tested on Expo or the EAS dev build before the next prompt is drafted.
- Read existing files before writing. Don't guess data shapes.
- Both branches stay in sync. Every commit:
  ```
  git push origin main
  git checkout feature/main-working-branch
  git merge main
  git push origin feature/main-working-branch
  git checkout main
  ```
- **Heredoc trap:** never use bare `EOF` markers — they collide with shell traps. Use `MEMO_EOF`, `LIB_EOF`, `THEME_EOF`.

### Code style for noor-mobile

- Expo Router 6 file-based routing
- TypeScript strict
- StyleSheet API (not styled-components or NativeWind)
- Color palette in non-Mushaf-mode UI: bg `#ffffff`, text `#111111`, secondary `#666666`, border `#e5e7eb`, primary `#2563eb`, danger `#dc2626`, card-bg `#f9fafb`. Mushaf-mode parchment palette in `src/lib/mushaf-theme.ts`.
- Card style: `borderRadius: 12`, padding `16`, `backgroundColor: "#f9fafb"`, `borderWidth: 1`, `borderColor: "#e5e7eb"`
- Header: `paddingTop: 60`, back button left, centered title, button or spacer right (60 wide)
- No state libraries (no zustand, no Redux, no TanStack Query). Plain `useState` + `useEffect` + `useRef`.
- No UI libraries. Plain RN components.
- API calls go through `apiFetch<T>` from `src/lib/api.ts` for the Railway backend (handles cookie auth).
- External APIs (Quran.com, QDC, GitHub raw, everyayah) use native `fetch` directly, no auth.

### Existing src/lib files

- `src/lib/api.ts` — `apiFetch<T>` typed helper, Better Auth cookie attached
- `src/lib/auth-client.ts` — Better Auth Expo client
- `src/lib/audio.ts` — `ayahAudioUrl(surahNumber, ayahNumber)` returns Husary 128kbps URL (Slice 5a generalizes to take a reciter)
- `src/lib/mushaf.ts` — page-image URL helper for Reading mode
- `src/lib/mushaf-theme.ts` — parchment palette, Juz lookup (Slice 5a expands to multi-theme map)
- `src/lib/quran.ts` — Quran.com v4 surah/page/chapters fetch with module-level caches (Slice 5a adds tajweed + translation fields)
- `src/lib/memorization.ts` — dashboard fetch, QDC chapter timings, memorization POST
- `src/lib/recite.ts` — Arabic normalization + multi-predicate fuzzy match. **Don't tighten without asking.**
- `src/lib/reviews.ts` — typed review queue + submit (used by `review-session.tsx`)
- `src/lib/reciters.ts` — to be created in Slice 5a

### Known pitfalls

- **Metro + pnpm**: `metro.config.js` must set `watchFolders` and `nodeModulesPaths` per existing config. Don't set `disableHierarchicalLookup: true`. After native dep changes, `npx expo start --clear`.
- **`npx expo install` in pnpm monorepo** can create stray `package-lock.json` in `noor-mobile/`. If it appears, delete it and run `pnpm install` from repo root. For Slice 5a's JS-only adds, prefer `pnpm add` from inside `noor-mobile/`.
- **Cookie auth**: RN has no `document.cookie`. Existing `apiFetch` handles it. Don't write fetch calls without it for backend requests.
- **Audio leaks**: always `unloadAsync()` `Audio.Sound` instances on cleanup. Never let one leak — it breaks subsequent playback. The `stopAudioCompletely()` helper is the single cleanup point; use it.
- **iOS audio session**: `pauseAsync()` is not enough to release the session for the mic. Must `unloadAsync()`. This is why recite-mode entry calls `stopAudioCompletely()`.
- **EAS dev build for native deps**: `expo-speech-recognition`, `expo-blur`, `expo-linear-gradient`, etc. require an EAS dev build. Expo Go doesn't include them. Pure JS deps (AsyncStorage, slider, etc.) hot-reload over the existing dev build.

### EAS Build basics

- CLI: `npx eas-cli@latest <cmd>` (avoid global install permission issues)
- Build: `eas build --profile development --platform ios`
- After build completes, install via QR code on the build's "Install" page; trust the developer profile in iPhone Settings → General → VPN & Device Management.
- iOS 16+ requires Developer Mode enabled (Settings → Privacy & Security → Developer Mode). The toggle only appears AFTER an internal-distribution app has been installed once.
- Run dev server: `npx expo start --dev-client` (the `--dev-client` flag is critical)
- New native deps require a rebuild. JS changes hot-reload over the existing build.

---

## 8. What to do first in the next session

1. **Read `TODO.md` and this handoff.** Don't read older handoffs first; this one supersedes them.
2. **Confirm with Mohammad whether to proceed with the full Slice 5a or the smaller first-chunk split.** The §5 slicing recommendation is the starting offer; he'll tell you which.
3. **Start with the diag log cleanup (5a.1).** It's tiny, gets a quick win, and the logs are noisy if left in.
4. **Then either ship 5a.2–5a.4 (settings/theming foundation) as one Claude Code prompt, or do them separately.** Whichever Mohammad prefers.
5. **Test on hardware after each Claude Code commit.** Don't draft the next prompt until the previous one is verified working.
6. **Same Claude Code prompt pattern as throughout this project.** Read existing files first, write a precise prompt, hand it over, verify SHA + typecheck, hardware-test.

---

## 9. The one important reminder

The whole reason this app exists is so Mohammad's kids can use it to memorize Quran with him. The app already works for that purpose as of Slice 4 + hotfixes — kid sits down with iPhone, opens NoorPath, picks themself, hits Memorization, sees today's verses, hits Play, follows Husary word by word in the parchment-themed Mushaf, marks complete, and it lands in Review. They can even recite back to the app and get word-by-word feedback. That's done.

Slice 5 is polish — themed, persistent across sessions, real blur, multi-reciter, with translations and tajweed and cumulative review. It's the difference between "works" and "delightful." But "works" is already shipped, and that's the bigger threshold.

Phase 3 takes it through TestFlight to the App Store. That's the next big milestone after 5b.

Good luck.
