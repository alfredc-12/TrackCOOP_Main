"use client";

import { Plus, Trash2 } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
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
            <label className="grid gap-2 text-sm font-semibold text-[#365F4A]">
              Relationship
              <input
                className="h-11 rounded-xl border border-[#DDE8D8] bg-white px-3 text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
                {...register(`beneficiaries.${index}.relationship`)}
              />
            </label>
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
