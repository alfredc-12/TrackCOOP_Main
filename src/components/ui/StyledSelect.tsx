"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

type StyledSelectProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  prefix?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

// Retain the existing string contract; Radix supplies keyboard navigation, focus return and collision handling.
export function StyledSelect({
  value,
  options,
  onChange,
  disabled,
  prefix,
  id,
  ...aria
}: StyledSelectProps) {
  const selected = options.indexOf(value);
  return (
    <Select.Root
      value={selected < 0 ? undefined : String(selected)}
      onValueChange={(index) => onChange(options[Number(index)])}
      disabled={disabled}
    >
      <Select.Trigger
        id={id}
        {...aria}
        aria-label={aria["aria-label"] ?? prefix}
        className="flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-[#9BC7A9] bg-[#F7F8F3] px-3 text-left text-sm font-semibold text-[#123D2A] outline-none transition hover:border-[#1F6B43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43] disabled:opacity-60"
      >
        <span className="truncate">
          {prefix ? `${prefix}: ` : ""}
          <Select.Value placeholder="Choose an option" />
        </span>
        <Select.Icon>
          <ChevronDown size={17} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={5}
          collisionPadding={12}
          className="z-[100] max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-[#D4E5D8] bg-white p-1 text-sm shadow-xl"
        >
          <Select.Viewport>
            {options.map((option, index) => (
              <Select.Item
                key={`${index}:${option}`}
                value={String(index)}
                className="relative flex min-h-11 cursor-default items-center gap-3 rounded-md px-3 py-2 pr-9 text-[#294B39] outline-none data-[highlighted]:bg-[#EAF3E8] data-[state=checked]:font-bold"
              >
                <Select.ItemText>{option}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-3">
                  <Check size={16} aria-hidden="true" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
