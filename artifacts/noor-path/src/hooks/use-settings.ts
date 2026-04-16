import { useState, useEffect } from "react";

export type BlurIntensity = "low" | "medium" | "high";
export type FontSize = "small" | "medium" | "large";

export interface Settings {
  darkMode: boolean;
  confetti: boolean;
  autoAdvance: boolean;
  defaultRepeatCount: number;
  cumulativeReview: boolean;
  defaultReviewRepeatCount: number;
  blurIntensity: BlurIntensity;
  reciter: string;
  mushafTheme: string;
  fontSize: FontSize;
}

const SETTINGS_KEY = "noor-settings";
const DARK_MODE_KEY = "noor-dark-mode";
const MUSHAF_THEME_KEY = "mushaf-theme";

export const SETTINGS_DEFAULTS: Settings = {
  darkMode: false,
  confetti: true,
  autoAdvance: true,
  defaultRepeatCount: 3,
  cumulativeReview: false,
  defaultReviewRepeatCount: 3,
  blurIntensity: "medium",
  reciter: "husary",
  mushafTheme: "teal",
  fontSize: "medium",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    const darkMode = parsed.darkMode ?? (localStorage.getItem(DARK_MODE_KEY) === "true");
    return { ...SETTINGS_DEFAULTS, ...parsed, darkMode };
  } catch {
    return {
      ...SETTINGS_DEFAULTS,
      darkMode: localStorage.getItem(DARK_MODE_KEY) === "true",
    };
  }
}

function applyDarkMode(dark: boolean) {
  try {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem(DARK_MODE_KEY, String(dark));
  } catch { /* ignore */ }
}

function persist(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    // Keep legacy mushaf-theme key in sync for the memorization player
    localStorage.setItem(MUSHAF_THEME_KEY, s.mushafTheme);
  } catch { /* ignore */ }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    applyDarkMode(settings.darkMode);
  }, [settings.darkMode]);

  function updateSettings(patch: Partial<Settings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      if (patch.darkMode !== undefined) applyDarkMode(patch.darkMode);
      return next;
    });
  }

  return { settings, updateSettings };
}
