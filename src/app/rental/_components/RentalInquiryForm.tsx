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
import { toast } from "sonner";
import { cloneElement, useEffect, useMemo, useRef, useState } from "react";
import {
  useForm,
  useWatch,
  type FieldPath,
} from "react-hook-form";
import { BARANGAYS } from "../_lib/rentalConstants";
import {
  BookingSchema,
  validateUpload,
} from "../_lib/rentalValidation";
import { estimateRentalFee } from "../_lib/rentalEstimate";
import { formatPeso } from "../_lib/rentalFormatting";
import { z } from "zod";
import { useRental } from "../_context/RentalProvider";
import { rentalApiRepository } from "../_lib/rentalApi";
import {
  VALID_ID_TYPES,
  type PublicRentalBlockedDate,
  type ValidIdType,
} from "../_types/rental";
import { getAuthenticatedUser } from "@/lib/auth-client";

const ClientBookingSchema = BookingSchema.safeExtend({
  firstName: z.string().trim().min(2, "Enter your first name."),
  lastName: z.string().trim().min(2, "Enter your last name."),
});
type ClientFormValues = z.infer<typeof ClientBookingSchema>;

const defaultValues: ClientFormValues = {
  firstName: "",
  lastName: "",
  fullName: "",
  requesterType: "Public or Non-member",
  contactNumber: "",
  email: "",
  completeAddress: "",
  barangay: "",
  municipality: "Nasugbu",
  serviceId: "",
  intendedUse: "Not specified",
  preferredDate: "",
  preferredEndDate: "",
  preferredStartTime: "08:00",
  preferredEndTime: "17:00",
  requestDescription: "No additional details provided.",
  notes: "",
  validIdType: "",
  attachmentName: "",
  membershipProofName: "",
  dataPrivacyConsent: false,
  accuracyConfirmation: false,
  contactConsent: false,
  preferredPaymentMethod: "Cash",
};

const requesterFields: FieldPath<ClientFormValues>[] = [
  "firstName",
  "lastName",
  "fullName",
  "requesterType",
  "contactNumber",
  "email",
  "completeAddress",
  "barangay",
  "municipality",
  "validIdType",
];

const rentalFields: FieldPath<ClientFormValues>[] = [
  "serviceId",
  "intendedUse",
  "preferredDate",
  "preferredEndDate",
  "preferredStartTime",
  "preferredEndTime",
  "requestDescription",
  "notes",
  "attachmentName",
];

const confirmationFields: FieldPath<ClientFormValues>[] = [
  "dataPrivacyConsent",
  "accuracyConfirmation",
  "contactConsent",
  "preferredPaymentMethod",
];

