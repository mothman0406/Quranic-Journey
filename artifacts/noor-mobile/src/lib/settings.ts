import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeKey } from "@/src/lib/mushaf-theme";

// Profile-level memorization preferences persisted across sessions.
export type MemorizationViewMode = "ayah" | "page" | "test-mushaf";
export type MushafViewMode = "swipe" | "scroll";

export type ProfileSettings = {
  themeKey: ThemeKey;
  reciterId: string;
  viewMode: MemorizationViewMode;
  mushafViewMode: MushafViewMode;
};

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  themeKey: "madinah_day",
  reciterId: "husary",
  viewMode: "ayah",
  mushafViewMode: "swipe",
};

function profileKey(childId: string): string {
  return `noorpath:profile:${childId}`;
}

function normalizeProfileSettings(
  settings: Partial<ProfileSettings>,
): ProfileSettings {
  return {
    themeKey:
      typeof settings.themeKey === "string"
        ? (settings.themeKey as ThemeKey)
        : DEFAULT_PROFILE_SETTINGS.themeKey,
    reciterId:
      typeof settings.reciterId === "string" && settings.reciterId.length > 0
        ? settings.reciterId
        : DEFAULT_PROFILE_SETTINGS.reciterId,
    viewMode:
      settings.viewMode === "page"
        ? "page"
        : settings.viewMode === "test-mushaf"
          ? "test-mushaf"
          : DEFAULT_PROFILE_SETTINGS.viewMode,
    mushafViewMode:
      settings.mushafViewMode === "scroll"
        ? "scroll"
        : DEFAULT_PROFILE_SETTINGS.mushafViewMode,
  };
}

export async function loadProfileSettings(childId: string): Promise<ProfileSettings> {
  try {
    const raw = await AsyncStorage.getItem(profileKey(childId));
    if (!raw) return DEFAULT_PROFILE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>;
    return normalizeProfileSettings(parsed);
  } catch {
    return DEFAULT_PROFILE_SETTINGS;
  }
}

export async function saveProfileSettings(childId: string, settings: ProfileSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(profileKey(childId), JSON.stringify(normalizeProfileSettings(settings)));
  } catch {
    // best-effort
  }
}

export type DefaultSessionSettings = {
  repeatCount: number;
  autoAdvanceDelayMs: number;
  autoplayThroughRange: boolean;
  blurMode: boolean;
  blindMode: boolean;
  cumulativeReview: boolean;
  reviewRepeatCount: number;
  confetti: boolean;
};

// Session-level defaults applied fresh each memorization session.
export const DEFAULT_SESSION_SETTINGS: DefaultSessionSettings = {
  repeatCount: 1,
  autoAdvanceDelayMs: 0,
  autoplayThroughRange: true,
  blurMode: false,
  blindMode: false,
  cumulativeReview: false,
  reviewRepeatCount: 3,
  confetti: true,
};

