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
  normalizePhilippineMobile,
  PERSON_NAME_PATTERN,
  validateUpload,
} from "../_lib/rentalValidation";
import { estimateRentalFee } from "../_lib/rentalEstimate";
import { formatPeso, formatRentalDateRange } from "../_lib/rentalFormatting";
import { z } from "zod";
import { useRental } from "../_context/RentalProvider";
import { rentalApiRepository } from "../_lib/rentalApi";
import {
  VALID_ID_TYPES,
  type PublicRentalBlockedDate,
  type ValidIdType,
} from "../_types/rental";
import { getAuthenticatedUser } from "@/lib/auth-client";
import { expressFetch } from "@/lib/express-api";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { DatePicker } from "@/components/ui/DatePicker";

const ClientBookingSchema = BookingSchema.safeExtend({
  firstName: z.string().trim().min(2, "Enter your first name.").max(60, "First name must be 60 characters or fewer.").regex(PERSON_NAME_PATTERN, "Use letters, spaces, apostrophes, or hyphens only."),
  lastName: z.string().trim().min(2, "Enter your last name.").max(60, "Last name must be 60 characters or fewer.").regex(PERSON_NAME_PATTERN, "Use letters, spaces, apostrophes, or hyphens only."),
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
  intendedUse: "",
  preferredDate: "",
  preferredEndDate: "",
  preferredStartTime: "08:00",
  preferredEndTime: "17:00",
  requestDescription: "",
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

const FARM_WORK_OPTIONS = [
  "Plowing",
  "Harrowing",
  "Land preparation",
  "Planting support",
  "Irrigation",
  "Spraying",
  "Harvesting",
  "Hauling or transport",
] as const;
const OTHER_FARM_WORK = "Other";

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
  const [selectedFarmWork, setSelectedFarmWork] = useState("");
  const [otherFarmWork, setOtherFarmWork] = useState("");
  const [contactDisplay, setContactDisplay] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([
    "Nasugbu, Batangas",
    "Lian, Batangas",
    "Balayan, Batangas",
    "Tagaytay City, Cavite",
    "Batangas City, Batangas",
    "Quezon City, Metro Manila",
  ]);
  const allBarangays = useMemo(() => {
    const values = addressSuggestions
      .filter((location) => location.split(",").length >= 3)
      .filter((location) => {
        const parts = location.split(",").map((part) => part.trim().toLowerCase());
        return parts[1] === "nasugbu" && parts[2] === "batangas";
      })
      .map((location) => location.split(",")[0].trim());
    return [...new Set(values.length ? values : BARANGAYS)].sort((a, b) => a.localeCompare(b));
  }, [addressSuggestions]);
  const {
    register,
    reset,
    setValue,
    setError,
    clearErrors,
    trigger,
    control,
    watch,
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

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("https://raw.githubusercontent.com/clavearnel/philippines-region-province-citymun-brgy/master/json/refprovince.json"),
      fetch("https://raw.githubusercontent.com/clavearnel/philippines-region-province-citymun-brgy/master/json/refcitymun.json"),
      fetch("https://raw.githubusercontent.com/clavearnel/philippines-region-province-citymun-brgy/master/json/refbrgy.json"),
    ]).then(async ([provinceResponse, cityResponse, barangayResponse]) => {
      if (!provinceResponse.ok || !cityResponse.ok || !barangayResponse.ok || cancelled) return;
      const provinces = (await provinceResponse.json()) as { RECORDS?: { provCode: string; provDesc: string }[] };
      const cities = (await cityResponse.json()) as { RECORDS?: { provCode: string; citymunCode: string; citymunDesc: string }[] };
      const barangays = (await barangayResponse.json()) as { RECORDS?: { provCode: string; citymunCode: string; brgyDesc: string }[] };
      const titleCase = (value: string) => value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
      const provinceNames = new Map((provinces.RECORDS ?? []).map((item) => [item.provCode, titleCase(item.provDesc)]));
      const cityNames = new Map((cities.RECORDS ?? []).map((item) => [item.citymunCode, titleCase(item.citymunDesc)]));
      const locations = [
        ...(provinces.RECORDS ?? []).map((item) => titleCase(item.provDesc)),
        ...(cities.RECORDS ?? []).map((item) => `${titleCase(item.citymunDesc)}, ${provinceNames.get(item.provCode) ?? ""}`),
        ...(barangays.RECORDS ?? []).map((item) => `${titleCase(item.brgyDesc)}, ${cityNames.get(item.citymunCode) ?? ""}, ${provinceNames.get(item.provCode) ?? ""}`),
      ].filter((location) => !location.includes(", ,"));
      if (!cancelled) setAddressSuggestions([...new Set(locations)].sort((a, b) => a.localeCompare(b)));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

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

  const intendedUse = useWatch({ control, name: "intendedUse" });
  useEffect(() => {
    setValue("requestDescription", intendedUse || "", {
      shouldValidate: Boolean(intendedUse),
    });
  }, [intendedUse, setValue]);
  function updateFarmWork(nextSelected: string, nextOther = otherFarmWork) {
    const cleanOther = nextOther.trim();
    const nextValue =
      nextSelected === OTHER_FARM_WORK ? cleanOther : nextSelected;
    setSelectedFarmWork(nextSelected);
    setOtherFarmWork(nextOther);
    setValue("intendedUse", nextValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

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
            const profileRes = await expressFetch("/api/members/me/profile");
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
          title="Your information"
          description="Enter your name, mobile number, address, and one valid ID. We will use these only to review this request."
        >
          <div className="grid gap-5 sm:grid-cols-2">
              <Field label="First name" required error={errors.firstName?.message}>
                <input {...register("firstName")} autoComplete="given-name" maxLength={60} />
              </Field>
              <Field label="Last name" required error={errors.lastName?.message}>
                <input {...register("lastName", { onBlur: () => void trigger("lastName") })} autoComplete="family-name" maxLength={60} />
              </Field>
            <Field
              label="Contact number"
              required
              hint="Format: +63 9XXXXXXXXX"
              error={errors.contactNumber?.message}
            >
              <div className="flex overflow-hidden rounded-xl border border-[#d5e1d0] bg-white focus-within:border-[#1f6b43] focus-within:ring-4 focus-within:ring-[#1f6b43]/10">
                <span className="flex min-w-[4.5rem] items-center justify-center border-r border-[#d5e1d0] bg-[#f7f3e8] px-3 text-sm font-bold text-[#365f4a]">+63</span>
                <input
                  value={contactDisplay}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/\D/g, "");
                    const localDigits = raw.startsWith("63")
                      ? raw.slice(2)
                      : raw.startsWith("0")
                        ? raw.slice(1)
                        : raw;
                    const next = localDigits.slice(0, 10);
                    setContactDisplay(next);
                    setValue("contactNumber", next ? `+63${next}` : "", { shouldValidate: true });
                  }}
                  onBlur={() => setValue("contactNumber", contactDisplay ? `+63${contactDisplay}` : "", { shouldValidate: true })}
                inputMode="tel"
                autoComplete="tel"
                  placeholder="9171234567"
                  maxLength={10}
                  className="min-w-0 flex-1 border-0 bg-transparent px-4 text-base outline-none"
                />
              </div>
            </Field>
            <Field label="Email (optional)" hint="Leave blank if you prefer SMS updates." error={errors.email?.message}>
              <input
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                maxLength={190}
              />
            </Field>
            <Field
              label="Complete address"
              required
              error={errors.completeAddress?.message}
              wide
            >
              <AddressAutocomplete
                value={watch("completeAddress") || ""}
                suggestions={addressSuggestions}
                error={errors.completeAddress?.message}
                onChange={(value) => setValue("completeAddress", value, { shouldDirty: true, shouldValidate: true })}
              />
            </Field>
            <Field label="Barangay" required error={errors.barangay?.message}>
              <StyledSelect
                value={watch("barangay") || "Select barangay"}
                options={["Select barangay", ...allBarangays]}
                onChange={(value) => setValue("barangay", value === "Select barangay" ? "" : value, { shouldDirty: true, shouldValidate: true })}
              />
            </Field>
            <Field label="Municipality" required error={errors.municipality?.message}>
              <input {...register("municipality")} maxLength={100} readOnly className="bg-[#f1f4ef]" />
            </Field>
            <Field label="Valid ID type" required error={errors.validIdType?.message}>
              <StyledSelect
                value={watch("validIdType") || "Select valid ID type"}
                options={["Select valid ID type", ...VALID_ID_TYPES]}
                onChange={(value) => setValue("validIdType", value === "Select valid ID type" ? "" : value, { shouldDirty: true, shouldValidate: true })}
              />
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
          title="Equipment and dates"
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
                <StyledSelect
                  value={services.find((service) => service.serviceId === selectedServiceId)?.name || "Select equipment"}
                  options={["Select equipment", ...services.map((service) => service.name)]}
                  onChange={(value) => setValue("serviceId", services.find((service) => service.name === value)?.serviceId ?? "", { shouldDirty: true, shouldValidate: true })}
                />
              </Field>
            )}
            <FarmWorkField
              selected={selectedFarmWork}
              otherValue={otherFarmWork}
              error={errors.intendedUse?.message}
              onChange={(work) => updateFarmWork(work)}
              onOtherChange={(value) => updateFarmWork(selectedFarmWork, value)}
            />
            <input type="hidden" {...register("intendedUse")} />
            <div className="sm:col-span-2">
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Start date"
                  required
                  error={errors.preferredDate?.message}
                >
                  <DatePicker
                    label="Start date"
                    hideLabel
                    value={preferredDate}
                    min={todayKey()}
                    max={`${new Date().getFullYear() + 2}-12-31`}
                    placeholder="Select start date"
                    onChange={(date) => {
                      setValue("preferredDate", date, { shouldValidate: true });
                      const currentEndDate = getValues("preferredEndDate");
                      if (!currentEndDate || currentEndDate < date) {
                        setValue("preferredEndDate", date, { shouldValidate: true });
                      }
                    }}
                  />
                </Field>
                <Field
                  label="End date"
                  required
                  error={errors.preferredEndDate?.message}
                >
                  <DatePicker
                    label="End date"
                    hideLabel
                    value={preferredEndDate}
                    min={preferredDate || todayKey()}
                    max={`${new Date().getFullYear() + 2}-12-31`}
                    placeholder="Select end date"
                    onChange={(date) => setValue("preferredEndDate", date, { shouldValidate: true })}
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
                        Original rate: {formatPeso(estimatedFee.originalDailyRate ?? estimatedFee.dailyRate)}
                        {estimatedFee.discountPercent ? (
                          <>
                            {" "}
                            - member discount {estimatedFee.discountPercent}% ={" "}
                            {formatPeso(estimatedFee.dailyRate)} per day
                          </>
                        ) : null}
                        <br />
                        {estimatedFee.days} day{estimatedFee.days === 1 ? "" : "s"} x{" "}
                        {formatPeso(estimatedFee.dailyRate)}
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
          title="Review and send"
          description="Check the request below. This is not yet a confirmed schedule; NFFAC will contact you after reviewing availability."
        >
          <div className="mb-5 rounded-xl border border-[#cfd9d2] bg-white p-4 text-sm text-[#334b3d]">
            <h3 className="font-extrabold text-[#123d2a]">Request summary</h3>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div><dt className="font-bold">Requester</dt><dd>{`${firstName || ""} ${lastName || ""}`.trim()}</dd></div>
              <div><dt className="font-bold">Equipment</dt><dd>{selectedService?.name ?? "Not selected"}</dd></div>
              <div><dt className="font-bold">Requested dates</dt><dd>{formatRentalDateRange(preferredDate, preferredEndDate, true)}</dd></div>
              <div><dt className="font-bold">Farm work</dt><dd>{intendedUse || "Not provided"}</dd></div>
            </dl>
          </div>
          <ConsentField
            error={
              errors.dataPrivacyConsent?.message ||
              errors.accuracyConfirmation?.message ||
              errors.contactConsent?.message
            }
          >
            <input
              type="checkbox"
              className="mt-0.5 size-5"
              {...register("dataPrivacyConsent", {
                onChange: (event) => {
                  const checked = event.target.checked;
                  setValue("accuracyConfirmation", checked, { shouldValidate: true });
                  setValue("contactConsent", checked, { shouldValidate: true });
                },
              })}
            />
            <span>I confirm that my information is correct, I will use the equipment only for the stated farm work, and NFFAC may contact me about this request.</span>
          </ConsentField>
          <input type="hidden" {...register("accuracyConfirmation")} />
          <input type="hidden" {...register("contactConsent")} />
          
          <div className="mt-6 border-t border-[#e3e9e5] pt-6">
            <h3 className="mb-3 text-sm font-bold text-[#123d2a]">How do you prefer to pay?</h3>
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
              {submitting ? "Sending request..." : "Send Rental Request"}
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

