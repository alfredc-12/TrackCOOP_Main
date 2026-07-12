import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Input({ className, label, id, ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <label className="grid gap-2 text-sm font-medium text-[#36433c]">
      {label}
      <input
        id={inputId}
        className={cn(
          "h-11 rounded-md border border-black/10 bg-white px-3 text-sm text-[#17211c] outline-none transition placeholder:text-[#8a958e] focus:border-[#4d8f5b] focus:ring-4 focus:ring-[#4d8f5b]/15",
          className,
        )}
        {...props}
      />
    </label>
  );
}
