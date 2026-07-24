"use client";

import { CheckCircle2, Printer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

type LastSubmission = {
  reference: string;
  name: string;
  submittedAt: string;
  preferredMembershipType: string;
};

export function MembershipSuccess() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? "";
  const [submission] = useState<LastSubmission | null>(() => {
    if (typeof window === "undefined") return null;
    const value = window.sessionStorage.getItem(
      "trackcoop-membership-last-submission",
    );
    if (!value) return null;
    try {
      return JSON.parse(value) as LastSubmission;
    } catch {
      return null;
    }
  });

  return (
    <section className="rounded-xl border border-[#CAD8CB] bg-white p-6 text-center shadow-sm sm:p-10">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#E3F7E7] text-[#1F6B43]">
        <CheckCircle2 className="size-9" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-2xl font-black text-[#123D2A]">
        Membership Application Submitted
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#5D6D63]">
        NFFAC will review your application. Submitting an application does not
        immediately create a member account. You will receive an update after
        the cooperative completes its review.
      </p>
      <dl className="mx-auto mt-7 grid max-w-2xl gap-4 rounded-lg bg-[#F7F8F3] p-5 text-left sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.15em] text-[#6C7A70]">
            Application reference
          </dt>
          <dd className="mt-1 font-black text-[#123D2A]">
            {reference || submission?.reference || "Unavailable"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.15em] text-[#6C7A70]">
            Current status
          </dt>
          <dd className="mt-1 font-bold text-[#8A6200]">Submitted</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.15em] text-[#6C7A70]">
            Applicant
          </dt>
          <dd className="mt-1 font-semibold text-[#294B39]">
            {submission?.name ?? "See your saved application"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.15em] text-[#6C7A70]">
            Submitted
          </dt>
          <dd className="mt-1 font-semibold text-[#294B39]">
            {submission?.submittedAt
              ? new Date(submission.submittedAt).toLocaleString()
              : "Just now"}
          </dd>
        </div>
      </dl>
      <p className="mx-auto mt-6 max-w-xl text-sm text-[#5D6D63]">
        Keep your reference and contact number. NFFAC may request more
        information or provide payment instructions after review.
      </p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-5 text-sm font-bold text-[#294B39]"
        >
          <Printer className="size-4" aria-hidden="true" />
          Print Application
        </button>
        <Link
          href="/membership/application-status"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white"
        >
          Check Application Status
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#CAD8CB] bg-white px-5 text-sm font-bold text-[#294B39]"
        >
          Return Home
        </Link>
      </div>
    </section>
  );
}
