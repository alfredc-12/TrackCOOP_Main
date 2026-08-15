"use client";

import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

export const fieldClass =
  "min-h-11 w-full rounded-md border border-[#CAD8CB] bg-white px-3 text-sm text-[#17211C] outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20";

export const errorFieldClass =
  "min-h-11 w-full rounded-md border border-[#FF4D4F] bg-white px-3 text-sm text-[#17211C] outline-none focus:border-[#FF4D4F] focus:ring-4 focus:ring-[#FF4D4F]/20";

export const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#294B39] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:cursor-not-allowed disabled:opacity-50";

export const warningButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#FFF4D7] px-4 text-sm font-bold text-[#8A6200] transition hover:bg-[#FDE9AE] disabled:cursor-not-allowed disabled:opacity-50";

export function BusyLabel({ label }: { label: string }) {
  return (
    <>
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
  wide,
  error,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
  error?: string;
}) {
  return (
    <label
      className={`flex flex-col gap-1.5 text-sm font-semibold text-[#294B39] ${wide ? "sm:col-span-2" : ""}`}
    >
      <span>
        {label}
        {required ? <span className="text-[#9A392A]"> *</span> : null}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-[#FF4D4F]">{error}</span>
      ) : hint ? (
        <span className="text-xs font-normal text-[#6C7A70]">{hint}</span>
      ) : null}
    </label>
  );
}

export async function apiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

export function formatDate(value: string | null, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
    timeZone: "Asia/Manila",
  }).format(date);
}

export function formatFileSize(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** exponent).toFixed(exponent ? 1 : 0)} ${units[exponent]}`;
}
