"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type IbadgeTheme = "light" | "dark";

const STORAGE_KEY = "ibadge-theme";

type ThemeContextValue = {
  theme: IbadgeTheme;
  setTheme: (theme: IbadgeTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyHtmlClass(next: IbadgeTheme) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.classList.toggle("dark", next === "dark");
  document.documentElement.setAttribute("data-theme", next);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<IbadgeTheme>("dark");
  /** Avoid overwriting localStorage and the document root class with default "dark" before we read stored preference. */
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        setThemeState(stored);
        applyHtmlClass(stored);
      } else {
        applyHtmlClass("dark");
      }
    } catch {
      applyHtmlClass("dark");
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
    applyHtmlClass(theme);
  }, [theme, storageReady]);

  const setTheme = useCallback((next: IbadgeTheme) => {
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useIbadgeTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useIbadgeTheme must be used within ThemeProvider");
  }
  return ctx;
}
