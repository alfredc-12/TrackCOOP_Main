"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileUp,
  Home,
  Loader2,
  Mail,
  MapPin,
  PenLine,
  RotateCcw,
  Send,
  UploadCloud,
  UserRound,
  UsersRound,
  WalletCards,
  X,
  ChevronDown,
  Check as SelectCheck,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ChangeEvent,
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
import { CommitmentReview } from "./CommitmentReview";

const draftKey = "trackcoop.membershipApplicationDraft.v1";
const maxUploadBytes = 5 * 1024 * 1024;
const allowedUploadTypes = ["application/pdf", "image/jpeg", "image/png"];
const allowedUploadExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
const occupationOptions = [
  "Farmer",
  "Fisherfolk",
  "Livestock raiser",
  "Poultry raiser",
  "Aquaculture worker",
  "Agricultural worker",
  "Fish vendor",
  "Entrepreneur",
  "Government employee",
  "Private employee",
  "Self-employed",
  "Student",
  "Retired",
  "Unemployed",
] as const;
const motionEase = [0.22, 1, 0.36, 1] as const;

function formatLocationName(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, separator: string, letter: string) => `${separator}${letter.toUpperCase()}`);
}
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
    fullName: requiredText("Beneficiary full name"),
    relationship: requiredText("Beneficiary relationship"),
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
    email: z.string().trim().min(1, "Email is required.").email("Enter a valid email."),
    contactNumber: requiredText("Contact number").regex(/^9\d{9}$/, "Enter 10 digits starting with 9 after +63."),
    civilStatus: z.enum(civilStatuses),
    placeOfBirth: optionalText,
    dateOfBirth: requiredText("Date of birth"),
    currentAddress: requiredText("Current address"),
    barangay: optionalText,
    municipality: requiredText("Municipality"),
    province: requiredText("Province"),
    fatherName: requiredText("Father name"),
    motherName: requiredText("Mother name"),
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
    "firstName",
    "middleName",
    "lastName",
    "suffix",
    "email",
    "contactNumber",
    "civilStatus",
    "placeOfBirth",
    "dateOfBirth",
    "occupation",
  ],
  [
    "currentAddress",
    "barangay",
    "municipality",
    "province",
    "fatherName",
    "motherName",
    "spouseName",
    "beneficiaries",
  ],
  [
    "requestedMembershipType",
    "orientationCommitmentAccepted",
    "membershipFeeCommitmentAccepted",
    "shareSubscriptionCommitmentAccepted",
    "initialShareCapitalAcknowledged",
    "trueMemberRequirementAcknowledged",
    "bylawsAgreementAccepted",
    "patronageRefundAcknowledged",
    "privacyConsentAccepted",
  ],
  ["signedPlace", "signedAt"],
  ["finalConfirmation"],
];

