"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

/**
 * Multi-choice list for filters that take several values (categories, source modules, classifications).
 * A labelled button opens a panel of checkboxes with optional search. Escape closes it and returns focus
 * to the button; a click elsewhere closes it too.
 */
export function MultiPicker({ label, allLabel, options, value, onChange, searchable }: {
  label: string;
  allLabel: string;
  options: Array<{ value: string; label: string; hint?: string }>;
  value: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) { setOpen(false); setQuery(""); }
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const close = () => { setOpen(false); setQuery(""); button.current?.focus(); };
  const needle = query.trim().toLocaleLowerCase("en-PH");
  const visible = needle ? options.filter((option) => option.label.toLocaleLowerCase("en-PH").includes(needle)) : options;
  const summary = value.length === 0 ? allLabel : value.length === 1 ? (options.find((option) => option.value === value[0])?.label ?? "1 selected") : `${value.length} selected`;
  const toggle = (next: string) => onChange(value.includes(next) ? value.filter((item) => item !== next) : [...value, next]);

  return (
    <div ref={root} className="relative min-w-0" onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); close(); } }}>
      <button
        ref={button}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-[#9BC7A9] bg-[#F7F8F3] px-3 text-left text-sm font-semibold text-[#123D2A] outline-none transition hover:border-[#1F6B43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]"
      >
        <span className="min-w-0 truncate"><span className="font-normal text-[#5D6D63]">{label}: </span>{summary}</span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div id={id} role="group" aria-label={label} className="absolute inset-x-0 top-[calc(100%+6px)] z-50 min-w-[14rem] rounded-xl border border-[#D4E5D8] bg-white p-2 shadow-[0_14px_30px_rgba(18,61,42,0.14)]">
          {searchable ? (
            <label className="relative mb-2 block">
              <span className="sr-only">Search {label.toLowerCase()}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
              <input type="search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}`} className="h-10 w-full rounded-md border border-[#CAD8CB] bg-white pl-9 pr-2 text-sm outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/10" />
            </label>
          ) : null}
          <ul className="max-h-64 overflow-y-auto overscroll-contain">
            {visible.map((option) => {
              const checked = value.includes(option.value);
              return (
                <li key={option.value}>
                  <label className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-[#EAF3E8] ${checked ? "text-[#123D2A]" : "text-[#466B59]"}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(option.value)} className="peer sr-only" />
                    <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded border ${checked ? "border-[#1F6B43] bg-[#1F6B43] text-white" : "border-[#9BC7A9] bg-white"} peer-focus-visible:ring-2 peer-focus-visible:ring-[#1F6B43]/50`}>
                      {checked ? <Check className="size-3.5" /> : null}
                    </span>
                    <span className="min-w-0 break-words">{option.label}{option.hint ? <span className="block text-xs font-normal text-[#5D6D63]">{option.hint}</span> : null}</span>
                  </label>
                </li>
              );
            })}
            {!visible.length ? <li role="status" className="p-3 text-sm text-[#5D6D63]">No matching options.</li> : null}
          </ul>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#E1E8E2] pt-2">
            <button type="button" onClick={() => onChange([])} disabled={!value.length} className="min-h-10 px-2 text-sm font-bold text-[#123D2A] underline-offset-4 hover:underline disabled:opacity-40">Clear</button>
            <button type="button" onClick={close} className="min-h-10 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white">Done</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
