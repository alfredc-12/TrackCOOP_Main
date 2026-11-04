"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onInputChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  placeholder?: string;
  className?: string;
};

/** Editable variant of StyledSelect; selection stays separate from optional free-text input. */
export function SearchableCombobox(props: Props) {
  const { value, options, onChange, onInputChange, disabled, id, placeholder, className } = props;
  const generatedId = useId();
  const listId = `${generatedId}-options`;
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<CSSProperties>({});
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const filtered = options.filter(option => option.toLocaleLowerCase().includes((query ?? "").toLocaleLowerCase()));
  const effectiveActive = Math.max(0, Math.min(active, filtered.length - 1));
  const place = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dialog = inputRef.current?.closest<HTMLElement>("[role='dialog']");
    const fullscreen = document.fullscreenElement;
    setPortalContainer(dialog ?? (fullscreen instanceof HTMLElement ? fullscreen : document.body));
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const up = below < 180 && above > below;
    setPlacement({ position: "fixed", left: Math.max(12, Math.min(rect.left, window.innerWidth - rect.width - 12)), width: Math.min(rect.width, window.innerWidth - 24), maxHeight: Math.min(320, Math.max(80, (up ? above : below) - 6)), ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }) });
  };
  const show = () => { if (!disabled) { place(); setQuery(null); setActive(Math.max(0, options.indexOf(value))); setOpen(true); } };
  const close = () => { setOpen(false); setQuery(null); };
  const choose = (option: string) => { onChange(option); close(); inputRef.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!inputRef.current?.parentElement?.contains(target) && !popupRef.current?.contains(target)) { setOpen(false); setQuery(null); }
    };
    const reposition = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 12, above = rect.top - 12;
      const up = below < 180 && above > below;
      setPlacement({ position: "fixed", left: Math.max(12, Math.min(rect.left, window.innerWidth - rect.width - 12)), width: Math.min(rect.width, window.innerWidth - 24), maxHeight: Math.min(320, Math.max(80, (up ? above : below) - 6)), ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }) });
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => { document.removeEventListener("pointerdown", outside); window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); };
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${effectiveActive}`)?.scrollIntoView({ block: "nearest" });
  }, [open, effectiveActive, listId]);

  return <div className={cn("relative min-w-0", className)}>
    <input ref={inputRef} id={id} role="combobox" type="text" autoComplete="off" spellCheck={false} disabled={disabled}
      aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]} aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-activedescendant={open && filtered.length ? `${listId}-${effectiveActive}` : undefined}
      value={query ?? value} placeholder={placeholder}
      className="coop-field h-11 w-full min-w-0 rounded-coop-control border border-coop-border bg-coop-surface py-2 pl-3 pr-11 text-sm font-semibold text-coop-forest outline-none hover:border-coop-green focus-visible:ring-2 focus-visible:ring-coop-green/20 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={() => { if (!open) show(); }}
      onChange={event => { const text = event.target.value; setQuery(text); onInputChange?.(text); setActive(0); place(); setOpen(true); }}
      onBlur={event => { if (event.relatedTarget && !popupRef.current?.contains(event.relatedTarget as Node)) close(); }}
      onKeyDown={event => {
        if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); }
        else if (event.key === "Tab") close();
        else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); if (!open) show(); else setActive(index => Math.max(0, Math.min(filtered.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
        } else if (event.key === "Enter" && open) { event.preventDefault(); if (filtered[effectiveActive] !== undefined) choose(filtered[effectiveActive]); }
      }} />
    <button type="button" tabIndex={-1} aria-label={open ? "Close options" : "Show options"} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => { if (open) close(); else { inputRef.current?.focus(); show(); } }} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-coop-secondary"><ChevronDown aria-hidden="true" className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} /></button>
    {open && createPortal(<div ref={popupRef} role="listbox" id={listId} aria-label={props["aria-label"] ?? "Available options"} style={placement} className="z-[100] overflow-y-auto overscroll-contain rounded-coop-panel border border-coop-border bg-coop-surface p-1.5 text-coop-forest shadow-coop-floating">
      {filtered.length ? filtered.map((option, index) => <div role="option" aria-selected={option === value} id={`${listId}-${index}`} key={option} onPointerDown={event => { if (event.pointerType === "mouse") event.preventDefault(); }} onClick={() => choose(option)} onPointerMove={event => { if (event.pointerType === "mouse") setActive(index); }} className={cn("relative flex min-h-11 cursor-pointer select-none items-center justify-between gap-3 rounded-coop-control py-2.5 pl-3 pr-9 text-sm font-semibold text-coop-secondary", (index === effectiveActive || option === value) && "bg-coop-sage text-coop-forest")}>
        {option}{option === value && <span aria-hidden="true" className="absolute right-3 size-1.5 rounded-full bg-coop-green" />}
      </div>) : <p role="status" className="p-3 text-sm text-coop-muted">No matching options.</p>}
    </div>, portalContainer ?? document.body)}
  </div>;
}
