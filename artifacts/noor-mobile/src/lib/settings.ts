import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeKey } from "@/src/lib/mushaf-theme";

// Profile-level settings — persist across sessions. Edit via a future Profile
// Settings page (Phase 2E). For now, defaults are hardcoded.
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

// Session-level defaults — hardcoded constants, applied fresh each session.
// Not persisted. Future Profile Settings page may let parents adjust these defaults.
export const DEFAULT_SESSION_SETTINGS = {
  repeatCount: 1,
  autoAdvanceDelayMs: 0,
  autoplayThroughRange: true,
  blurMode: false,
  blindMode: false,
} as const;
