# NoorPath / Quranic Journey — Phase 2D Slice 5 Handoff

**For: the next Claude conversation continuing this project**
**From: the Claude that ran Phase 2D Slices 1–4 (the project's whole memorization screen)**
**Date: 2026-04-27, evening**

This handoff supersedes `PHASE_2D_HANDOFF.md` from earlier today. Where they conflict, this one wins.

---

## 1. The user (Mohammad)

You're working with a self-taught builder doing this project on weekends and evenings. Father of multiple kids he wants to teach Quran memorization to. Sharp product instincts, fast on the keyboard, treats Claude as a peer not a teacher. Things that have stayed true across many sessions:

- He hates UI work. Wants things to "be there by default."
- He prefers Claude Code (the agentic CLI) make all code changes. The pattern that works: I draft a precise prompt as a markdown block; he pastes it into a fresh Claude Code session at the repo root; Claude Code reports SHA + typecheck; we iterate. Direct filesystem edits from the chat assistant are reserved for tiny things (config files, doc updates, manual git commits).
- One terminal command at a time, not walls.
- "Let's keep going" / "next" / "good" means it. Don't suggest stopping.
- He pushes back hard when scope is wrong. Take it seriously, but don't preemptively scope down — *ship the right slice, and offer the slicing plan transparently*. Don't bury features.
- Test-then-ship. As of this session, every slice gets tested on Expo before the next prompt is drafted. Don't skip ahead.
- He's fine being told something is hard or that a tradeoff exists. Don't sandbag.

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
- **EAS project:** `@mothman123/noor-mobile`. First development build kicked off Apr 27 evening (likely complete by next session).

---

## 3. Where the project is right now

The memorization screen is **Phase 2D's whole story**. Five slices planned; four shipped and tested; Slice 5 (Polish) is what the next session ships.

| Slice | Status | Commit | What |
|---|---|---|---|
| **2D-Core (1)** | ✅ tested | `5650d9e` | Single-verse view, Amiri font, Husary word-by-word audio sync, tap-to-seek, Mark Complete |
| **2D-Mushaf-Render (2a)** | ✅ tested | `1dae113` | View mode toggle, page-level static rendering |
| **2D-Mushaf-Polish (2a-fix)** | ✅ tested | `3a9307c` + line-centering tweak | Parchment chrome, surah banners, centered lines |
| **2D-Mushaf-Sync (2b)** | ✅ tested | `ef7ae00` | Page-level word highlight, sequential auto-advance, fixed controls island |
| **2D-Practice (3)** | ✅ tested | `e2f9be7` + `1c89b3b` + `948de29` | Settings sheet, repeat counts, auto-advance delay, blind mode (toggle, persists across auto-advance), blur mode, Recite placeholder |
| **2D-Recite (4)** | ✅ committed; needs hardware testing via EAS dev build | `1f6557e` + `4100a1f` | On-device speech recognition, fuzzy Arabic match, word-by-word advance |
| **2D-Polish (5)** | 🔜 next | — | Themes, AsyncStorage persistence, real blur via expo-blur, reciter picker, tajweed coloring, translation popup, playback rate, cumulative review |

There is also a small commit `d154455` adding the iOS bundle identifier to `app.json`, and an `eas.json` commit for the EAS build profile. These are infrastructure, not feature work.

`TODO.md` is current. Read it first.

---

## 4. The single most important file

`artifacts/noor-mobile/app/child/[childId]/memorization.tsx` — **the entire memorization product, ~1100 lines as of Slice 4**. Everything Phase 2D ships is in this one file (plus three supporting libs: `src/lib/memorization.ts`, `src/lib/quran.ts`, `src/lib/recite.ts`, plus `src/lib/mushaf-theme.ts`).

It's getting large. After Slice 5 ships, it will likely be ~1500–1800 lines. **If you (next Claude) find yourself scrolling repeatedly to understand state interactions, the right move is to refactor into separate concerns:** `lib/memorization-audio.ts` (audio state machine, RAF loop, segments), `lib/memorization-recite.ts` (recognition controller), and the screen file becomes mostly composition + rendering. Don't refactor preemptively — only if the file's complexity is actively slowing the work.

### Architectural notes (current state, Slice 4)

- **Two render modes** controlled by `viewMode: "ayah" | "page"`. Toggle pills under the header.
- **Audio state lives in refs** because `expo-av`'s status callback closes over stale state. Pattern:
  ```ts
  const [foo, setFoo] = useState(...);
  const fooRef = useRef(foo);
  useEffect(() => { fooRef.current = foo; }, [foo]);
  ```
  Every state value the audio path reads has a parallel ref. After Slice 4, the synced refs are: `viewModeRef`, `currentVerseRef`, `ayahEndRef`, `isPlayingRef`, `pendingSeekPositionRef`, `repeatCountRef`, `autoAdvanceDelayRef`, `autoplayThroughRangeRef`, `reciteModeRef`, `reciteExpectedIdxRef`, plus probably `surahNumberRef` and `displayWordsMapRef` (added in Slice 4 for the recognition listener).
- **Two highlight states**: `highlightedWord: number` (0-based, used by ayah mode) and `highlightedPage: { verseKey, position } | null` (1-based position to match `ApiWord.position`, used by page mode). Both updated from the same RAF tick.
- **`segsRef.current`** holds segments for the *currently playing verse only*. The active verse is always the one playing — page mode plays one verse at a time, sequentially.
- **QDC segments are 1-indexed and skip non-word tokens.** When using them with display words, filter `char_type_name === "word"` first.
- **Husary uses `qdcId: 6`.** The reciters table has `quranComId: null` for Husary, but QDC has segment timings. Don't be fooled.
- **Audio session conflict on iOS**: mic and speaker can't both be active. Recite mode pauses Husary and blocks Play. Same applies to anything else that opens a mic in the future.
- **Auto-advance + delay**: `setTimeout`-gated, tracked in `advanceTimeoutRef`. Cancelled on pause / Prev / Next / unmount.
- **Repeat count**: per-verse counter `currentRepeatRef`. Resets on verse change. Replays via `setPositionAsync(0)` + `playAsync` (no sound recreation).
- **Blind mode**: hides in-scope verses as `••••`. Toggle behavior — tap reveals, tap again hides (no auto-timer). Reveals persist across audio auto-advance. Tap-to-seek disabled while blind mode is on (intent: blind = test mode, not seek mode). Reveals reset on view-mode change and on blind-mode toggle (those are user-driven context shifts) but NOT on verse change.
- **Blur mode**: opacity 0.35 on non-active in-scope verses while playing. Real `expo-blur` is Slice 5.
- **Recite mode (Slice 4)**: `expo-speech-recognition`, continuous listening, word-by-word advance via `matchesExpectedWord` from `src/lib/recite.ts`. Auto-restarts on iOS's 1-minute recognition limit. Pauses Husary on entry; blocks Play while active. Permission requested first time.

### The fixed controls island

Below the ScrollView (NOT inside it). Three rows top-to-bottom:
1. Mode buttons row: Blind, Recite (both pill-shaped, 50/50 width)
2. Audio controls row: Prev, Play, Next
3. Mark Complete button (full width, black)

This was added in Slice 2b explicitly so the user never has to scroll past a long Mushaf page to reach Play / Mark Complete.

### The settings sheet

Bottom modal, opened by gear icon top-right of header. Contains: repeat count stepper (1–10), auto-advance delay stepper (0–5s, 0.5s increments), autoplay-through-range toggle, blur-other-verses toggle. Slice 5 will add: reciter picker, theme picker, tajweed toggle, playback rate, persistence to AsyncStorage.

---

## 5. What Slice 5 needs to do

The handoff §5.1 of the original `PHASE_2D_HANDOFF.md` listed all the web app's settings. By the end of Slice 5, the mobile app should have parity with the most-used web settings, plus a few new mobile-native polish items.

### Required for Slice 5

In rough priority order:

1. **AsyncStorage persistence.** `@react-native-async-storage/async-storage`. JS-only package, doesn't require an EAS rebuild. Persist: repeat count, auto-advance delay, autoplay-through-range, blind mode, blur mode, view mode, theme, reciter, tajweed toggle, playback rate. Key prefix per child: `noorpath:settings:${childId}:*`. Load on mount; save on each setting change.

2. **All 8 Mushaf themes.** Madinah/Ottoman/Modern/Classic × Day/Night. Web's palette is in `noor-path/components/mushaf/bayaan/bayaan-constants.ts` — we already ported one (`MUSHAF_PAGE_THEME` in `mushaf-theme.ts`). Extend to a map `THEMES: Record<ThemeKey, MushafTheme>`. The currently-shipped theme is Madinah Day. Add a theme picker in the settings sheet.

3. **Real blur via `expo-blur`.** Replaces the opacity-dimming fallback. **Adds a native dep — requires another EAS dev build after Slice 5 ships.** Use `<BlurView intensity={20} tint="light" />` overlay on non-active verses while playing. Blur intensity tunable in settings. The opacity fallback stays as the implementation when `Platform.OS !== "ios"` (no blur on Android in this build target since we're iOS-only).

4. **Reciter picker.** Currently hardcoded to Husary. Reciters table is in `noor-path/components/verse-player.tsx` — port to `src/lib/reciters.ts`. UI: settings sheet row, opens a sub-list. Husary stays default. Each reciter has a `qdcId` (for word timing) or `quranComId` (alternate timing API) or both. Some reciters have neither — in that case, fall back to no word highlight (audio plays, highlight is verse-level only).

5. **Tajweed highlighting toggle.** Quran.com v4 returns `text_uthmani_tajweed` field on verses (request via `fields=text_uthmani_tajweed`). It contains HTML-like tags around colored spans. Port the CSS class → color map from `noor-path/components/mushaf/bayaan/bayaan-constants.ts` (`TAJWEED_CSS`). When enabled, render words with their tajweed colors instead of solid `pageText`. Toggle in settings sheet.

6. **Long-press word for translation popup.** Quran.com v4 word fields can include `translation`. Add `translation` to the `word_fields` query in `fetchSurahVerses` and `fetchVersesByPage`. On long-press a word, show a small popover with the word's English translation. RN's `Pressable` has `onLongPress`.

7. **Playback rate slider.** `expo-av`'s `Audio.Sound.setRateAsync(rate, true)`. Range 0.5x–1.5x in 0.1 steps. Slider in settings sheet.

8. **Cumulative review mode.** After memorizing a new verse, automatically review all previously memorized verses in the current range. Toggle in settings sheet. When enabled, after Mark Complete, the screen plays through everything from `ayahStart` to the verse just memorized, sequentially. This is what the web does — it's the single most-loved feature for retention. Worth shipping.

### Slicing recommendation for Slice 5

Slice 5 is too big for one Claude Code session if everything ships at once. Two reasonable splits:

**Option A — by feature category:**
- 5a: AsyncStorage persistence + theme system + theme picker
- 5b: Real blur + reciter picker + playback rate slider
- 5c: Tajweed highlighting + translation popup + cumulative review

**Option B — by EAS rebuild boundary:**
- 5a: Everything that doesn't need a new native package (persistence, themes, picker, playback rate, tajweed, translation, cumulative review)
- 5b: `expo-blur` integration + AsyncStorage if not already in 5a (requires EAS rebuild)

**My recommendation is B.** It minimizes EAS rebuilds (one in the middle vs two), and 5a delivers the bulk of the user-visible polish in a single session. The only thing 5b adds is real blur — everything else is JS-only.

**If user wants to ship in one session anyway:** that's their call. Combine all of it, plan for an EAS rebuild after, send a single big prompt. Acknowledge the size in the prompt's preamble.

### Acknowledged compromises that stay through Slice 5

- One canonical Mushaf line may wrap to 2 visual lines on phones (Slice 2a-fix decision). Not fixing in Slice 5.
- Surah banners always on their own row, even at mid-line surah transitions. Not fixing.
- No parchment gradient (flat color). `expo-linear-gradient` is small but adds another native rebuild — defer to Slice 5b only if user wants it.
- Auto-scroll math is approximate — Slice 2b shipped best-effort. Adequate for now; tune later if needed.

### Things explicitly NOT in Slice 5

- Push notifications, app icon, splash screen, EAS production build, TestFlight — those are Phase 3.
- Any new audio model (web's "blind mode + blur during recitation" was a single feature; mobile already has them as separate toggles, that's fine).

---

## 6. The conventions

These haven't changed since the last handoff. Reproduced here so this doc stands alone.

### Workflow

- Claude Code prompts as markdown blocks. User pastes; reports back commit SHA + typecheck.
- **Test-then-ship.** Every slice gets tested on Expo (or now, the EAS dev build) before the next prompt is drafted. The chat assistant doesn't draft Slice N+1 until user confirms Slice N works.
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
- `src/lib/audio.ts` — `ayahAudioUrl(surahNumber, ayahNumber)` returns Husary 128kbps URL
- `src/lib/mushaf.ts` — page-image URL helper for Reading mode
- `src/lib/mushaf-theme.ts` — parchment palette, Juz lookup
- `src/lib/quran.ts` — Quran.com v4 surah/page/chapters fetch with module-level caches
- `src/lib/memorization.ts` — dashboard fetch, QDC chapter timings, memorization POST
- `src/lib/recite.ts` — Arabic normalization + fuzzy match
- `src/lib/reviews.ts` — typed review queue + submit (used by `review-session.tsx`)

### Known pitfalls

- **Metro + pnpm**: `metro.config.js` must set `watchFolders` and `nodeModulesPaths` per existing config. Don't set `disableHierarchicalLookup: true`. After native dep changes, `npx expo start --clear`.
- **`npx expo install` in pnpm monorepo** can create stray `package-lock.json` in `noor-mobile/`. If it appears, delete it and run `pnpm install` from repo root.
- **Cookie auth**: RN has no `document.cookie`. Existing `apiFetch` handles it. Don't write fetch calls without it for backend requests.
- **Audio leaks**: always `unloadAsync()` `Audio.Sound` instances on cleanup. Never let one leak — it breaks subsequent playback.
- **EAS dev build for native deps**: `expo-speech-recognition`, `expo-blur`, `expo-linear-gradient`, etc. require an EAS dev build. Expo Go doesn't include them. Pure JS deps (AsyncStorage, etc.) hot-reload over the existing dev build.

### EAS Build basics

- CLI: `npx eas-cli@latest <cmd>` (avoid global install permission issues)
- Build: `eas build --profile development --platform ios`
- After build completes, install via QR code on the build's "Install" page; trust the developer profile in iPhone Settings → General → VPN & Device Management.
- Run dev server: `npx expo start --dev-client` (the `--dev-client` flag is critical)
- New native deps require a rebuild. JS changes hot-reload over the existing build.

---

## 7. What to do first in the next session

1. **Read `TODO.md` and this handoff.** Don't read the older `PHASE_2D_HANDOFF.md` first; this one supersedes it.
2. **Confirm the EAS dev build status with Mohammad.** If Slice 4 hasn't been hardware-tested yet, Slice 5 doesn't ship until it has been. Don't draft Slice 5 prompts on top of unverified Slice 4 behavior.
3. **If Slice 4 testing surfaces bugs** (likely — speech recognition is the most heuristic part of the project), fix-prompt those before Slice 5. Common things to expect: fuzzy match too lenient (advances on garbage), too strict (doesn't advance on clearly-correct recitation), iOS recognition restart on the 1-minute mark causes a brief audio glitch, permission denial flow. Tune in `src/lib/recite.ts`.
4. **Once Slice 4 is verified, present the Slice 5 plan.** Use the §5 slicing as the starting offer. The user will tell you if they want one big slice or two.
5. **Same Claude Code prompt pattern as before.** Read existing files first, write a precise prompt, hand it over, verify SHA + typecheck.

---

## 8. The one important reminder

The whole reason this app exists is so Mohammad's kids can use it to memorize Quran with him. When you write code, when you write prompts, when you make tradeoffs — keep that user in mind. Polish matters. Performance matters. Authentic Mushaf aesthetics matter. But shipping working features his kids can actually use **right now** matters more than any of those. The web app is great. The mobile app, after Slice 5, will be at parity for the most-used features and better for some (mic-based recite is more natural on mobile).

Get him to: kid sits down with iPhone, opens NoorPath, picks themself, hits Memorization, sees today's verses, hits Play, follows Husary word by word in the parchment-themed Mushaf, marks complete, watches it land in Review. That's done. Slice 5 makes it polished — themed, persistent, real blur, multi-reciter, with translations on long-press. And after Slice 5, Phase 3 takes it through TestFlight to the App Store.

Good luck.