function FarmWorkField({
  selected,
  otherValue,
  error,
  onChange,
  onOtherChange,
}: {
  selected: string;
  otherValue: string;
  error?: string;
  onChange: (work: string) => void;
  onOtherChange: (value: string) => void;
}) {
  const otherSelected = selected === OTHER_FARM_WORK;

  return (
    <div className="grid gap-2 text-sm font-bold text-[#334b3d] sm:col-span-2">
      <span>
        What farm work will you do? <span className="text-red-700">*</span>
      </span>
      <div className="grid gap-3">
        <StyledSelect
          value={selected || "Select farm work"}
          options={["Select farm work", ...FARM_WORK_OPTIONS, OTHER_FARM_WORK]}
          onChange={(value) => onChange(value === "Select farm work" ? "" : value)}
        />
        {otherSelected ? (
          <input
            value={otherValue}
            onChange={(event) => onOtherChange(event.target.value)}
            maxLength={80}
            placeholder="Please specify other farm work"
            className="min-h-12 rounded-xl border border-[#cfd9d2] bg-white px-3.5 py-2.5 text-sm font-normal text-[#17211c] outline-none transition placeholder:text-[#98a39d] focus:border-[#168046] focus:ring-4 focus:ring-[#168046]/10"
          />
        ) : null}
      </div>
      {!error ? (
        <span className="text-xs font-normal text-[#7a877f]">
          Choose Other if the work is not listed.
        </span>
      ) : (
        <span className="text-xs font-semibold text-red-700">{error}</span>
      )}
    </div>
  );
}

