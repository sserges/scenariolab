import type { Theme } from "../lib/theme";

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  const nextTheme = theme === "light" ? "Dark Mode" : "Classic Mode";

  return (
    <button
      aria-label={`Switch to ${nextTheme}`}
      aria-pressed={theme === "dark"}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-tint"
      onClick={onToggle}
      type="button"
    >
      <svg aria-hidden="true" className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24">
        {theme === "light" ? (
          <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36 6.36-1.42-1.42M7.05 7.05 5.64 5.64m12.72 0-1.41 1.41M7.05 16.95l-1.41 1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        ) : (
          <path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        )}
      </svg>
      <span>{theme === "light" ? "Classic" : "Dark"}</span>
    </button>
  );
}
