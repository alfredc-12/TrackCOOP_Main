"use client";

import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import { DatePicker } from "@/components/ui/DatePicker";
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import { useState } from "react";
import type { MembershipApplicationFormValues } from "./MembershipApplicationForm";

type BeneficiaryFieldsProps = {
  count: number;
  register: UseFormRegister<MembershipApplicationFormValues>;
  watch: UseFormWatch<MembershipApplicationFormValues>;
  setValue: UseFormSetValue<MembershipApplicationFormValues>;
  errors: FieldErrors<MembershipApplicationFormValues>;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

const relationshipOptions = ["Spouse", "Child", "Parent", "Sibling", "Guardian", "Other"] as const;

function todayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function BeneficiaryFields({
  count,
  register,
  watch,
  setValue,
  errors,
  onAdd,
  onRemove,
}: BeneficiaryFieldsProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-[1.25rem] border border-[#DDE8D8] bg-white p-4 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-[#123D2A]">
              Beneficiary {index + 1}
            </h3>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="inline-flex size-10 items-center justify-center rounded-full border border-red-200 text-red-700 transition hover:bg-red-50"
              aria-label={`Remove beneficiary ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#365F4A]">
              Full name
              <input
                className="h-11 rounded-xl border border-[#DDE8D8] bg-white px-3 text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
                {...register(`beneficiaries.${index}.fullName`)}
              />
              {errors.beneficiaries?.[index]?.fullName ? (
                <span className="text-xs text-red-700">
                  {errors.beneficiaries[index]?.fullName?.message}
                </span>
              ) : null}
            </label>
            <RelationshipField
              value={watch(`beneficiaries.${index}.relationship`) ?? ""}
              inputProps={register(`beneficiaries.${index}.relationship`)}
              error={errors.beneficiaries?.[index]?.relationship?.message}
              onChange={(value) => setValue(`beneficiaries.${index}.relationship`, value, { shouldDirty: true, shouldValidate: true })}
            />
            <label className="grid gap-2 text-sm font-semibold text-[#365F4A]">
              Age
              <input
                type="number"
                min="0"
                max="130"
                className="h-11 rounded-xl border border-[#DDE8D8] bg-white px-3 text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
                {...register(`beneficiaries.${index}.age`)}
              />
              {errors.beneficiaries?.[index]?.age ? (
                <span className="text-xs text-red-700">
                  {errors.beneficiaries[index]?.age?.message}
                </span>
              ) : null}
            </label>
            <div>
              <input type="hidden" {...register(`beneficiaries.${index}.birthDate`)} />
              <DatePicker
                label="Birth date"
                value={watch(`beneficiaries.${index}.birthDate`) ?? ""}
                onChange={(value) =>
                  setValue(`beneficiaries.${index}.birthDate`, value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
                min="1900-01-01"
                max={todayDateKey()}
                placeholder="Select birth date"
                error={errors.beneficiaries?.[index]?.birthDate?.message}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-[#1F6B43] bg-[#EAF3E8] px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#DDE8D8]"
      >
        <Plus className="size-4" />
        Add beneficiary
      </button>
    </div>
  );
}

function RelationshipField({
  value,
  inputProps,
  error,
  onChange,
}: {
  value: string;
  inputProps: ReturnType<UseFormRegister<MembershipApplicationFormValues>>;
  error?: string;
  onChange: (value: string) => void;
}) {
  const [showOther, setShowOther] = useState(() => value !== "" && !relationshipOptions.includes(value as (typeof relationshipOptions)[number]));
  const isOther = showOther;

  return (
    <div className="relative text-sm font-semibold text-[#365F4A]">
      Relationship
      {isOther ? (
        <div className="relative">
          <input
            className="mt-2 h-11 w-full rounded-xl border border-[#DDE8D8] bg-white px-3 pr-28 text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
            placeholder="Type relationship"
            {...inputProps}
          />
          <button type="button" onClick={() => { setShowOther(false); onChange(""); }} className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-xs font-bold text-[#1F6B43] underline">
            Choose from list
          </button>
        </div>
      ) : (
        <Select.Root value={value || undefined} onValueChange={(selected) => { setShowOther(selected === "Other"); onChange(selected === "Other" ? "" : selected); }}>
          <Select.Trigger aria-label="Relationship" aria-invalid={Boolean(error)} className="mt-2 flex h-11 w-full items-center justify-between rounded-xl border border-[#DDE8D8] bg-white px-3 text-left text-[#123D2A] outline-none transition hover:border-[#9FB7A4] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20 data-[placeholder]:text-[#6C7A70]">
            <Select.Value placeholder="Select relationship" />
            <Select.Icon><ChevronDown className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content position="popper" sideOffset={6} className="z-[100] max-h-64 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-xl border border-[#CAD8CB] bg-white p-1.5 shadow-[0_18px_40px_rgba(18,61,42,0.16)]">
              <Select.Viewport>
                {relationshipOptions.map((option) => (
                  <Select.Item key={option} value={option} className="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]">
                    <Select.ItemText>{option}</Select.ItemText>
                    <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      )}
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
