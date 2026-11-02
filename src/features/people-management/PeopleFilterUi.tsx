"use client";

import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Check, ChevronDown, Filter, Info, Search, SlidersHorizontal, X } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { useDebouncedText } from "./people-hooks";
import type { FilterChip } from "./people-filters";
import type { KpiDetail, KpiSpec, KpiTone } from "./people-kpis";

/**
 * Shared KPI cards and filter controls for the four People Management views. Presentation only: the
 * numbers, filters and click behaviour come from people-kpis.ts and people-filters.ts.
 */

const field = "h-11 w-full rounded-md border border-[#CAD8CB] bg-white text-sm font-semibold text-[#123D2A] outline-none transition placeholder:font-normal placeholder:text-[#7D8C82] hover:border-[#1F6B43]/55 focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/10 disabled:opacity-60";

// ---------------------------------------------------------------- KPI cards

const toneStyles: Record<KpiTone, string> = {
  neutral: "bg-[#EEF7ED] text-[#1F6B43]",
  good: "bg-[#E3F4E7] text-[#16804D]",
  warning: "bg-[#FFF4D6] text-[#8A5A00]",
  danger: "bg-[#FBE7E4] text-[#A13226]",
};

function KpiInfo({ label, detail }: { label: string; detail: KpiDetail }) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const open = pinned || hovered;

  useEffect(() => {
    if (!pinned) return;
    const away = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPinned(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [pinned]);

  return (
    <div ref={rootRef} className="absolute right-2 top-2" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`How ${label} is calculated`}
        onClick={() => setPinned((current) => !current)}
        className="grid size-8 place-items-center rounded-full text-[#5D6D63] outline-none transition hover:bg-[#EEF2EC] hover:text-[#123D2A] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40"
      >
        <Info className="size-4" aria-hidden="true" />
      </button>
      {open ? (
        <div id={id} role="note" className="absolute right-0 top-9 z-30 w-[min(18rem,calc(100vw-2.5rem))] rounded-lg border border-[#CAD8CB] bg-white p-3 text-left text-xs leading-5 text-[#365F4A] shadow-[0_14px_30px_rgba(18,61,42,0.16)]">
          <p className="font-black text-[#123D2A]">{label}</p>
          <p className="mt-1">{detail.definition}</p>
          <p className="mt-2"><span className="font-bold text-[#123D2A]">Counted from: </span>{detail.population}</p>
          {detail.basis ? <p className="mt-2"><span className="font-bold text-[#123D2A]">Calculation: </span>{detail.basis}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function KpiCard<Query>({
  spec,
  icon: Icon,
  onSelect,
  loading,
}: {
  spec: KpiSpec<Query>;
  icon: ComponentType<{ className?: string }>;
  /** Called with the filter to apply, or the one that clears this card's selection. */
  onSelect?: (patch: Partial<Query>) => void;
  loading?: boolean;
}) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-2 pr-8">
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${toneStyles[spec.tone]}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 truncate text-[0.72rem] font-semibold text-[#5D6D63]">{spec.label}</span>
      </span>
      <span className="flex items-baseline gap-2">
        <span className="text-2xl font-black leading-none text-[#123D2A]">{loading ? "…" : spec.value}</span>
        {spec.selected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#123D2A] px-2 py-0.5 text-[0.65rem] font-bold text-white">
            <Check className="size-3" aria-hidden="true" />Filtering
          </span>
        ) : null}
      </span>
      <span className="text-xs leading-4 text-[#5D6D63]">{loading ? "Loading…" : spec.caption}</span>
    </>
  );
  const frame = `relative min-w-0 rounded-lg border bg-white shadow-[0_10px_24px_rgba(18,61,42,0.05)] transition ${
    spec.selected ? "border-[#1F6B43] bg-[#F4FAF2] ring-2 ring-[#82E6A7]/40" : "border-[#CAD8CB]"
  }`;

  return (
    <article className={frame}>
      {onSelect ? (
        <button
          type="button"
          aria-pressed={spec.selected}
          aria-label={`${spec.label}: ${loading ? "loading" : spec.value}. ${spec.selected ? "Filtering the list. Select to show all." : "Select to filter the list."}`}
          onClick={() => onSelect(spec.selected ? spec.clear : spec.apply)}
          className="flex w-full min-w-0 flex-col gap-1.5 rounded-lg p-3 text-left outline-none transition hover:bg-[#FBFCF8] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-col gap-1.5 p-3">{body}</div>
      )}
      {spec.breakdown?.length ? (
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          {spec.breakdown.map((part) => (
            <button
              key={part.key}
              type="button"
              aria-pressed={Boolean(part.selected)}
              disabled={!onSelect || !part.apply}
              onClick={() => onSelect?.(part.selected ? (part.clear ?? spec.clear) : (part.apply ?? spec.apply))}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40 ${
                part.selected ? "border-[#1F6B43] bg-[#123D2A] text-white" : "border-[#CAD8CB] bg-white text-[#365F4A] hover:bg-[#EEF2EC]"
              }`}
            >
              {part.label}
              <span className="font-black">{loading ? "…" : part.value}</span>
            </button>
          ))}
        </div>
      ) : null}
      <KpiInfo label={spec.label} detail={spec.detail} />
    </article>
  );
}

export function KpiGrid<Query>({
  specs,
  icons,
  onSelect,
  onClear,
  loading,
  error,
  onRetry,
  scopeNote,
  columns = "sm:grid-cols-2 xl:grid-cols-4",
}: {
  specs: Array<KpiSpec<Query>>;
  icons: Record<string, ComponentType<{ className?: string }>>;
  onSelect: (patch: Partial<Query>) => void;
  /** Clears whichever card is selected. */
  onClear: (patch: Partial<Query>) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  /** One line saying what population the numbers describe. */
  scopeNote?: ReactNode;
  columns?: string;
}) {
  const selected = specs.find((spec) => spec.selected || spec.breakdown?.some((part) => part.selected));
  return (
    <section aria-label="Key figures" className="grid gap-2" aria-busy={loading || undefined}>
      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E6B9B3] bg-[#FDF3F1] px-3 py-2 text-sm text-[#8A2A20]">
          <span>{error}</span>
          {onRetry ? <button type="button" onClick={onRetry} className="font-bold underline underline-offset-4">Retry</button> : null}
        </div>
      ) : null}
      {scopeNote || selected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5D6D63]">
          <p>{scopeNote}</p>
          {selected ? (
            <button type="button" onClick={() => onClear(selected.clear)} className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 font-bold text-[#123D2A] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#1F6B43]">
              <X className="size-3.5" aria-hidden="true" />Clear card selection
            </button>
          ) : null}
        </div>
      ) : null}
      <div className={`grid gap-3 ${columns}`}>
        {specs.map((spec) => (
          <KpiCard key={spec.key} spec={spec} icon={icons[spec.key] ?? Filter} onSelect={onSelect} loading={loading && !error} />
        ))}
      </div>
    </section>
  );
}

/** Smaller clickable counts under the cards (for example "Pending approval 2"). */
export function SupportStats<Query>({ stats, onSelect }: {
  stats: Array<{ key: string; label: string; value: string; selected: boolean; apply: Partial<Query>; clear: Partial<Query> }>;
  onSelect: (patch: Partial<Query>) => void;
}) {
  return (
    <ul aria-label="More counts" className="flex flex-wrap gap-2">
      {stats.map((stat) => (
        <li key={stat.key}>
          <button
            type="button"
            aria-pressed={stat.selected}
            onClick={() => onSelect(stat.selected ? stat.clear : stat.apply)}
            className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40 ${
              stat.selected ? "border-[#1F6B43] bg-[#123D2A] text-white" : "border-[#CAD8CB] bg-white text-[#365F4A] hover:bg-[#EEF2EC]"
            }`}
          >
            {stat.label}
            <span className="font-black">{stat.value}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- filter controls

export function FilterPanel<Query>({ children, chips, onRemoveChip, onClearAll }: {
  children: ReactNode;
  chips: Array<FilterChip<Query>>;
  onRemoveChip: (chip: FilterChip<Query>) => void;
  onClearAll: () => void;
}) {
  return (
    <section aria-label="Filters" className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-3 shadow-[0_10px_24px_rgba(18,61,42,0.04)] sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-black text-[#123D2A]">
          <Filter className="size-4" aria-hidden="true" />
          Filters
        </div>
        {chips.length ? (
          <button type="button" onClick={onClearAll} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-bold text-[#123D2A] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#1F6B43]">
            <X className="size-4" aria-hidden="true" />Clear all
          </button>
        ) : null}
      </div>
      {children}
      {chips.length ? (
        <ul aria-label="Active filters" className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.key} className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#CAD8CB] bg-[#F4FAF2] py-1 pl-3 pr-1 text-xs font-semibold text-[#123D2A]">
              <span className="min-w-0 break-words">{chip.label}</span>
              <button type="button" aria-label={`Remove filter: ${chip.label}`} onClick={() => onRemoveChip(chip)} className="grid size-7 shrink-0 place-items-center rounded-full outline-none hover:bg-[#DDE8DD] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40">
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Search box that waits for a pause in typing before it changes the query. */
export function SearchField({ value, onCommit, placeholder, label }: { value: string; onCommit: (text: string) => void; placeholder: string; label: string }) {
  const { text, setText, flush } = useDebouncedText(value, onCommit);
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") flush(); }}
        onBlur={flush}
        placeholder={placeholder}
        className={`${field} pl-10 pr-3`}
      />
    </label>
  );
}

/** Shared StyledSelect with readable labels while the underlying API values stay unchanged. */
export function FilterSelect<T extends string>({ label, value, options, onChange, disabled }: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const current = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "";
  return (
    <StyledSelect
      prefix={label}
      value={current}
      disabled={disabled}
      options={options.map((option) => option.label)}
      onChange={(next) => {
        const match = options.find((option) => option.label === next);
        if (match) onChange(match.value);
      }}
    />
  );
}

/** Searchable single-choice list for long option sets such as barangays or actors. */
export function SearchableFilterSelect({ label, value, options, allLabel, onChange, extra }: {
  label: string;
  /** The selected option's value, or "" for "all". */
  value: string;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
  onChange: (value: string) => void;
  /** Rendered after the all option, e.g. a "No recorded actor" choice. */
  extra?: Array<{ value: string; label: string }>;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const all = [{ value: "", label: allLabel }, ...(extra ?? []), ...options];
  const selected = all.find((option) => option.value === value);
  const needle = (query ?? "").trim().toLocaleLowerCase("en-PH");
  const visible = needle ? all.filter((option) => option.label.toLocaleLowerCase("en-PH").includes(needle)) : all;
  const activeIndex = Math.max(0, Math.min(active, visible.length - 1));

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) { setOpen(false); setQuery(null); }
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, listId]);

  const choose = (option: { value: string; label: string }) => {
    onChange(option.value);
    setOpen(false);
    setQuery(null);
  };

  return (
    <div ref={rootRef} className="relative min-w-0 self-start">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        type="text"
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && visible.length ? `${listId}-${activeIndex}` : undefined}
        placeholder={`${label}: ${allLabel}`}
        value={query ?? (value ? `${label}: ${selected?.label ?? value}` : "")}
        onClick={() => { if (!open) { setOpen(true); setActive(Math.max(0, all.findIndex((option) => option.value === value))); } }}
        onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); setQuery(null); }
          else if (event.key === "Tab") { setOpen(false); setQuery(null); }
          else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) setOpen(true);
            else setActive(Math.max(0, Math.min(visible.length - 1, activeIndex + (event.key === "ArrowDown" ? 1 : -1))));
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (visible[activeIndex]) choose(visible[activeIndex]);
          }
        }}
        className={`${field} pl-3 pr-10 ${value ? "" : "placeholder:font-semibold placeholder:text-[#123D2A]"}`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? `Close ${label} options` : `Show ${label} options`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => { if (open) { setOpen(false); setQuery(null); } else { inputRef.current?.focus(); setOpen(true); } }}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-[#527765]"
      >
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div id={listId} role="listbox" aria-label={label} className="absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-[#D4E5D8] bg-white p-1.5 shadow-[0_14px_30px_rgba(18,61,42,0.14)]">
          {visible.length ? visible.map((option, index) => (
            <div
              key={option.value || "__all__"}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
              onPointerMove={() => setActive(index)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${index === activeIndex ? "bg-[#EAF3E8] text-[#123D2A]" : "text-[#466B59]"}`}
            >
              <span className="min-w-0 break-words">{option.label}</span>
              {option.value === value ? <Check className="size-4 shrink-0 text-[#16804D]" aria-hidden="true" /> : null}
            </div>
          )) : <p role="status" className="p-3 text-sm text-[#5D6D63]">No matching options.</p>}
        </div>
      ) : null}
    </div>
  );
}

/** Two date pickers that keep start ≤ end. Either can be cleared. */
export function DateRangeFilter({ label, from, to, onChange, error }: {
  label: string;
  from?: string;
  to?: string;
  onChange: (range: { from?: string; to?: string }) => void;
  error?: string | null;
}) {
  const trigger = "h-11 rounded-md border-[#CAD8CB] px-3 text-sm focus:ring-[#1F6B43]/10";
  return (
    <fieldset className="grid min-w-0 gap-1 border-0 p-0">
      <legend className="mb-1 text-xs font-semibold text-[#5D6D63]">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <DatePicker label={`${label}: from`} hideLabel value={from ?? ""} max={to || undefined} placeholder="From" allowClear clearLabel={`Clear ${label.toLowerCase()} start`} triggerClassName={trigger} onChange={(next) => onChange({ from: next || undefined, to })} />
        <DatePicker label={`${label}: to`} hideLabel value={to ?? ""} min={from || undefined} placeholder="To" allowClear clearLabel={`Clear ${label.toLowerCase()} end`} triggerClassName={trigger} onChange={(next) => onChange({ from, to: next || undefined })} />
      </div>
      {error ? <p role="alert" className="text-xs font-semibold text-[#A13226]">{error}</p> : null}
    </fieldset>
  );
}

/** Collapsible group for the less-used filters. Opens by default when one of them is active. */
export function MoreFilters({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(activeCount > 0);
  return (
    <div className="grid gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-bold text-[#123D2A] outline-none transition hover:bg-[#EEF2EC] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40 sm:w-auto sm:justify-self-start"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        More filters
        {activeCount ? <span className="grid min-w-5 place-items-center rounded-full bg-[#123D2A] px-1.5 text-[0.7rem] font-black text-white">{activeCount}<span className="sr-only"> active</span></span> : null}
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div id={id} hidden={!open} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

/** "42 of 126 applications match the selected filters." */
export function ResultSummary({ total, overall, noun, filtered, loading }: {
  total: number;
  /** Population with no filters at all, when the server reports it. */
  overall?: number | null;
  noun: string;
  filtered: boolean;
  loading?: boolean;
}) {
  const format = new Intl.NumberFormat("en-PH");
  return (
    <p aria-live="polite" className="text-sm font-semibold text-[#365F4A]">
      {loading ? "Updating results…" : filtered
        ? `${format.format(total)}${overall != null ? ` of ${format.format(overall)}` : ""} ${noun} match the selected filters.`
        : `${format.format(total)} ${noun}.`}
    </p>
  );
}

export function InlineNote({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-5 text-[#5D6D63]">{children}</p>;
}
