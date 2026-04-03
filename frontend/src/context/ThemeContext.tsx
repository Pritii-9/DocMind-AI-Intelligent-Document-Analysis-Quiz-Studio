/* eslint-disable react-refresh/only-export-components */
import { useSyncExternalStore } from "react";

type ThemeMode = "light" | "dark";

const subscribers = new Set<() => void>();
let currentTheme: ThemeMode | null = null;

function getInitialTheme(): ThemeMode {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  const html = document.documentElement;
  html.classList.toggle("dark", theme === "dark");
  html.style.colorScheme = theme;
}

function ensureThemeInitialized() {
  if (currentTheme) return currentTheme;

  currentTheme = getInitialTheme();
  applyTheme(currentTheme);
  return currentTheme;
}

function emitChange() {
  subscribers.forEach((listener) => listener());
}

function setTheme(theme: ThemeMode) {
  if (theme === currentTheme) return;

  currentTheme = theme;
  applyTheme(theme);
  localStorage.setItem("theme", theme);
  emitChange();
}

function subscribe(listener: () => void) {
  subscribers.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== "theme") return;
    const nextTheme = event.newValue === "dark" ? "dark" : "light";
    currentTheme = nextTheme;
    applyTheme(nextTheme);
    listener();
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    subscribers.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot() {
  return ensureThemeInitialized();
}

ensureThemeInitialized();

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    theme,
    setTheme,
    toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
  };
}
