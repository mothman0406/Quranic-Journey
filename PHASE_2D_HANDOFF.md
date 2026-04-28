# NoorPath / Quranic Journey — Phase 2D Slice 5a Session 3 Handoff

**For: the next Claude conversation continuing this project**
**Last updated: 2026-04-27, late evening (Slice 5a Session 2 shipped + tested except tajweed; Slice 5a Session 3 is next)**

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
- He's pragmatic about partial wins. When tajweed didn't render in Session 2, his response was "let's add that to the queue as well: not one of the more important features." Don't try to over-investigate broken things if they're not blocking — note them and move on.

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

**Phase 2D Slices 1–4 + Slice 5a Sessions 1+2 are shipped, hardware-tested, working very well** with two known issues backlogged. Recite mode at parity with web. Multi-reciter playback works for all 7 reciters. Word tracking works for all (true QDC for Husary, fractional fallback w/ 500ms lead for others). Audio plays through iPhone silent switch. Theme + reciter pickers in settings sheet. Profile vs session settings split. **Long-press translation popup works.** **Playback rate (0.75x–1.5x discrete pills) works.** **Tajweed coloring wired but doesn't render** (likely API field shape — backlogged).

| Slice | Status | Commit | What |
|---|---|---|---|
| 2D-Core (1) | ✅ tested | `5650d9e` + `e752721` | Single-verse, Amiri, Husary word-by-word audio sync |
| 2D-Mushaf-Render (2a) | ✅ tested | `1dae113` | View mode toggle, page-level static rendering |
| 2D-Mushaf-Polish (2a-fix) | ✅ tested | `3a9307c` + tweak | Parchment chrome |
| 2D-Mushaf-Sync (2b) | ✅ tested | `ef7ae00` | Page-level word highlight, auto-advance, controls island |
| 2D-Practice (3) | ✅ tested | `e2f9be7` + `1c89b3b` + `948de29` | Settings sheet, repeat, delay, blind mode, blur mode |
| 2D-Recite (4) | ✅ tested (after 3 hotfixes) | `1f6557e` + `4100a1f` + `53675e6` + `74ce890` + `4b247eb` | On-device speech recognition |
| 2D-Polish 5a Session 1 | ✅ tested (after 4 hotfixes) | `b73ed60` + 4 hotfixes (latest `45d58a3` then `d5d5f1f` then LEAD_MS=500) | Cleanup, AsyncStorage, 8 themes, 7 reciters, profile/session split, fractional fallback, anticipatory shift |
| 2D-Polish 5a Session 2 | ✅ tested (tajweed broken — backlogged) | `18f054d` | Translation popup, playback rate, tajweed wiring (no colors) |
| **2D-Polish 5a Session 3** | 🔜 **next** | — | **Cumulative review** |
| 2D-Polish 5b | after Session 3 | — | Real `expo-blur` (requires EAS rebuild). May piggyback tajweed fix here or earlier. |

`TODO.md` is current. Read it first.

---

## 4. The single most important file

`artifacts/noor-mobile/app/child/[childId]/memorization.tsx` — **the entire memorization product, ~1500 lines after Slice 5a Session 2**. Plus supporting libs: `src/lib/memorization.ts`, `src/lib/quran.ts`, `src/lib/recite.ts`, `src/lib/mushaf-theme.ts`, `src/lib/reciters.ts`, `src/lib/settings.ts`, `src/lib/audio.ts`, `src/lib/tajweed.ts`.

Don't refactor preemptively. If it gets unwieldy after Session 3, extract `lib/memorization-audio.ts` and `lib/memorization-recite.ts`.

### Architectural notes (current state, post-Slice-5a-Session-2)

**Two render modes** controlled by `viewMode: "ayah" | "page"`. Toggle pills under the header.

**Audio state lives in refs.** `expo-av`'s status callback closes over stale state. Pattern:
```ts
const [foo, setFoo] = useState(...);
const fooRef = useRef(foo);
useEffect(() => { fooRef.current = foo; }, [foo]);
```

