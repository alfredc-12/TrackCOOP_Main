"use client";

import * as Select from "@radix-ui/react-select";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableCombobox } from "./SearchableCombobox";

type StyledSelectProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  prefix?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  searchable?: boolean;
  placeholder?: string;
  onInputChange?: (value: string) => void;
};

export function StyledSelect(props: StyledSelectProps) {
  const { value, options, onChange, disabled, prefix, id, className } = props;
  if (props.searchable) return <SearchableCombobox {...props} />;
  // Index values also support callers whose legitimate option is an empty string.
  const selected = options.indexOf(value);
  return (
    <Select.Root value={String(selected)} onValueChange={(index) => onChange(options[Number(index)])} disabled={disabled}>
      <Select.Trigger
        id={id}
        aria-label={props["aria-label"] ?? (props["aria-labelledby"] ? undefined : prefix ? `${prefix}: ${value}` : value || "Choose an option")}
        aria-labelledby={props["aria-labelledby"]}
        className={cn("coop-field group flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-coop-control border border-coop-border bg-coop-surface px-3 text-left text-sm font-semibold text-coop-forest outline-none hover:border-coop-green focus-visible:ring-2 focus-visible:ring-coop-green/20 disabled:cursor-not-allowed disabled:opacity-60", className)}
      >
        <Select.Value><span className="min-w-0 truncate">{prefix ? `${prefix}: ${value}` : value}</span></Select.Value>
        <Select.Icon><ChevronDown aria-hidden="true" className="size-4 shrink-0 text-coop-secondary transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal container={typeof document === "undefined" ? undefined : document.fullscreenElement ?? undefined}>
        <Select.Content position="popper" align="start" sideOffset={8} collisionPadding={12} className="z-[100] max-h-[min(20rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-coop-panel border border-coop-border bg-coop-surface p-2 text-coop-forest shadow-coop-floating">
          <Select.ScrollUpButton className="grid h-7 place-items-center"><ChevronUp aria-hidden="true" className="size-4" /></Select.ScrollUpButton>
          <Select.Viewport>
            {options.map((option, index) => (
              <Select.Item key={`${index}:${option}`} value={String(index)} className="relative flex min-h-11 cursor-pointer select-none items-center justify-between gap-3 rounded-coop-control py-2.5 pl-3 pr-9 text-sm font-semibold text-coop-secondary outline-none data-[highlighted]:bg-coop-sage data-[highlighted]:text-coop-forest data-[state=checked]:bg-coop-sage data-[state=checked]:text-coop-forest">
                <Select.ItemText>{prefix ? `${prefix}: ${option}` : option}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-3"><span aria-hidden="true" className="block size-1.5 rounded-full bg-coop-green" /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="grid h-7 place-items-center"><ChevronDown aria-hidden="true" className="size-4" /></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
