"use client";

import { ArrowLeft, CheckCircle2, FileCheck2, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRental } from "../_context/RentalProvider";
import type { InquiryDraft } from "../_types/rental";
import { formatRentalDate } from "../_lib/rentalFormatting";
import { RentalInquiryStepper } from "./RentalInquiryStepper";
import { RentalPolicyNotice } from "./RentalPolicyNotice";

export function RentalInquiryReview({ member = false }: { member?: boolean }) {
  const router = useRouter();
  const { getInquiryDraft, submitInquiry, services } = useRental();
  const [draft, setDraft] = useState<InquiryDraft>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmations, setConfirmations] = useState({
    privacy: false,
    accuracy: false,
    contact: false,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedDraft = getInquiryDraft();
      setDraft(savedDraft);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [getInquiryDraft]);

  const editHref = member
    ? "/rental/member/requests/new?step=2"
    : "/rental/inquiry?step=2";

  if (!draft) {
    return (
      <div className="mx-auto max-w-4xl">
        <RentalInquiryStepper currentStep={3} />
        <div className="rounded-2xl border border-[#d8e4d3] bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-[#123d2a]">No inquiry is ready for review</h2>
          <p className="mt-2 text-[#66756c]">Complete the requester and rental details first.</p>
          <Link
            href={member ? "/rental/member/requests/new" : "/rental/inquiry"}
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#08753a] px-5 font-bold text-white"
          >
            Start rental inquiry
          </Link>
        </div>
      </div>
    );
  }

  const service = services.find((item) => item.serviceId === draft.serviceId)?.name ?? draft.serviceId;
  const allConfirmed =
    confirmations.privacy && confirmations.accuracy && confirmations.contact;

  const submit = async () => {
    if (!allConfirmed) {
      setError("Confirm all three declarations before submitting your rental inquiry.");
      return;
    }

    setSubmitting(true);
    setError(undefined);

    try {
      await submitInquiry(
        {
          ...draft,
          dataPrivacyConsent: confirmations.privacy,
          accuracyConfirmation: confirmations.accuracy,
          contactConsent: confirmations.contact,
        },
        member,
      );
      router.push(member ? "/rental/member/requests" : "/rental/inquiry/success");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The inquiry could not be submitted.");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <RentalInquiryStepper currentStep={3} />

      <section className="overflow-hidden rounded-2xl border border-[#d9e1dc] bg-white shadow-[0_12px_36px_rgba(18,61,42,0.06)]">
        <header className="border-b border-[#e3e9e5] px-5 py-5 sm:px-8 sm:py-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#168046]">
            Section 3
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#10231a]">
            Review &amp; Submit
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6b786f]">
            Confirm the details below before sending your rental inquiry to NFFAC.
          </p>
        </header>

        <div className="space-y-5 px-5 py-6 sm:px-8 sm:py-7">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
            >
              {error}
            </div>
          )}

          <div className="rounded-xl border border-[#dce3de] bg-[#f8faf9] p-5 sm:p-6">
            <SummarySection
              title="Requester Information"
              rows={[
                ["Name", draft.fullName],
                ["Type", draft.requesterType],
                ["Contact", draft.contactNumber],
                ["Email", draft.email || "Not provided"],
                ["Barangay", draft.barangay],
                ["Municipality", draft.municipality],
                ["Address", draft.completeAddress],
                ["Preferred contact", draft.preferredContactMethod],
              ]}
            />

            <div className="my-5 border-t border-[#dfe5e1]" />

            <SummarySection
              title="Rental Details"
              rows={[
                ["Equipment", service],
                ["Preferred date", formatRentalDate(draft.preferredDate, true)],
                [
                  "Alternative date",
                  draft.alternativeDate
                    ? formatRentalDate(draft.alternativeDate, true)
                    : "Not provided",
                ],
                ["Preferred time", draft.preferredStartTime],
                ["Estimated usage", `${draft.estimatedUsage} ${draft.unitOfMeasurement}`],
                ["Estimated duration", draft.estimatedDuration],
                ["Intended use", draft.intendedUse],
                ["Service location", `${draft.serviceLocation}, ${draft.serviceBarangay}`],
                ["Request description", draft.requestDescription],
                ["Special instructions", draft.specialInstructions || "None"],
              ]}
            />

            <div className="my-5 border-t border-[#dfe5e1]" />

            <SummarySection
              title="Supporting Information"
              rows={[
                ["Inquiry attachment", draft.attachmentName || "None"],
                ["Membership proof", draft.membershipProofName || "None"],
                ["Additional notes", draft.additionalNotes || "None"],
              ]}
            />
          </div>

          <RentalPolicyNotice tone="warning" />

          <div className="rounded-xl border border-[#d8e4d3] bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-[#08753a]" />
              <h3 className="font-extrabold text-[#1f3529]">Final declarations</h3>
            </div>
            <p className="mt-1 text-sm leading-6 text-[#6b786f]">
              Please confirm each declaration before submitting your inquiry.
            </p>
            <div className="mt-4 grid gap-3">
              <DeclarationCheckbox
                checked={confirmations.privacy}
                onChange={(checked) =>
                  setConfirmations((current) => ({ ...current, privacy: checked }))
                }
              >
                I agree to the NFFAC Data Privacy Notice and consent to the collection and use of my
                personal information for processing this rental inquiry.
              </DeclarationCheckbox>
              <DeclarationCheckbox
                checked={confirmations.accuracy}
                onChange={(checked) =>
                  setConfirmations((current) => ({ ...current, accuracy: checked }))
                }
              >
                I confirm that the information I have provided is correct and complete.
              </DeclarationCheckbox>
              <DeclarationCheckbox
                checked={confirmations.contact}
                onChange={(checked) =>
                  setConfirmations((current) => ({ ...current, contact: checked }))
                }
              >
                I agree to be contacted by NFFAC regarding this rental inquiry.
              </DeclarationCheckbox>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#748178]">
              Submitting creates an inquiry for cooperative review; it is not yet a confirmed
              booking.
            </p>
          </div>

          <div className="flex flex-col-reverse justify-between gap-3 border-t border-[#e3e9e5] pt-5 sm:flex-row sm:items-center">
            <Link
              href={editHref}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cbdac6] px-5 text-sm font-bold text-[#365f4a] hover:bg-[#f3f7f1]"
            >
              <ArrowLeft className="size-4" />
              Back to Rental Details
            </Link>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Link
                href="/rental"
                className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold text-[#66756c] hover:bg-[#f1f4ef]"
              >
                Cancel
              </Link>
              <button
                type="button"
                disabled={submitting || !allConfirmed}
                onClick={() => void submit()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#08753a] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#075f31] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08753a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Inquiry"}
                {submitting ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function DeclarationCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl px-1 py-2 text-sm text-[#253c2f] transition hover:bg-[#f6f9f5] sm:text-base">
      <input
        type="checkbox"
        required
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[#079447]"
      />
      <span className="font-medium leading-6">
        {children} <span className="font-bold text-red-600">*</span>
      </span>
    </label>
  );
}

function SummarySection({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <FileCheck2 className="size-4 text-[#168046]" />
        <h3 className="font-extrabold text-[#1f3529]">{title}</h3>
      </div>
      <dl className="mt-3 grid gap-x-10 gap-y-3 sm:grid-cols-2">
        {rows.map(([term, value]) => (
          <div key={term} className={value.length > 80 ? "sm:col-span-2" : ""}>
            <dt className="text-xs font-bold uppercase tracking-wide text-[#7b8980]">{term}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#334b3d]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
