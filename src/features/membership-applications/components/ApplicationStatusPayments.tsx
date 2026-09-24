"use client";

import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Loader2,
  LockKeyhole,
  Search,
  UploadCloud,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type ChangeEvent, type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { ApiClientError } from "@/lib/api-client";
import {
  createMembershipApplicationPaymongoCheckout,
  getMembershipApplicationStatus,
  uploadMembershipApplicationDocument,
} from "../membership-application-api";
import type { MembershipDocumentType } from "../membership-application-types";
import type {
  PublicMembershipPaymentState,
  PublicMembershipPaymentStatus,
} from "../public-payment-types";

const followUpDocumentTypes: MembershipDocumentType[] = [
  "Signed Application",
  "Valid ID",
  "Proof of Residency",
  "Membership Fee Proof",
  "Share Capital Proof",
  "Other",
];

type ApplicationStatusDetailTab = "overview" | "requirements" | "activity";

function peso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);
}

function suggestedCapitalAmount(status: PublicMembershipPaymentStatus) {
  if (
    status.latestCheckout?.paymentPurpose === "Share Capital"
    && status.latestCheckout.amount > 0
    && status.shareCapital.pendingAmount > 0
  ) {
    return status.latestCheckout.amount;
  }
  const minimum = status.shareCapital.minimumNextAmount;
  const targetGap = status.shareCapital.remainingToTarget;
  const maximumGap = status.shareCapital.remainingToMaximum;
  const preferred = targetGap > 0 ? Math.max(minimum, targetGap) : minimum;
  return Math.min(preferred, maximumGap);
}

function todayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function friendlyDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function statusTone(status: string) {
  if (status === "Approved") {
    return "border-[#BBD9C0] bg-[#DDF5E2] text-[#0F6B3D]";
  }
  if (status === "Rejected" || status === "Withdrawn") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "Submitted") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-[#FFE1A6] bg-[#FFF3C9] text-[#946400]";
}

