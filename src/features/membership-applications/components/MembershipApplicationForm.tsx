"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, ArrowRight, FileUp, Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type FieldPath,
  type UseFormRegister,
  type UseFormRegisterReturn,
  type UseFormSetValue,
  type UseFormWatch,
} from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { ApiClientError } from "@/lib/api-client";
import {
  submitMembershipApplication,
  uploadMembershipApplicationDocument,
} from "../membership-application-api";
import {
  civilStatuses,
  documentTypes,
  requestedMembershipTypes,
  type DocumentUploadDraft,
  type PublicMembershipApplicationInput,
  type PublicSubmissionResult,
} from "../membership-application-types";
import { ApplicationProgress } from "./ApplicationProgress";
import { ApplicationSuccess } from "./ApplicationSuccess";
import { BeneficiaryFields } from "./BeneficiaryFields";
import { CommitmentReview, ReviewSummary } from "./CommitmentReview";

const draftKey = "trackcoop.membershipApplicationDraft.v1";
const maxUploadBytes = 5 * 1024 * 1024;
const allowedUploadTypes = ["application/pdf", "image/jpeg", "image/png"];
const allowedUploadExtensions = [".pdf", ".jpg", ".jpeg", ".png"];

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optionalText = z.string().trim().optional().or(z.literal(""));
const trueLiteral = (message: string) => z.boolean().refine((value) => value, message);

const beneficiarySchema = z
  .object({
    fullName: z.string().trim().optional().or(z.literal("")),
    relationship: z.string().trim().optional().or(z.literal("")),
    age: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (value) =>
          !value || (/^\d+$/.test(value) && Number(value) >= 0 && Number(value) <= 130),
        "Enter a valid age.",
      ),
    birthDate: z.string().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const hasAnyValue = Boolean(
      value.fullName?.trim() ||
        value.relationship?.trim() ||
        (value.age !== "" && value.age !== undefined) ||
        value.birthDate?.trim(),
    );

    if (!hasAnyValue) return;

    if (!value.fullName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["fullName"],
        message: "Enter the beneficiary name.",
      });
    }

    if (!value.age && !value.birthDate?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["age"],
        message: "Enter age or birth date.",
      });
    }
  });

const applicationSchema = z
  .object({
    requestedMembershipType: z.enum(requestedMembershipTypes),
    fullName: requiredText("Full name"),
    email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
    contactNumber: requiredText("Contact number"),
    civilStatus: z.enum(civilStatuses),
    placeOfBirth: optionalText,
    dateOfBirth: z.string().optional().or(z.literal("")),
    currentAddress: requiredText("Current address"),
    barangay: optionalText,
    municipality: requiredText("Municipality"),
    province: requiredText("Province"),
    fatherName: optionalText,
    motherName: optionalText,
    spouseName: optionalText,
    occupation: optionalText,
    beneficiaries: z.array(beneficiarySchema),
    orientationCommitmentAccepted: trueLiteral("Orientation commitment is required."),
    membershipFeeCommitmentAccepted: trueLiteral("Membership fee commitment is required."),
    shareSubscriptionCommitmentAccepted: trueLiteral("Membership agreement is required."),
    initialShareCapitalAcknowledged: trueLiteral("Initial share-capital acknowledgement is required."),
    trueMemberRequirementAcknowledged: trueLiteral("True Member requirement acknowledgement is required."),
    bylawsAgreementAccepted: trueLiteral("Bylaws agreement is required."),
    patronageRefundAcknowledged: trueLiteral("Patronage-refund acknowledgement is required."),
    privacyConsentAccepted: trueLiteral("Privacy consent is required."),
    signatureName: requiredText("Typed signature"),
    signedPlace: requiredText("Signed place"),
    signedAt: requiredText("Signed date"),
    finalConfirmation: trueLiteral("Final confirmation is required."),
    website: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.civilStatus === "Married" && !value.spouseName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["spouseName"],
        message: "Spouse name is required for married applicants.",
      });
    }

    if (value.dateOfBirth) {
      const birthDate = new Date(value.dateOfBirth);
      const today = new Date();
      if (Number.isNaN(birthDate.getTime()) || birthDate >= today) {
        ctx.addIssue({
          code: "custom",
          path: ["dateOfBirth"],
          message: "Date of birth must be a valid past date.",
        });
      }
    }

    if (!signatureMatchesName(value.signatureName, value.fullName)) {
      ctx.addIssue({
        code: "custom",
        path: ["signatureName"],
        message: "Typed signature must reasonably match the applicant name.",
      });
    }
  });

