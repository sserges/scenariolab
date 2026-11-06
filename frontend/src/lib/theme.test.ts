import { expect, test, vi } from "vitest";

import {
  applyTheme,
  getInitialTheme,
  resolveTheme,
  saveThemePreference,
  THEME_STORAGE_KEY,
} from "./theme";

function setSystemPreference(prefersDark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: prefersDark }),
  );
}

test.each([
  [null, false, "light"],
  [null, true, "dark"],
  ["light", true, "light"],
  ["dark", false, "dark"],
  ["invalid", false, "light"],
] as const)("resolves theme from saved preference and system setting", (saved, systemDark, expected) => {
  expect(resolveTheme(saved, systemDark)).toBe(expected);
});

test.each([
  [false, "light"],
  [true, "dark"],
] as const)("uses the operating system preference on first visit", (systemDark, expected) => {
  setSystemPreference(systemDark);
  expect(getInitialTheme()).toBe(expected);
});

test("restores a saved theme before using the system preference", () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, "light");
  setSystemPreference(true);

  expect(getInitialTheme()).toBe("light");
});

test("updates the current session when localStorage cannot save a preference", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage unavailable", "SecurityError");
  });

  applyTheme("dark");
  expect(saveThemePreference("dark")).toBe(false);
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
});
