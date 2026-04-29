import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeKey } from "@/src/lib/mushaf-theme";

// Profile-level memorization preferences persisted across sessions.
export type ProfileSettings = {
  themeKey: ThemeKey;
  reciterId: string;
  viewMode: "ayah" | "page";
};

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  themeKey: "madinah_day",
  reciterId: "husary",
  viewMode: "ayah",
};

function profileKey(childId: string): string {
  return `noorpath:profile:${childId}`;
}

export async function loadProfileSettings(childId: string): Promise<ProfileSettings> {
  try {
    const raw = await AsyncStorage.getItem(profileKey(childId));
    if (!raw) return DEFAULT_PROFILE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>;
    return { ...DEFAULT_PROFILE_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_PROFILE_SETTINGS;
  }
}

export async function saveProfileSettings(childId: string, settings: ProfileSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(profileKey(childId), JSON.stringify(settings));
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
};

// Session-level defaults applied fresh each memorization session.
export const DEFAULT_SESSION_SETTINGS: DefaultSessionSettings = {
  repeatCount: 1,
  autoAdvanceDelayMs: 0,
  autoplayThroughRange: true,
  blurMode: false,
  blindMode: false,
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
