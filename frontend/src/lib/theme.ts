export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "scenariolab.theme";

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function resolveTheme(
  storedTheme: string | null,
  systemPrefersDark: boolean,
): Theme {
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }
  return systemPrefersDark ? "dark" : "light";
}

export function getInitialTheme(): Theme {
  let storedTheme: string | null = null;
  try {
    storedTheme = getStorage()?.getItem(THEME_STORAGE_KEY) ?? null;
  } catch {
    // Private browsing and storage policies can disable localStorage.
  }

  const systemPrefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  return resolveTheme(storedTheme, systemPrefersDark);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function saveThemePreference(theme: Theme): boolean {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}
