"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cloneElement, useEffect, useMemo, useState } from "react";
import {
  useForm,
  useWatch,
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
import { rentalApiRepository } from "../_lib/rentalApi";
import type { PublicRentalBlockedDate } from "../_types/rental";
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
  preferredEndDate: "",
  alternativeDate: "",
  alternativeEndDate: "",
  preferredStartTime: "",
  preferredEndTime: "",
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
  "preferredEndDate",
  "alternativeDate",
  "alternativeEndDate",
  "preferredStartTime",
  "preferredEndTime",
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
  const [blockedDates, setBlockedDates] = useState<PublicRentalBlockedDate[]>([]);
  const [blockedDatesServiceId, setBlockedDatesServiceId] = useState("");
  const [blockedDatesError, setBlockedDatesError] = useState<string>();
  const {
    register,
    reset,
    setValue,
    setError,
    clearErrors,
    trigger,
    control,
    getValues,
    formState: { errors },
  } = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      ...defaultValues,
      requesterType: member ? "Member" : "Public or Non-member",
    },
  });

  const selectedServiceId = useWatch({ control, name: "serviceId" });
  const preferredDate = useWatch({ control, name: "preferredDate" });
  const preferredEndDate = useWatch({ control, name: "preferredEndDate" });
  const alternativeDate = useWatch({ control, name: "alternativeDate" });
  const alternativeEndDate = useWatch({ control, name: "alternativeEndDate" });
  const selectedService = services.find(
    (service) => service.serviceId === selectedServiceId,
  );
  const effectiveBlockedDates = useMemo(
    () =>
      selectedServiceId && blockedDatesServiceId === selectedServiceId
        ? blockedDates
        : [],
    [blockedDates, blockedDatesServiceId, selectedServiceId],
  );
  const effectiveBlockedDatesError =
    selectedServiceId && blockedDatesServiceId === selectedServiceId
      ? blockedDatesError
      : undefined;
  const blockedDatesLoading = Boolean(
    selectedServiceId && blockedDatesServiceId !== selectedServiceId,
  );
  const blockedDateByKey = useMemo(
    () => new Map(effectiveBlockedDates.map((item) => [item.date, item])),
    [effectiveBlockedDates],
  );
  const preferredBlockedDate = firstBlockedDateInRange(
    preferredDate,
    preferredEndDate,
    blockedDateByKey,
  );
  const alternativeBlockedDate = firstBlockedDateInRange(
    alternativeDate,
    alternativeEndDate,
    blockedDateByKey,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = getInquiryDraft();
      const params = new URLSearchParams(window.location.search);

      if (saved) {
        reset({
          ...defaultValues,
          ...saved,
          preferredEndDate: saved.preferredEndDate || saved.preferredDate,
          preferredEndTime: saved.preferredEndTime || "",
          alternativeEndDate: saved.alternativeEndDate || "",
        });
      }
      else {
        const selectedService = params.get("service");
        if (selectedService) setValue("serviceId", selectedService);
      }

      if (params.get("step") === "2") setStep(2);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [getInquiryDraft, reset, setValue]);

  useEffect(() => {
    let active = true;

    if (!selectedServiceId) {
      return () => {
        active = false;
      };
    }

    void rentalApiRepository
      .getPublicRentalBlockedDates(selectedServiceId)
      .then((dates) => {
        if (active) {
          setBlockedDates(dates);
          setBlockedDatesError(undefined);
          setBlockedDatesServiceId(selectedServiceId);
        }
      })
      .catch((reason) => {
        if (active) {
          setBlockedDates([]);
          setBlockedDatesError(
            reason instanceof Error
              ? reason.message
              : "Availability dates could not be loaded.",
          );
          setBlockedDatesServiceId(selectedServiceId);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedServiceId]);

  useEffect(() => {
    if (preferredDate && preferredBlockedDate) {
      setError("preferredEndDate", {
        type: "manual",
        message: `${preferredBlockedDate.date} is unavailable. The preferred range cannot include approved rentals or maintenance.`,
      });
    } else if (errors.preferredEndDate?.type === "manual") {
      clearErrors("preferredEndDate");
    }
  }, [
    clearErrors,
    errors.preferredEndDate?.type,
    preferredBlockedDate,
    preferredDate,
    setError,
  ]);

  useEffect(() => {
    if (alternativeDate && alternativeBlockedDate) {
      setError("alternativeEndDate", {
        type: "manual",
        message: `${alternativeBlockedDate.date} is unavailable. The alternative range cannot include approved rentals or maintenance.`,
      });
    } else if (errors.alternativeEndDate?.type === "manual") {
      clearErrors("alternativeEndDate");
    }
  }, [
    alternativeBlockedDate,
    alternativeDate,
    clearErrors,
    errors.alternativeEndDate?.type,
    setError,
  ]);

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

  const goToReview = async () => {
    if (fileErrors.length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (blockedDatesLoading || effectiveBlockedDatesError) {
      setError("preferredDate", {
        type: "manual",
        message: blockedDatesLoading
          ? "Please wait while availability dates load."
          : "Availability dates could not be verified. Refresh the page or choose the equipment again.",
      });
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const requesterValid = await trigger(requesterFields, { shouldFocus: true });
    if (!requesterValid) {
      setStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const rentalValid = await trigger(rentalFields, { shouldFocus: true });
    const values = getValues();
    const selectedPreferredBlock = firstBlockedDateInRange(
      values.preferredDate,
      values.preferredEndDate,
      blockedDateByKey,
    );
    const selectedAlternativeBlock = firstBlockedDateInRange(
      values.alternativeDate,
      values.alternativeEndDate,
      blockedDateByKey,
    );

    if (selectedPreferredBlock) {
      setError("preferredEndDate", {
        type: "manual",
        message: `${selectedPreferredBlock.date} is unavailable. Choose a range without crossed-out dates.`,
      });
    }
    if (selectedAlternativeBlock) {
      setError("alternativeEndDate", {
        type: "manual",
        message: `${selectedAlternativeBlock.date} is unavailable. Choose a range without crossed-out dates.`,
      });
    }
    if (!rentalValid || selectedPreferredBlock || selectedAlternativeBlock) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    submitForReview(values);
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
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 1) void goToRentalDetails();
        else void goToReview();
      }}
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
            <div className="sm:col-span-2">
              <AvailabilityCalendar
                serviceName={selectedService?.name}
                selectedDate={preferredDate}
                selectedEndDate={preferredEndDate}
                blockedDates={effectiveBlockedDates}
                loading={blockedDatesLoading}
                error={effectiveBlockedDatesError}
                onSelect={(date) => {
                  setValue("preferredDate", date, { shouldValidate: true });
                  if (!preferredEndDate || preferredEndDate < date) {
                    setValue("preferredEndDate", date, { shouldValidate: true });
                  }
                }}
              />
            </div>
            <Field label="Preferred start date" required error={errors.preferredDate?.message}>
              <input type="date" min={todayKey()} {...register("preferredDate")} />
            </Field>
            <Field label="Preferred end date" required error={errors.preferredEndDate?.message}>
              <input
                type="date"
                min={preferredDate || todayKey()}
                {...register("preferredEndDate")}
              />
            </Field>
            <Field label="Alternative start date" error={errors.alternativeDate?.message}>
              <input type="date" min={todayKey()} {...register("alternativeDate")} />
            </Field>
            <Field label="Alternative end date" error={errors.alternativeEndDate?.message}>
              <input
                type="date"
                min={alternativeDate || todayKey()}
                {...register("alternativeEndDate")}
              />
            </Field>
            {preferredBlockedDate || alternativeBlockedDate ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 sm:col-span-2">
                Choose another date. Crossed-out dates already have an approved rental schedule or
                maintenance block.
              </div>
            ) : null}
            <Field
              label="Preferred start time"
              required
              error={errors.preferredStartTime?.message}
            >
              <input type="time" {...register("preferredStartTime")} />
            </Field>
            <Field
              label="Preferred end time"
              required
              error={errors.preferredEndTime?.message}
            >
              <input type="time" {...register("preferredEndTime")} />
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
              disabled={fileErrors.length > 0 || blockedDatesLoading}
              type="button"
              onClick={() => void goToReview()}
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

function AvailabilityCalendar({
  serviceName,
  selectedDate,
  selectedEndDate,
  blockedDates,
  loading,
  error,
  onSelect,
}: {
  serviceName?: string;
  selectedDate: string;
  selectedEndDate: string;
  blockedDates: PublicRentalBlockedDate[];
  loading: boolean;
  error?: string;
  onSelect: (date: string) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const blockedByDate = useMemo(
    () => new Map(blockedDates.map((item) => [item.date, item])),
    [blockedDates],
  );

  useEffect(() => {
    if (!selectedDate) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      setMonth(startOfMonth(parseDateKey(selectedDate)));
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [selectedDate]);

  const days = useMemo(() => monthDays(month), [month]);
  const unavailableCount = blockedDates.filter(
    (item) =>
      parseDateKey(item.date).getFullYear() === month.getFullYear() &&
      parseDateKey(item.date).getMonth() === month.getMonth(),
  ).length;

  return (
    <section className="rounded-2xl border border-[#d7e2dc] bg-[#fbfdfb] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-extrabold text-[#123d2a]">
            <CalendarDays className="size-5 text-[#08753a]" />
            Availability calendar
          </div>
          <p className="mt-1 text-xs leading-5 text-[#6b786f]">
            {serviceName
              ? `${serviceName}: crossed-out dates already have approved rental use.`
              : "Select equipment first to load unavailable dates."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth(addMonths(month, -1))}
            className="grid size-10 place-items-center rounded-xl border border-[#cbdac6] bg-white text-[#365f4a]"
          >
            <ChevronLeft className="size-4" />
          </button>
          <strong className="min-w-36 text-center text-sm text-[#123d2a]">
            {new Intl.DateTimeFormat("en-PH", {
              month: "long",
              year: "numeric",
            }).format(month)}
          </strong>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth(addMonths(month, 1))}
            className="grid size-10 place-items-center rounded-xl border border-[#cbdac6] bg-white text-[#365f4a]"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day} className="py-1 font-bold text-[#6b786f]">
            {day}
          </span>
        ))}
        {days.map((date) => {
          const key = localDateKey(date);
          const blocked = blockedByDate.get(key);
          const past = key < todayKey();
          const outsideMonth = date.getMonth() !== month.getMonth();
          const selected = selectedDate === key;
          const inSelectedRange =
            Boolean(selectedDate && selectedEndDate) &&
            key >= selectedDate &&
            key <= selectedEndDate;
          const disabled = Boolean(blocked) || past || !serviceName;

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              title={blocked ? blocked.reason : undefined}
              onClick={() => onSelect(key)}
              className={`relative min-h-10 rounded-xl border px-1 font-bold transition ${
                blocked
                  ? "border-red-200 bg-red-50 text-red-800 line-through"
                  : selected
                    ? "border-[#08753a] bg-[#08753a] text-white"
                    : inSelectedRange
                      ? "border-[#9bc9aa] bg-[#def0e2] text-[#174f32]"
                    : past || outsideMonth || !serviceName
                      ? "border-[#e1e8e2] bg-[#f4f6f2] text-[#a0aaa4]"
                      : "border-[#d4dfd7] bg-white text-[#294b39] hover:border-[#08753a] hover:bg-[#edf7ee]"
              }`}
            >
              {date.getDate()}
              {blocked ? (
                <span className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 bg-red-700/70" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-[#6b786f]">
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded bg-white ring-1 ring-[#cbdac6]" />
          Available
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded bg-red-50 ring-1 ring-red-200" />
          Booked or maintenance
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded bg-[#def0e2] ring-1 ring-[#9bc9aa]" />
          Selected rental range
        </span>
        {loading ? <span>Loading dates...</span> : null}
        {!loading && serviceName ? (
          <span>
            {unavailableCount} unavailable date{unavailableCount === 1 ? "" : "s"} this month
          </span>
        ) : null}
      </div>
    </section>
  );
}

function todayKey() {
  return localDateKey(new Date());
}

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKeysBetween(startDate: string, endDate: string) {
  if (!startDate || !endDate || endDate < startDate) return [];
  const end = parseDateKey(endDate);
  const dates: string[] = [];
  for (
    const cursor = parseDateKey(startDate);
    cursor <= end;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    dates.push(localDateKey(cursor));
  }
  return dates;
}

function firstBlockedDateInRange(
  startDate: string,
  endDate: string,
  blockedDates: Map<string, PublicRentalBlockedDate>,
) {
  return dateKeysBetween(startDate, endDate)
    .map((date) => blockedDates.get(date))
    .find((date): date is PublicRentalBlockedDate => Boolean(date));
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, offset: number) {
  return new Date(value.getFullYear(), value.getMonth() + offset, 1);
}

function monthDays(cursor: Date) {
  const first = startOfMonth(cursor);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));

  const days: Date[] = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    days.push(new Date(date));
  }
  return days;
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