All refs as of Slice 5a Session 2: `viewModeRef`, `currentVerseRef`, `ayahEndRef`, `isPlayingRef`, `isLoadingRef`, `pendingSeekPositionRef`, `repeatCountRef`, `autoAdvanceDelayRef`, `autoplayThroughRangeRef`, `reciteModeRef`, `reciteExpectedIdxRef`, `displayWordsMapRef`, `surahNumberRef`, `matchedWordCountRef`, `lastMatchedWordRef`, `lastMatchTimeRef`, `reciterRef`, `saveTimerRef`, `playbackRateRef`. Plus timer/raf/sound refs.

**`handlePlayPause` reads ONLY refs.** Critical. After Slice 4 hotfix v2 the function gates exclusively on `isPlayingRef.current` and `isLoadingRef.current` to close the load-completion race window.

**`stopAudioCompletely()`** is the single audio cleanup point.

**Two highlight states.** `highlightedWord: number` (0-based, ayah mode) and `highlightedPage: { verseKey, position } | null` (1-based to match `ApiWord.position`, page mode). Both updated from the same RAF tick.

**Verse-change effect (`[currentVerse]`)** behaves differently for recite vs Husary mode. In recite mode it sets highlight to word 0. In Husary mode it clears to -1.

**Multi-reciter timing routing (Slice 5a Session 1):**
- `fetchTimingsForReciter(reciter, surah)` returns a `ChapterTimings` discriminated union
- Husary: `{ kind: "chapter", map: ... }` — synchronous lookup
- Others: `{ kind: "ondemand", fetch: (verse) => ... }` — per-verse v4 fetch (cached)
- v4 returns no segments for non-Husary → `tick()` falls back to fractional formula

**Fractional fallback (Slice 5a Session 1 final):**
```ts
const LEAD_MS = 500;
const shiftedPos = pos + LEAD_MS;
const shiftedFrac = Math.min(shiftedPos / dur, 1);
found = Math.min(Math.floor(shiftedFrac * wordCount), wordCount - 1);
```
Provides anticipatory feel. Works for short ayahs; trails on long ones — accepted limitation.

**iOS audio session:** `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })` mandatory. `setVolumeAsync(1.0)` on every Sound. `expo-av` and `expo-speech-recognition` can't both hold the session — `pauseAsync()` not enough, must `unloadAsync()`.

**Profile vs session settings (Slice 5a Session 1):**
- Profile-level (persist): `themeKey`, `reciterId`, `viewMode`. Persistence currently buggy.
- Session-level (`DEFAULT_SESSION_SETTINGS`): `repeatCount`, `autoAdvanceDelayMs`, `autoplayThroughRange`, `blurMode`, `blindMode`.
- Session 2 added `playbackRate` (default 1.0) and `tajweedEnabled` (default false) as plain inline `useState`, NOT in `DEFAULT_SESSION_SETTINGS`.

**Translation popup (Slice 5a Session 2):**
- `word_fields=translation` + `translations=131` (Sahih International) on both fetchers
- `translation` field on word may be `{ text, language_name }` or plain string — `getTranslationText` handles both
- `onLongPress` with `delayLongPress={400}`. Short tap still triggers tap-to-seek.
- Modal pattern: outer `Pressable` backdrop with `onPress={close}`, inner card is also `Pressable` with empty `onPress={() => {}}` to absorb taps. Plain `View` would let taps bubble.

**Playback rate (Slice 5a Session 2):**
- `PLAYBACK_RATES = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5]` discrete pill scroller
- Skipped `@react-native-community/slider` (has native code, would require rebuild)
- `setRateAsync(rate, true)` in `playVerse` after `createAsync`
- Separate effect pushes mid-playback rate changes to active sound

**Tajweed (Slice 5a Session 2 — wired but not rendering):**
- `src/lib/tajweed.ts` has 21-class `TAJWEED_COLORS` map + `extractTajweedColor(html)` helper
- `text_uthmani_tajweed` added as `word_field` on both fetchers (likely the bug — see backlog in TODO.md)
- Toggle wired into settings sheet
- Both renderers call `extractTajweedColor(word.text_uthmani_tajweed)` for in-scope words
- **Doesn't color anything.** Probably need verse-level `text_uthmani_tajweed` + `splitTajweedIntoWords` parser like the web. Backlogged.

