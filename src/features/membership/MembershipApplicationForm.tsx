"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileUp, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMembershipDraft } from "./MembershipDraftProvider";
import type { MembershipDraft } from "./membership-api";

const consent = z.boolean().refine(Boolean, "This declaration is required");
const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  middleName: z.string().trim().max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  suffix: z.string().trim().max(30),
  contactNumber: z
    .string()
    .trim()
    .regex(/^[+()\d\s-]{7,40}$/, "Enter a valid contact number"),
  email: z.email("Enter a valid email address").max(190),
  preferredContactMethod: z.enum(["Phone", "SMS", "Email"]),
  completeAddress: z
    .string()
    .trim()
    .min(5, "Complete address is required")
    .max(500),
  barangay: z.string().trim().min(1, "Barangay is required").max(120),
  municipality: z.string().trim().min(2).max(120),
  province: z.string().trim().min(2).max(120),
  sector: z.string().trim().min(1, "Sector is required").max(100),
  livelihood: z.string().trim().min(2, "Livelihood is required").max(190),
  applicantClassification: z.enum(["Farmer", "Fisherfolk", "Both", "Other"]),
  primaryActivity: z
    .string()
    .trim()
    .min(2, "Primary activity is required")
    .max(190),
  preferredMembershipType: z.enum(["ASSOCIATE", "TRUE_MEMBER", "NOT_SURE"]),
  consentAccuracy: consent,
  consentPrivacy: consent,
  consentNoImmediateMembership: consent,
  consentAccountAfterApproval: consent,
});

type FormValues = z.infer<typeof schema>;

const inputClass =
  "h-11 w-full rounded-md border border-[#CAD8CB] bg-white px-3 text-sm text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/25";
const labelClass = "grid gap-2 text-sm font-semibold text-[#294B39]";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="text-xs font-medium text-[#9A392A]">{message}</span>
  ) : null;
}

