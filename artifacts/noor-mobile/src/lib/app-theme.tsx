import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import {
  Appearance,
  DynamicColorIOS,
  Platform,
  useColorScheme,
  type ColorValue,
  type ColorSchemeName,
} from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppThemePreference = "light" | "dark" | "system";
export type EffectiveAppTheme = "light" | "dark";

export type AppThemeColors = {
  background: string;
  surface: string;
  surfaceSubtle: string;
  surfaceElevated: string;
  surfaceInverse: string;
  border: string;
  borderStrong: string;
  separator: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;
  primary: string;
  primaryStrong: string;
  primarySoft: string;
  primaryBorder: string;
  success: string;
  successSoft: string;
  successBorder: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  overlay: string;
  shadow: string;
  input: string;
  inputBorder: string;
  disabled: string;
};

type AppThemeContextValue = {
  preference: AppThemePreference;
  effectiveTheme: EffectiveAppTheme;
  colors: AppThemeColors;
  isDark: boolean;
  setPreference: (preference: AppThemePreference) => void;
};

const STORAGE_KEY = "noorpath:app-theme";
const DEFAULT_PREFERENCE: AppThemePreference = "light";

export const APP_THEME_OPTIONS: {
  value: AppThemePreference;
  label: string;
  detail: string;
  icon: "sunny-outline" | "moon-outline" | "phone-portrait-outline";
}[] = [
  {
    value: "light",
    label: "Light",
    detail: "Keeps the current NoorPath look.",
    icon: "sunny-outline",
  },
  {
    value: "dark",
    label: "Dark",
    detail: "Uses darker app surfaces.",
    icon: "moon-outline",
  },
  {
    value: "system",
    label: "System",
    detail: "Follows this device.",
    icon: "phone-portrait-outline",
  },
];

export const APP_THEME_COLORS: Record<EffectiveAppTheme, AppThemeColors> = {
  light: {
    background: "#f8fafc",
    surface: "#ffffff",
    surfaceSubtle: "#f8fafc",
    surfaceElevated: "#ffffff",
    surfaceInverse: "#111827",
    border: "#e2e8f0",
    borderStrong: "#cbd5e1",
    separator: "#f1f5f9",
    text: "#111827",
    textMuted: "#64748b",
    textSubtle: "#94a3b8",
    textInverse: "#ffffff",
    primary: "#2563eb",
    primaryStrong: "#1d4ed8",
    primarySoft: "#eff6ff",
    primaryBorder: "#dbeafe",
    success: "#0f766e",
    successSoft: "#f0fdfa",
    successBorder: "#99f6e4",
    warning: "#b45309",
    warningSoft: "#fffbeb",
    warningBorder: "#fde68a",
    danger: "#dc2626",
    dangerSoft: "#fef2f2",
    dangerBorder: "#fecaca",
    overlay: "rgba(15, 23, 42, 0.42)",
    shadow: "#0f172a",
    input: "#ffffff",
    inputBorder: "#d1d5db",
    disabled: "#e5e7eb",
  },
  dark: {
    background: "#020617",
    surface: "#0f172a",
    surfaceSubtle: "#111827",
    surfaceElevated: "#1e293b",
    surfaceInverse: "#f8fafc",
    border: "#1e293b",
    borderStrong: "#334155",
    separator: "#172033",
    text: "#f8fafc",
    textMuted: "#cbd5e1",
    textSubtle: "#94a3b8",
    textInverse: "#0f172a",
    primary: "#60a5fa",
    primaryStrong: "#93c5fd",
    primarySoft: "rgba(37, 99, 235, 0.22)",
    primaryBorder: "rgba(96, 165, 250, 0.34)",
    success: "#5eead4",
    successSoft: "rgba(15, 118, 110, 0.24)",
    successBorder: "rgba(94, 234, 212, 0.28)",
    warning: "#fbbf24",
    warningSoft: "rgba(180, 83, 9, 0.22)",
    warningBorder: "rgba(251, 191, 36, 0.30)",
    danger: "#f87171",
    dangerSoft: "rgba(127, 29, 29, 0.32)",
    dangerBorder: "rgba(248, 113, 113, 0.28)",
    overlay: "rgba(2, 6, 23, 0.72)",
    shadow: "#000000",
    input: "#111827",
    inputBorder: "#334155",
    disabled: "#334155",
  },
};

function adaptiveColor(light: string, dark: string): ColorValue {
  if (Platform.OS === "ios") {
    return DynamicColorIOS({ light, dark });
  }

  // Non-iOS static StyleSheets still get the explicit hooked theme pass.
  return light;
}