function AddressAutocomplete({
  value,
  suggestions,
  error,
  onChange,
}: {
  value: string;
  suggestions: string[];
  error?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = value.trim().toLowerCase();
  const matches = query.length < 2
    ? []
    : suggestions
      .filter((location) => location.toLowerCase().includes(query))
      .slice(0, 8);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        autoComplete="street-address"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="rental-address-suggestions"
        aria-expanded={open && matches.length > 0}
        aria-invalid={Boolean(error)}
        maxLength={250}
        placeholder="Search barangay, municipality, or enter house/street"
        className="mt-1 h-12 w-full rounded-xl border border-[#DDE8D8] bg-white px-4 text-base font-normal text-[#123D2A] outline-none transition placeholder:text-[#9AA8A0] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
      />
      {open && matches.length > 0 ? (
        <div id="rental-address-suggestions" role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-y-auto rounded-xl border border-[#CAD8CB] bg-white p-1.5 shadow-[0_18px_40px_rgba(18,61,42,0.16)]">
          {matches.map((location) => (
            <button key={location} type="button" role="option" aria-selected={location === value} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(location); setOpen(false); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#365F4A] hover:bg-[#EAF3E8] hover:text-[#123D2A]">
              {location}
            </button>
          ))}
        </div>
      ) : null}
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
    <label className={`block w-full rounded-xl border bg-[#f8fbf9] p-4 text-sm font-medium text-[#123d2a] hover:bg-[#eaf4ec] ${error ? "border-red-400" : "border-[#e1e8e2]"}`}>
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
  const maintenanceCount = blockedDates.filter(
    (item) =>
      item.status === "Maintenance" &&
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
              ? `${serviceName}: unavailable dates show approved rentals or maintenance.`
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
          const maintenance = blocked?.status === "Maintenance";

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              title={
                blocked
                  ? maintenance
                    ? "Unavailable: scheduled maintenance"
                    : blocked.reason
                  : undefined
              }
              onClick={() => onSelect(key)}
              className={`relative min-h-9 rounded-xl border px-1 font-bold transition ${
                blocked
                  ? maintenance
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-red-200 bg-red-50 text-red-800 line-through"
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
                maintenance ? (
                  <span className="absolute right-1 top-1 rounded bg-amber-200 px-1 text-[9px] font-black leading-3 text-amber-950">
                    M
                  </span>
                ) : (
                  <span className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 bg-red-700/70" />
                )
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
          Booked
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded bg-amber-50 ring-1 ring-amber-300" />
          Maintenance
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded bg-[#def0e2] ring-1 ring-[#9bc9aa]" />
          Selected rental range
        </span>
        {loading ? <span>Loading dates...</span> : null}
        {!loading && serviceName ? (
          <span>
            {unavailableCount} unavailable date{unavailableCount === 1 ? "" : "s"} this month
            {maintenanceCount ? `, including ${maintenanceCount} maintenance` : ""}
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
