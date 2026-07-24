"use client";

import { Plus, Trash2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { MembershipApplicationFormValues } from "./MembershipApplicationForm";

type BeneficiaryFieldsProps = {
  count: number;
  register: UseFormRegister<MembershipApplicationFormValues>;
  errors: FieldErrors<MembershipApplicationFormValues>;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

export function BeneficiaryFields({
  count,
  register,
  errors,
  onAdd,
  onRemove,
}: BeneficiaryFieldsProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="border border-[#DDE8D8] bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-[#123D2A]">
              Beneficiary {index + 1}
            </h3>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="inline-flex size-10 items-center justify-center border border-red-200 text-red-700 transition hover:bg-red-50"
              aria-label={`Remove beneficiary ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#365F4A]">
              Full name
              <input
                className="h-11 border border-[#DDE8D8] bg-white px-3 text-[#123D2A] outline-none focus:border-[#1F6B43]"
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
                className="h-11 border border-[#DDE8D8] bg-white px-3 text-[#123D2A] outline-none focus:border-[#1F6B43]"
                {...register(`beneficiaries.${index}.relationship`)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#365F4A]">
              Age
              <input
                type="number"
                min="0"
                max="130"
                className="h-11 border border-[#DDE8D8] bg-white px-3 text-[#123D2A] outline-none focus:border-[#1F6B43]"
                {...register(`beneficiaries.${index}.age`)}
              />
              {errors.beneficiaries?.[index]?.age ? (
                <span className="text-xs text-red-700">
                  {errors.beneficiaries[index]?.age?.message}
                </span>
              ) : null}
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#365F4A]">
              Birth date
              <input
                type="date"
                className="h-11 border border-[#DDE8D8] bg-white px-3 text-[#123D2A] outline-none focus:border-[#1F6B43]"
                {...register(`beneficiaries.${index}.birthDate`)}
              />
              {errors.beneficiaries?.[index]?.birthDate ? (
                <span className="text-xs text-red-700">
                  {errors.beneficiaries[index]?.birthDate?.message}
                </span>
              ) : null}
            </label>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex h-11 items-center gap-2 border border-[#1F6B43] bg-[#EAF3E8] px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#DDE8D8]"
      >
        <Plus className="size-4" />
        Add beneficiary
      </button>
    </div>
  );
}