### The recite matcher (`src/lib/recite.ts`)

Parity with the web app. Don't tighten without asking. Carry-over from Slice 4 + hotfixes.

### The fixed controls island

Below the ScrollView. Three rows: Mode buttons (Blind, Recite), audio controls (Prev, Play, Next), Mark Complete (full width black).

### The settings sheet (current ordering)

Bottom modal, opened by gear icon top-right of header.

1. Repeat count stepper (1–10)
2. Auto-advance delay stepper (0–5s, 0.5s steps)
3. Autoplay-through-range toggle
4. Blur-other-verses toggle
5. Tajweed coloring toggle (wired but not rendering)
6. Playback speed pills (0.75x, 0.85x, 1x, 1.15x, 1.25x, 1.5x)
7. Theme pills (8 themes)
8. Reciter pills (7 reciters, last-name only)
9. Done button

Slice 5a Session 3 will add: cumulative review toggle.

---

## 5. Slice 5a Session 3 — what to ship next

Cumulative review. JS-only.

After Mark Complete, optionally play through everything from `ayahStart` to the verse just memorized, sequentially. Most-loved feature on web for retention.

In `memorization.tsx`:
- Add `const [cumulativeReview, setCumulativeReview]` state, default `false`
- When `true`, after `submitMemorization` succeeds, instead of immediately showing the success alert:
  - Set `currentVerse` back to `ayahStart`
  - Engage autoplay-through-range (it already exists; reuse the autoPlayRef pattern)
  - When the playback reaches the end of the range, show the success alert
- Add a cumulative review toggle to the settings sheet (with the other toggles)

**Behavioral interactions to think through:**
- Repeat count: should each verse repeat N times during cumulative review, or just play once? Web treats cumulative as "play through once, no repeats." Recommend mirroring that.
- Auto-advance delay: should respect the configured delay between verses. Reuse existing machinery.
- Blind mode: incompatible with cumulative review (kid needs to *see* the words to refresh memory). Recommend auto-disabling blind mode during cumulative pass, OR just let it be — kid can toggle blind off if they want.
- Blur mode: works fine; the active verse un-blurs as it plays. No special handling needed.
- Mark Complete during cumulative pass: should be no-op. The flow already submitted before the cumulative pass started.
- Stop button: kid should be able to abort cumulative review. The Pause button can serve this — just needs to also clear the pending success alert.

If the state machine fights this, split. The cumulative-review machinery may live in its own ref/effect to avoid corrupting normal playback state.

**Implementation skeleton:**

```ts
const [cumulativeReview, setCumulativeReview] = useState<boolean>(false);
const cumulativeReviewRef = useRef(cumulativeReview);
useEffect(() => { cumulativeReviewRef.current = cumulativeReview; }, [cumulativeReview]);

const cumulativePassActiveRef = useRef(false);

async function handleMarkComplete() {
  if (!surahNumber || ayahStart === null || ayahEnd === null) return;
  const ayahs = Array.from({ length: ayahEnd - ayahStart + 1 }, (_, i) => ayahStart + i);
  setSubmitting(true);
  try {
    await submitMemorization(childId, { ... });
    if (cumulativeReviewRef.current) {
      // Kick off cumulative pass — defer the success alert
      cumulativePassActiveRef.current = true;
      autoPlayRef.current = true;
      setCurrentVerse(ayahStart);
      setSubmitting(false);
      // Success alert fires from playVerse status callback when end-of-range reached
    } else {
      Alert.alert("Marked complete.", undefined, [{ text: "OK", onPress: () => router.back() }]);
    }
  } catch (e) {
    Alert.alert("Error", e instanceof Error ? e.message : "Failed to save.");
  } finally {
    if (!cumulativeReviewRef.current) setSubmitting(false);
  }
}
```

In the `playVerse` status callback's natural-finish branch, after the existing auto-advance logic, add:

```ts
if (cumulativePassActiveRef.current && currentVerseRef.current >= ayahEndRef.current) {
  cumulativePassActiveRef.current = false;
  Alert.alert("Marked complete.", "Cumulative review done.", [
    { text: "OK", onPress: () => router.back() },
  ]);
}
```

