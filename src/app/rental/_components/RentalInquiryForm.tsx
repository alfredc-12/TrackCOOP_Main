"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, ArrowRight, FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { cloneElement, useEffect, useState } from "react";
import {
  useForm,
  type FieldErrors,
  type FieldPath,
} from "react-hook-form";
import { BARANGAYS } from "../_lib/rentalConstants";
import {
  inquirySchema,
  validateUpload,
  type InquiryFormValues,
} from "../_lib/rentalValidation";
import { useRental } from "../_context/RentalProvider";
import { RentalInquiryStepper } from "./RentalInquiryStepper";

const defaultValues: InquiryFormValues = {
  fullName: "",
  requesterType: "Public or Non-member",
  contactNumber: "",
  email: "",
  completeAddress: "",
  barangay: "",
  municipality: "Nasugbu",
  preferredContactMethod: "SMS",
  serviceId: "",
  intendedUse: "",
  preferredDate: "",
  alternativeDate: "",
  preferredStartTime: "",
  estimatedDuration: "",
  estimatedUsage: "",
  unitOfMeasurement: "",
  serviceLocation: "",
  serviceBarangay: "",
  requestDescription: "",
  specialInstructions: "",
  additionalNotes: "",
  attachmentName: "",
  membershipProofName: "",
  dataPrivacyConsent: false,
  accuracyConfirmation: false,
  contactConsent: false,
};

const requesterFields: FieldPath<InquiryFormValues>[] = [
  "fullName",
  "requesterType",
  "contactNumber",
  "email",
  "completeAddress",
  "barangay",
  "municipality",
  "preferredContactMethod",
];

const rentalFields: FieldPath<InquiryFormValues>[] = [
  "serviceId",
  "intendedUse",
  "preferredDate",
  "alternativeDate",
  "preferredStartTime",
  "estimatedDuration",
  "estimatedUsage",
  "unitOfMeasurement",
  "serviceLocation",
  "serviceBarangay",
  "requestDescription",
  "specialInstructions",
  "additionalNotes",
];