export function MembershipApplicationForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const [isRetryingUploads, setIsRetryingUploads] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [submissionResult, setSubmissionResult] = useState<PublicSubmissionResult | null>(null);
  const [submissionDateOfBirth, setSubmissionDateOfBirth] = useState("");
  const [uploads, setUploads] = useState<DocumentUploadDraft[]>([]);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("draw");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  const hasLoadedDraftRef = useRef(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const {
    register,
    control,
    handleSubmit,
    trigger,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<MembershipApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "beneficiaries",
  });
  const draftValues = useWatch({ control });

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(draftKey);
      if (rawDraft) {
        reset({
          ...defaultValues,
          ...JSON.parse(rawDraft),
          signedAt: defaultValues.signedAt,
        });
      }
    } catch {
      // Ignore corrupted drafts and keep the default application state.
    } finally {
      hasLoadedDraftRef.current = true;
    }
  }, [reset]);

  useEffect(() => {
    if (!hasLoadedDraftRef.current) return;
    if (submissionResult) return;

    const draft = { ...draftValues };
    delete draft.website;
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draftValues, submissionResult]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isSubmittingApplication) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [isSubmittingApplication]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      stepHeadingRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
      stepHeadingRef.current?.focus({ preventScroll: true });
    }, prefersReducedMotion ? 40 : 180);

    return () => window.clearTimeout(timeoutId);
  }, [currentStep, prefersReducedMotion]);

  const goToStep = (nextStep: number) => {
    const clampedStep = Math.min(Math.max(nextStep, 0), stepFields.length - 1);
    if (clampedStep === currentStep) return;
    setStepDirection(clampedStep > currentStep ? 1 : -1);
    setCurrentStep(clampedStep);
  };

  const advanceStep = async () => {
    const valid = await trigger(stepFields[currentStep], { shouldFocus: true });
    if (valid) goToStep(currentStep + 1);
  };

  const goBack = () => {
    goToStep(currentStep - 1);
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

  const viewTransition = prefersReducedMotion
    ? { duration: 0.08 }
    : { duration: 0.28, ease: motionEase };
  const exitTransition = prefersReducedMotion
    ? { duration: 0.06 }
    : { duration: 0.16, ease: "easeIn" as const };
  const stepContent = (() => {
    if (currentStep === 0) {
      return <PersonalInfoStep register={register} watch={watch} errors={errors} setValue={setValue} />;
    }

    if (currentStep === 1) {
      return (
        <FamilyStep
          count={fields.length}
          register={register}
          watch={watch}
          setValue={setValue}
          errors={errors}
          onAdd={() => append({ fullName: "", relationship: "", age: "", birthDate: "" })}
          onRemove={remove}
        />
      );
    }

    if (currentStep === 2) {
      return (
        <MembershipStep
          register={register}
          watch={watch}
          setValue={setValue}
          errors={errors}
        />
      );
    }

    if (currentStep === 3) {
      return (
        <DocumentsSignatureStep
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
      );
    }

    return (
      <FinalReviewStep
        register={register}
        watch={watch}
        errors={errors}
        uploads={uploads}
        signatureFile={signatureFile}
        onEditStep={goToStep}
      />
    );
  })();

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
      aria-busy={isSubmittingApplication}
      className="grid gap-6"
    >
      <section className="rounded-[1.5rem] border border-[#DDE8D8] bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-sm font-black text-[#D8A011]">Membership Application</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={currentStep}
                ref={stepHeadingRef}
                tabIndex={-1}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={viewTransition}
                className="mt-2 scroll-mt-28 text-3xl font-black leading-tight tracking-normal text-[#123D2A] outline-none"
              >
                {applicationStepTitle(currentStep)}
              </motion.h2>
            </AnimatePresence>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5D6D63]">
              Complete the current section. Payment is not required until NFFAC approves the application for payment.
            </p>
          </div>
          <motion.div
            layout
            transition={viewTransition}
            className="rounded-2xl border border-[#DDE8D8] bg-[#F8F1E5] px-4 py-3 text-sm font-bold text-[#365F4A]"
          >
            Step {currentStep + 1} of 5
          </motion.div>
        </div>
      </section>

      <AnimatePresence initial={false}>
        {!isOnline ? (
          <motion.div
            key="offline-alert"
            role="status"
            aria-live="polite"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={exitTransition}
            className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            You are offline. Your draft is saved, but submission will work after your connection returns.
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ApplicationProgress currentStep={currentStep} />

      <motion.div layout className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <motion.div
          layout
          transition={viewTransition}
          className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_24px_70px_rgba(18,61,42,0.10)] ring-1 ring-[#DDE8D8] sm:p-7"
        >
          <AnimatePresence mode="wait" custom={stepDirection} initial={false}>
            <motion.div
              key={currentStep}
              custom={stepDirection}
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      x: stepDirection > 0 ? 10 : -10,
                      y: stepDirection > 0 ? 6 : 0,
                      filter: "blur(2px)",
                    }
              }
              animate={{ opacity: 1, x: 0, y: 0, filter: "blur(0px)" }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -6, filter: "blur(1px)" }
              }
              transition={viewTransition}
            >
              {stepContent}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div layout transition={viewTransition}>
          <ApplicationSummaryRail
            values={draftValues}
            currentStep={currentStep}
            uploads={uploads}
            signatureFile={signatureFile}
          />
        </motion.div>
      </motion.div>

      <AnimatePresence initial={false}>
        {submitError ? (
          <motion.div
            key="submit-error"
            role="alert"
            aria-live="assertive"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={exitTransition}
            className="mt-6 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div><p>{submitError}</p><p className="mt-1 font-semibold">Your entries are still here. Review the message, then try submitting again.</p></div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-col-reverse gap-3 rounded-[1.5rem] border border-[#DDE8D8] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          onClick={goBack}
          disabled={currentStep === 0 || isSubmittingApplication}
          className="h-11 rounded-full border border-[#DDE8D8] bg-white px-5 text-[#123D2A] hover:bg-[#EAF3E8]"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <AnimatePresence mode="wait" initial={false}>
          {currentStep < stepFields.length - 1 ? (
            <motion.div
              key="continue"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={exitTransition}
            >
              <Button
                type="button"
                onClick={advanceStep}
                className="h-11 rounded-full bg-[#123D2A] px-5 text-white shadow-sm hover:bg-[#1F6B43] active:scale-[0.98]"
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="submit"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={exitTransition}
            >
              <Button
                type="submit"
                disabled={isSubmittingApplication || !isOnline}
                className="h-11 rounded-full bg-[#123D2A] px-5 text-white shadow-sm hover:bg-[#1F6B43] active:scale-[0.98]"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isSubmittingApplication ? (
                    <motion.span
                      key="loader"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      transition={{ duration: prefersReducedMotion ? 0.05 : 0.12 }}
                    >
                      <Loader2 className="size-4 animate-spin" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="send"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      transition={{ duration: prefersReducedMotion ? 0.05 : 0.12 }}
                    >
                      <Send className="size-4" />
                    </motion.span>
                  )}
                </AnimatePresence>
                {isSubmittingApplication ? "Submitting..." : "Submit Membership Application"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}

function applicationStepTitle(step: number) {
  return ["About You", "Address & Family", "Membership", "Documents & Signature", "Review & Submit"][step] ?? "Membership Application";
}

function ApplicationSummaryRail({
  values,
  currentStep,
  uploads,
  signatureFile,
}: {
  values: {
    requestedMembershipType?: string;
    firstName?: string;
    lastName?: string;
  };
  currentStep: number;
  uploads: DocumentUploadDraft[];
  signatureFile: File | null;
}) {
  const membershipPath = values.requestedMembershipType ?? "Associate";
  const completed = currentStep + 1;
  const namedApplicant = [values.firstName, values.lastName].filter(Boolean).join(" ");

  return (
    <aside className="sticky top-24 grid gap-4 self-start">
      <section className="rounded-[1.5rem] border border-[#DDE8D8] bg-white p-5 shadow-[0_18px_42px_rgba(18,61,42,0.08)]">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f4b62a]">
          Your Application
        </p>
        <h3 className="mt-3 text-xl font-black text-[#123D2A]">
          {namedApplicant || "New applicant"}
        </h3>
        <dl className="mt-5 grid gap-4 text-sm">
          <SummaryMetric label="Membership Path" value={membershipPath} />
          <SummaryMetric label="Required Share Capital" value={membershipPath === "True Member" ? "PHP 3,000" : "Not required yet"} />
          <SummaryMetric label="Payment" value="Not required yet" />
          <SummaryMetric label="Progress" value={`${completed} of 5 sections active`} />
          <SummaryMetric label="Documents" value={`${uploads.filter((upload) => upload.file).length} ready`} />
          <SummaryMetric label="Signature" value={signatureFile ? "Ready" : "Needed"} />
        </dl>
      </section>
    </aside>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#EEF2EC] pb-3 last:border-b-0 last:pb-0">
      <dt className="text-[#5D6D63]">{label}</dt>
      <dd className="text-right font-black text-[#123D2A]">{value}</dd>
    </div>
  );
}

function ApplicationFieldGroup({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#DDE8D8] bg-[#FFFAF2] p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-white text-[#1F6B43] shadow-sm">
          <Icon className="size-4" />
        </span>
        <h3 className="text-base font-black text-[#123D2A]">{title}</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
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
  const occupation = watch("occupation");
  const isOtherOccupation = Boolean(occupation) && !occupationOptions.includes(occupation as (typeof occupationOptions)[number]);
  const [showOtherOccupation, setShowOtherOccupation] = useState(isOtherOccupation);
  const [placeSuggestions, setPlaceSuggestions] = useState<string[]>(["Batangas City, Batangas", "Lipa City, Batangas", "Manila, Metro Manila", "Quezon City, Metro Manila", "Cebu City, Cebu", "Davao City, Davao del Sur"]);

  useEffect(() => {
    let cancelled = false;
    const loadBatangasLocations = async () => {
      try {
        const [provinceResponse, cityResponse, barangayResponse] = await Promise.all([
          fetch("https://raw.githubusercontent.com/clavearnel/philippines-region-province-citymun-brgy/master/json/refprovince.json"),
          fetch("https://raw.githubusercontent.com/clavearnel/philippines-region-province-citymun-brgy/master/json/refcitymun.json"),
          fetch("https://raw.githubusercontent.com/clavearnel/philippines-region-province-citymun-brgy/master/json/refbrgy.json"),
        ]);
        if (!provinceResponse.ok || !cityResponse.ok || !barangayResponse.ok) return;
        const provinces = (await provinceResponse.json()) as { RECORDS?: { provCode: string; provDesc: string }[] };
        const cities = (await cityResponse.json()) as { RECORDS?: { provCode: string; citymunCode: string; citymunDesc: string }[] };
        const barangays = (await barangayResponse.json()) as { RECORDS?: { provCode: string; citymunCode: string; brgyDesc: string }[] };
        if (cancelled) return;
        const provinceNames = new Map((provinces.RECORDS ?? []).map((item) => [item.provCode, item.provDesc]));
        const cityNames = new Map((cities.RECORDS ?? []).map((item) => [item.citymunCode, item.citymunDesc]));
        const locations = [
          ...(provinces.RECORDS ?? []).map((item) => formatLocationName(item.provDesc)),
          ...(cities.RECORDS ?? []).map((item) => `${formatLocationName(item.citymunDesc)}, ${formatLocationName(provinceNames.get(item.provCode) ?? "")}`),
          ...(barangays.RECORDS ?? []).map((item) => `${formatLocationName(item.brgyDesc)}, ${formatLocationName(cityNames.get(item.citymunCode) ?? "")}, ${formatLocationName(provinceNames.get(item.provCode) ?? "")}`),
        ];
        setPlaceSuggestions([...new Set(locations.filter((location) => !location.includes(", ,")).map((location) => formatLocationName(location)))].sort((a, b) => a.localeCompare(b)));
      } catch {
        // Keep the local Batangas fallback suggestions when the dataset is unavailable.
      }
    };
    void loadBatangasLocations();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (civilStatus !== "Married") setValue("spouseName", "");
  }, [civilStatus, setValue]);

  return (
    <div className="grid gap-5">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3E8] text-[#1F6B43]">
          <UserRound className="size-6" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f4b62a]">
            About You
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-normal text-[#123D2A]">
            Tell us who is applying.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5D6D63]">
            Use the applicant legal name and reachable contact details. Payment is not requested in this step.
          </p>
        </div>
      </div>

      <ApplicationFieldGroup icon={UserRound} title="Name">
        <TextField label="First name" error={errors.firstName?.message} inputProps={register("firstName")} />
        <TextField label="Middle name (optional)" error={errors.middleName?.message} inputProps={register("middleName")} />
        <TextField label="Last name" error={errors.lastName?.message} inputProps={register("lastName")} />
        <TextField label="Suffix (optional)" error={errors.suffix?.message} inputProps={register("suffix")} />
      </ApplicationFieldGroup>

      <ApplicationFieldGroup icon={Mail} title="Contact information">
        <TextField label="Email" required type="email" error={errors.email?.message} inputProps={register("email")} />
        <TextField
          label="Contact number"
          prefix="+63"
          error={errors.contactNumber?.message}
          inputProps={register("contactNumber", {
            setValueAs: (value) => String(value ?? "").replace(/\D/g, "").replace(/^63/, "").replace(/^0/, "").slice(0, 10),
          })}
          inputMode="numeric"
          maxLength={10}
          placeholder="9171234567"
        />
      </ApplicationFieldGroup>

      <ApplicationFieldGroup icon={CalendarDays} title="Personal details">
        <StyledOptionSelect
          label="Civil status"
          value={watch("civilStatus") || ""}
          options={civilStatuses as readonly string[]}
          error={errors.civilStatus?.message}
          onChange={(value) => setValue("civilStatus", value as typeof civilStatuses[number], { shouldDirty: true, shouldValidate: true })}
        />
        <PlaceOfBirthField value={watch("placeOfBirth") || ""} error={errors.placeOfBirth?.message} suggestions={placeSuggestions} onChange={(value) => setValue("placeOfBirth", value, { shouldDirty: true, shouldValidate: true })} />
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
      </ApplicationFieldGroup>

      <ApplicationFieldGroup icon={BadgeCheck} title="Occupation">
        {showOtherOccupation ? (
          <div className="relative md:col-span-2">
            <TextField label="Occupation" error={errors.occupation?.message} inputProps={register("occupation")} placeholder="Type your occupation" className="[&_input]:pr-36" />
            <button type="button" onClick={() => { setShowOtherOccupation(false); setValue("occupation", "", { shouldDirty: true }); }} className="absolute right-4 top-[3.4rem] -translate-y-1/2 text-xs font-bold text-[#1F6B43] underline">Choose from list</button>
          </div>
        ) : (
          <OccupationSelect
            value={occupationOptions.includes(occupation as (typeof occupationOptions)[number]) ? occupation ?? "" : ""}
            error={errors.occupation?.message}
            onChange={(value) => {
              setShowOtherOccupation(value === "Other");
              setValue("occupation", value === "Other" ? "" : value, { shouldDirty: true, shouldValidate: true });
            }}
          />
        )}
      </ApplicationFieldGroup>
    </div>
  );
}

function FamilyStep({
  count,
  register,
  watch,
  setValue,
  errors,
  onAdd,
  onRemove,
}: {
  count: number;
  register: UseFormRegister<MembershipApplicationFormValues>;
  watch: UseFormWatch<MembershipApplicationFormValues>;
  setValue: UseFormSetValue<MembershipApplicationFormValues>;
  errors: FieldErrors<MembershipApplicationFormValues>;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const civilStatus = watch("civilStatus");

  return (
    <div className="grid gap-5">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3E8] text-[#1F6B43]">
          <Home className="size-6" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f4b62a]">
            Address & Family
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-normal text-[#123D2A]">
            Household and beneficiary details.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5D6D63]">
            This helps the cooperative identify the applicant and prepare records after approval.
          </p>
        </div>
      </div>

      <ApplicationFieldGroup icon={MapPin} title="Current address">
        <TextField label="Current address" error={errors.currentAddress?.message} inputProps={register("currentAddress")} className="md:col-span-2" />
        <TextField label="Barangay" error={errors.barangay?.message} inputProps={register("barangay")} />
        <TextField label="Municipality" error={errors.municipality?.message} inputProps={register("municipality")} />
        <TextField label="Province" error={errors.province?.message} inputProps={register("province")} />
      </ApplicationFieldGroup>

      <ApplicationFieldGroup icon={UsersRound} title="Family">
        <TextField label="Father name" error={errors.fatherName?.message} inputProps={register("fatherName")} />
        <TextField label="Mother name" error={errors.motherName?.message} inputProps={register("motherName")} />
        {civilStatus === "Married" ? (
          <TextField label="Spouse name" error={errors.spouseName?.message} inputProps={register("spouseName")} className="md:col-span-2" />
        ) : (
          <div className="rounded-2xl border border-[#DDE8D8] bg-white p-4 text-sm font-semibold leading-6 text-[#5D6D63] md:col-span-2">
            Spouse information appears when civil status is set to Married.
          </div>
        )}
      </ApplicationFieldGroup>

      <section className="rounded-[1.5rem] border border-[#DDE8D8] bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-[#123D2A]">Beneficiaries</h3>
            <p className="mt-1 text-sm text-[#5D6D63]">Add people connected to the applicant record.</p>
          </div>
        </div>
        <BeneficiaryFields
          count={count}
          register={register}
          watch={watch}
          setValue={setValue}
          errors={errors}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      </section>
    </div>
  );
}

function MembershipStep({
  register,
  watch,
  setValue,
  errors,
}: {
  register: UseFormRegister<MembershipApplicationFormValues>;
  watch: UseFormWatch<MembershipApplicationFormValues>;
  setValue: UseFormSetValue<MembershipApplicationFormValues>;
  errors: FieldErrors<MembershipApplicationFormValues>;
}) {
  const membershipType = watch("requestedMembershipType");

  return (
    <div className="grid gap-5">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3E8] text-[#1F6B43]">
          <WalletCards className="size-6" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f4b62a]">
            Membership
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-normal text-[#123D2A]">
            Choose a path and confirm the commitments.
          </h2>
        </div>
      </div>

      <section className="overflow-hidden rounded-[1.5rem] border border-[#DDE8D8] bg-white">
        <div className="grid gap-5 bg-[#F8F1E5] p-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#D8A011]">
              {membershipType} Membership
            </p>
            <h3 className="mt-2 text-2xl font-black text-[#123D2A]">Required Share Capital: PHP 3,000</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5D6D63]">
              You do not pay now. Your application must first be reviewed and accepted by NFFAC.
            </p>
          </div>
          <div className="rounded-2xl border border-[#DDE8D8] bg-white p-4 text-sm font-bold text-[#365F4A]">
            Membership Fee
            <span className="mt-1 block text-2xl font-black text-[#123D2A]">PHP 200</span>
          </div>
        </div>
        <div className="p-5">
          <SelectField label="Requested membership type" error={errors.requestedMembershipType?.message} inputProps={register("requestedMembershipType")}>
            {requestedMembershipTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </SelectField>
        </div>
      </section>

      <CommitmentReview setValue={setValue} watch={watch} errors={errors} />
    </div>
  );
}

function DocumentsSignatureStep({
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
      <section className="rounded-[1.5rem] border border-[#DDE8D8] bg-[#F8F1E5] p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3E8] text-[#1F6B43]">
            <FileUp className="size-6" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f4b62a]">
              Documents & Signature
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-normal text-[#123D2A]">
              Upload documents and prepare your signature.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5D6D63]">
              The signature becomes part of the submitted application.
            </p>
          </div>
        </div>
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

function FinalReviewStep({
  register,
  watch,
  errors,
  uploads,
  signatureFile,
  onEditStep,
}: {
  register: UseFormRegister<MembershipApplicationFormValues>;
  watch: UseFormWatch<MembershipApplicationFormValues>;
  errors: FieldErrors<MembershipApplicationFormValues>;
  uploads: DocumentUploadDraft[];
  signatureFile: File | null;
  onEditStep: (step: number) => void;
}) {
  const values = watch();
  const fullName = [values.firstName, values.middleName, values.lastName, values.suffix]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  const beneficiaries = values.beneficiaries.filter((item) => item.fullName?.trim());

  return (
    <div className="grid gap-5">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3E8] text-[#1F6B43]">
          <ClipboardCheck className="size-6" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f4b62a]">
            Review & Submit
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-normal text-[#123D2A]">
            Confirm the application before sending.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5D6D63]">
            This is a review dashboard, not another form. Use Edit to jump back to a section.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewDashboardCard title="Applicant" onEdit={() => onEditStep(0)}>
          <strong className="text-lg text-[#123D2A]">{fullName || "Applicant name missing"}</strong>
          <span>{values.email || "Email missing"}</span>
          <span>{values.contactNumber ? `+63 ${values.contactNumber}` : "Contact number missing"}</span>
          <span>{values.dateOfBirth || "Date of birth missing"}</span>
        </ReviewDashboardCard>

        <ReviewDashboardCard title="Address" onEdit={() => onEditStep(1)}>
          <strong className="text-[#123D2A]">{values.currentAddress || "Address missing"}</strong>
          <span>{[values.barangay, values.municipality, values.province].filter(Boolean).join(", ") || "Location missing"}</span>
          <span>Parents: {[values.fatherName, values.motherName].filter(Boolean).join(" / ") || "Missing"}</span>
        </ReviewDashboardCard>

        <ReviewDashboardCard title="Family / Beneficiaries" onEdit={() => onEditStep(1)}>
          {beneficiaries.length ? (
            beneficiaries.slice(0, 3).map((beneficiary, index) => (
              <span key={`${beneficiary.fullName}-${index}`}>
                {beneficiary.fullName} - {beneficiary.relationship || "Beneficiary"}
              </span>
            ))
          ) : (
            <span>No beneficiaries listed.</span>
          )}
        </ReviewDashboardCard>

        <ReviewDashboardCard title="Membership" onEdit={() => onEditStep(2)}>
          <strong className="text-[#123D2A]">{values.requestedMembershipType}</strong>
          <span>Share Capital Requirement: PHP 3,000</span>
          <span>Payment: Not required until application review</span>
        </ReviewDashboardCard>

        <ReviewDashboardCard title="Documents" onEdit={() => onEditStep(3)}>
          <span className="inline-flex items-center gap-2 font-black text-[#1F6B43]">
            <CheckCircle2 className="size-4" />
            {uploads.filter((upload) => upload.file).length} upload(s) selected
          </span>
          <span className={signatureFile ? "font-black text-[#1F6B43]" : "font-black text-[#8A6200]"}>
            {signatureFile ? "Signature ready" : "Signature needed"}
          </span>
        </ReviewDashboardCard>

        <section className="rounded-[1.5rem] border border-[#DDE8D8] bg-[#F8F1E5] p-5">
          <h3 className="text-lg font-black text-[#123D2A]">Ready to submit?</h3>
          <p className="mt-2 text-sm leading-6 text-[#5D6D63]">
            NFFAC will review the application and email you if payment becomes available.
          </p>
          <label className="mt-5 flex gap-3 rounded-2xl border border-[#DDE8D8] bg-white p-4 text-sm font-semibold leading-6 text-[#123D2A]">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[#1F6B43]"
              {...register("finalConfirmation")}
            />
            <span>
              I confirm that the information in this application is true and ready for cooperative review.
              {errors.finalConfirmation ? (
                <span className="mt-1 block text-xs text-red-700">
                  {errors.finalConfirmation.message}
                </span>
              ) : null}
            </span>
          </label>
        </section>
      </div>
    </div>
  );
}

function ReviewDashboardCard({
  title,
  children,
  onEdit,
}: {
  title: string;
  children: ReactNode;
  onEdit: () => void;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#DDE8D8] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[#123D2A]">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border border-[#DDE8D8] px-3 py-1 text-xs font-black text-[#1F6B43] transition hover:bg-[#EAF3E8]"
        >
          Edit
        </button>
      </div>
      <div className="mt-4 grid gap-2 text-sm leading-6 text-[#365F4A]">{children}</div>
    </section>
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
  required = false,
  prefix,
  inputMode,
  maxLength,
  placeholder,
  suggestions,
  error,
  inputProps,
  type = "text",
  className = "",
}: {
  label: string;
  required?: boolean;
  prefix?: string;
  inputMode?: "numeric" | "text" | "email" | "tel";
  maxLength?: number;
  placeholder?: string;
  suggestions?: string[];
  error?: string;
  inputProps: UseFormRegisterReturn;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-semibold text-[#365F4A] ${className}`}>
      {label}{required ? <span className="text-red-700"> *</span> : null}
      <span className="mt-2 flex h-12 overflow-hidden rounded-2xl border border-[#DDE8D8] bg-white transition focus-within:border-[#1F6B43] focus-within:ring-2 focus-within:ring-[#1F6B43]/20">
        {prefix ? <span className="inline-flex items-center border-r border-[#DDE8D8] bg-[#F8F1E5] px-3 text-sm font-bold text-[#365F4A]">{prefix}</span> : null}
        <input
          type={type}
          inputMode={inputMode}
          maxLength={maxLength}
          placeholder={placeholder}
          list={suggestions?.length ? `${label.toLowerCase().replace(/\s+/g, "-")}-suggestions` : undefined}
          className="min-w-0 flex-1 bg-transparent px-4 text-base text-[#123D2A] outline-none"
          aria-invalid={Boolean(error)}
          {...inputProps}
        />
      </span>
      {suggestions?.length ? (
        <datalist id={`${label.toLowerCase().replace(/\s+/g, "-")}-suggestions`}>
          {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
        </datalist>
      ) : null}
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}

function OccupationSelect({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const options = [...occupationOptions, "Other"];
  return (
    <label className="block text-sm font-semibold text-[#365F4A]">
      Occupation
      <Select.Root value={value || undefined} onValueChange={onChange}>
        <Select.Trigger aria-label="Occupation" aria-invalid={Boolean(error)} className="mt-2 flex h-12 w-full items-center justify-between rounded-2xl border border-[#DDE8D8] bg-white px-4 text-left text-base text-[#123D2A] outline-none transition hover:border-[#9FB7A4] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20 data-[placeholder]:text-[#6C7A70]">
          <Select.Value placeholder="Select occupation" />
          <Select.Icon><ChevronDown className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content position="popper" sideOffset={6} className="z-[100] max-h-64 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-xl border border-[#CAD8CB] bg-white p-1.5 shadow-[0_18px_40px_rgba(18,61,42,0.16)]">
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item key={option} value={option} className="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]">
                  <Select.ItemText>{option}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-3"><SelectCheck className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}

function PlaceOfBirthField({
  label = "Place of birth",
  value,
  error,
  suggestions,
  placeholder = "Search barangay or municipality",
  onChange,
}: {
  label?: string;
  value: string;
  error?: string;
  suggestions: string[];
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const searchTerm = value.trim().toLowerCase();
  const exactMatches = searchTerm.length >= 2
    ? suggestions.filter((item) => item.split(",").some((part) => part.trim().toLowerCase() === searchTerm))
    : [];
  const matches = searchTerm.length < 2
    ? []
    : exactMatches.length > 0
      ? exactMatches.slice(0, 50)
      : suggestions.filter((item) => item.toLowerCase().includes(searchTerm)).slice(0, 8);
  return (
    <label className="relative block text-sm font-semibold text-[#365F4A]">
      {label}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="place-of-birth-suggestions"
        aria-expanded={open && matches.length > 0}
        aria-invalid={Boolean(error)}
        className="mt-2 h-12 w-full rounded-2xl border border-[#DDE8D8] bg-white px-4 text-base text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
      />
      {open && matches.length > 0 ? (
        <div id="place-of-birth-suggestions" role="listbox" className="absolute inset-x-0 top-[4.5rem] z-50 max-h-64 overflow-y-auto rounded-xl border border-[#CAD8CB] bg-white p-1.5 shadow-[0_18px_40px_rgba(18,61,42,0.16)]">
          {matches.map((suggestion) => (
            <button key={suggestion} type="button" role="option" aria-selected={suggestion === value} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(suggestion); setOpen(false); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#365F4A] hover:bg-[#EAF3E8] hover:text-[#123D2A]">
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}

function StyledOptionSelect({
  label,
  value,
  options,
  error,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-[#365F4A]">
      {label}
      <Select.Root value={value || undefined} onValueChange={onChange}>
        <Select.Trigger aria-label={label} aria-invalid={Boolean(error)} className="mt-2 flex h-12 w-full items-center justify-between rounded-2xl border border-[#DDE8D8] bg-white px-4 text-left text-base text-[#123D2A] outline-none transition hover:border-[#9FB7A4] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20 data-[placeholder]:text-[#6C7A70]">
          <Select.Value placeholder={`Select ${label.toLowerCase()}`} />
          <Select.Icon><ChevronDown className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content position="popper" sideOffset={6} className="z-[100] max-h-64 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-xl border border-[#CAD8CB] bg-white p-1.5 shadow-[0_18px_40px_rgba(18,61,42,0.16)]">
            <Select.Viewport>
              {options.map((option) => <Select.Item key={option} value={option} className="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]"><Select.ItemText>{option}</Select.ItemText><Select.ItemIndicator className="absolute right-3"><SelectCheck className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator></Select.Item>)}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  error,
  inputProps,
  children,
  value,
  onChange,
}: {
  label: string;
  error?: string;
  inputProps: UseFormRegisterReturn;
  children: ReactNode;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-[#365F4A]">
      {label}
      <select
        className="mt-2 h-12 w-full rounded-2xl border border-[#DDE8D8] bg-white px-4 text-base text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
        aria-invalid={Boolean(error)}
        {...inputProps}
        value={value}
        onChange={onChange ?? inputProps.onChange}
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