The existing autoplay-through-range logic in the status callback should naturally drive verse-to-verse advance during the cumulative pass since `autoPlayRef.current = true` was set in `handleMarkComplete`.

Pause/abort: when the user taps Pause during cumulative review, set `cumulativePassActiveRef.current = false` so the success alert doesn't fire on the next verse-end. Verify the pause flow in `handlePlayPause` and add this clear if it's not already there.

Settings sheet:

```tsx
<View style={styles.settingRow}>
  <Text style={styles.settingLabel}>Cumulative review after Mark Complete</Text>
  <Pressable
    onPress={() => setCumulativeReview(!cumulativeReview)}
    style={[styles.toggleSwitch, cumulativeReview && styles.toggleSwitchOn]}
  >
    <View style={[styles.toggleKnob, cumulativeReview && styles.toggleKnobOn]} />
  </Pressable>
</View>
```

Place the new toggle right below the "Tajweed coloring" toggle (or wherever it fits in the visual flow — Mohammad will adjust if needed).

### Things explicitly NOT in Session 3

- "Review repeat count" separate from main repeat count (web has it). Out of scope; tune later if requested.
- Tajweed fix (still backlogged). Could be tackled in a small dedicated commit before 5b if Mohammad wants.
- Real `expo-blur` (Slice 5b — requires rebuild)
- Profile Settings page (Phase 2E)

---

## 6. Slice 5b — after Session 3

Real blur via `expo-blur`. Replaces the opacity-0.35 fallback used by `blurMode`. Requires EAS rebuild.

```
pnpm add expo-blur
eas build --profile development --platform ios
```

Possibly bundle tajweed fix into this commit since you're rebuilding anyway. Or do tajweed first as a JS-only commit; doesn't matter.

After 5b ships, Phase 2D is complete.

---

## 7. After Phase 2D

Per user (confirmed Apr 27 evening): Option A — finish Slice 5 first, then do 2E + 2F before TestFlight.

