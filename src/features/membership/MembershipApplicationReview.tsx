"use client";

import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiClientError } from "@/lib/api-client";
import { useMembershipDraft } from "./MembershipDraftProvider";
import { submitMembershipApplication } from "./membership-api";

function labelMembershipType(value: string) {
  if (value === "ASSOCIATE") return "Associate Member";
  if (value === "TRUE_MEMBER") return "True Member";
  return "Not Sure — Let NFFAC Determine";
}

function ReviewGroup({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <section className="rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-black text-[#123D2A]">{title}</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-bold uppercase tracking-[0.15em] text-[#6C7A70]">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-[#294B39]">
              {value || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function MembershipApplicationReview() {
  const router = useRouter();
  const { draft, files, documentTypes, clearDraft } = useMembershipDraft();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  if (!draft) {
    return (
      <div className="rounded-xl border border-[#E4C66A] bg-[#FFF4D7] p-6 text-center">
        <AlertTriangle
          className="mx-auto size-8 text-[#8A6200]"
          aria-hidden="true"
        />
        <h2 className="mt-3 text-xl font-black text-[#123D2A]">
          Application draft not found
        </h2>
        <p className="mt-2 text-sm text-[#6B5000]">
          Start or restore the application before opening the review page.
        </p>
        <Link
          href="/membership/apply"
          className="mt-5 inline-flex min-h-11 items-center rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white"
        >
          Return to Application
        </Link>
      </div>
    );
  }

  async function submit() {
    if (!draft || pending) return;
    setPending(true);
    setError("");
    try {
      const application = await submitMembershipApplication(
        draft,
        files,
        documentTypes,
      );
      clearDraft();
      window.sessionStorage.setItem(
        "trackcoop-membership-last-submission",
        JSON.stringify({
          reference: application.reference,
          name: application.fullName,
          submittedAt: application.submittedAt,
          preferredMembershipType: application.preferredMembershipType,
        }),
      );
      router.push(
        `/membership/apply/success?reference=${encodeURIComponent(application.reference)}`,
      );
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "The application could not be submitted.",
      );
      setConfirming(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-[#E4C66A] bg-[#FFF4D7] p-4 text-sm leading-6 text-[#6B5000]">
        Please review your information before submitting. Some information may
        require an authorized update after formal review begins.
      </div>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-[#E7B8A8] bg-[#FFF4EC] p-4 text-sm text-[#7A3023]"
        >
          {error}
        </div>
      ) : null}

      <ReviewGroup
        title="Applicant information"
        rows={[
          [
            "Full name",
            [draft.firstName, draft.middleName, draft.lastName, draft.suffix]
              .filter(Boolean)
              .join(" "),
          ],
          ["Contact number", draft.contactNumber],
          ["Email", draft.email],
          ["Preferred contact", draft.preferredContactMethod],
        ]}
      />
      <ReviewGroup
        title="Address"
        rows={[
          ["Complete address", draft.completeAddress],
          ["Barangay", draft.barangay],
          ["Municipality", draft.municipality],
          ["Province", draft.province],
        ]}
      />
      <ReviewGroup
        title="Cooperative profile"
        rows={[
          ["Sector", draft.sector],
          ["Classification", draft.applicantClassification],
          ["Livelihood", draft.livelihood],
          ["Primary activity", draft.primaryActivity],
          [
            "Preferred membership",
            labelMembershipType(draft.preferredMembershipType),
          ],
        ]}
      />
      <section className="rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <FileText className="size-5 text-[#1F6B43]" aria-hidden="true" />
          <h2 className="text-lg font-black text-[#123D2A]">
            Supporting documents
          </h2>
        </div>
        {files.length ? (
          <ul className="mt-4 space-y-2 text-sm text-[#365F4A]">
            {files.map((file) => (
              <li key={`${file.name}-${file.size}`}>{file.name}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[#6C7A70]">
            No optional documents selected.
          </p>
        )}
      </section>
      <section className="rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-5 text-[#1F6B43]" aria-hidden="true" />
          <h2 className="text-lg font-black text-[#123D2A]">
            Consent confirmed
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#5D6D63]">
          All required declarations and the privacy-processing consent were
          accepted.
        </p>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/membership/apply"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#CAD8CB] bg-white px-5 text-sm font-bold text-[#294B39] transition hover:bg-[#EEF2EC]"
        >
          Edit Application
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#CAD8CB] bg-white px-5 text-sm font-bold text-[#294B39] transition hover:bg-[#EEF2EC]"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={pending}
          className="min-h-11 rounded-md bg-[#123D2A] px-6 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:opacity-60"
        >
          {pending ? "Submitting…" : "Submit Application"}
        </button>
      </div>

      {confirming ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-[#061B11]/55 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-membership-title"
            className="w-full max-w-md rounded-xl border border-[#CAD8CB] bg-white p-6 text-center shadow-2xl"
          >
            <h2
              id="submit-membership-title"
              className="text-xl font-black text-[#123D2A]"
            >
              Submit membership application?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#5D6D63]">
              NFFAC will begin formal review. Submission does not create
              membership or an account.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="min-h-11 rounded-md border border-[#CAD8CB] font-bold text-[#294B39]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={pending}
                className="min-h-11 rounded-md bg-[#123D2A] font-bold text-white disabled:opacity-60"
              >
                {pending ? "Submitting…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