export function RentalInquiryForm({ member = false, hideBackButton = false }: { member?: boolean; hideBackButton?: boolean }) {
  const router = useRouter();
  const { services, saveInquiryDraft, getInquiryDraft } = useRental();
  const [step, setStep] = useState<1 | 2>(1);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      ...defaultValues,
      requesterType: member ? "Member" : "Public or Non-member",
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = getInquiryDraft();
      const params = new URLSearchParams(window.location.search);

      if (saved) reset(saved);
      else {
        const selectedService = params.get("service");
        if (selectedService) setValue("serviceId", selectedService);
      }

      if (params.get("step") === "2") setStep(2);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [getInquiryDraft, reset, setValue]);

  const goToRentalDetails = async () => {
    const valid = await trigger(requesterFields, { shouldFocus: true });
    if (!valid) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitForReview = (values: InquiryFormValues) => {
    saveInquiryDraft(values);
    router.push(member ? "/rental/member/requests/new?review=1" : "/rental/inquiry/review");
  };

  const handleInvalid = (formErrors: FieldErrors<InquiryFormValues>) => {
    const hasRequesterError = requesterFields.some((field) => Boolean(formErrors[field]));
    if (hasRequesterError) setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFile = (
    file: File | undefined,
    field: "attachmentName" | "membershipProofName",
  ) => {
    const issue = validateUpload(file);
    setFileErrors((current) =>
      issue
        ? [
            ...current.filter((item) => !item.startsWith(field)),
            `${field}: ${issue}`,
          ]
        : current.filter((item) => !item.startsWith(field)),
    );
    setValue(field, issue ? "" : file?.name ?? "");
  };

  const visibleFields = step === 1 ? requesterFields : rentalFields;
  const errorMessages = flattenErrors(errors, visibleFields);

  return (
    <form
      onSubmit={handleSubmit(submitForReview, handleInvalid)}
      noValidate
      className="mx-auto max-w-4xl"
    >
      <RentalInquiryStepper currentStep={step} />

      {(errorMessages.length > 0 || (step === 2 && fileErrors.length > 0)) && (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900"
        >
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="size-5" />
            Please review this section
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
            {[...errorMessages, ...(step === 2 ? fileErrors : [])].map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {step === 1 ? (
        <FormSection
          step="Section 1"
          title="Requester Information"
          description="Tell NFFAC who is making the rental inquiry and how we can contact you."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" required error={errors.fullName?.message}>
              <input {...register("fullName")} autoComplete="name" />
            </Field>
            <Field label="Requester type" required error={errors.requesterType?.message}>
              <select {...register("requesterType")}>
                {member ? (
                  <option>Member</option>
                ) : (
                  <>
                    <option>Public or Non-member</option>
                    <option>Member</option>
                  </>
                )}
              </select>
            </Field>
            <Field
              label="Contact number"
              required
              hint="Example: 09171234567"
              error={errors.contactNumber?.message}
            >
              <input
                {...register("contactNumber")}
                inputMode="tel"
                autoComplete="tel"
                placeholder="09XXXXXXXXX"
              />
            </Field>
            <Field label="Email (optional)" error={errors.email?.message}>
              <input
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
              />
            </Field>
            <Field
              label="Complete address"
              required
              error={errors.completeAddress?.message}
              wide
            >
              <input {...register("completeAddress")} autoComplete="street-address" />
            </Field>
            <Field label="Barangay" required error={errors.barangay?.message}>
              <select {...register("barangay")}>
                <option value="">Select barangay</option>
                {BARANGAYS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Municipality" required error={errors.municipality?.message}>
              <input {...register("municipality")} />
            </Field>
            <Field
              label="Preferred contact method"
              required
              error={errors.preferredContactMethod?.message}
              wide
            >
              <select {...register("preferredContactMethod")}>
                <option>SMS</option>
                <option>Phone</option>
                <option>Email</option>
              </select>
            </Field>
          </div>

          <FormActions center={hideBackButton}>
            {!hideBackButton && (
              <button
                type="button"
                onClick={() => router.push("/rental")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-[#66756c] hover:bg-[#f1f4ef]"
              >
                <ArrowLeft className="size-4" />
                Back to Services
              </button>
            )}
            <button
              type="button"
              onClick={() => void goToRentalDetails()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#08753a] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#075f31] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08753a]"
            >
              Continue to Rental Details
              <ArrowRight className="size-4" />
            </button>
          </FormActions>
        </FormSection>
      ) : (
        <FormSection
          step="Section 2"
          title="Rental Details"
          description="Describe the equipment, preferred schedule, location, and intended use for cooperative review."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Equipment or service"
              required
              error={errors.serviceId?.message}
              wide
            >
              <select {...register("serviceId")}>
                <option value="">Select equipment</option>
                {services.map((service) => (
                  <option value={service.serviceId} key={service.serviceId}>
                    {service.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Intended use"
              required
              error={errors.intendedUse?.message}
              wide
            >
              <input
                {...register("intendedUse")}
                placeholder="e.g. Land preparation for rice planting"
              />
            </Field>
            <Field label="Preferred date" required error={errors.preferredDate?.message}>
              <input type="date" {...register("preferredDate")} />
            </Field>
            <Field label="Alternative date" error={errors.alternativeDate?.message}>
              <input type="date" {...register("alternativeDate")} />
            </Field>
            <Field
              label="Preferred start time"
              required
              error={errors.preferredStartTime?.message}
            >
              <input type="time" {...register("preferredStartTime")} />
            </Field>
            <Field
              label="Estimated duration"
              required
              error={errors.estimatedDuration?.message}
            >
              <input placeholder="e.g. 4 hours" {...register("estimatedDuration")} />
            </Field>
            <Field
              label="Estimated land area or usage"
              required
              error={errors.estimatedUsage?.message}
            >
              <input placeholder="e.g. 1.5" {...register("estimatedUsage")} />
            </Field>
            <Field
              label="Unit of measurement"
              required
              error={errors.unitOfMeasurement?.message}
            >
              <input
                placeholder="e.g. hectares, hours, trip"
                {...register("unitOfMeasurement")}
              />
            </Field>
            <Field
              label="Service location"
              required
              error={errors.serviceLocation?.message}
              wide
            >
              <input {...register("serviceLocation")} />
            </Field>
            <Field
              label="Service-location barangay"
              required
              error={errors.serviceBarangay?.message}
              wide
            >
              <select {...register("serviceBarangay")}>
                <option value="">Select barangay</option>
                {BARANGAYS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Request description"
              required
              error={errors.requestDescription?.message}
              wide
            >
              <textarea
                rows={4}
                placeholder="Describe the work, site conditions, and expected outcome."
                {...register("requestDescription")}
              />
            </Field>
            <Field
              label="Special instructions (optional)"
              error={errors.specialInstructions?.message}
              wide
            >
              <textarea rows={3} {...register("specialInstructions")} />
            </Field>
          </div>

          <div className="my-7 border-t border-[#e2e8e3]" />

          <div>
            <h3 className="text-base font-extrabold text-[#123d2a]">
              Supporting information
            </h3>
            <p className="mt-1 text-sm text-[#6b786f]">
              Optional JPG, PNG, or PDF files up to 5 MB each.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <UploadField
                label="Inquiry attachment"
                onChange={(file) => handleFile(file, "attachmentName")}
              />
              <UploadField
                label="Proof of membership"
                onChange={(file) => handleFile(file, "membershipProofName")}
              />
              <Field label="Additional notes" error={errors.additionalNotes?.message} wide>
                <textarea rows={3} {...register("additionalNotes")} />
              </Field>
            </div>
          </div>

          <FormActions>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cbdac6] px-5 text-sm font-bold text-[#365f4a] hover:bg-[#f3f7f1]"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <button
              disabled={isSubmitting || fileErrors.length > 0}
              type="submit"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#08753a] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#075f31] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08753a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Review &amp; Submit
              <ArrowRight className="size-4" />
            </button>
          </FormActions>
        </FormSection>
      )}
    </form>
  );
}

function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="overflow-hidden rounded-2xl border border-[#d9e1dc] bg-white shadow-[0_12px_36px_rgba(18,61,42,0.06)]">
      <legend className="sr-only">{title}</legend>
      <div className="border-b border-[#e3e9e5] px-5 py-5 sm:px-8 sm:py-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#168046]">
          {step}
        </p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#10231a]">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b786f]">{description}</p>
      </div>
      <div className="px-5 py-6 sm:px-8 sm:py-7">{children}</div>
    </fieldset>
  );
}

function FormActions({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={`mt-8 flex flex-col-reverse gap-3 border-t border-[#e3e9e5] pt-5 sm:flex-row sm:items-center ${center ? "sm:justify-center" : "sm:justify-between"}`}>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  wide,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  wide?: boolean;
  children: React.ReactElement<{
    className?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <label
      className={`grid gap-2 text-sm font-bold text-[#334b3d] ${wide ? "sm:col-span-2" : ""}`}
    >
      <span>
        {label}
        {required && <span className="text-red-700"> *</span>}
      </span>
      {withFieldStyles(children, id, error)}
      {hint && !error && <span className="text-xs font-normal text-[#7a877f]">{hint}</span>}
      {error && (
        <span id={`${id}-error`} className="text-xs font-semibold text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}

function withFieldStyles(
  element: React.ReactElement<{
    className?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>,
  id: string,
  error?: string,
) {
  return cloneElement(element, {
    className: `min-h-12 rounded-xl border bg-white px-3.5 py-2.5 text-sm font-normal text-[#17211c] outline-none transition placeholder:text-[#98a39d] focus:ring-4 ${
      error
        ? "border-red-400 focus:border-red-600 focus:ring-red-100"
        : "border-[#cfd9d2] hover:border-[#aebdb3] focus:border-[#168046] focus:ring-[#168046]/10"
    } ${element.props.className ?? ""}`,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${id}-error` : undefined,
  });
}

function UploadField({
  label,
  onChange,
}: {
  label: string;
  onChange: (file?: File) => void;
}) {
  return (
    <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#aebfa9] bg-[#f8faf7] p-4 text-center text-sm font-bold text-[#365f4a] transition hover:border-[#168046] hover:bg-[#f2f7f0]">
      <span className="grid size-10 place-items-center rounded-full bg-[#e8f3e9] text-[#168046]">
        <FileUp className="size-5" />
      </span>
      <span className="mt-2">{label}</span>
      <span className="mt-1 text-xs font-normal text-[#7a877f]">Choose JPG, PNG, or PDF</span>
      <input
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0])}
      />
    </label>
  );
}

function flattenErrors(
  errors: FieldErrors<InquiryFormValues>,
  fields: FieldPath<InquiryFormValues>[],
) {
  return fields.flatMap((field) => {
    const error = errors[field];
    return error?.message ? [String(error.message)] : [];
  });
}
