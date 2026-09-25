"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

export function RetryButton({ onRetry }: { onRetry: () => void | Promise<void> }) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRetry}
      disabled={retrying}
      aria-busy={retrying}
      className="mt-3 rounded-md bg-[#8F2F25] px-4 py-2 font-bold text-white hover:bg-[#73251D] disabled:cursor-wait disabled:opacity-60"
    >
      {retrying ? (
        <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Retrying...
        </span>
      ) : "Try again"}
    </button>
  );
}
