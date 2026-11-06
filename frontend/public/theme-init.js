(() => {
  const key = "scenariolab.theme";
  let theme = null;

  try {
    const stored = window.localStorage.getItem(key);
    if (stored === "light" || stored === "dark") {
      theme = stored;
    }
  } catch {
    // Continue with the system preference when storage is unavailable.
  }

  if (theme === null) {
    theme = window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