- **Phase 2E** — Dashboard polish (today's-work content on Mem/Review/Reading banners, red/orange/green surah quality colors, profile selector polish)
- **Phase 2F** — Target-setting UI (set memorization/review/reading targets by page number — backend already supports it via dashboard endpoint)
- **Then Phase 3** — TestFlight (app icon, splash, EAS production build, App Store Connect, TestFlight beta)

User also requested **deep-dive into web app's `noor-path/` for "lots of cool stuff that took a lot of work"** — to be done after Phase 2 completes. Consider during Phase 2E/2F drafting.

---

## 8. The conventions

### Workflow

- Claude Code prompts as markdown blocks. User pastes; reports back commit SHA + typecheck.
- **Test-then-ship.** Every slice tested on EAS dev build before next prompt drafted.
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
- StyleSheet API
- Color palette in non-Mushaf-mode UI: bg `#ffffff`, text `#111111`, secondary `#666666`, border `#e5e7eb`, primary `#2563eb`, danger `#dc2626`, card-bg `#f9fafb`. Mushaf 8-theme palette in `src/lib/mushaf-theme.ts`.
- Card style: `borderRadius: 12`, padding `16`, `backgroundColor: "#f9fafb"`, `borderWidth: 1`, `borderColor: "#e5e7eb"`
- Header: `paddingTop: 60`, back button left, centered title, button or spacer right (60 wide)
- No state libraries. Plain `useState` + `useEffect` + `useRef`.
- No UI libraries. Plain RN components.
- API calls go through `apiFetch<T>` from `src/lib/api.ts` for the Railway backend.
- External APIs (Quran.com, QDC, GitHub raw, everyayah) use native `fetch` directly, no auth.

### Existing src/lib files

- `src/lib/api.ts` — `apiFetch<T>` typed helper, Better Auth cookie attached
- `src/lib/auth-client.ts` — Better Auth Expo client
- `src/lib/audio.ts` — `ayahAudioUrl(reciter, surah, ayah)`
- `src/lib/mushaf.ts` — page-image URL helper for Reading mode
- `src/lib/mushaf-theme.ts` — 8-theme `THEMES` map, `ThemeKey`, `MushafTheme`, etc.
- `src/lib/quran.ts` — Quran.com v4 fetchers with `text_uthmani_tajweed` + `translation` word_fields + `translations=131`
- `src/lib/memorization.ts` — dashboard fetch, QDC chapter timings, on-demand v4 fetcher, `fetchTimingsForReciter` router, `ChapterTimings` discriminated union, memorization POST
- `src/lib/recite.ts` — Arabic normalization + multi-predicate fuzzy match. **Don't tighten without asking.**
- `src/lib/reviews.ts` — typed review queue + submit
- `src/lib/reciters.ts` — 7-reciter table
- `src/lib/settings.ts` — `ProfileSettings`, `loadProfileSettings`, `saveProfileSettings`, `DEFAULT_SESSION_SETTINGS`
- `src/lib/tajweed.ts` — `TAJWEED_COLORS` map + `extractTajweedColor` helper (wiring shipped Session 2; coloring not rendering — see backlog)

### Known pitfalls

- **Metro + pnpm**: `metro.config.js` must set `watchFolders` and `nodeModulesPaths`. After native dep changes, `npx expo start --clear`.
- **`npx expo install` in pnpm monorepo** can create stray `package-lock.json` in `noor-mobile/`. Delete it and run `pnpm install` from repo root.
- **Cookie auth**: RN has no `document.cookie`. Existing `apiFetch` handles it.
- **Audio leaks**: always `unloadAsync()` `Audio.Sound` instances. Use `stopAudioCompletely()`.
- **iOS audio session**: `pauseAsync()` not enough to release for the mic. Must `unloadAsync()`.
- **iOS silent switch**: `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })` mandatory.
- **everyayah folder names**: stale ones break audio with `AVPlayerItem -1100`. Verify against `https://www.everyayah.com/recitations_pages.html`.
- **Quran.com v4 `by_ayah` segments**: returns `undefined` for non-Husary reciter IDs.
- **Quran.com v4 `text_uthmani_tajweed`**: likely only available at verse level, NOT word level (Session 2 tajweed broken because of this assumption).
- **EAS dev build for native deps**: required for `expo-blur`, `@react-native-community/slider`, etc. Pure JS hot-reloads.

### EAS Build basics

- CLI: `npx eas-cli@latest <cmd>`
- Build: `eas build --profile development --platform ios`
- After build, install via QR code on the build's "Install" page; trust developer profile in iPhone Settings → General → VPN & Device Management.
- iOS 16+ requires Developer Mode (toggle only appears AFTER an internal-distribution app installed once).
- Run dev server: `npx expo start --dev-client`.

---

## 9. What to do first in the next session

1. **Read `TODO.md` and this handoff.** This one supersedes earlier handoffs.
2. **Confirm with Mohammad whether to proceed with Session 3 (cumulative review) or address tajweed first.** Mohammad explicitly backlogged tajweed; Session 3 is the recommended next step. He'll say if he wants tajweed first.
3. **For cumulative review:** read existing `handleMarkComplete` and the `playVerse` status callback (auto-advance branch). Plan the integration. Draft the prompt.
4. **Test on hardware after the commit.** Pay special attention to: pause-during-cumulative-pass, blind mode interaction, success alert firing exactly once at end of range.
5. **Same Claude Code prompt pattern as throughout this project.**

---

## 10. The one important reminder

The whole reason this app exists is so Mohammad's kids can use it to memorize Quran with him. The app already works for that purpose — kid sits down with iPhone, opens NoorPath, picks themself, hits Memorization, sees today's verses, hits Play, follows their chosen reciter (Husary, Afasy, Sudais, Basit, Minshawi, Ghamdi, or Ajmi) word by word in the Madinah-themed Mushaf at their preferred speed (0.75x for slow learning, 1x for normal, faster for review), long-presses any word for an English translation, marks complete, and it lands in Review. They can recite back to the app and get word-by-word feedback. They can switch themes. That's done.

Slice 5a Session 3 adds cumulative review (the retention secret weapon). 5b adds real blur. After that Phase 2D is done and we move to dashboard polish (2E) + target setting (2F) before TestFlight.

Phase 3 takes it through TestFlight to the App Store.

Good luck.
</content>