export function MembershipApplicationForm() {
  const router = useRouter();
  const { draft, setApplicationDraft } = useMembershipDraft();
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: draft ?? {
      firstName: "",
      middleName: "",
      lastName: "",
      suffix: "",
      contactNumber: "",
      email: "",
      preferredContactMethod: "SMS",
      completeAddress: "",
      barangay: "",
      municipality: "Nasugbu",
      province: "Batangas",
      sector: "Farmer",
      livelihood: "",
      applicantClassification: "Farmer",
      primaryActivity: "",
      preferredMembershipType: "NOT_SURE",
      consentAccuracy: false,
      consentPrivacy: false,
      consentNoImmediateMembership: false,
      consentAccountAfterApproval: false,
    },
  });

  const errorMessages = Object.values(errors)
    .map((error) => error?.message)
    .filter((message): message is string => Boolean(message));

  function selectFiles(selected: FileList | null) {
    const nextFiles = Array.from(selected ?? []);
    const invalid = nextFiles.find(
      (file) =>
        !["image/jpeg", "image/png", "application/pdf"].includes(file.type) ||
        file.size <= 0 ||
        file.size > 5 * 1024 * 1024,
    );
    if (invalid) {
      setFileError(
        "Each document must be a JPG, PNG, or PDF no larger than 5 MB.",
      );
      setFiles([]);
      return;
    }
    setFileError("");
    setFiles(nextFiles.slice(0, 5));
  }

  function review(values: FormValues) {
    const nextDraft: MembershipDraft = {
      ...values,
      idempotencyKey: draft?.idempotencyKey ?? crypto.randomUUID(),
      privacyNoticeVersion: "2026-07-24",
    };
    setApplicationDraft(
      nextDraft,
      files,
      files.map(() => "Other cooperative requirement"),
    );
    router.push("/membership/apply/review");
  }

  return (
    <form className="grid gap-6" noValidate onSubmit={handleSubmit(review)}>
      {errorMessages.length ? (
        <div
          role="alert"
          className="rounded-lg border border-[#E7B8A8] bg-[#FFF4EC] p-4 text-sm text-[#7A3023]"
        >
          <p className="font-bold">Please correct the following:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {Array.from(new Set(errorMessages)).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-black text-[#123D2A]">
          Applicant information
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#5D6D63]">
          Email is required because TrackCOOP uses it for unique, secure account
          activation after approval.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            First name
            <input
              className={inputClass}
              autoComplete="given-name"
              {...register("firstName")}
            />
            <FieldError message={errors.firstName?.message} />
          </label>
          <label className={labelClass}>
            Middle name{" "}
            <span className="font-normal text-[#6C7A70]">(optional)</span>
            <input
              className={inputClass}
              autoComplete="additional-name"
              {...register("middleName")}
            />
          </label>
          <label className={labelClass}>
            Last name
            <input
              className={inputClass}
              autoComplete="family-name"
              {...register("lastName")}
            />
            <FieldError message={errors.lastName?.message} />
          </label>
          <label className={labelClass}>
            Suffix{" "}
            <span className="font-normal text-[#6C7A70]">(optional)</span>
            <input className={inputClass} {...register("suffix")} />
          </label>
          <label className={labelClass}>
            Contact number
            <input
              className={inputClass}
              inputMode="tel"
              autoComplete="tel"
              {...register("contactNumber")}
            />
            <FieldError message={errors.contactNumber?.message} />
          </label>
          <label className={labelClass}>
            Email address
            <input
              className={inputClass}
              type="email"
              autoComplete="email"
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </label>
          <label className={labelClass}>
            Preferred contact method
            <select
              className={inputClass}
              {...register("preferredContactMethod")}
            >
              <option>SMS</option>
              <option>Phone</option>
              <option>Email</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-black text-[#123D2A]">Address</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className={`${labelClass} sm:col-span-2`}>
            Complete address
            <input
              className={inputClass}
              autoComplete="street-address"
              {...register("completeAddress")}
            />
            <FieldError message={errors.completeAddress?.message} />
          </label>
          <label className={labelClass}>
            Barangay
            <input className={inputClass} {...register("barangay")} />
            <FieldError message={errors.barangay?.message} />
          </label>
          <label className={labelClass}>
            Municipality
            <input className={inputClass} {...register("municipality")} />
          </label>
          <label className={labelClass}>
            Province
            <input className={inputClass} {...register("province")} />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-black text-[#123D2A]">
          Cooperative profile
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Sector
            <select className={inputClass} {...register("sector")}>
              {[
                "Farmer",
                "Fisherfolk",
                "Rice",
                "Corn",
                "Livestock",
                "Vegetable Production",
                "High-Value Crops",
                "Other",
              ].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Farmer or fisherfolk classification
            <select
              className={inputClass}
              {...register("applicantClassification")}
            >
              <option>Farmer</option>
              <option>Fisherfolk</option>
              <option>Both</option>
              <option>Other</option>
            </select>
          </label>
          <label className={labelClass}>
            Primary occupation or livelihood
            <input className={inputClass} {...register("livelihood")} />
            <FieldError message={errors.livelihood?.message} />
          </label>
          <label className={labelClass}>
            Main agricultural or fishery activity
            <input className={inputClass} {...register("primaryActivity")} />
            <FieldError message={errors.primaryActivity?.message} />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-black text-[#123D2A]">
          Preferred membership type
        </h2>
        <p className="mt-2 text-sm text-[#5D6D63]">
          Your selection is a preference. An authorized NFFAC reviewer confirms
          the final classification.
        </p>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {[
            {
              value: "ASSOCIATE",
              title: "Associate Member",
              detail: "Associate membership fee: ₱200.00",
            },
            {
              value: "TRUE_MEMBER",
              title: "True Member",
              detail:
                "₱1,500.00 initial payment; ₱3,000.00 per share; one year; ₱15,000.00 maximum.",
            },
            {
              value: "NOT_SURE",
              title: "Not Sure",
              detail:
                "NFFAC will determine the appropriate membership classification.",
            },
          ].map((option) => (
            <label
              key={option.value}
              className="flex min-h-32 cursor-pointer gap-3 rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4 has-[:checked]:border-[#1F6B43] has-[:checked]:ring-2 has-[:checked]:ring-[#82E6A7]/35"
            >
              <input
                type="radio"
                value={option.value}
                className="mt-1 size-4 accent-[#1F6B43]"
                {...register("preferredMembershipType")}
              />
              <span>
                <span className="block font-bold text-[#123D2A]">
                  {option.title}
                </span>
                <span className="mt-2 block text-sm leading-6 text-[#5D6D63]">
                  {option.detail}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <FileUp className="mt-1 size-5 text-[#1F6B43]" aria-hidden="true" />
          <div>
            <h2 className="text-xl font-black text-[#123D2A]">
              Supporting documents
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5D6D63]">
              Requirements are subject to cooperative validation. Uploads are
              optional and may include identification, proof of address, an
              applicant photo, or farmer/fisherfolk support.
            </p>
          </div>
        </div>
        <label className="mt-5 grid min-h-28 cursor-pointer place-items-center rounded-lg border border-dashed border-[#9FB4A4] bg-[#F7F8F3] p-4 text-center">
          <span className="text-sm font-semibold text-[#123D2A]">
            Select up to 5 JPG, PNG, or PDF files (5 MB each)
          </span>
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.pdf"
            className="sr-only"
            onChange={(event) => selectFiles(event.target.files)}
          />
        </label>
        {files.length ? (
          <ul className="mt-3 space-y-1 text-sm text-[#365F4A]">
            {files.map((file) => (
              <li key={`${file.name}-${file.size}`}>{file.name}</li>
            ))}
          </ul>
        ) : null}
        {fileError ? (
          <p className="mt-3 text-sm text-[#9A392A]">{fileError}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <ShieldCheck
            className="mt-1 size-5 text-[#1F6B43]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-xl font-black text-[#123D2A]">
              Declarations and consent
            </h2>
            <p className="mt-2 text-sm text-[#5D6D63]">
              Review the Data Privacy Notice, Membership Terms, and cooperative
              contact information before continuing.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          {[
            [
              "consentAccuracy",
              "I certify that the information I provided is correct.",
            ],
            [
              "consentPrivacy",
              "I consent to NFFAC processing my information for membership evaluation.",
            ],
            [
              "consentNoImmediateMembership",
              "I understand that submitting this application does not immediately make me a member.",
            ],
            [
              "consentAccountAfterApproval",
              "I understand that my account will be created only after approval and applicable payment validation.",
            ],
          ].map(([name, label]) => (
            <label
              key={name}
              className="flex min-h-11 items-start gap-3 text-sm leading-6 text-[#294B39]"
            >
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[#1F6B43]"
                {...register(name as keyof FormValues)}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="min-h-11 rounded-md border border-[#CAD8CB] bg-white px-5 text-sm font-bold text-[#294B39] transition hover:bg-[#EEF2EC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 rounded-md bg-[#123D2A] px-6 text-sm font-bold text-white transition hover:bg-[#1F6B43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43] disabled:opacity-60"
        >
          Review Application
        </button>
      </div>
    </form>
  );
}