export const APP_ADAPTIVE_COLORS = {
  background: adaptiveColor(APP_THEME_COLORS.light.background, APP_THEME_COLORS.dark.background),
  surface: adaptiveColor(APP_THEME_COLORS.light.surface, APP_THEME_COLORS.dark.surface),
  surfaceSubtle: adaptiveColor(
    APP_THEME_COLORS.light.surfaceSubtle,
    APP_THEME_COLORS.dark.surfaceSubtle,
  ),
  surfaceElevated: adaptiveColor(
    APP_THEME_COLORS.light.surfaceElevated,
    APP_THEME_COLORS.dark.surfaceElevated,
  ),
  surfaceInverse: adaptiveColor(
    APP_THEME_COLORS.light.surfaceInverse,
    APP_THEME_COLORS.dark.surfaceInverse,
  ),
  border: adaptiveColor(APP_THEME_COLORS.light.border, APP_THEME_COLORS.dark.border),
  borderStrong: adaptiveColor(
    APP_THEME_COLORS.light.borderStrong,
    APP_THEME_COLORS.dark.borderStrong,
  ),
  separator: adaptiveColor(APP_THEME_COLORS.light.separator, APP_THEME_COLORS.dark.separator),
  text: adaptiveColor(APP_THEME_COLORS.light.text, APP_THEME_COLORS.dark.text),
  textMuted: adaptiveColor(APP_THEME_COLORS.light.textMuted, APP_THEME_COLORS.dark.textMuted),
  textSubtle: adaptiveColor(APP_THEME_COLORS.light.textSubtle, APP_THEME_COLORS.dark.textSubtle),
  textInverse: adaptiveColor(APP_THEME_COLORS.light.textInverse, APP_THEME_COLORS.dark.textInverse),
  primary: adaptiveColor(APP_THEME_COLORS.light.primary, APP_THEME_COLORS.dark.primary),
  primaryStrong: adaptiveColor(
    APP_THEME_COLORS.light.primaryStrong,
    APP_THEME_COLORS.dark.primaryStrong,
  ),
  primarySoft: adaptiveColor(APP_THEME_COLORS.light.primarySoft, APP_THEME_COLORS.dark.primarySoft),
  primaryBorder: adaptiveColor(
    APP_THEME_COLORS.light.primaryBorder,
    APP_THEME_COLORS.dark.primaryBorder,
  ),
  success: adaptiveColor(APP_THEME_COLORS.light.success, APP_THEME_COLORS.dark.success),
  successSoft: adaptiveColor(APP_THEME_COLORS.light.successSoft, APP_THEME_COLORS.dark.successSoft),
  successBorder: adaptiveColor(
    APP_THEME_COLORS.light.successBorder,
    APP_THEME_COLORS.dark.successBorder,
  ),
  warning: adaptiveColor(APP_THEME_COLORS.light.warning, APP_THEME_COLORS.dark.warning),
  warningSoft: adaptiveColor(APP_THEME_COLORS.light.warningSoft, APP_THEME_COLORS.dark.warningSoft),
  warningBorder: adaptiveColor(
    APP_THEME_COLORS.light.warningBorder,
    APP_THEME_COLORS.dark.warningBorder,
  ),
  danger: adaptiveColor(APP_THEME_COLORS.light.danger, APP_THEME_COLORS.dark.danger),
  dangerSoft: adaptiveColor(APP_THEME_COLORS.light.dangerSoft, APP_THEME_COLORS.dark.dangerSoft),
  dangerBorder: adaptiveColor(
    APP_THEME_COLORS.light.dangerBorder,
    APP_THEME_COLORS.dark.dangerBorder,
  ),
  overlay: adaptiveColor(APP_THEME_COLORS.light.overlay, APP_THEME_COLORS.dark.overlay),
  shadow: adaptiveColor(APP_THEME_COLORS.light.shadow, APP_THEME_COLORS.dark.shadow),
  input: adaptiveColor(APP_THEME_COLORS.light.input, APP_THEME_COLORS.dark.input),
  inputBorder: adaptiveColor(APP_THEME_COLORS.light.inputBorder, APP_THEME_COLORS.dark.inputBorder),
  disabled: adaptiveColor(APP_THEME_COLORS.light.disabled, APP_THEME_COLORS.dark.disabled),
} satisfies Record<keyof AppThemeColors, ColorValue>;

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function normalizePreference(value: string | null): AppThemePreference {
  return value === "dark" || value === "system" || value === "light"
    ? value
    : DEFAULT_PREFERENCE;
}

function resolveEffectiveTheme(
  preference: AppThemePreference,
  systemScheme: ColorSchemeName,
): EffectiveAppTheme {
  if (preference === "dark") return "dark";
  if (preference === "system") return systemScheme === "dark" ? "dark" : "light";
  return "light";
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] =
    useState<AppThemePreference>(DEFAULT_PREFERENCE);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!cancelled) setPreferenceState(normalizePreference(value));
      })
      .catch(() => {
        if (!cancelled) setPreferenceState(DEFAULT_PREFERENCE);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveTheme = resolveEffectiveTheme(preference, systemScheme);
  const colors = APP_THEME_COLORS[effectiveTheme];

  useEffect(() => {
    Appearance.setColorScheme(preference === "system" ? null : preference);
  }, [preference]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {
      // best-effort; Android/iOS differ by version.
    });
  }, [colors.background]);

  const setPreference = useCallback((nextPreference: AppThemePreference) => {
    setPreferenceState(nextPreference);
    AsyncStorage.setItem(STORAGE_KEY, nextPreference).catch(() => {
      // best-effort preference persistence.
    });
  }, []);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      preference,
      effectiveTheme,
      colors,
      isDark: effectiveTheme === "dark",
      setPreference,
    }),
    [colors, effectiveTheme, preference, setPreference],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
}

export function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