export type MembershipApplicationFormValues = z.infer<typeof applicationSchema>;

const defaultValues: MembershipApplicationFormValues = {
  requestedMembershipType: "Associate",
  fullName: "",
  email: "",
  contactNumber: "",
  civilStatus: "Single",
  placeOfBirth: "",
  dateOfBirth: "",
  currentAddress: "",
  barangay: "",
  municipality: "Nasugbu",
  province: "Batangas",
  fatherName: "",
  motherName: "",
  spouseName: "",
  occupation: "",
  beneficiaries: [],
  orientationCommitmentAccepted: false,
  membershipFeeCommitmentAccepted: false,
  shareSubscriptionCommitmentAccepted: false,
  initialShareCapitalAcknowledged: false,
  trueMemberRequirementAcknowledged: false,
  bylawsAgreementAccepted: false,
  patronageRefundAcknowledged: false,
  privacyConsentAccepted: false,
  signatureName: "",
  signedPlace: "Nasugbu, Batangas",
  signedAt: new Date().toISOString().slice(0, 10),
  finalConfirmation: false,
  website: "",
};

const stepFields: FieldPath<MembershipApplicationFormValues>[][] = [
  [
    "requestedMembershipType",
    "fullName",
    "email",
    "contactNumber",
    "civilStatus",
    "placeOfBirth",
    "dateOfBirth",
    "currentAddress",
    "barangay",
    "municipality",
    "province",
    "fatherName",
    "motherName",
    "spouseName",
    "occupation",
  ],
  ["beneficiaries"],
  [
    "orientationCommitmentAccepted",
    "membershipFeeCommitmentAccepted",
    "shareSubscriptionCommitmentAccepted",
    "initialShareCapitalAcknowledged",
    "trueMemberRequirementAcknowledged",
    "bylawsAgreementAccepted",
    "patronageRefundAcknowledged",
    "privacyConsentAccepted",
  ],
  ["signatureName", "signedPlace", "signedAt", "finalConfirmation"],
];

