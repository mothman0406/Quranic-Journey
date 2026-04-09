import { useState, useEffect } from "react";

const STORAGE_KEY = "noor-dark-mode";

export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(isDarkMode));
    } catch {
      /* ignore */
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((d) => !d);

  return { isDarkMode, toggleDarkMode };
}
