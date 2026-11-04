import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Input({ className, label, id, ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <label htmlFor={inputId} className="grid min-w-0 gap-2 text-sm font-medium text-coop-body">
      {label}
      <input
        id={inputId}
        className={cn(
          "coop-field h-11 w-full min-w-0 rounded-coop-control border border-coop-border bg-coop-surface px-3 text-sm text-coop-ink outline-none placeholder:text-coop-placeholder focus:border-coop-green focus:ring-2 focus:ring-coop-green/15 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
    </label>
  );
}
