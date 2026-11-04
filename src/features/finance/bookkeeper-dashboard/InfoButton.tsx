"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type InfoButtonProps = {
  label: string;
  children: string;
};

/**
 * Keyboard- and touch-accessible info disclosure for financial KPI definitions and caveats.
 */
export function InfoButton({ label, children }: InfoButtonProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-6 items-center justify-center rounded-full text-[#5D6D63] transition hover:bg-[#EEF6EC] hover:text-[#123D2A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <span
          id={id}
          role="region"
          aria-label={`${label} explanation`}
          className="absolute right-0 top-7 z-30 w-64 rounded-lg border border-[#CAD8CB] bg-white p-3 text-left text-xs font-normal leading-5 text-[#294B39] shadow-[0_12px_28px_rgba(18,61,42,0.16)]"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