function sessionDefaultsKey(childId: string): string {
  return `noorpath:session-defaults:${childId}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeSessionSettings(
  settings: Partial<DefaultSessionSettings>,
): DefaultSessionSettings {
  return {
    repeatCount: Math.round(
      clamp(
        typeof settings.repeatCount === "number"
          ? settings.repeatCount
          : DEFAULT_SESSION_SETTINGS.repeatCount,
        1,
        10,
      ),
    ),
    autoAdvanceDelayMs:
      Math.round(
        clamp(
          typeof settings.autoAdvanceDelayMs === "number"
            ? settings.autoAdvanceDelayMs
            : DEFAULT_SESSION_SETTINGS.autoAdvanceDelayMs,
          0,
          5000,
        ) / 500,
      ) * 500,
    autoplayThroughRange:
      typeof settings.autoplayThroughRange === "boolean"
        ? settings.autoplayThroughRange
        : DEFAULT_SESSION_SETTINGS.autoplayThroughRange,
    blurMode:
      typeof settings.blurMode === "boolean"
        ? settings.blurMode
        : DEFAULT_SESSION_SETTINGS.blurMode,
    blindMode:
      typeof settings.blindMode === "boolean"
        ? settings.blindMode
        : DEFAULT_SESSION_SETTINGS.blindMode,
    cumulativeReview:
      typeof settings.cumulativeReview === "boolean"
        ? settings.cumulativeReview
        : DEFAULT_SESSION_SETTINGS.cumulativeReview,
    reviewRepeatCount: Math.round(
      clamp(
        typeof settings.reviewRepeatCount === "number"
          ? settings.reviewRepeatCount
          : DEFAULT_SESSION_SETTINGS.reviewRepeatCount,
        1,
        10,
      ),
    ),
    confetti:
      typeof settings.confetti === "boolean"
        ? settings.confetti
        : DEFAULT_SESSION_SETTINGS.confetti,
  };
}

export async function loadDefaultSessionSettings(
  childId: string,
): Promise<DefaultSessionSettings> {
  try {
    const raw = await AsyncStorage.getItem(sessionDefaultsKey(childId));
    if (!raw) return DEFAULT_SESSION_SETTINGS;
    return normalizeSessionSettings(JSON.parse(raw) as Partial<DefaultSessionSettings>);
  } catch {
    return DEFAULT_SESSION_SETTINGS;
  }
}

export async function saveDefaultSessionSettings(
  childId: string,
  settings: DefaultSessionSettings,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      sessionDefaultsKey(childId),
      JSON.stringify(normalizeSessionSettings(settings)),
    );
  } catch {
    // best-effort
  }
}

export type MemorizationSessionBookmark = {
  surahNumber: number;
  surahName?: string;
  fromAyah: number;
  toAyah: number;
  currentAyah: number;
  repeatCount: number;
  autoAdvance: boolean;
  cumulativeReview: boolean;
  reviewRepeatCount: number;
  isReviewOnly?: boolean;
  pageStart?: number | null;
  pageEnd?: number | null;
  savedAt: number;
};

function memorizationBookmarkKey(childId: string): string {
  return `noorpath:memorization-bookmark:${childId}`;
}

function normalizeBookmark(
  bookmark: Partial<MemorizationSessionBookmark>,
): MemorizationSessionBookmark | null {
  const surahNumber = Math.round(bookmark.surahNumber ?? 0);
  const fromAyah = Math.round(bookmark.fromAyah ?? 0);
  const rawToAyah = Math.round(bookmark.toAyah ?? 0);
  if (surahNumber < 1 || fromAyah < 1 || rawToAyah < 1) return null;

  const toAyah = Math.max(fromAyah, rawToAyah);
  const currentAyah = Math.round(
    clamp(
      typeof bookmark.currentAyah === "number" ? bookmark.currentAyah : fromAyah,
      fromAyah,
      toAyah,
    ),
  );
  const repeatCount = Math.round(
    clamp(
      typeof bookmark.repeatCount === "number"
        ? bookmark.repeatCount
        : DEFAULT_SESSION_SETTINGS.repeatCount,
      1,
      10,
    ),
  );
  const reviewRepeatCount = Math.round(
    clamp(
      typeof bookmark.reviewRepeatCount === "number"
        ? bookmark.reviewRepeatCount
        : DEFAULT_SESSION_SETTINGS.reviewRepeatCount,
      1,
      10,
    ),
  );
  const savedAt =
    typeof bookmark.savedAt === "number" && Number.isFinite(bookmark.savedAt)
      ? bookmark.savedAt
      : Date.now();

  return {
    surahNumber,
    surahName: bookmark.surahName,
    fromAyah,
    toAyah,
    currentAyah,
    repeatCount,
    autoAdvance:
      typeof bookmark.autoAdvance === "boolean"
        ? bookmark.autoAdvance
        : DEFAULT_SESSION_SETTINGS.autoplayThroughRange,
    cumulativeReview:
      typeof bookmark.cumulativeReview === "boolean"
        ? bookmark.cumulativeReview
        : DEFAULT_SESSION_SETTINGS.cumulativeReview,
    reviewRepeatCount,
    isReviewOnly:
      typeof bookmark.isReviewOnly === "boolean" ? bookmark.isReviewOnly : undefined,
    pageStart: typeof bookmark.pageStart === "number" ? bookmark.pageStart : null,
    pageEnd: typeof bookmark.pageEnd === "number" ? bookmark.pageEnd : null,
    savedAt,
  };
}

export async function loadMemorizationSessionBookmark(
  childId: string,
): Promise<MemorizationSessionBookmark | null> {
  try {
    const raw = await AsyncStorage.getItem(memorizationBookmarkKey(childId));
    if (!raw) return null;
    return normalizeBookmark(JSON.parse(raw) as Partial<MemorizationSessionBookmark>);
  } catch {
    return null;
  }
}

export async function saveMemorizationSessionBookmark(
  childId: string,
  bookmark: MemorizationSessionBookmark,
): Promise<void> {
  const normalized = normalizeBookmark(bookmark);
  if (!normalized) return;
  try {
    await AsyncStorage.setItem(memorizationBookmarkKey(childId), JSON.stringify(normalized));
  } catch {
    // best-effort
  }
}

export async function clearMemorizationSessionBookmark(childId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(memorizationBookmarkKey(childId));
  } catch {
    // best-effort
  }
}
