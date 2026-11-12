"use client";

import {
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { calendarDateInMonth } from "@/lib/calendar-date";

type DatePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabledDates?: string[];
  disabled?: boolean;
  placeholder?: string;
  error?: string;
  className?: string;
  hideLabel?: boolean;
  triggerClassName?: string;
  allowClear?: boolean;
  clearLabel?: string;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekdayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return toDateKey(new Date());
}

function parseDateKey(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDate(value: string) {
  const date = parseDateKey(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function isOutsideRange(dateKey: string, min: string, max: string) {
  return dateKey < min || dateKey > max;
}

export function DatePicker({
  label,
  value,
  onChange,
  min = "1900-01-01",
  max = todayKey(),
  disabledDates = [],
  disabled = false,
  placeholder = "Select date",
  error,
  className,
  hideLabel = false,
  triggerClassName,
  allowClear = false,
  clearLabel = "Clear",
}: DatePickerProps) {
  const labelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedDate = useMemo(() => parseDateKey(value), [value]);
  const maxDate = useMemo(() => parseDateKey(max) ?? new Date(), [max]);
  const minDate = useMemo(() => parseDateKey(min) ?? new Date(1900, 0, 1), [min]);
  const unavailableDates = useMemo(() => new Set(disabledDates), [disabledDates]);
  const initialDate = selectedDate ?? (parseDateKey(todayKey() < min ? min : todayKey() > max ? max : todayKey()) ?? minDate);
  const [isOpen, setIsOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<Element | null>(null);
  const [viewMonth, setViewMonth] = useState(
    initialDate.getMonth(),
  );
  const [viewYear, setViewYear] = useState(
    initialDate.getFullYear(),
  );
  const [pendingDateKey, setPendingDateKey] = useState(value);
  const draftSourceValue = useRef(value);
  const preferredDay = useRef(selectedDate?.getDate() ?? null);
  const [openSelector, setOpenSelector] = useState<"month" | "year" | null>(null);
  const [pickerPosition, setPickerPosition] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  const positionPicker = useCallback(() => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return;

    const pickerWidth = Math.min(320, Math.max(0, window.innerWidth - 32));
    const left = Math.max(
      16,
      Math.min(
        window.innerWidth - pickerWidth - 16,
        triggerRect.left + (triggerRect.width - pickerWidth) / 2,
      ),
    );
    const estimatedPickerHeight = 360;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const direction = spaceBelow < estimatedPickerHeight && spaceAbove > estimatedPickerHeight ? "up" : "down";

    setPickerPosition(
      direction === "up"
        ? { left, bottom: Math.max(16, window.innerHeight - triggerRect.top + 8) }
        : { left, top: triggerRect.bottom + 8 },
    );
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        rootRef.current?.contains(event.target as Node) ||
        pickerRef.current?.contains(event.target as Node)
      ) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    positionPicker();
    const handleViewportChange = () => positionPicker();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, positionPicker]);

  const years = useMemo(() => {
    const startYear = minDate.getFullYear();
    const endYear = maxDate.getFullYear();

    return Array.from(
      { length: endYear - startYear + 1 },
      (_, index) => endYear - index,
    );
  }, [maxDate, minDate]);

  const days = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const firstGridDate = new Date(
      viewYear,
      viewMonth,
      1 - firstOfMonth.getDay(),
    );

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(
        firstGridDate.getFullYear(),
        firstGridDate.getMonth(),
        firstGridDate.getDate() + index,
      );
      const dateKey = toDateKey(date);

      return {
        date,
        dateKey,
        isCurrentMonth: date.getMonth() === viewMonth,
        isDisabled: isOutsideRange(dateKey, min, max) || unavailableDates.has(dateKey),
        isSelected: pendingDateKey === dateKey,
        isToday: todayKey() === dateKey,
      };
    });
  }, [max, min, pendingDateKey, unavailableDates, viewMonth, viewYear]);

  function resetDraft() {
    const anchorDate = initialDate;
    setViewMonth(anchorDate.getMonth());
    setViewYear(anchorDate.getFullYear());
    setPendingDateKey(value);
    preferredDay.current = selectedDate?.getDate() ?? null;
    draftSourceValue.current = value;
  }

  function togglePicker() {
    if (!isOpen) {
      setPortalContainer(rootRef.current?.closest('[role="dialog"]') ?? document.body);
      // Dismissal keeps the draft; a change made by the parent replaces it.
      if (draftSourceValue.current !== value) resetDraft();
      setPickerPosition(null);
    }

    setOpenSelector(null);
    setIsOpen((current) => !current);
  }

  function selectDate(dateKey: string) {
    if (isOutsideRange(dateKey, min, max) || unavailableDates.has(dateKey)) return;
    const date = parseDateKey(dateKey)!;
    preferredDay.current = date.getDate();
    setViewMonth(date.getMonth());
    setViewYear(date.getFullYear());
    setPendingDateKey(dateKey);
  }

  function changeMonth(year: number, month: number) {
    const anchor = parseDateKey(calendarDateInMonth(year, month, 1, min, max))!;
    setViewMonth(anchor.getMonth());
    setViewYear(anchor.getFullYear());
    if (preferredDay.current !== null) {
      setPendingDateKey(calendarDateInMonth(year, month, preferredDay.current, min, max));
    }
    setOpenSelector(null);
  }

  const displayValue = formatDate(value);

  return (
    <div ref={rootRef} className={cn("date-picker-root relative", className)}>
      <label
        id={labelId}
        className={cn(
          "block text-sm font-bold text-coop-secondary",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </label>

      <button
        type="button"
        ref={triggerRef}
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={togglePicker}
        className={cn(
          "mt-2 flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[#DDE8D8] bg-white px-4 text-left text-base text-coop-forest outline-none transition hover:border-[#B9D1B6] focus:border-coop-green focus:ring-2 focus:ring-[#1F6B43]/20",
          hideLabel && "mt-0",
          triggerClassName,
        )}
      >
        <span
          className={cn(
            "min-w-0 truncate font-semibold",
            !displayValue && "font-medium text-[#7B8D82]",
          )}
        >
          {displayValue || placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-coop-green">
          <CalendarDays className="size-4" />
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </span>
      </button>

      {isOpen && pickerPosition ? createPortal(
        <div
          ref={pickerRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby={labelId}
          style={{
            left: pickerPosition.left,
            ...(pickerPosition.top !== undefined ? { top: pickerPosition.top } : { bottom: pickerPosition.bottom }),
          }}
          className="fixed z-[100] w-[20rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-coop-border bg-white p-4 shadow-[0_20px_50px_rgba(18,61,42,0.18)] ring-1 ring-[#F8F1E5]"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <button
                type="button"
                aria-label="Month"
                aria-haspopup="listbox"
                aria-expanded={openSelector === "month"}
                onClick={() => setOpenSelector((current) => current === "month" ? null : "month")}
                className="flex h-9 w-full items-center justify-between gap-1 rounded-xl border border-[#DDE8D8] bg-[#FBFBFA] px-3 text-left text-[0.72rem] font-black text-coop-forest outline-none transition hover:border-[#B9D1B6] focus:border-coop-green focus:ring-2 focus:ring-[#1F6B43]/15"
              >
                <span className="truncate">{monthNames[viewMonth]}</span>
                <ChevronDown className={cn("size-3.5 shrink-0 text-coop-green transition-transform", openSelector === "month" && "rotate-180")} />
              </button>
              {openSelector === "month" ? (
                <div role="listbox" aria-label="Month options" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#DDE8D8] bg-white p-1.5 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">
                  {monthNames.map((month, index) => (
                    <button
                      key={month}
                      type="button"
                      role="option"
                      aria-selected={viewMonth === index}
                      onClick={() => changeMonth(viewYear, index)}
                      className={cn("flex min-h-8 w-full items-center rounded-lg px-2.5 text-left text-[0.72rem] font-bold text-coop-secondary transition hover:bg-coop-sage", viewMonth === index && "bg-coop-green text-white hover:bg-coop-green")}
                    >
                      {month}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                type="button"
                aria-label="Year"
                aria-haspopup="listbox"
                aria-expanded={openSelector === "year"}
                onClick={() => setOpenSelector((current) => current === "year" ? null : "year")}
                className="flex h-9 w-full items-center justify-between gap-1 rounded-xl border border-[#DDE8D8] bg-[#FBFBFA] px-3 text-left text-[0.72rem] font-black text-coop-forest outline-none transition hover:border-[#B9D1B6] focus:border-coop-green focus:ring-2 focus:ring-[#1F6B43]/15"
              >
                <span>{viewYear}</span>
                <ChevronDown className={cn("size-3.5 shrink-0 text-coop-green transition-transform", openSelector === "year" && "rotate-180")} />
              </button>
              {openSelector === "year" ? (
                <div role="listbox" aria-label="Year options" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#DDE8D8] bg-white p-1.5 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">
                  {years.map((year) => (
                    <button
                      key={year}
                      type="button"
                      role="option"
                      aria-selected={viewYear === year}
                      onClick={() => changeMonth(year, viewMonth)}
                      className={cn("flex min-h-8 w-full items-center rounded-lg px-2.5 text-left text-[0.72rem] font-bold text-coop-secondary transition hover:bg-coop-sage", viewYear === year && "bg-coop-green text-white hover:bg-coop-green")}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[0.65rem] font-black uppercase tracking-[0.05em] text-coop-muted">
            {weekdayNames.map((weekday) => (
              <div key={weekday}>{weekday.slice(0, 1)}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-x-1.5 gap-y-1">
            {days.map((day) => (
              <button
                key={day.dateKey}
                type="button"
                data-date={day.dateKey}
                disabled={day.isDisabled}
                aria-pressed={day.isSelected}
                onClick={() => selectDate(day.dateKey)}
                className={cn(
                  "mx-auto grid size-8 place-items-center rounded-lg text-[0.72rem] font-black leading-none outline-none transition focus:ring-2 focus:ring-[#1F6B43]/25",
                  day.isSelected
                    ? "bg-coop-green text-white shadow-sm"
                    : "text-[#28372F] hover:bg-coop-sage",
                  !day.isCurrentMonth && "text-[#AAB6AD]",
                  day.isToday &&
                    !day.isSelected &&
                    "ring-1 ring-inset ring-[#F4B62A]",
                  day.isDisabled &&
                    "cursor-not-allowed text-[#D5DDD7] opacity-60 hover:bg-transparent",
                )}
              >
                {day.date.getDate()}
              </button>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            {allowClear ? (
              <button
                type="button"
                onClick={() => {
                  setPendingDateKey("");
                  preferredDay.current = null;
                  draftSourceValue.current = "";
                  onChange("");
                  setIsOpen(false);
                }}
                disabled={!value && !pendingDateKey}
                className="h-7 rounded-full px-2 text-[0.68rem] font-black text-coop-green transition hover:text-coop-forest focus:outline-none focus:ring-2 focus:ring-[#1F6B43]/15 disabled:pointer-events-none disabled:text-[#AAB6AD] disabled:opacity-60"
              >
                {clearLabel}
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetDraft();
                  setIsOpen(false);
                }}
                className="h-7 rounded-full px-2 text-[0.68rem] font-black text-[#9AAC9F] transition hover:text-coop-muted focus:outline-none focus:ring-2 focus:ring-[#1F6B43]/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingDateKey && !isOutsideRange(pendingDateKey, min, max) && !unavailableDates.has(pendingDateKey)) {
                    draftSourceValue.current = pendingDateKey;
                    onChange(pendingDateKey);
                  }
                  setIsOpen(false);
                }}
                disabled={!pendingDateKey || isOutsideRange(pendingDateKey, min, max) || unavailableDates.has(pendingDateKey)}
                className="h-7 rounded-full px-2 text-[0.68rem] font-black text-coop-green transition hover:text-coop-forest focus:outline-none focus:ring-2 focus:ring-[#1F6B43]/15 disabled:pointer-events-none disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>,
        // Keep the popup inside a modal's focus and pointer boundary, outside its scrolling panel.
        portalContainer ?? document.body,
      ) : null}

      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
