import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeKey } from "@/src/lib/mushaf-theme";

export type ChildSettings = {
  repeatCount: number;
  autoAdvanceDelayMs: number;
  autoplayThroughRange: boolean;
  blurMode: boolean;
  blindMode: boolean;
  viewMode: "ayah" | "page";
  themeKey: ThemeKey;
  reciterId: string;
};

export const DEFAULT_SETTINGS: ChildSettings = {
  repeatCount: 1,
  autoAdvanceDelayMs: 0,
  autoplayThroughRange: true,
  blurMode: false,
  blindMode: false,
  viewMode: "ayah",
  themeKey: "madinah_day",
  reciterId: "husary",
};

function key(childId: string): string {
  return `noorpath:settings:${childId}`;
}

export async function loadSettings(childId: string): Promise<ChildSettings> {
  try {
    const raw = await AsyncStorage.getItem(key(childId));
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ChildSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(childId: string, settings: ChildSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(key(childId), JSON.stringify(settings));
  } catch {
    // Best-effort; silently swallow
  }
}
