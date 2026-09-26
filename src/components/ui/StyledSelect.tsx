"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type StyledSelectProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  prefix?: string;
};

export function StyledSelect({ value, options, onChange, disabled, prefix }: StyledSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionsId = useId();

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={rootRef} className="styled-select-root relative">
      <button ref={triggerRef} type="button" disabled={disabled} onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="listbox" aria-controls={optionsId}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
          }
        }}
        className="flex h-11 w-full items-center justify-between rounded-md border border-[#9BC7A9] bg-[#F7F8F3] px-4 text-left text-sm font-bold text-[#123D2A] outline-none transition hover:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20 disabled:opacity-60">
        <span>{prefix ? `${prefix}: ${value}` : value}</span>
        <ChevronDown size={17} className={`text-[#527765] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id={optionsId} role="listbox" aria-label={prefix ?? "Options"} className="absolute inset-x-0 top-[calc(100%+6px)] z-50 rounded-xl border border-[#D4E5D8] bg-white p-2 shadow-[0_14px_30px_rgba(18,61,42,0.14)]">
          {options.map((option) => (
            <button type="button" role="option" aria-selected={option === value} key={option} onClick={() => { onChange(option); setOpen(false); triggerRef.current?.focus(); }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition ${option === value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#466B59] hover:bg-[#F4F8F3]"}`}>
              <span>{prefix ? `${prefix}: ${option}` : option}</span>
              {option === value && <Check size={18} className="text-[#16804D]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
