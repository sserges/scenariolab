/** Decorative category glyph. Keyed by catalog category, never by scenario ID. */
export function ScenarioIcon({ category, className = "h-6 w-6" }: { category: string; className?: string }) {
  const common = {
    "aria-hidden": true,
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };
  if (category === "cybersecurity") {
    return (
      <svg {...common}>
        <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }
  if (category === "space") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="5" />
        <path d="M3.5 15.5c-1 1.8-.9 3 .1 3.6 2 1.1 7.3-1.1 11.9-5s7.3-8.4 6.2-10.4c-.6-1-1.9-1.1-3.7-.2" />
      </svg>
    );
  }
  if (category === "business") {
    return (
      <svg {...common}>
        <rect height="12" rx="2" width="18" x="3" y="7.5" />
        <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 12.5h18" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </svg>
  );
}
