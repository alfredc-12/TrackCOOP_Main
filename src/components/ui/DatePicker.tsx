"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
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

const shortMonthNames = monthNames.map((month) => month.slice(0, 3));

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
  const [openDirection, setOpenDirection] = useState<"down" | "up">("down");

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
        isSelected: value === dateKey,
        isToday: todayKey() === dateKey,
      };
    });
  }, [max, min, value, viewMonth, viewYear]);

  function moveMonth(offset: number) {
    const nextDate = new Date(viewYear, viewMonth + offset, 1);
    setViewMonth(nextDate.getMonth());
    setViewYear(nextDate.getFullYear());
  }

  function togglePicker() {
    if (!isOpen) {
      const anchorDate = selectedDate ?? maxDate;
      const fieldRect = rootRef.current?.getBoundingClientRect();
      setViewMonth(anchorDate.getMonth());
      setViewYear(anchorDate.getFullYear());

      if (fieldRect) {
        const estimatedPickerHeight = 336;
        const spaceBelow = window.innerHeight - fieldRect.bottom;
        const spaceAbove = fieldRect.top;
        setOpenDirection(
          spaceBelow < estimatedPickerHeight && spaceAbove > spaceBelow
            ? "up"
            : "down",
        );
      }
    }

    setIsOpen((current) => !current);
  }

  function selectDate(dateKey: string) {
    if (isOutsideRange(dateKey, min, max)) return;
    onChange(dateKey);
    setIsOpen(false);
  }

  const displayValue = formatDate(value);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <label
        id={labelId}
        className="block text-sm font-bold text-[#365F4A]"
      >
        {label}
      </label>

      <button
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={togglePicker}
        className="mt-2 flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[#DDE8D8] bg-white px-4 text-left text-base text-[#123D2A] outline-none transition hover:border-[#B9D1B6] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
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
            "absolute left-0 z-50 w-full max-w-80 rounded-[1.25rem] border border-[#DDE8D8] bg-white p-3 shadow-[0_18px_48px_rgba(18,61,42,0.16)] ring-1 ring-[#F8F1E5]",
            openDirection === "up" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-[#DDE8D8] text-[#123D2A] transition hover:bg-[#EAF3E8] focus:outline-none focus:ring-2 focus:ring-[#1F6B43]/20"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <select
                aria-label="Month"
                value={viewMonth}
                onChange={(event) => setViewMonth(Number(event.target.value))}
                className="h-9 min-w-0 rounded-xl border border-[#DDE8D8] bg-[#FBF8EF] px-3 text-sm font-black text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
              >
                {shortMonthNames.map((month, index) => (
                  <option key={monthNames[index]} value={index}>
                    {month}
                  </option>
                ))}
              </select>

              <select
                aria-label="Year"
                value={viewYear}
                onChange={(event) => setViewYear(Number(event.target.value))}
                className="h-9 min-w-0 rounded-xl border border-[#DDE8D8] bg-[#FBF8EF] px-3 text-sm font-black text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-[#DDE8D8] text-[#123D2A] transition hover:bg-[#EAF3E8] focus:outline-none focus:ring-2 focus:ring-[#1F6B43]/20"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#6B8174]">
            {weekdayNames.map((weekday) => (
              <div key={weekday}>{weekday}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-x-1 gap-y-0.5">
            {days.map((day) => (
              <button
                key={day.dateKey}
                type="button"
                disabled={day.isDisabled}
                onClick={() => selectDate(day.dateKey)}
                className={cn(
                  "mx-auto grid size-8 place-items-center rounded-lg text-xs font-bold outline-none transition focus:ring-2 focus:ring-[#1F6B43]/25",
                  day.isSelected
                    ? "bg-[#123D2A] text-white shadow-sm"
                    : "text-[#123D2A] hover:bg-[#EAF3E8]",
                  !day.isCurrentMonth && "text-[#9AAC9F]",
                  day.isToday &&
                    !day.isSelected &&
                    "ring-1 ring-inset ring-[#F4B62A]",
                  day.isDisabled &&
                    "cursor-not-allowed text-[#C2CEC4] opacity-50 hover:bg-transparent",
                )}
              >
                {day.date.getDate()}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[#E8EFE5] pt-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-black text-[#9A251B] transition hover:bg-[#FFF1EE] focus:outline-none focus:ring-2 focus:ring-[#9A251B]/15"
            >
              <X className="size-4" />
              Clear
            </button>
            <button
              type="button"
              onClick={() => selectDate(todayKey())}
              disabled={isOutsideRange(todayKey(), min, max)}
              className="h-9 rounded-full bg-[#F8F1E5] px-4 text-sm font-black text-[#775200] transition hover:bg-[#FFF3C9] focus:outline-none focus:ring-2 focus:ring-[#F4B62A]/30 disabled:pointer-events-none disabled:opacity-50"
            >
              Today
            </button>
          </div>
        </div>
      ) : null}

      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