export function RentalInquiryForm({
  member = false,
  hideBackButton = false,
  initialServiceId,
  onCancel,
  onSuccess,
}: {
  member?: boolean;
  hideBackButton?: boolean;
  initialServiceId?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const { services, getInquiryDraft, submitInquiry } = useRental();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const requestIdRef = useRef<string | null>(null);
  const [validIdFile, setValidIdFile] = useState<File>();
  const [validIdFileError, setValidIdFileError] = useState<string>();
  const [preselectedServiceId, setPreselectedServiceId] = useState(
    initialServiceId ?? "",
  );
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
  } = useForm<ClientFormValues>({
    resolver: zodResolver(ClientBookingSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      ...defaultValues,
      requesterType: member ? "Member" : "Public or Non-member",
    },
  });

  const selectedServiceId = useWatch({ control, name: "serviceId" });
  const preferredDate = useWatch({ control, name: "preferredDate" });
  const preferredEndDate = useWatch({ control, name: "preferredEndDate" });
  const requesterType = useWatch({ control, name: "requesterType" });
  const selectedService = services.find(
    (service) => service.serviceId === selectedServiceId,
  );
  const estimatedFee = useMemo(
    () =>
      estimateRentalFee({
        service: selectedService,
        requesterType:
          requesterType ?? (member ? "Member" : "Public or Non-member"),
        startDate: preferredDate,
        endDate: preferredEndDate,
      }),
    [member, preferredDate, preferredEndDate, requesterType, selectedService],
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

  const firstName = useWatch({ control, name: "firstName" });
  const lastName = useWatch({ control, name: "lastName" });
  const preferredPaymentMethod = useWatch({
    control,
    name: "preferredPaymentMethod",
  });
  useEffect(() => {
    setValue("fullName", `${firstName || ""} ${lastName || ""}`.trim(), {
      shouldValidate: true,
    });
  }, [firstName, lastName, setValue]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = getInquiryDraft();
      const params = new URLSearchParams(window.location.search);
      const selectedService = initialServiceId || params.get("service") || "";

      if (saved) {
        reset({
          ...defaultValues,
          ...saved,
          preferredEndDate: saved.preferredEndDate || saved.preferredDate,
          preferredEndTime: saved.preferredEndTime || "",
        });
      }
      if (selectedService) {
        setPreselectedServiceId(selectedService);
        setValue("serviceId", selectedService, { shouldValidate: true });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [getInquiryDraft, reset, setValue, initialServiceId]);

  useEffect(() => {
    let active = true;
    getAuthenticatedUser()
      .then(async (user) => {
        if (active && user) {
          const names = user.displayName.split(" ");
          const firstName = names[0];
          const lastName = names.slice(1).join(" ") || "Member";
          
          const currentValues = getValues();
          if (!currentValues.firstName) setValue("firstName", firstName, { shouldValidate: true });
          if (!currentValues.lastName) setValue("lastName", lastName, { shouldValidate: true });
          if (!currentValues.email) setValue("email", user.email, { shouldValidate: true });
          
          try {
            const profileRes = await fetch("/api/members/me/profile");
            if (profileRes.ok && active) {
              const profile = await profileRes.json();
              if (profile.contact_number && !currentValues.contactNumber) {
                setValue("contactNumber", profile.contact_number, { shouldValidate: true });
              }
              if (profile.barangay && !currentValues.barangay) {
                setValue("barangay", profile.barangay, { shouldValidate: true });
              }
              if (profile.municipality && !currentValues.municipality) {
                setValue("municipality", profile.municipality, { shouldValidate: true });
              }
              if (!currentValues.completeAddress) {
                const parts = [];
                if (profile.barangay) parts.push(`Brgy. ${profile.barangay}`);
                if (profile.municipality) parts.push(profile.municipality);
                if (profile.province) parts.push(profile.province);
                if (parts.length > 0) {
                  setValue("completeAddress", parts.join(", "), { shouldValidate: true });
                }
              }
            }
          } catch {}
        }
      })
      .catch(() => {}); // ignore error if unauthenticated

    return () => {
      active = false;
    };
  }, [member, setValue, getValues]);

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

  const submitBooking = async () => {
    setSubmitError(undefined);

    const requesterValid = await trigger(requesterFields);
    const hasValidId = validateValidIdFile(validIdFile, setValidIdFileError);
    if (!requesterValid || !hasValidId) {
      setCurrentStep(1);
      toast.error("Please fix the highlighted fields.");
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
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const values = getValues();
    const selectedPreferredBlock = firstBlockedDateInRange(
      values.preferredDate,
      values.preferredEndDate,
      blockedDateByKey,
    );

    if (selectedPreferredBlock) {
      setError("preferredEndDate", {
        type: "manual",
        message: `${selectedPreferredBlock.date} is unavailable. Choose a range without crossed-out dates.`,
      });
    }
    if (selectedPreferredBlock) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const rentalValid = await trigger(rentalFields);
    if (!rentalValid) {
      setCurrentStep(2);
      toast.error("Please fix the highlighted fields.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const confirmationsValid = await trigger(confirmationFields, {
      shouldFocus: true,
    });
    if (!confirmationsValid) {
      toast.error("Please confirm all required declarations.");
      return;
    }

    setSubmitting(true);
    try {
      requestIdRef.current ??= crypto.randomUUID();
      await submitInquiry({
        ...values,
        validIdType: values.validIdType as ValidIdType,
        clientRequestId: requestIdRef.current,
      }, validIdFile!, member);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(member ? "/portal/member/rentals" : "/rental/inquiry/success");
      }
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : "The booking could not be submitted.");
      setSubmitting(false);
    }
  };

  const handleValidIdFile = (file: File | undefined) => {
    const issue = validateUpload(file);
    setValidIdFile(issue ? undefined : file);
    setValidIdFileError(issue ?? (file ? undefined : "Upload a clear copy of the selected valid ID."));
  };

  const handleNext = async (fields: FieldPath<ClientFormValues>[], step: number) => {
    const valid = await trigger(fields, { shouldFocus: true });
    const fileValid =
      currentStep !== 1 ||
      validateValidIdFile(validIdFile, setValidIdFileError);
    if (valid && fileValid) {
      setCurrentStep(step);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      toast.error("Please fix the highlighted fields.");
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submitBooking();
      }}
      noValidate
      className="mx-auto max-w-4xl"
    >
      <input type="hidden" {...register("fullName")} />
      <input type="hidden" {...register("requesterType")} />
      
      {submitError && (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900"
        >
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="size-5" />
            Submission Error
          </div>
          <p className="mt-2 text-sm font-semibold">{submitError}</p>
        </div>
      )}

      <div className="flex flex-col gap-8">
        {currentStep === 1 && (
        <FormSection
          step="Step 1 of 3"
          title="Requester Information"
          description="Tell NFFAC who is making the rental booking and how we can contact you."
        >
          <div className="grid gap-5 sm:grid-cols-2">
              <Field label="First name" required error={errors.firstName?.message}>
                <input {...register("firstName")} autoComplete="given-name" />
              </Field>
              <Field label="Last name" required error={errors.lastName?.message}>
                <input {...register("lastName")} autoComplete="family-name" />
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
            <Field label="Email" required error={errors.email?.message}>
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
            <Field label="Valid ID type" required error={errors.validIdType?.message}>
              <select {...register("validIdType")}>
                <option value="">Select valid ID type</option>
                {VALID_ID_TYPES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </Field>
            <UploadField
              label="Valid ID file"
              required
              fileName={validIdFile?.name}
              error={validIdFileError}
              onChange={handleValidIdFile}
            />
          </div>

          <FormActions center={hideBackButton && !onCancel}>
            {(!hideBackButton || onCancel) && (
              <button
                type="button"
                onClick={onCancel ? onCancel : () => router.push("/rental")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-[#66756c] hover:bg-[#f1f4ef]"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={() => handleNext(requesterFields, 2)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#08753a] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#075f31] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08753a]"
            >
              Next
              <ArrowRight className="size-4" />
            </button>
          </FormActions>
        </FormSection>
        )}
        
        {currentStep === 2 && (
        <FormSection
          step="Step 2 of 3"
          title="Rental Details"
          description={preselectedServiceId
            ? "Review the selected equipment and check its availability schedule."
            : "Select the equipment and check its availability schedule."}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {preselectedServiceId ? (
              <div className="sm:col-span-2">
                <input type="hidden" {...register("serviceId")} />
                <p className="text-sm font-bold text-[#334b3d]">Selected equipment</p>
                <div className="mt-2 rounded-xl border border-[#b9cfbe] bg-[#f2f8f4] px-4 py-3">
                  <p className="font-extrabold text-[#123d2a]">
                    {selectedService?.name ?? preselectedServiceId}
                  </p>
                  <p className="mt-1 text-xs text-[#607067]">
                    This equipment was selected before the booking form opened.
                  </p>
                </div>
                {errors.serviceId?.message ? (
                  <p className="mt-2 text-xs font-semibold text-red-700">
                    {errors.serviceId.message}
                  </p>
                ) : null}
              </div>
            ) : (
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
            )}
            <input type="hidden" {...register("intendedUse")} />
            <div className="sm:col-span-2">
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Start date"
                  required
                  error={errors.preferredDate?.message}
                >
                  <input
                    type="date"
                    min={todayKey()}
                    {...register("preferredDate", {
                      onChange: (event) => {
                        const date = event.target.value;
                        const currentEndDate = getValues("preferredEndDate");
                        if (!currentEndDate || currentEndDate < date) {
                          setValue("preferredEndDate", date, {
                            shouldValidate: true,
                          });
                        }
                      },
                    })}
                  />
                </Field>
                <Field
                  label="End date"
                  required
                  error={errors.preferredEndDate?.message}
                >
                  <input
                    type="date"
                    min={preferredDate || todayKey()}
                    {...register("preferredEndDate")}
                  />
                </Field>
              </div>
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
              {selectedService && preferredDate && preferredEndDate && (
                <div className="mt-4 rounded-xl border border-[#9bc9aa] bg-[#eaf4ec] p-4 text-[#123d2a]">
                  <h4 className="font-bold">Possible rental fee</h4>
                  {estimatedFee ? (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm">
                        {estimatedFee.days} day{estimatedFee.days === 1 ? "" : "s"} x{" "}
                        {formatPeso(estimatedFee.dailyRate)} ({estimatedFee.rateLabel})
                      </span>
                      <strong className="text-lg">
                        {formatPeso(estimatedFee.total)}
                      </strong>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-[#365f4a]">
                      Rate is not configured yet. NFFAC will confirm the final amount.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[#168046]">
                    This automatic estimate may change after schedule and usage review.
                  </p>
                </div>
              )}
            </div>

            <input type="hidden" {...register("preferredStartTime")} />
            <input type="hidden" {...register("preferredEndTime")} />
            <input type="hidden" {...register("requestDescription")} />
            <input type="hidden" {...register("notes")} />
            <input type="hidden" {...register("attachmentName")} />
          </div>


          <FormActions center={hideBackButton}>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-[#66756c] hover:bg-[#f1f4ef]"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <button
              type="button"
              onClick={async () => {
                if (blockedDatesLoading || effectiveBlockedDatesError) {
                  setError("preferredDate", {
                    type: "manual",
                    message: blockedDatesLoading
                      ? "Please wait while availability dates load."
                      : "Availability dates could not be verified. Choose the equipment again or refresh the page.",
                  });
                  return;
                }
                const blockedMap = new Map(effectiveBlockedDates.map(item => [item.date, item]));
                const selectedBlock = firstBlockedDateInRange(getValues("preferredDate"), getValues("preferredEndDate"), blockedMap);
                if (selectedBlock) {
                  setError("preferredEndDate", { type: "manual", message: `${selectedBlock.date} is unavailable.` });
                }
                if (!selectedBlock) handleNext(rentalFields, 3);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#08753a] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#075f31] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08753a]"
            >
              Next
              <ArrowRight className="size-4" />
            </button>
          </FormActions>
        </FormSection>
        )}
        
        {currentStep === 3 && (
        <FormSection
          step="Step 3 of 3"
          title="Review & Consent"
          description="Acknowledge the policies and finalize your booking request."
        >
          <div className="grid gap-3">
            <ConsentField error={errors.dataPrivacyConsent?.message}>
              <input type="checkbox" className="mt-0.5" {...register("dataPrivacyConsent")} />
              <span>I consent to NFFAC collecting and processing my data in accordance with the Data Privacy Act for the purpose of this rental booking.</span>
            </ConsentField>
            <ConsentField error={errors.accuracyConfirmation?.message}>
              <input type="checkbox" className="mt-0.5" {...register("accuracyConfirmation")} />
              <span>I confirm that the information provided is accurate, and I agree to use the equipment only for the stated agricultural purpose.</span>
            </ConsentField>
            <ConsentField error={errors.contactConsent?.message}>
              <input type="checkbox" className="mt-0.5" {...register("contactConsent")} />
              <span>I agree to be contacted by NFFAC via SMS or email regarding my booking schedule, payment, and policy updates.</span>
            </ConsentField>
          </div>
          
          <div className="mt-6 border-t border-[#e3e9e5] pt-6">
            <h3 className="mb-3 text-sm font-bold text-[#123d2a]">Preferred Payment Method</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${preferredPaymentMethod === "Cash" ? "border-[#08753a] bg-[#f2f8f4]" : "border-[#e1e8e2] bg-[#f8fbf9] hover:bg-[#eaf4ec]"}`}>
                <input type="radio" value="Cash" {...register("preferredPaymentMethod")} className="size-4 text-[#08753a] focus:ring-[#08753a]" />
                <div>
                  <span className="block text-sm font-bold text-[#123d2a]">Cash Payment</span>
                  <span className="block text-xs text-[#6b786f]">Pay over the counter at the cooperative</span>
                </div>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${preferredPaymentMethod === "Online" ? "border-[#08753a] bg-[#f2f8f4]" : "border-[#e1e8e2] bg-[#f8fbf9] hover:bg-[#eaf4ec]"}`}>
                <input type="radio" value="Online" {...register("preferredPaymentMethod")} className="size-4 text-[#08753a] focus:ring-[#08753a]" />
                <div>
                  <span className="block text-sm font-bold text-[#123d2a]">Online (GCash)</span>
                  <span className="block text-xs text-[#6b786f]">Pay via GCash transfer and upload receipt</span>
                </div>
              </label>
            </div>
            {errors.preferredPaymentMethod && (
              <span className="mt-2 text-xs font-semibold text-red-700">{errors.preferredPaymentMethod.message}</span>
            )}
          </div>
          
          <FormActions center={hideBackButton}>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-[#66756c] hover:bg-[#f1f4ef]"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <button
              disabled={Boolean(validIdFileError) || blockedDatesLoading || submitting}
              type="submit"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#08753a] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#075f31] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08753a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Booking"}
            </button>
          </FormActions>
        </FormSection>
        )}
      </div>
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
    <fieldset>
      <legend className="sr-only">{title}</legend>
      <div className="mb-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#168046]">
          {step}
        </p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#10231a]">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b786f]">{description}</p>
      </div>
      <div>{children}</div>
    </fieldset>
  );
}

function FormActions({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={`mt-8 flex flex-col-reverse gap-3 border-t border-[#e3e9e5] pt-5 sm:flex-row sm:items-center ${center ? "sm:justify-center" : "sm:justify-end"}`}>
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
  required,
  fileName,
  error,
  onChange,
}: {
  label: string;
  required?: boolean;
  fileName?: string;
  error?: string;
  onChange: (file?: File) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[#334b3d]">
      <span>
        {label}
        {required ? <span className="text-red-700"> *</span> : null}
      </span>
      <span className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-[#f8faf7] px-4 py-3 transition hover:border-[#168046] hover:bg-[#f2f7f0] ${error ? "border-red-400" : "border-[#aebfa9]"}`}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e8f3e9] text-[#168046]">
          <FileUp className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm text-[#365f4a]">
            {fileName ?? "Choose ID file"}
          </span>
          <span className="block text-xs font-normal text-[#7a877f]">JPG, PNG, or PDF; up to 5 MB</span>
        </span>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="sr-only"
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.files?.[0])}
        />
      </span>
      {error ? <span className="text-xs font-semibold text-red-700">{error}</span> : null}
    </label>
  );
}

function ConsentField({
  error,
  children,
}: {
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`rounded-xl border bg-[#f8fbf9] p-4 text-sm font-medium text-[#123d2a] hover:bg-[#eaf4ec] ${error ? "border-red-400" : "border-[#e1e8e2]"}`}>
      <span className="flex items-start gap-3">{children}</span>
      {error ? <span className="mt-2 block text-xs font-semibold text-red-700">{error}</span> : null}
    </label>
  );
}

function validateValidIdFile(
  file: File | undefined,
  setError: (message: string | undefined) => void,
) {
  const issue = file
    ? validateUpload(file)
    : "Upload a clear copy of the selected valid ID.";
  setError(issue);
  return !issue;
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
    <section className="rounded-2xl border border-[#d7e2dc] bg-[#fbfdfb] p-3">
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
              className={`relative min-h-9 rounded-xl border px-1 font-bold transition ${
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
