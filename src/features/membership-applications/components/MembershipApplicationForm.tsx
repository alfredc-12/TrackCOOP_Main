"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileUp,
  Loader2,
  PenLine,
  RotateCcw,
  Send,
  UploadCloud,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
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
import { DatePicker } from "@/components/ui/DatePicker";
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
type SignatureMode = "draw" | "upload";

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optionalText = z.string().trim().optional().or(z.literal(""));
const trueLiteral = (message: string) => z.boolean().refine((value) => value, message);

function todayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
    firstName: requiredText("First name"),
    middleName: optionalText,
    lastName: requiredText("Last name"),
    suffix: optionalText,
    email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
    contactNumber: requiredText("Contact number"),
    civilStatus: z.enum(civilStatuses),
    placeOfBirth: optionalText,
    dateOfBirth: requiredText("Date of birth"),
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
  });

export type MembershipApplicationFormValues = z.infer<typeof applicationSchema>;

const defaultValues: MembershipApplicationFormValues = {
  requestedMembershipType: "Associate",
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
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
  signedPlace: "Nasugbu, Batangas",
  signedAt: new Date().toISOString().slice(0, 10),
  finalConfirmation: false,
  website: "",
};

const stepFields: FieldPath<MembershipApplicationFormValues>[][] = [
  [
    "requestedMembershipType",
    "firstName",
    "middleName",
    "lastName",
    "suffix",
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
  ["signedPlace", "signedAt", "finalConfirmation"],
];

export function MembershipApplicationForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const [isRetryingUploads, setIsRetryingUploads] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<PublicSubmissionResult | null>(null);
  const [submissionDateOfBirth, setSubmissionDateOfBirth] = useState("");
  const [uploads, setUploads] = useState<DocumentUploadDraft[]>([]);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("draw");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);

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
    setSignatureError(null);

    if (!signatureFile) {
      setSignatureError("Draw your signature or upload a signature file.");
      return;
    }

    setIsSubmittingApplication(true);

    try {
      const result = await submitMembershipApplication(toPayload(values));
      setSubmissionResult(result);
      setSubmissionDateOfBirth(values.dateOfBirth);
      window.localStorage.removeItem(draftKey);
      await uploadSelectedDocuments(result, values.dateOfBirth);
    } catch (err) {
      setSubmitError(
        err instanceof ApiClientError
          ? formatApiClientError(err)
          : "Unable to submit the application. Please review the form and try again.",
      );
    } finally {
      setIsSubmittingApplication(false);
    }
  };

  const uploadSelectedDocuments = async (result: PublicSubmissionResult, dateOfBirth: string) => {
    const signatureUpload: DocumentUploadDraft[] = signatureFile
      ? [{ documentType: "Signed Application", file: signatureFile, clientError: null }]
      : [];
    const selectedUploads = [...signatureUpload, ...uploads].filter(
      (upload): upload is DocumentUploadDraft & { file: File } =>
        Boolean(upload.file) && !upload.clientError,
    );
    if (!selectedUploads.length) return;

    try {
      for (const upload of selectedUploads) {
        await uploadMembershipApplicationDocument({
          applicationCode: result.applicationCode,
          dateOfBirth,
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
    await uploadSelectedDocuments(submissionResult, submissionDateOfBirth);
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
      { documentType: "Valid ID", file: null, clientError: null },
    ]);
  };

  if (submissionResult) {
    return (
      <ApplicationSuccess
        result={submissionResult}
        uploadError={uploadError}
        isRetryingUploads={isRetryingUploads}
        onRetryUploads={uploads.length || signatureFile ? retryUploads : undefined}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_24px_70px_rgba(18,61,42,0.10)] ring-1 ring-[#DDE8D8] sm:p-8"
    >
      <ApplicationProgress currentStep={currentStep} />

      <div className="mt-8 rounded-[1.5rem] bg-[#FFFAF2] p-4 ring-1 ring-[#E7DCC7] sm:p-6">
        {currentStep === 0 ? (
          <PersonalInfoStep register={register} watch={watch} errors={errors} setValue={setValue} />
        ) : null}

        {currentStep === 1 ? (
          <BeneficiaryFields
            count={fields.length}
            register={register}
            watch={watch}
            setValue={setValue}
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
            setValue={setValue}
            errors={errors}
            signatureMode={signatureMode}
            signatureFile={signatureFile}
            signatureError={signatureError}
            onSignatureModeChange={(mode) => {
              setSignatureMode(mode);
              setSignatureError(null);
              setSignatureFile(null);
            }}
            onSignatureChange={(file, error) => {
              setSignatureFile(file);
              setSignatureError(error);
            }}
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
        <div className="mt-6 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{submitError}</p>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#DDE8D8] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          onClick={goBack}
          disabled={currentStep === 0 || isSubmittingApplication}
          className="h-11 rounded-full border border-[#DDE8D8] bg-white px-5 text-[#123D2A] hover:bg-[#EAF3E8]"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {currentStep < stepFields.length - 1 ? (
          <Button
            type="button"
            onClick={advanceStep}
            className="h-11 rounded-full bg-[#123D2A] px-5 text-white shadow-sm hover:bg-[#1F6B43]"
          >
            Continue
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={isSubmittingApplication}
            className="h-11 rounded-full bg-[#123D2A] px-5 text-white shadow-sm hover:bg-[#1F6B43]"
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
        <TextField label="First name" error={errors.firstName?.message} inputProps={register("firstName")} />
        <TextField label="Middle name (optional)" error={errors.middleName?.message} inputProps={register("middleName")} />
        <TextField label="Last name" error={errors.lastName?.message} inputProps={register("lastName")} />
        <TextField label="Suffix (optional)" error={errors.suffix?.message} inputProps={register("suffix")} />
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
        <div>
          <input type="hidden" {...register("dateOfBirth")} />
          <DatePicker
            label="Date of birth"
            value={watch("dateOfBirth")}
            onChange={(value) =>
              setValue("dateOfBirth", value, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              })
            }
            min="1900-01-01"
            max={todayDateKey()}
            placeholder="Select birth date"
            error={errors.dateOfBirth?.message}
          />
        </div>
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
  setValue,
  errors,
  signatureMode,
  signatureFile,
  signatureError,
  onSignatureModeChange,
  onSignatureChange,
  uploads,
  addUpload,
  updateUpload,
  removeUpload,
}: {
  register: UseFormRegister<MembershipApplicationFormValues>;
  watch: UseFormWatch<MembershipApplicationFormValues>;
  setValue: UseFormSetValue<MembershipApplicationFormValues>;
  errors: FieldErrors<MembershipApplicationFormValues>;
  signatureMode: SignatureMode;
  signatureFile: File | null;
  signatureError: string | null;
  onSignatureModeChange: (mode: SignatureMode) => void;
  onSignatureChange: (file: File | null, error: string | null) => void;
  uploads: DocumentUploadDraft[];
  addUpload: () => void;
  updateUpload: (index: number, patch: Partial<DocumentUploadDraft>) => void;
  removeUpload: (index: number) => void;
}) {
  return (
    <div className="grid gap-6">
      <ReviewSummary watch={watch} />

      <section className="rounded-[1.5rem] border border-[#DDE8D8] bg-[#F8F1E5] p-5 shadow-sm">
        <h3 className="text-lg font-bold text-[#123D2A]">Signature</h3>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <TextField label="Signed place" error={errors.signedPlace?.message} inputProps={register("signedPlace")} />
          <div>
            <input type="hidden" {...register("signedAt")} />
            <DatePicker
              label="Signed date"
              value={watch("signedAt")}
              onChange={(value) =>
                setValue("signedAt", value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                })
              }
              min="1900-01-01"
              max={todayDateKey()}
              placeholder="Select signed date"
              error={errors.signedAt?.message}
            />
          </div>
        </div>
        <SignatureInput
          mode={signatureMode}
          file={signatureFile}
          error={signatureError}
          onModeChange={onSignatureModeChange}
          onChange={onSignatureChange}
        />
        <label className="mt-5 flex gap-3 rounded-2xl border border-[#DDE8D8] bg-white p-4 text-sm font-semibold leading-6 text-[#123D2A]">
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

      <section className="rounded-[1.5rem] border border-[#DDE8D8] bg-white p-5 shadow-sm">
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
            className="h-10 rounded-full bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]"
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

function SignatureInput({
  mode,
  file,
  error,
  onModeChange,
  onChange,
}: {
  mode: SignatureMode;
  file: File | null;
  error: string | null;
  onModeChange: (mode: SignatureMode) => void;
  onChange: (file: File | null, error: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false);

  useEffect(() => {
    if (!isSignaturePadOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    clearCanvas(canvas);
    hasDrawnRef.current = false;
  }, [isSignaturePadOpen]);

  function pointFromEvent(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function beginDraw(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    const point = pointFromEvent(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;

    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;

    const point = pointFromEvent(event);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 4;
    context.strokeStyle = "#123D2A";
    context.lineTo(point.x, point.y);
    context.stroke();
    hasDrawnRef.current = true;
  }

  function finishDraw(event: PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    onChange(file, null);
  }

  function resetDrawnSignature() {
    const canvas = canvasRef.current;
    if (canvas) clearCanvas(canvas);
    hasDrawnRef.current = false;
    onChange(null, null);
  }

  function applyDrawnSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnRef.current) {
      onChange(null, "Draw your signature before using it.");
      return;
    }

    void canvasToSignatureFile(canvas).then((signature) => {
      onChange(signature, signature ? null : "Draw your signature before using it.");
      if (signature) setIsSignaturePadOpen(false);
    });
  }

  return (
    <div className="mt-5 rounded-[1.25rem] border border-[#DDE8D8] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]">
            Applicant Signature
          </p>
          <p className="mt-1 text-sm text-[#365F4A]">
            Draw your signature or upload a saved signature file.
          </p>
        </div>
        <div className="grid grid-cols-2 rounded-full bg-[#F8F1E5] p-1">
          <button
            type="button"
            onClick={() => onModeChange("draw")}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-black transition ${
              mode === "draw"
                ? "bg-[#123D2A] text-white shadow-sm"
                : "text-[#123D2A] hover:bg-[#EAF3E8]"
            }`}
          >
            <PenLine className="size-4" />
            Draw
          </button>
          <button
            type="button"
            onClick={() => onModeChange("upload")}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-black transition ${
              mode === "upload"
                ? "bg-[#123D2A] text-white shadow-sm"
                : "text-[#123D2A] hover:bg-[#EAF3E8]"
            }`}
          >
            <UploadCloud className="size-4" />
            Upload
          </button>
        </div>
      </div>

      {mode === "draw" ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#B9D1B6] bg-[#FFFAF2] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
                <PenLine className="size-5" />
              </span>
              <div>
                <p className="text-base font-black text-[#123D2A]">
                  {file && mode === "draw" ? "Drawn signature ready" : "No drawn signature yet"}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#365F4A]">
                  Open the signature pad for a larger writing space.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onChange(file, null);
                setIsSignaturePadOpen(true);
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#123D2A] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#1F6B43]"
            >
              <PenLine className="size-4" />
              {file && mode === "draw" ? "Replace signature" : "Open signature pad"}
            </button>
          </div>

          <Dialog.Root open={isSignaturePadOpen} onOpenChange={setIsSignaturePadOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[80] bg-[#061B11]/55 backdrop-blur-sm" />
              <Dialog.Content className="fixed inset-0 z-[90] overflow-y-auto p-3 focus:outline-none sm:p-6">
                <div className="flex min-h-full items-center justify-center">
                  <div className="relative w-full max-w-5xl rounded-[2rem] border border-[#DDE8D8] bg-white p-5 shadow-[0_28px_90px_rgba(6,27,17,0.28)] sm:p-7">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Dialog.Title className="text-2xl font-black tracking-normal text-[#123D2A]">
                          Draw Signature
                        </Dialog.Title>
                        <Dialog.Description className="mt-1 text-sm font-semibold text-[#365F4A]">
                          Use your mouse, trackpad, or finger in the signature area.
                        </Dialog.Description>
                      </div>
                      <Dialog.Close className="absolute right-4 top-4 grid size-10 place-items-center rounded-full border border-[#DDE8D8] bg-white text-[#123D2A] transition hover:bg-[#EAF3E8] sm:static">
                        <X className="size-5" />
                        <span className="sr-only">Close signature pad</span>
                      </Dialog.Close>
                    </div>

                    <canvas
                      ref={canvasRef}
                      width={1200}
                      height={420}
                      onPointerDown={beginDraw}
                      onPointerMove={draw}
                      onPointerUp={finishDraw}
                      onPointerCancel={() => {
                        isDrawingRef.current = false;
                      }}
                      className="mt-6 h-[min(48vh,26rem)] min-h-72 w-full touch-none rounded-[1.5rem] border border-dashed border-[#9FBEA2] bg-white shadow-inner"
                      aria-label="Draw applicant signature"
                    />

                    <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={resetDrawnSignature}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#DDE8D8] bg-white px-5 text-sm font-black text-[#123D2A] transition hover:bg-[#EAF3E8]"
                      >
                        <RotateCcw className="size-4" />
                        Clear signature
                      </button>
                      <div className="flex flex-col-reverse gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => setIsSignaturePadOpen(false)}
                          className="inline-flex h-11 items-center justify-center rounded-full border border-[#DDE8D8] bg-white px-5 text-sm font-black text-[#123D2A] transition hover:bg-[#EAF3E8]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={applyDrawnSignature}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#123D2A] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#1F6B43]"
                        >
                          <Check className="size-4" />
                          Use signature
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      ) : (
        <label className="mt-4 block rounded-2xl border border-dashed border-[#B9D1B6] bg-[#FFFAF2] p-4 text-sm font-semibold text-[#365F4A]">
          Upload signature
          <input
            type="file"
            accept={allowedUploadExtensions.join(",")}
            onChange={(event) => {
              const selectedFile = event.target.files?.[0] ?? null;
              const uploadError = validateUpload(selectedFile);
              onChange(uploadError ? null : selectedFile, uploadError);
            }}
            className="mt-3 block w-full text-sm text-[#123D2A] file:mr-4 file:h-10 file:rounded-full file:border-0 file:bg-[#123D2A] file:px-4 file:font-bold file:text-white"
          />
          <span className="mt-2 block text-xs text-[#5D6D63]">
            Accepted files: PDF, JPG, or PNG up to 5 MB.
          </span>
        </label>
      )}

      {file ? (
        <div className="mt-3 rounded-2xl border border-[#DDE8D8] bg-[#EAF3E8] px-4 py-3 text-sm font-bold text-[#123D2A]">
          {file.name} is ready to submit.
        </div>
      ) : null}

      {error ? <span className="mt-2 block text-sm font-semibold text-red-700">{error}</span> : null}
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
    <div className="grid gap-3 rounded-2xl border border-[#DDE8D8] bg-[#F8F1E5] p-4 md:grid-cols-[220px_1fr_auto]">
      <label className="block text-sm font-semibold text-[#365F4A]">
        Document type
        <select
          value={upload.documentType}
          onChange={(event) =>
            onChange({
              documentType: event.target.value as DocumentUploadDraft["documentType"],
            })
          }
          className="mt-2 h-11 w-full rounded-xl border border-[#DDE8D8] bg-white px-3 text-[#123D2A] outline-none focus:border-[#1F6B43]"
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
          className="mt-2 block w-full text-sm text-[#123D2A] file:mr-4 file:h-10 file:rounded-full file:border-0 file:bg-[#123D2A] file:px-4 file:font-bold file:text-white"
        />
        {upload.clientError ? (
          <span className="mt-1 block text-xs text-red-700">{upload.clientError}</span>
        ) : null}
      </label>
      <Button
        type="button"
        onClick={onRemove}
        className="h-11 self-end rounded-full border border-red-200 bg-white px-4 text-red-700 hover:bg-red-50"
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
        className="mt-2 h-12 w-full rounded-2xl border border-[#DDE8D8] bg-white px-4 text-base text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
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
        className="mt-2 h-12 w-full rounded-2xl border border-[#DDE8D8] bg-white px-4 text-base text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
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
    firstName: values.firstName.trim(),
    middleName: values.middleName?.trim() || undefined,
    lastName: values.lastName.trim(),
    suffix: values.suffix?.trim() || undefined,
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
    applicantSignatureName: applicantFullName(values),
    signedPlace: values.signedPlace.trim(),
    signedAt: signedDateToTimestamp(values.signedAt),
    website: values.website,
  };
}

function formatApiClientError(error: ApiClientError) {
  const fieldErrors = error.errors
    .filter((issue) => issue.message)
    .map((issue) =>
      issue.field
        ? `${humanizeFieldName(issue.field)}: ${issue.message}`
        : issue.message,
    );

  if (!fieldErrors.length) return error.message;
  return `${error.message}: ${fieldErrors.join(" ")}`;
}

function humanizeFieldName(field: string) {
  return field
    .replace(/\.(\d+)\./g, " $1 ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function signedDateToTimestamp(value: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!dateOnlyMatch) return value;

  const [, year, month, day] = dateOnlyMatch;
  const now = new Date();
  const signedAt = new Date(now);
  signedAt.setFullYear(Number(year), Number(month) - 1, Number(day));
  return signedAt.toISOString();
}

function applicantFullName(values: Pick<MembershipApplicationFormValues, "firstName" | "middleName" | "lastName" | "suffix">) {
  return [values.firstName, values.middleName, values.lastName, values.suffix]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

function validateUpload(file: File | null) {
  if (!file) return null;
  if (!allowedUploadTypes.includes(file.type)) return "Use a PDF, JPG, or PNG file.";
  if (file.size > maxUploadBytes) return "File must be 5 MB or smaller.";
  return null;
}

function clearCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function canvasToSignatureFile(canvas: HTMLCanvasElement) {
  return new Promise<File | null>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }

      resolve(new File([blob], `signature-${Date.now()}.png`, { type: "image/png" }));
    }, "image/png");
  });
}
