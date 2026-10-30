import { useEffect, useState } from "react";

import { getApiHealth } from "../lib/api";

type ConnectionState = "loading" | "connected" | "unavailable";

const statusContent: Record<ConnectionState, { label: string; dotClass: string }> = {
  loading: {
    label: "Checking API",
    dotClass: "bg-amber-400",
  },
  connected: {
    label: "API Connected",
    dotClass: "bg-emerald-400",
  },
  unavailable: {
    label: "API Unavailable",
    dotClass: "bg-rose-400",
  },
};

export function ApiStatus() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("loading");

  useEffect(() => {
    const controller = new AbortController();

    void getApiHealth(controller.signal)
      .then(() => setConnectionState("connected"))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setConnectionState("unavailable");
      });

    return () => controller.abort();
  }, []);

  const content = statusContent[connectionState];
  const isError = connectionState === "unavailable";

  return (
    <div
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold tracking-wide text-slate-200"
      role={isError ? "alert" : "status"}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${content.dotClass}`}
      />
      {content.label}
    </div>
  );
}