export function ApplicationStatusPayments() {
  const searchParams = useSearchParams();
  const [applicationCode, setApplicationCode] = useState(
    searchParams.get("code") ?? "",
  );
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [status, setStatus] = useState<PublicMembershipPaymentStatus | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [checkoutAction, setCheckoutAction] = useState<
    "Associate Membership Fee" | "Share Capital" | null
  >(null);
  const [shareCapitalAmount, setShareCapitalAmount] = useState("1500");
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUpSuccess, setFollowUpSuccess] = useState<string | null>(null);
  const [uploadingFollowUpDocumentType, setUploadingFollowUpDocumentType] =
    useState<MembershipDocumentType | null>(null);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = applicationCode.trim();
    const birthDate = dateOfBirth.trim();
    if (!code || !birthDate) {
      setLookupError("Enter the application code and applicant date of birth.");
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setCheckoutError(null);
    try {
      const result = await getMembershipApplicationStatus({
        applicationCode: code,
        dateOfBirth: birthDate,
      }) as PublicMembershipPaymentStatus;
      setStatus(result);
      setFollowUpError(null);
      setFollowUpSuccess(null);
      const suggested = suggestedCapitalAmount(result);
      if (suggested > 0) setShareCapitalAmount(String(suggested));
    } catch (error) {
      setStatus(null);
      setLookupError(
        error instanceof ApiClientError
          ? error.message
          : "Unable to load the application status. Please try again.",
      );
    } finally {
      setIsLookingUp(false);
    }
  }

  async function uploadFollowUpDocuments(
    documentType: MembershipDocumentType,
    files: File[],
  ) {
    if (!status || uploadingFollowUpDocumentType) return;
    if (!files.length) {
      setFollowUpError("Select at least one requested PDF, JPG, or PNG file.");
      return;
    }

    setUploadingFollowUpDocumentType(documentType);
    setFollowUpError(null);
    setFollowUpSuccess(null);
    try {
      for (const file of files) {
        await uploadMembershipApplicationDocument({
          applicationCode: status.applicationCode,
          dateOfBirth: dateOfBirth.trim(),
          documentType,
          file,
        });
      }
      const refreshed = await getMembershipApplicationStatus({
        applicationCode: status.applicationCode,
        dateOfBirth: dateOfBirth.trim(),
      }) as PublicMembershipPaymentStatus;
      setStatus(refreshed);
      setFollowUpSuccess(
        `${documentType} uploaded. The Chairman can now review the new file.`,
      );
    } catch (error) {
      setFollowUpError(
        error instanceof ApiClientError
          ? error.message
          : "Unable to upload the requested document. Please try again.",
      );
    } finally {
      setUploadingFollowUpDocumentType(null);
    }
  }

  async function startCheckout(
    paymentPurpose: "Associate Membership Fee" | "Share Capital",
  ) {
    if (!status || checkoutAction) return;
    const amount = Number(shareCapitalAmount);
    if (
      paymentPurpose === "Share Capital"
      && (!Number.isFinite(amount)
        || amount < status.shareCapital.minimumNextAmount
        || amount > status.shareCapital.remainingToMaximum)
    ) {
      setCheckoutError(
        `Enter an amount from ${peso(status.shareCapital.minimumNextAmount)} to ${peso(status.shareCapital.remainingToMaximum)}.`,
      );
      return;
    }

    setCheckoutAction(paymentPurpose);
    setCheckoutError(null);
    try {
      const checkout = await createMembershipApplicationPaymongoCheckout({
        applicationCode: status.applicationCode,
        dateOfBirth: dateOfBirth.trim(),
        paymentPurpose,
        requestedAmount: paymentPurpose === "Share Capital" ? amount : undefined,
      });
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      setCheckoutError(
        error instanceof ApiClientError
          ? error.message
          : "Unable to start PayMongo checkout. Please try again.",
      );
      setCheckoutAction(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
      <LookupCard
        applicationCode={applicationCode}
        dateOfBirth={dateOfBirth}
        isLookingUp={isLookingUp}
        lookupError={lookupError}
        onApplicationCodeChange={setApplicationCode}
        onDateOfBirthChange={setDateOfBirth}
        onSubmit={lookup}
      />

      {status ? (
        <StatusDashboard
          status={status}
          checkoutAction={checkoutAction}
          checkoutError={checkoutError}
          followUpError={followUpError}
          followUpSuccess={followUpSuccess}
          uploadingFollowUpDocumentType={uploadingFollowUpDocumentType}
          shareCapitalAmount={shareCapitalAmount}
          onShareCapitalAmountChange={setShareCapitalAmount}
          onStartCheckout={startCheckout}
          onUploadFollowUpDocuments={uploadFollowUpDocuments}
        />
      ) : (
        <EmptyDashboard />
      )}
    </div>
  );
}

function LookupCard({
  applicationCode,
  dateOfBirth,
  isLookingUp,
  lookupError,
  onApplicationCodeChange,
  onDateOfBirthChange,
  onSubmit,
}: {
  applicationCode: string;
  dateOfBirth: string;
  isLookingUp: boolean;
  lookupError: string | null;
  onApplicationCodeChange: (value: string) => void;
  onDateOfBirthChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="h-fit rounded-[18px] border border-[#DDE8D8] bg-white/95 p-5 shadow-[0_18px_42px_rgba(18,61,42,0.10)]"
    >
      <p className="text-[0.62rem] font-black uppercase tracking-[0.34em] text-[#f4b62a]">
        Secure lookup
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-normal text-[#123D2A]">
        Track your application
      </h2>
      <p className="mt-3 text-xs leading-5 text-[#4F6F5D]">
        Enter your application code and the date of birth used in your membership
        application.
      </p>

      <label className="mt-5 block text-[0.68rem] font-black text-[#365F4A]">
        Application code
        <span className="relative mt-2 block">
          <input
            value={applicationCode}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onApplicationCodeChange(event.target.value)
            }
            className="h-10 w-full rounded-xl border border-[#DDE8D8] bg-white py-2 pl-3 pr-9 text-xs font-black text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
            autoComplete="off"
          />
          {applicationCode.trim() ? (
            <Check className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#2E9C5B]" />
          ) : null}
        </span>
      </label>

      <DatePicker
        label="Applicant date of birth"
        value={dateOfBirth}
        onChange={onDateOfBirthChange}
        min="1900-01-01"
        max={todayDateKey()}
        placeholder="Select birth date"
        className="mt-4 text-xs [&>button]:h-10 [&>button]:rounded-xl [&>button]:text-xs"
      />

      {lookupError ? <ErrorNotice message={lookupError} /> : null}

      <Button
        type="submit"
        disabled={isLookingUp}
        className="mt-5 h-11 w-full rounded-full bg-[#123D2A] text-xs font-black text-white shadow-[0_12px_28px_rgba(18,61,42,0.24)] hover:bg-[#1F6B43]"
      >
        {isLookingUp ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Search className="size-4" />
        )}
        {isLookingUp ? "Checking..." : "Check Status"}
      </Button>

      <div className="mt-6 flex gap-3 border-t border-[#EEF2EC] pt-4 text-[0.68rem] leading-5 text-[#5D6D63]">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
          <LockKeyhole className="size-4" />
        </span>
        <p>We protect your privacy. Your information is only used to retrieve your application status.</p>
      </div>
    </form>
  );
}