export function MembershipApplicationForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const [isRetryingUploads, setIsRetryingUploads] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<PublicSubmissionResult | null>(null);
  const [uploads, setUploads] = useState<DocumentUploadDraft[]>([]);

  const restoredDefaults = useMemo(() => {
    if (typeof window === "undefined") return defaultValues;

    const rawDraft = window.localStorage.getItem(draftKey);
    if (!rawDraft) return defaultValues;

    try {
      return { ...defaultValues, ...JSON.parse(rawDraft), signedAt: defaultValues.signedAt };
    } catch {
      return defaultValues;
    }
  }, []);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MembershipApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: restoredDefaults,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "beneficiaries",
  });
  const draftValues = useWatch({ control });

  useEffect(() => {
    if (submissionResult) return;

    const draft = { ...draftValues };
    delete draft.website;
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draftValues, submissionResult]);

  const advanceStep = async () => {
    const valid = await trigger(stepFields[currentStep], { shouldFocus: true });
    if (valid) setCurrentStep((step) => Math.min(step + 1, stepFields.length - 1));
  };

  const goBack = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const onSubmit = async (values: MembershipApplicationFormValues) => {
    if (isSubmittingApplication) return;

    setSubmitError(null);
    setUploadError(null);
    setIsSubmittingApplication(true);

    try {
      const result = await submitMembershipApplication(toPayload(values));
      setSubmissionResult(result);
      window.localStorage.removeItem(draftKey);
      await uploadSelectedDocuments(result);
    } catch (err) {
      setSubmitError(
        err instanceof ApiClientError
          ? err.message
          : "Unable to submit the application. Please review the form and try again.",
      );
    } finally {
      setIsSubmittingApplication(false);
    }
  };

  const uploadSelectedDocuments = async (result: PublicSubmissionResult) => {
    const selectedUploads = uploads.filter(
      (upload): upload is DocumentUploadDraft & { file: File } =>
        Boolean(upload.file) && !upload.clientError,
    );
    if (!selectedUploads.length) return;

    try {
      for (const upload of selectedUploads) {
        await uploadMembershipApplicationDocument({
          applicationCode: result.applicationCode,
          trackingToken: result.trackingToken,
          documentType: upload.documentType,
          file: upload.file,
        });
      }
    } catch {
      setUploadError("Please retry after checking that each file is PDF, JPG, or PNG and under 5 MB.");
    }
  };

  const retryUploads = async () => {
    if (!submissionResult) return;

    setIsRetryingUploads(true);
    setUploadError(null);
    await uploadSelectedDocuments(submissionResult);
    setIsRetryingUploads(false);
  };

  const updateUpload = (index: number, patch: Partial<DocumentUploadDraft>) => {
    setUploads((current) =>
      current.map((upload, uploadIndex) =>
        uploadIndex === index ? { ...upload, ...patch } : upload,
      ),
    );
  };

  const addUpload = () => {
    setUploads((current) => [
      ...current,
      { documentType: "Signed Application", file: null, clientError: null },
    ]);
  };

  if (submissionResult) {
    return (
      <ApplicationSuccess
        result={submissionResult}
        uploadError={uploadError}
        isRetryingUploads={isRetryingUploads}
        onRetryUploads={uploads.length ? retryUploads : undefined}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="border border-[#DDE8D8] bg-white p-5 shadow-sm sm:p-8"
    >
      <ApplicationProgress currentStep={currentStep} />

      <div className="mt-8">
        {currentStep === 0 ? (
          <PersonalInfoStep register={register} watch={watch} errors={errors} setValue={setValue} />
        ) : null}

        {currentStep === 1 ? (
          <BeneficiaryFields
            count={fields.length}
            register={register}
            errors={errors}
            onAdd={() => append({ fullName: "", relationship: "", age: "", birthDate: "" })}
            onRemove={remove}
          />
        ) : null}

        {currentStep === 2 ? (
          <CommitmentReview register={register} watch={watch} errors={errors} />
        ) : null}

        {currentStep === 3 ? (
          <ReviewStep
            register={register}
            watch={watch}
            errors={errors}
            uploads={uploads}
            addUpload={addUpload}
            updateUpload={updateUpload}
            removeUpload={(index) =>
              setUploads((current) => current.filter((_, uploadIndex) => uploadIndex !== index))
            }
          />
        ) : null}
      </div>

      {submitError ? (
        <div className="mt-6 flex gap-3 border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{submitError}</p>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#DDE8D8] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          onClick={goBack}
          disabled={currentStep === 0 || isSubmittingApplication}
          className="h-11 border border-[#DDE8D8] bg-white px-5 text-[#123D2A] hover:bg-[#EAF3E8]"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {currentStep < stepFields.length - 1 ? (
          <Button
            type="button"
            onClick={advanceStep}
            className="h-11 bg-[#123D2A] px-5 text-white hover:bg-[#1F6B43]"
          >
            Continue
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={isSubmittingApplication}
            className="h-11 bg-[#123D2A] px-5 text-white hover:bg-[#1F6B43]"
          >
            {isSubmittingApplication ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {isSubmittingApplication ? "Submitting..." : "Submit Application"}
          </Button>
        )}
      </div>
    </form>
  );
}

function PersonalInfoStep({
  register,
  watch,
  errors,
  setValue,
}: {
  register: UseFormRegister<MembershipApplicationFormValues>;
  watch: UseFormWatch<MembershipApplicationFormValues>;
  errors: FieldErrors<MembershipApplicationFormValues>;
  setValue: UseFormSetValue<MembershipApplicationFormValues>;
}) {
  const civilStatus = watch("civilStatus");

  useEffect(() => {
    if (civilStatus !== "Married") setValue("spouseName", "");
  }, [civilStatus, setValue]);

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f4b62a]">
          Personal Information
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-normal text-[#123D2A]">
          Applicant details
        </h2>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <SelectField label="Requested membership type" error={errors.requestedMembershipType?.message} inputProps={register("requestedMembershipType")}>
          {requestedMembershipTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SelectField>
        <TextField label="Full name" error={errors.fullName?.message} inputProps={register("fullName")} />
        <TextField label="Email (optional)" type="email" error={errors.email?.message} inputProps={register("email")} />
        <TextField label="Contact number" error={errors.contactNumber?.message} inputProps={register("contactNumber")} />
        <SelectField label="Civil status" error={errors.civilStatus?.message} inputProps={register("civilStatus")}>
          {civilStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </SelectField>
        <TextField label="Occupation" error={errors.occupation?.message} inputProps={register("occupation")} />
        <TextField label="Place of birth" error={errors.placeOfBirth?.message} inputProps={register("placeOfBirth")} />
        <TextField label="Date of birth" type="date" error={errors.dateOfBirth?.message} inputProps={register("dateOfBirth")} />
        <TextField label="Current address" className="md:col-span-2" error={errors.currentAddress?.message} inputProps={register("currentAddress")} />
        <TextField label="Barangay" error={errors.barangay?.message} inputProps={register("barangay")} />
        <TextField label="Municipality" error={errors.municipality?.message} inputProps={register("municipality")} />
        <TextField label="Province" error={errors.province?.message} inputProps={register("province")} />
        <TextField label="Father name" error={errors.fatherName?.message} inputProps={register("fatherName")} />
        <TextField label="Mother name" error={errors.motherName?.message} inputProps={register("motherName")} />
        {civilStatus === "Married" ? (
          <TextField label="Spouse name" error={errors.spouseName?.message} inputProps={register("spouseName")} />
        ) : null}
      </div>
    </div>
  );
}

function ReviewStep({
  register,
  watch,
  errors,
  uploads,
  addUpload,
  updateUpload,
  removeUpload,
}: {
  register: UseFormRegister<MembershipApplicationFormValues>;
  watch: UseFormWatch<MembershipApplicationFormValues>;
  errors: FieldErrors<MembershipApplicationFormValues>;
  uploads: DocumentUploadDraft[];
  addUpload: () => void;
  updateUpload: (index: number, patch: Partial<DocumentUploadDraft>) => void;
  removeUpload: (index: number) => void;
}) {
  return (
    <div className="grid gap-6">
      <ReviewSummary watch={watch} />

      <section className="border border-[#DDE8D8] bg-[#F8F1E5] p-5">
        <h3 className="text-lg font-bold text-[#123D2A]">Signature</h3>
        <div className="mt-4 grid gap-5 md:grid-cols-3">
          <TextField label="Typed signature name" error={errors.signatureName?.message} inputProps={register("signatureName")} />
          <TextField label="Signed place" error={errors.signedPlace?.message} inputProps={register("signedPlace")} />
          <TextField label="Signed date" type="date" error={errors.signedAt?.message} inputProps={register("signedAt")} />
        </div>
        <label className="mt-5 flex gap-3 text-sm font-semibold leading-6 text-[#123D2A]">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-[#1F6B43]"
            {...register("finalConfirmation")}
          />
          <span>
            I confirm that the information in this application is true and ready
            for cooperative review.
            {errors.finalConfirmation ? (
              <span className="mt-1 block text-xs text-red-700">
                {errors.finalConfirmation.message}
              </span>
            ) : null}
          </span>
        </label>
      </section>

      <section className="border border-[#DDE8D8] bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#123D2A]">Optional uploads</h3>
            <p className="mt-1 text-sm text-[#365F4A]">
              Accepted files: PDF, JPG, or PNG up to 5 MB.
            </p>
          </div>
          <Button
            type="button"
            onClick={addUpload}
            className="h-10 bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]"
          >
            <FileUp className="size-4" />
            Add Upload
          </Button>
        </div>

        <div className="mt-4 grid gap-4">
          {uploads.map((upload, index) => (
            <UploadRow
              key={index}
              upload={upload}
              onRemove={() => removeUpload(index)}
              onChange={(patch) => updateUpload(index, patch)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function UploadRow({
  upload,
  onRemove,
  onChange,
}: {
  upload: DocumentUploadDraft;
  onRemove: () => void;
  onChange: (patch: Partial<DocumentUploadDraft>) => void;
}) {
  return (
    <div className="grid gap-3 border border-[#DDE8D8] bg-[#F8F1E5] p-4 md:grid-cols-[220px_1fr_auto]">
      <label className="block text-sm font-semibold text-[#365F4A]">
        Document type
        <select
          value={upload.documentType}
          onChange={(event) =>
            onChange({
              documentType: event.target.value as DocumentUploadDraft["documentType"],
            })
          }
          className="mt-2 h-11 w-full border border-[#DDE8D8] bg-white px-3 text-[#123D2A] outline-none focus:border-[#1F6B43]"
        >
          {documentTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold text-[#365F4A]">
        File
        <input
          type="file"
          accept={allowedUploadExtensions.join(",")}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            onChange({ file, clientError: validateUpload(file) });
          }}
          className="mt-2 block w-full text-sm text-[#123D2A] file:mr-4 file:h-10 file:border-0 file:bg-[#123D2A] file:px-4 file:font-bold file:text-white"
        />
        {upload.clientError ? (
          <span className="mt-1 block text-xs text-red-700">{upload.clientError}</span>
        ) : null}
      </label>
      <Button
        type="button"
        onClick={onRemove}
        className="h-11 self-end border border-red-200 bg-white px-4 text-red-700 hover:bg-red-50"
      >
        Remove
      </Button>
    </div>
  );
}

function TextField({
  label,
  error,
  inputProps,
  type = "text",
  className = "",
}: {
  label: string;
  error?: string;
  inputProps: UseFormRegisterReturn;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-semibold text-[#365F4A] ${className}`}>
      {label}
      <input
        type={type}
        className="mt-2 h-12 w-full border border-[#DDE8D8] bg-white px-4 text-base text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
        aria-invalid={Boolean(error)}
        {...inputProps}
      />
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  error,
  inputProps,
  children,
}: {
  label: string;
  error?: string;
  inputProps: UseFormRegisterReturn;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-[#365F4A]">
      {label}
      <select
        className="mt-2 h-12 w-full border border-[#DDE8D8] bg-white px-4 text-base text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
        aria-invalid={Boolean(error)}
        {...inputProps}
      >
        {children}
      </select>
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}

function toPayload(values: MembershipApplicationFormValues): PublicMembershipApplicationInput {
  return {
    requestedMembershipType: values.requestedMembershipType,
    fullName: values.fullName.trim(),
    email: values.email?.trim() || undefined,
    contactNumber: values.contactNumber.trim(),
    civilStatus: values.civilStatus,
    placeOfBirth: values.placeOfBirth?.trim() || undefined,
    dateOfBirth: values.dateOfBirth || undefined,
    currentAddress: values.currentAddress.trim(),
    barangay: values.barangay?.trim() || undefined,
    municipality: values.municipality.trim(),
    province: values.province.trim(),
    fatherName: values.fatherName?.trim() || undefined,
    motherName: values.motherName?.trim() || undefined,
    spouseName: values.spouseName?.trim() || undefined,
    occupation: values.occupation?.trim() || undefined,
    beneficiaries: values.beneficiaries
      .filter((beneficiary) => beneficiary.fullName?.trim())
      .map((beneficiary) => ({
        fullName: beneficiary.fullName?.trim() ?? "",
        relationship: beneficiary.relationship?.trim() || undefined,
        ageAtApplication: beneficiary.age ? Number(beneficiary.age) : undefined,
        birthDate: beneficiary.birthDate || undefined,
      })),
    orientationCommitmentAccepted: true,
    membershipFeeCommitmentAccepted: true,
    shareSubscriptionCommitmentAccepted: true,
    bylawsAgreementAccepted: true,
    patronageRefundAcknowledged: true,
    privacyConsentAccepted: true,
    applicantSignatureName: values.signatureName.trim(),
    signedPlace: values.signedPlace.trim(),
    signedAt: values.signedAt,
    website: values.website,
  };
}

function signatureMatchesName(signatureName: string, fullName: string) {
  const normalizedSignature = normalizeName(signatureName);
  const normalizedName = normalizeName(fullName);
  if (!normalizedSignature || !normalizedName) return false;
  if (normalizedSignature === normalizedName) return true;

  const signatureParts = normalizedSignature.split(" ");
  const nameParts = new Set(normalizedName.split(" "));
  return signatureParts.length >= 2 && signatureParts.every((part) => nameParts.has(part));
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function validateUpload(file: File | null) {
  if (!file) return null;
  if (!allowedUploadTypes.includes(file.type)) return "Use a PDF, JPG, or PNG file.";
  if (file.size > maxUploadBytes) return "File must be 5 MB or smaller.";
  return null;
}
