"use client";

import { ArrowLeft, BadgeCheck, CircleAlert, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  ErrorState,
  LoadingSkeleton,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { env } from "@/config/env";
import { ApiClientError } from "@/lib/api-client";
import {
  createMembershipAccount,
  getMembershipApplication,
  reviewMembershipApplication,
  type MembershipApplication,
} from "./membership-api";

type Detail = MembershipApplication & {
  documents: Array<{
    id: string;
    documentType: string;
    originalFileName: string;
    verificationStatus: string;
    uploadedAt: string;
  }>;
  history: Array<{
    oldStatus: string | null;
    newStatus: string;
    publicMessage: string | null;
    internalReason: string | null;
    changedAt: string;
  }>;
  notes: Array<{
    noteType: string;
    noteText: string;
    createdAt: string;
  }>;
};

type ActionName =
  | "START_REVIEW"
  | "REQUEST_INFORMATION"
  | "PLACE_ON_HOLD"
  | "APPROVE"
  | "REJECT"
  | "CREATE_ACCOUNT";

function tone(status: string) {
  if (["APPROVED", "ACCOUNT_CREATED"].includes(status)) return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

export function MembershipApplicationDetail() {
  const params = useParams<{ applicationId: string }>();
  const [application, setApplication] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<ActionName | null>(null);
  const [publicMessage, setPublicMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [membershipType, setMembershipType] = useState<
    "ASSOCIATE" | "TRUE_MEMBER"
  >("ASSOCIATE");
  const [activationLink, setActivationLink] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setApplication(
        (await getMembershipApplication(params.applicationId)) as Detail,
      );
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Application could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [params.applicationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function runAction() {
    if (!application || !action || pending) return;
    const consequences: Record<ActionName, string> = {
      START_REVIEW: "assign you as reviewer and begin formal review",
      REQUEST_INFORMATION: "pause review until the applicant responds",
      PLACE_ON_HOLD: "place this application on hold",
      APPROVE: "approve the classification and create a payment requirement",
      REJECT: "reject the application and prevent account creation",
      CREATE_ACCOUNT: "create a pending Member account and one-time activation",
    };
    if (
      !window.confirm(
        `Confirm: ${consequences[action]} for ${application.fullName}?`,
      )
    )
      return;
    setPending(true);
    setError("");
    try {
      if (action === "CREATE_ACCOUNT") {
        const result = await createMembershipAccount(
          application.id,
          internalNote,
        );
        setActivationLink(
          `${window.location.origin}/membership/activate/${encodeURIComponent(result.activationToken)}`,
        );
      } else {
        const payload: Record<string, unknown> = {
          action,
          publicMessage,
          internalNote,
        };
        if (action === "APPROVE")
          payload.approvedMembershipType = membershipType;
        if (action === "REJECT")
          payload.rejectionCategory = "Eligibility or requirements";
        await reviewMembershipApplication(application.id, payload);
      }
      setAction(null);
      setPublicMessage("");
      setInternalNote("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "The action could not be completed.",
      );
    } finally {
      setPending(false);
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (error && !application) return <ErrorState message={error} />;
  if (!application) return null;

  const canStart = ["SUBMITTED", "NEEDS_INFORMATION", "ON_HOLD"].includes(
    application.status,
  );
  const canReview = application.status === "UNDER_REVIEW";
  const canCreateAccount =
    application.status === "APPROVED" &&
    application.paymentStatus === "VERIFIED";

  return (
    <div className="grid gap-6">
      <Link
        href="/portal/chairman/members/applications"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-bold text-[#365F4A]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Membership Applications
      </Link>
      <PageHeader
        eyebrow={application.reference}
        title={application.fullName}
        description={`Submitted ${new Date(application.submittedAt).toLocaleString()}`}
        actions={
          <StatusBadge tone={tone(application.status)}>
            {application.status.replaceAll("_", " ")}
          </StatusBadge>
        }
      />
      {error ? <ErrorState message={error} /> : null}
      {application.possibleDuplicate ? (
        <div className="flex gap-3 rounded-lg border border-[#E7B8A8] bg-[#FFF4EC] p-4 text-sm text-[#7A3023]">
          <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
          Possible duplicate detected from contact, email, or an existing
          record. Review before approval or account creation; an override reason
          is required.
        </div>
      ) : null}
      {activationLink ? (
        <div className="rounded-lg border border-[#9FD0AA] bg-[#E3F7E7] p-4 text-sm text-[#174F31]">
          <p className="font-bold">One-time activation link created</p>
          <p className="mt-1 break-all">{activationLink}</p>
          <p className="mt-2">
            Deliver this link through an approved private channel. It expires in
            72 hours and is not stored in plaintext.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canStart ? (
          <button
            onClick={() => setAction("START_REVIEW")}
            className="min-h-11 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white"
          >
            Start / Resume Review
          </button>
        ) : null}
        {canReview ? (
          <>
            <button
              onClick={() => setAction("REQUEST_INFORMATION")}
              className="min-h-11 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A]"
            >
              Request Information
            </button>
            <button
              onClick={() => setAction("PLACE_ON_HOLD")}
              className="min-h-11 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A]"
            >
              Place On Hold
            </button>
            <button
              onClick={() => setAction("APPROVE")}
              className="min-h-11 rounded-md bg-[#1F6B43] px-4 text-sm font-bold text-white"
            >
              Approve
            </button>
            <button
              onClick={() => setAction("REJECT")}
              className="min-h-11 rounded-md bg-[#9A392A] px-4 text-sm font-bold text-white"
            >
              Reject
            </button>
          </>
        ) : null}
        {canCreateAccount ? (
          <button
            onClick={() => setAction("CREATE_ACCOUNT")}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white"
          >
            <UserPlus className="size-4" aria-hidden="true" />
            Create Member Account
          </button>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-[#CAD8CB] bg-white p-5">
          <h2 className="text-lg font-black text-[#123D2A]">
            Applicant information
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              ["Full name", application.fullName],
              ["Contact", application.contactNumber],
              ["Email", application.email],
              ["Address", application.completeAddress],
              ["Barangay", application.barangay],
              ["Municipality", application.municipality],
              ["Province", application.province],
              ["Preferred contact", application.preferredContactMethod],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#6C7A70]">
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#294B39]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rounded-lg border border-[#CAD8CB] bg-white p-5">
          <h2 className="text-lg font-black text-[#123D2A]">
            Cooperative profile
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              ["Sector", application.sector],
              ["Livelihood", application.livelihood],
              ["Primary activity", application.primaryActivity],
              [
                "Preference",
                application.preferredMembershipType.replaceAll("_", " "),
              ],
              [
                "Approved type",
                application.approvedMembershipType?.replaceAll("_", " ") ??
                  "Pending",
              ],
              [
                "Payment",
                `${application.requiredPaymentType ?? "Not requested"} ${application.requiredPaymentAmount ? `— ₱${Number(application.requiredPaymentAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : ""}`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#6C7A70]">
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#294B39]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="rounded-lg border border-[#CAD8CB] bg-white p-5">
        <h2 className="text-lg font-black text-[#123D2A]">Documents</h2>
        {application.documents.length ? (
          <ul className="mt-4 divide-y divide-[#EEF2EC]">
            {application.documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <span>
                  <span className="font-bold text-[#123D2A]">
                    {document.originalFileName}
                  </span>
                  <span className="mt-1 block text-xs text-[#6C7A70]">
                    {document.documentType}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge tone="warning">
                    {document.verificationStatus}
                  </StatusBadge>
                  <a
                    href={`${env.apiUrl}/api/membership/applications/${application.id}/documents/${document.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center rounded-md border border-[#CAD8CB] px-3 text-xs font-bold text-[#123D2A]"
                  >
                    View
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[#6C7A70]">
            No documents uploaded. Requirements remain subject to cooperative
            validation.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-[#CAD8CB] bg-white p-5">
        <h2 className="text-lg font-black text-[#123D2A]">Status timeline</h2>
        <ol className="mt-4 space-y-4">
          {application.history.map((entry, index) => (
            <li
              key={`${entry.newStatus}-${entry.changedAt}-${index}`}
              className="flex gap-3"
            >
              <BadgeCheck
                className="mt-0.5 size-5 shrink-0 text-[#1F6B43]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold text-[#123D2A]">
                  {entry.newStatus.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-xs text-[#6C7A70]">
                  {new Date(entry.changedAt).toLocaleString()}
                </p>
                {entry.publicMessage ? (
                  <p className="mt-1 text-sm text-[#365F4A]">
                    {entry.publicMessage}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {action ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#061B11]/55 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl"
          >
            <h2 className="text-xl font-black text-[#123D2A]">
              {action.replaceAll("_", " ")}
            </h2>
            {action === "APPROVE" ? (
              <label className="mt-5 grid gap-2 text-sm font-semibold text-[#294B39]">
                Confirm membership type
                <select
                  value={membershipType}
                  onChange={(event) =>
                    setMembershipType(
                      event.target.value as "ASSOCIATE" | "TRUE_MEMBER",
                    )
                  }
                  className="h-11 rounded-md border border-[#CAD8CB] px-3"
                >
                  <option value="ASSOCIATE">Associate Member — ₱200.00</option>
                  <option value="TRUE_MEMBER">
                    True Member — ₱1,500.00 initial payment
                  </option>
                </select>
              </label>
            ) : null}
            {action !== "START_REVIEW" && action !== "CREATE_ACCOUNT" ? (
              <label className="mt-4 grid gap-2 text-sm font-semibold text-[#294B39]">
                Public response
                <textarea
                  required
                  rows={4}
                  value={publicMessage}
                  onChange={(event) => setPublicMessage(event.target.value)}
                  className="rounded-md border border-[#CAD8CB] p-3"
                />
              </label>
            ) : null}
            <label className="mt-4 grid gap-2 text-sm font-semibold text-[#294B39]">
              {action === "CREATE_ACCOUNT"
                ? "Duplicate review / account creation reason"
                : "Internal note"}
              <textarea
                required={
                  action === "PLACE_ON_HOLD" || action === "CREATE_ACCOUNT"
                }
                rows={3}
                value={internalNote}
                onChange={(event) => setInternalNote(event.target.value)}
                className="rounded-md border border-[#CAD8CB] p-3"
              />
            </label>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAction(null)}
                disabled={pending}
                className="min-h-11 rounded-md border border-[#CAD8CB] font-bold text-[#294B39]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runAction()}
                disabled={
                  pending ||
                  ((action === "APPROVE" ||
                    action === "REJECT" ||
                    action === "REQUEST_INFORMATION") &&
                    !publicMessage.trim()) ||
                  ((action === "PLACE_ON_HOLD" ||
                    action === "CREATE_ACCOUNT") &&
                    internalNote.trim().length < 5)
                }
                className="min-h-11 rounded-md bg-[#123D2A] font-bold text-white disabled:opacity-50"
              >
                {pending ? "Working…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