function StatusDashboard({
  status,
  checkoutAction,
  checkoutError,
  followUpError,
  followUpSuccess,
  uploadingFollowUpDocumentType,
  shareCapitalAmount,
  onShareCapitalAmountChange,
  onStartCheckout,
  onUploadFollowUpDocuments,
}: {
  status: PublicMembershipPaymentStatus;
  checkoutAction: "Associate Membership Fee" | "Share Capital" | null;
  checkoutError: string | null;
  followUpError: string | null;
  followUpSuccess: string | null;
  uploadingFollowUpDocumentType: MembershipDocumentType | null;
  shareCapitalAmount: string;
  onShareCapitalAmountChange: (value: string) => void;
  onStartCheckout: (
    paymentPurpose: "Associate Membership Fee" | "Share Capital",
  ) => Promise<void>;
  onUploadFollowUpDocuments: (
    documentType: MembershipDocumentType,
    files: File[],
  ) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<ApplicationStatusDetailTab>("overview");

  return (
    <section className="grid gap-4">
      <ApplicationProgressCard status={status} />

      <ApplicationDetailsTabs
        activeTab={activeTab}
        status={status}
        checkoutAction={checkoutAction}
        followUpError={followUpError}
        followUpSuccess={followUpSuccess}
        uploadingFollowUpDocumentType={uploadingFollowUpDocumentType}
        shareCapitalAmount={shareCapitalAmount}
        onActiveTabChange={setActiveTab}
        onShareCapitalAmountChange={onShareCapitalAmountChange}
        onStartCheckout={onStartCheckout}
        onUploadFollowUpDocuments={onUploadFollowUpDocuments}
      />

      {checkoutError ? <ErrorNotice message={checkoutError} /> : null}
    </section>
  );
}

function ApplicationDetailsTabs({
  activeTab,
  status,
  checkoutAction,
  followUpError,
  followUpSuccess,
  uploadingFollowUpDocumentType,
  shareCapitalAmount,
  onActiveTabChange,
  onShareCapitalAmountChange,
  onStartCheckout,
  onUploadFollowUpDocuments,
}: {
  activeTab: ApplicationStatusDetailTab;
  status: PublicMembershipPaymentStatus;
  checkoutAction: "Associate Membership Fee" | "Share Capital" | null;
  followUpError: string | null;
  followUpSuccess: string | null;
  uploadingFollowUpDocumentType: MembershipDocumentType | null;
  shareCapitalAmount: string;
  onActiveTabChange: (tab: ApplicationStatusDetailTab) => void;
  onShareCapitalAmountChange: (value: string) => void;
  onStartCheckout: (
    paymentPurpose: "Associate Membership Fee" | "Share Capital",
  ) => Promise<void>;
  onUploadFollowUpDocuments: (
    documentType: MembershipDocumentType,
    files: File[],
  ) => Promise<void>;
}) {
  const tabs: { key: ApplicationStatusDetailTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "requirements", label: "Requirements" },
    { key: "activity", label: "Activity Log" },
  ];

  return (
    <article className="rounded-[18px] border border-[#DDE8D8] bg-white p-4 shadow-[0_14px_32px_rgba(18,61,42,0.06)]">
      <div className="flex flex-col gap-3 border-b border-[#EEF2EC] pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#DDF5E2] text-[#1F6B43]">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-[#123D2A]">Application Details</h2>
            <p className="text-[0.68rem] font-bold text-[#5D6D63]">
              Review progress, requirements, and checkout activity.
            </p>
          </div>
        </div>
        <Badge
          icon={Clock3}
          label={status.applicationStatus}
          className={statusTone(status.applicationStatus)}
        />
      </div>

      <div className="mt-3 flex gap-1 border-b border-[#EEF2EC]">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onActiveTabChange(tab.key)}
              className={`border-b-2 px-3 pb-2 text-[0.68rem] font-black transition ${
                active
                  ? "border-[#123D2A] text-[#123D2A]"
                  : "border-transparent text-[#5D6D63] hover:text-[#123D2A]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {activeTab === "overview" ? (
          <div className="grid items-start gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <ApplicationInformationPanel status={status} />
            <ReviewActionCard
              status={status}
              checkoutAction={checkoutAction}
              onStartCheckout={onStartCheckout}
            />
            {status.requestedMembershipType === "True Member"
            && (status.shareCapital.canStartCheckout || status.shareCapital.pendingAmount > 0) ? (
              <div className="xl:col-span-2">
                <ShareCapitalActionCard
                  status={status}
                  checkoutAction={checkoutAction}
                  shareCapitalAmount={shareCapitalAmount}
                  onShareCapitalAmountChange={onShareCapitalAmountChange}
                  onStartCheckout={onStartCheckout}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "requirements" ? (
          <RequirementsActionCard
            status={status}
            followUpError={followUpError}
            followUpSuccess={followUpSuccess}
            uploadingFollowUpDocumentType={uploadingFollowUpDocumentType}
            onUploadFollowUpDocuments={onUploadFollowUpDocuments}
          />
        ) : null}

        {activeTab === "activity" ? <CheckoutActivityCard status={status} /> : null}
      </div>
    </article>
  );
}

function ApplicationInformationPanel({ status }: { status: PublicMembershipPaymentStatus }) {
  return (
    <section className="rounded-xl border border-[#DDE8D8] bg-[#F8FBF5] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserRound className="size-4 text-[#1F6B43]" />
          <h3 className="text-sm font-black text-[#123D2A]">Applicant Information</h3>
        </div>
      </div>
      <dl className="grid gap-0 overflow-hidden rounded-lg border border-[#DDE8D8] bg-white text-xs">
        <DetailRow label="Name" value={status.fullName} />
        <DetailRow label="Application Code" value={status.applicationCode} />
        <DetailRow label="Membership Type" value={status.requestedMembershipType} />
        <DetailRow label="Submitted" value={friendlyDate(status.submittedAt)} />
        <DetailRow label="Status" value={status.applicationStatus} />
        <DetailRow
          label="Payment Mode"
          value={
            status.paymongoMode === "test"
              ? "PayMongo Test Mode — No real money will be charged"
              : "PayMongo Live Mode"
          }
          last
        />
      </dl>
    </section>
  );
}

function DetailRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`grid gap-2 px-3 py-2 sm:grid-cols-[8rem_minmax(0,1fr)] ${
        last ? "" : "border-b border-[#EEF2EC]"
      }`}
    >
      <dt className="text-[0.62rem] font-black text-[#5D6D63]">{label}</dt>
      <dd className="min-w-0 break-words font-black text-[#123D2A]">{value}</dd>
    </div>
  );
}

function ApplicationProgressCard({ status }: { status: PublicMembershipPaymentStatus }) {
  const terminal = status.applicationStatus === "Rejected" || status.applicationStatus === "Withdrawn";
  const heading = status.applicationStatus === "Approved"
    ? "Approved"
    : terminal
      ? status.applicationStatus
      : "In Progress";

  return (
    <article className="rounded-[18px] border border-[#DDE8D8] bg-white px-4 py-3 shadow-[0_12px_30px_rgba(18,61,42,0.07)]">
      <div className="grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)] md:items-center">
        <div className="flex min-w-0 gap-3 md:border-r md:border-[#DDE8D8] md:pr-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#DDF5E2] text-[#1F6B43]">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black text-[#5D6D63]">Application Status</p>
            <h2 className="mt-0.5 text-base font-black leading-tight text-[#123D2A]">
              {heading}
            </h2>
          </div>
        </div>

        <StatusTimeline status={status.applicationStatus} submittedAt={status.submittedAt} />
      </div>
    </article>
  );
}

function StatusTimeline({
  status,
  submittedAt,
}: {
  status: string;
  submittedAt: string;
}) {
  const steps = [
    { key: "Submitted", label: "Submitted", date: friendlyDate(submittedAt) },
    { key: "Review", label: "Review", date: "Chairman review" },
    { key: "Approved", label: "Approved", date: "Pending" },
  ];
  const terminal = status === "Rejected" || status === "Withdrawn";
  const activeIndex = status === "Approved" ? 2 : status === "Submitted" ? 0 : 1;

  return (
    <div className="mt-2 md:mt-0">
      <div className="relative grid grid-cols-3 gap-2">
        <div className="absolute left-[16%] right-[16%] top-3.5 h-1 rounded-full bg-[#DDE8D8]" />
        <div
          className={`absolute left-[16%] top-3.5 h-1 rounded-full ${
            terminal ? "bg-red-300" : "bg-[#2E9C5B]"
          }`}
          style={{ width: `${activeIndex * 34}%` }}
        />
        {steps.map((step, index) => {
          const isActive = index === activeIndex && !terminal;
          const isDone = index < activeIndex || status === "Approved";
          return (
            <div key={step.key} className="relative z-10 grid justify-items-center gap-2 text-center">
              <span
                className={`grid size-7 place-items-center rounded-full text-[0.68rem] font-black shadow-sm ${
                  isDone
                    ? "bg-[#1F6B43] text-white"
                    : isActive
                      ? "bg-[#F4B62A] text-[#123D2A]"
                      : "bg-[#C9D2CE] text-white"
                }`}
              >
                {isDone ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className="text-[0.65rem] font-black leading-tight text-[#123D2A]">
                {step.label}
              </span>
              <span className="text-[0.58rem] font-bold leading-tight text-[#5D6D63]">
                {isActive
                  ? status === "Needs Information"
                    ? "Needs info"
                    : "Current"
                  : step.date}
              </span>
            </div>
          );
        })}
      </div>
      {terminal ? (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          This application is currently {status.toLowerCase()}.
        </p>
      ) : null}
    </div>
  );
}

function ReviewActionCard({
  status,
  checkoutAction,
  onStartCheckout,
}: {
  status: PublicMembershipPaymentStatus;
  checkoutAction: "Associate Membership Fee" | "Share Capital" | null;
  onStartCheckout: (
    paymentPurpose: "Associate Membership Fee" | "Share Capital",
  ) => Promise<void>;
}) {
  const paymentNeedsAction =
    status.membershipFee.canStartCheckout || status.membershipFee.pendingAmount > 0;

  return (
    <PanelCard icon={AlertCircle} title="What needs attention" compact className="h-fit">
      <p className="text-xs leading-6 text-[#365F4A]">
        {status.applicationStatus === "Needs Information"
          ? status.latestApplicantMessage
            ?? "The cooperative needs more information to continue reviewing your application."
          : status.applicationStatus === "Under Review"
            ? "Your application is being reviewed by the cooperative."
            : status.applicationStatus === "Approved"
              ? "Your application has been approved."
              : "Your application was submitted and is waiting for review."}
      </p>

      {paymentNeedsAction ? (
        <div className="mt-4 rounded-xl border border-[#DDE8D8] bg-[#F8FBF5] p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-[#123D2A]">
                Associate Membership Fee
              </p>
              <p className="mt-1 text-xs text-[#5D6D63]">
                Remaining:{" "}
                <span className="font-black text-[#123D2A]">
                  {peso(status.membershipFee.remainingAmount)}
                </span>
              </p>
            </div>
            <Button
              type="button"
              disabled={Boolean(checkoutAction)}
              onClick={() => void onStartCheckout("Associate Membership Fee")}
              className="h-10 rounded-full bg-[#123D2A] px-5 text-xs font-black text-white hover:bg-[#1F6B43]"
            >
              {checkoutAction === "Associate Membership Fee" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CreditCard className="size-4" />
              )}
              {status.membershipFee.pendingAmount > 0 ? "Continue checkout" : "Pay now"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <PaymentState state={status.membershipFee.status} label="Membership fee" />
        </div>
      )}
    </PanelCard>
  );
}

function RequirementsActionCard({
  status,
  followUpError,
  followUpSuccess,
  uploadingFollowUpDocumentType,
  onUploadFollowUpDocuments,
}: {
  status: PublicMembershipPaymentStatus;
  followUpError: string | null;
  followUpSuccess: string | null;
  uploadingFollowUpDocumentType: MembershipDocumentType | null;
  onUploadFollowUpDocuments: (
    documentType: MembershipDocumentType,
    files: File[],
  ) => Promise<void>;
}) {
  const requirements = status.missingOrRejectedRequirements;
  const documentRequirements = requirements.filter((requirement) =>
    isDocumentRequirement(requirement.requirementType),
  );
  const checklistRequirements = requirements.filter((requirement) =>
    !isDocumentRequirement(requirement.requirementType),
  );
  const canUploadMissingDocuments =
    documentRequirements.length > 0
    && ["Submitted", "Under Review", "Needs Information"].includes(status.applicationStatus);

  return (
    <PanelCard icon={FileText} title="Requirements">
      {requirements.length ? (
        <div className="grid gap-4">
          {documentRequirements.length ? (
            <RequirementGroup title="Uploadable documents">
              {documentRequirements.map((requirement) => (
                <RequirementItem
                  key={`${requirement.requirementType}-${requirement.requirementStatus}`}
                  icon={FileText}
                  requirementType={requirement.requirementType}
                  requirementStatus={requirement.requirementStatus}
                  action={
                    canUploadMissingDocuments
                    && isMembershipDocumentType(requirement.requirementType) ? (
                      <RequirementUploadButton
                        documentType={requirement.requirementType}
                        isUploading={
                          uploadingFollowUpDocumentType === requirement.requirementType
                        }
                        uploadDisabled={Boolean(uploadingFollowUpDocumentType)}
                        onUpload={onUploadFollowUpDocuments}
                      />
                    ) : null
                  }
                />
              ))}
            </RequirementGroup>
          ) : null}

          {checklistRequirements.length ? (
            <RequirementGroup title="Review checklist">
              {checklistRequirements.map((requirement) => (
                <RequirementItem
                  key={`${requirement.requirementType}-${requirement.requirementStatus}`}
                  icon={CheckCircle2}
                  requirementType={requirement.requirementType}
                  requirementStatus={requirement.requirementStatus}
                />
              ))}
            </RequirementGroup>
          ) : null}

          {followUpError ? <ErrorNotice message={followUpError} /> : null}
          {followUpSuccess ? (
            <div className="flex gap-3 rounded-xl border border-[#BBD9C0] bg-[#EAF3E8] p-3 text-xs text-[#1F6B43]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <p>{followUpSuccess}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs leading-5 text-[#365F4A]">
          No missing requirements are currently listed.
        </p>
      )}
    </PanelCard>
  );
}

function ShareCapitalActionCard({
  status,
  checkoutAction,
  shareCapitalAmount,
  onShareCapitalAmountChange,
  onStartCheckout,
}: {
  status: PublicMembershipPaymentStatus;
  checkoutAction: "Associate Membership Fee" | "Share Capital" | null;
  shareCapitalAmount: string;
  onShareCapitalAmountChange: (value: string) => void;
  onStartCheckout: (
    paymentPurpose: "Associate Membership Fee" | "Share Capital",
  ) => Promise<void>;
}) {
  const state = status.shareCapital.pendingAmount > 0
    ? "Pending"
    : status.shareCapital.validatedAmount >= status.shareCapital.targetAmount
      ? "Confirmed"
      : status.shareCapital.canStartCheckout
        ? "Required"
        : "Unavailable";

  return (
    <PanelCard icon={Wallet} title="Share capital">
      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <MiniMetric label="Validated" value={peso(status.shareCapital.validatedAmount)} />
        <MiniMetric label="Remaining to PHP 3,000" value={peso(status.shareCapital.remainingToTarget)} />
        <MiniMetric label="Remaining to PHP 15,000 max" value={peso(status.shareCapital.remainingToMaximum)} />
      </div>
      <p className="mt-3 text-[0.68rem] font-bold leading-5 text-[#5D6D63]">
        Internal IDs, webhook data, and tracking hashes stay hidden.
      </p>
      <PaymentState state={state} label="Share capital" />
      {status.shareCapital.canStartCheckout ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-[#5D6D63]">
            Amount
            <input
              type="number"
              min={status.shareCapital.minimumNextAmount}
              max={status.shareCapital.remainingToMaximum}
              step="0.01"
              value={shareCapitalAmount}
              disabled={status.shareCapital.pendingAmount > 0}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onShareCapitalAmountChange(event.target.value)
              }
              className="mt-1 h-10 w-full rounded-xl border border-[#DDE8D8] bg-white px-3 text-xs font-black text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20 disabled:bg-[#EEF2EC]"
            />
          </label>
          <Button
            type="button"
            disabled={Boolean(checkoutAction)}
            onClick={() => void onStartCheckout("Share Capital")}
            className="h-10 rounded-full bg-[#123D2A] px-5 text-xs font-black text-white hover:bg-[#1F6B43]"
          >
            {checkoutAction === "Share Capital" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wallet className="size-4" />
            )}
            {status.shareCapital.pendingAmount > 0
              ? "Continue Share Capital Installment"
              : "Start Share Capital Installment"}
          </Button>
        </div>
      ) : null}
    </PanelCard>
  );
}

function CheckoutActivityCard({ status }: { status: PublicMembershipPaymentStatus }) {
  return (
    <PanelCard icon={Clock3} title="Checkout activity">
      <div className="max-h-36 overflow-y-auto pr-2">
        <article className="rounded-xl border border-[#DDE8D8] bg-[#F8FBF5] p-3 text-xs leading-5 text-[#365F4A]">
          <p className="font-black text-[#123D2A]">
            {status.latestCheckout?.paymentPurpose} - {status.latestCheckout?.gatewayStatus}
          </p>
          <p className="mt-1 break-words">
            {status.latestCheckout?.referenceNumber}
          </p>
          <p className="mt-1">
            {status.latestCheckout
              ? `${peso(status.latestCheckout.amount)} recorded through PayMongo.`
              : "No checkout activity yet."}
          </p>
          {status.latestCheckout ? (
            <p className="mt-1">
              {status.latestCheckout.isReusable
                ? "This checkout can still be continued."
                : "This checkout is no longer active."}
            </p>
          ) : null}
        </article>
      </div>
    </PanelCard>
  );
}

function RequirementGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#5D6D63]">
        {title}
      </p>
      <ul className="grid gap-2">{children}</ul>
    </div>
  );
}

function RequirementItem({
  icon: Icon,
  requirementType,
  requirementStatus,
  action = null,
}: {
  icon: LucideIcon;
  requirementType: string;
  requirementStatus: string;
  action?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-[#EEF2EC] bg-white px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
      <span className="flex min-w-0 items-center gap-2 font-bold text-[#365F4A]">
        <Icon className="size-3.5 shrink-0 text-[#5D6D63]" />
        <span className="truncate">{requirementType}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <span className="rounded-full bg-[#FFF3C9] px-2 py-1 text-[0.6rem] font-black text-[#946400]">
          {requirementStatus}
        </span>
        {action}
      </span>
    </li>
  );
}

function RequirementUploadButton({
  documentType,
  isUploading,
  uploadDisabled,
  onUpload,
}: {
  documentType: MembershipDocumentType;
  isUploading: boolean;
  uploadDisabled: boolean;
  onUpload: (documentType: MembershipDocumentType, files: File[]) => Promise<void>;
}) {
  return (
    <label
      className={`inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-full px-3 text-[0.65rem] font-black text-white transition ${
        uploadDisabled
          ? "cursor-not-allowed bg-[#91A69A]"
          : "cursor-pointer bg-[#123D2A] shadow-[0_10px_22px_rgba(18,61,42,0.16)] hover:bg-[#1F6B43]"
      }`}
    >
      {isUploading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <UploadCloud className="size-3.5" />
      )}
      {isUploading ? "Uploading" : "Upload"}
      <input
        className="sr-only"
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.pdf"
        disabled={uploadDisabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) void onUpload(documentType, files);
        }}
      />
    </label>
  );
}

function PanelCard({
  icon: Icon,
  title,
  children,
  compact = false,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <article
      className={`rounded-[18px] border border-[#DDE8D8] bg-white ${
        compact ? "p-3" : "p-4"
      } shadow-[0_14px_32px_rgba(18,61,42,0.06)] ${className}`}
    >
      <div className={`${compact ? "mb-2" : "mb-3"} flex items-center gap-3`}>
        <div
          className={`grid shrink-0 place-items-center rounded-full bg-[#DDF5E2] text-[#1F6B43] ${
            compact ? "size-9" : "size-10"
          }`}
        >
          <Icon className={compact ? "size-4" : "size-5"} />
        </div>
        <p className="text-[0.65rem] font-black uppercase tracking-[0.28em] text-[#f4b62a]">
          {title}
        </p>
      </div>
      {children}
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#EEF2EC] bg-[#F8FBF5] p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-[#5D6D63]">
        {label}
      </p>
      <p className="mt-1 font-black text-[#123D2A]">{value}</p>
    </div>
  );
}

function PaymentState({
  state,
  label,
}: {
  state: PublicMembershipPaymentState | string;
  label: string;
}) {
  const confirmed = state === "Confirmed";
  return (
    <div className="mt-3 border-t border-[#EEF2EC] pt-3">
      <span
        className={`inline-flex min-w-28 items-center justify-center gap-1.5 rounded-full px-3 py-1 text-[0.65rem] font-black ${
          confirmed
            ? "bg-[#DDF5E2] text-[#1F6B43]"
            : state === "Pending"
              ? "bg-[#FFF3C9] text-[#946400]"
              : "bg-[#EEF2EC] text-[#365F4A]"
        }`}
      >
        {confirmed ? <CheckCircle2 className="size-3.5" /> : <Clock3 className="size-3.5" />}
        {label}: {state}
      </span>
    </div>
  );
}

function Badge({
  icon: Icon,
  label,
  className,
}: {
  icon: LucideIcon;
  label: string;
  className: string;
}) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.68rem] font-black ${className}`}>
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

function EmptyDashboard() {
  return (
    <section className="rounded-[18px] border border-[#DDE8D8] bg-white/80 p-6 shadow-[0_18px_42px_rgba(18,61,42,0.08)]">
      <div className="grid min-h-[28rem] place-items-center text-center">
        <div className="max-w-md">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
            <CalendarDays className="size-7" />
          </div>
          <h2 className="mt-4 text-2xl font-black text-[#123D2A]">
            Secure application status
          </h2>
          <p className="mt-2 text-sm leading-7 text-[#365F4A]">
            Enter your application details to view review progress, safe applicant
            messages, payment summaries, and requested follow-up documents.
          </p>
        </div>
      </div>
    </section>
  );
}

function isDocumentRequirement(requirementType: string) {
  return [
    "Scanned Paper Application",
    "Signed Application",
    "Valid ID",
    "Proof of Residency",
    "Membership Fee Proof",
    "Share Capital Proof",
  ].includes(requirementType);
}

function isMembershipDocumentType(value: string): value is MembershipDocumentType {
  return followUpDocumentTypes.includes(value as MembershipDocumentType)
    || value === "Scanned Paper Application";
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="mt-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
