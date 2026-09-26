"use client";

import {
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
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
  const selectedDate = useMemo(() => parseDateKey(value), [value]);
  const maxDate = useMemo(() => parseDateKey(max) ?? new Date(), [max]);
  const minDate = useMemo(() => parseDateKey(min) ?? new Date(1900, 0, 1), [min]);
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(
    selectedDate?.getMonth() ?? maxDate.getMonth(),
  );
  const [viewYear, setViewYear] = useState(
    selectedDate?.getFullYear() ?? maxDate.getFullYear(),
  );
  const [pendingDateKey, setPendingDateKey] = useState(value);
  const [openDirection, setOpenDirection] = useState<"down" | "up">("down");
  const [openSelector, setOpenSelector] = useState<"month" | "year" | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
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
        isDisabled: isOutsideRange(dateKey, min, max),
        isSelected: pendingDateKey === dateKey,
        isToday: todayKey() === dateKey,
      };
    });
  }, [max, min, pendingDateKey, viewMonth, viewYear]);

  function togglePicker() {
    if (!isOpen) {
      const anchorDate = selectedDate ?? maxDate;
      const fieldRect = rootRef.current?.getBoundingClientRect();
      setViewMonth(anchorDate.getMonth());
      setViewYear(anchorDate.getFullYear());
      setPendingDateKey(value);

      if (fieldRect) {
        const estimatedPickerHeight = 252;
        const spaceBelow = window.innerHeight - fieldRect.bottom;
        const spaceAbove = fieldRect.top;
        setOpenDirection(
          spaceBelow < estimatedPickerHeight && spaceAbove > 180
            ? "up"
            : "down",
        );
      }
    }

    setOpenSelector(null);
    setIsOpen((current) => !current);
  }

  function selectDate(dateKey: string) {
    if (isOutsideRange(dateKey, min, max)) return;
    setPendingDateKey(dateKey);
  }

  const displayValue = formatDate(value);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <label
        id={labelId}
        className={cn(
          "block text-sm font-bold text-[#365F4A]",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </label>

      <button
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={togglePicker}
        className={cn(
          "mt-2 flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[#DDE8D8] bg-white px-4 text-left text-base text-[#123D2A] outline-none transition hover:border-[#B9D1B6] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20",
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
        <span className="flex shrink-0 items-center gap-2 text-[#1F6B43]">
          <CalendarDays className="size-4" />
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </span>
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={labelId}
          className={cn(
            "absolute left-1/2 z-50 w-[19rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-[1rem] border border-[#DDE8D8] bg-white p-3 shadow-[0_18px_48px_rgba(18,61,42,0.14)] ring-1 ring-[#F8F1E5]",
            openDirection === "up" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <button
                type="button"
                aria-label="Month"
                aria-haspopup="listbox"
                aria-expanded={openSelector === "month"}
                onClick={() => setOpenSelector((current) => current === "month" ? null : "month")}
                className="flex h-9 w-full items-center justify-between gap-1 rounded-xl border border-[#DDE8D8] bg-[#FBFBFA] px-3 text-left text-[0.72rem] font-black text-[#123D2A] outline-none transition hover:border-[#B9D1B6] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/15"
              >
                <span className="truncate">{monthNames[viewMonth]}</span>
                <ChevronDown className={cn("size-3.5 shrink-0 text-[#1F6B43] transition-transform", openSelector === "month" && "rotate-180")} />
              </button>
              {openSelector === "month" ? (
                <div role="listbox" aria-label="Month options" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#DDE8D8] bg-white p-1.5 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">
                  {monthNames.map((month, index) => (
                    <button
                      key={month}
                      type="button"
                      role="option"
                      aria-selected={viewMonth === index}
                      onClick={() => { setViewMonth(index); setOpenSelector(null); }}
                      className={cn("flex min-h-8 w-full items-center rounded-lg px-2.5 text-left text-[0.72rem] font-bold text-[#365F4A] transition hover:bg-[#EAF3E8]", viewMonth === index && "bg-[#1F6B43] text-white hover:bg-[#1F6B43]")}
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
                className="flex h-9 w-full items-center justify-between gap-1 rounded-xl border border-[#DDE8D8] bg-[#FBFBFA] px-3 text-left text-[0.72rem] font-black text-[#123D2A] outline-none transition hover:border-[#B9D1B6] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/15"
              >
                <span>{viewYear}</span>
                <ChevronDown className={cn("size-3.5 shrink-0 text-[#1F6B43] transition-transform", openSelector === "year" && "rotate-180")} />
              </button>
              {openSelector === "year" ? (
                <div role="listbox" aria-label="Year options" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#DDE8D8] bg-white p-1.5 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">
                  {years.map((year) => (
                    <button
                      key={year}
                      type="button"
                      role="option"
                      aria-selected={viewYear === year}
                      onClick={() => { setViewYear(year); setOpenSelector(null); }}
                      className={cn("flex min-h-8 w-full items-center rounded-lg px-2.5 text-left text-[0.72rem] font-bold text-[#365F4A] transition hover:bg-[#EAF3E8]", viewYear === year && "bg-[#1F6B43] text-white hover:bg-[#1F6B43]")}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[0.5rem] font-black uppercase tracking-[0.05em] text-[#5D6D63]">
            {weekdayNames.map((weekday) => (
              <div key={weekday}>{weekday.slice(0, 1)}</div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-x-1.5 gap-y-0.5">
            {days.map((day) => (
              <button
                key={day.dateKey}
                type="button"
                disabled={day.isDisabled}
                onClick={() => selectDate(day.dateKey)}
                className={cn(
                  "mx-auto grid size-6 place-items-center rounded-full text-[0.62rem] font-black leading-none outline-none transition focus:ring-2 focus:ring-[#1F6B43]/25",
                  day.isSelected
                    ? "bg-[#1F6B43] text-white shadow-sm"
                    : "text-[#28372F] hover:bg-[#EAF3E8]",
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
                  onChange("");
                  setIsOpen(false);
                }}
                disabled={!value}
                className="h-7 rounded-full px-2 text-[0.68rem] font-black text-[#1F6B43] transition hover:text-[#123D2A] focus:outline-none focus:ring-2 focus:ring-[#1F6B43]/15 disabled:pointer-events-none disabled:text-[#AAB6AD] disabled:opacity-60"
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
                  setPendingDateKey(value);
                  setIsOpen(false);
                }}
                className="h-7 rounded-full px-2 text-[0.68rem] font-black text-[#9AAC9F] transition hover:text-[#5D6D63] focus:outline-none focus:ring-2 focus:ring-[#1F6B43]/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingDateKey && !isOutsideRange(pendingDateKey, min, max)) {
                    onChange(pendingDateKey);
                  }
                  setIsOpen(false);
                }}
                disabled={!pendingDateKey || isOutsideRange(pendingDateKey, min, max)}
                className="h-7 rounded-full px-2 text-[0.68rem] font-black text-[#1F6B43] transition hover:text-[#123D2A] focus:outline-none focus:ring-2 focus:ring-[#1F6B43]/15 disabled:pointer-events-none disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
