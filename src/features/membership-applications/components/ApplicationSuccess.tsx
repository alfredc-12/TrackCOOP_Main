"use client";

import { Check, CheckCircle2, Copy, MailCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { PublicSubmissionResult } from "../membership-application-types";

type ApplicationSuccessProps = {
  result: PublicSubmissionResult;
  uploadError?: string | null;
  isRetryingUploads?: boolean;
  onRetryUploads?: () => void;
};

export function ApplicationSuccess({
  result,
  uploadError,
  isRetryingUploads = false,
  onRetryUploads,
}: ApplicationSuccessProps) {
  const statusHref = `/membership/application-status?code=${encodeURIComponent(
    result.applicationCode,
  )}`;

  return (
    <section aria-live="polite" className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 shadow-[0_24px_70px_rgba(18,61,42,0.10)] ring-1 ring-[#DDE8D8]">
      <div className="border-b border-[#DDE8D8] bg-[#F8F1E5] p-6 sm:p-8">
        <div className="grid size-16 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
          <CheckCircle2 className="size-9" />
        </div>
        <h1 className="mt-5 text-3xl font-black leading-tight tracking-normal text-[#123D2A] sm:text-4xl">
          Application submitted
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[#365F4A]">
          Thank you. Your membership application has been sent to NFFAC for review.
        </p>
      </div>

      <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_22rem]">
        <div>
          <div className="rounded-[1.5rem] border border-[#DDE8D8] bg-[#FFFAF2] p-5">
            <div className="flex gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
                <MailCheck className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-black text-[#123D2A]">Confirmation sent</h2>
                <p className="mt-1 text-sm leading-6 text-[#365F4A]">
                  Your application reference is included in the email. You do not need to memorize it.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-black text-[#123D2A]">What happens next</h2>
            <ol className="mt-4 grid gap-3">
              {[
                "Application submitted",
                "NFFAC reviews your application",
                "We'll email you if anything else is needed",
                "Payment opens after initial acceptance",
                "Final membership approval",
              ].map((item, index) => (
                <li key={item} className="flex gap-3 rounded-2xl border border-[#DDE8D8] bg-white p-4 text-sm font-semibold text-[#365F4A]">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${index === 0 ? "bg-[#1F6B43] text-white" : "bg-[#EAF3E8] text-[#123D2A]"}`}>
                    {index === 0 ? <Check className="size-4" /> : index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="h-fit rounded-[1.5rem] border border-[#DDE8D8] bg-white p-5 shadow-sm">
          <CopyPanel label="Application Reference" value={result.applicationCode} />
          <div className="mt-5 grid gap-3">
            <Link href={statusHref}>
              <Button className="h-11 w-full rounded-full bg-[#123D2A] px-5 text-white hover:bg-[#1F6B43]">
                View My Application
              </Button>
            </Link>
            <Link href="/">
              <Button className="h-11 w-full rounded-full border border-[#DDE8D8] bg-white px-5 text-[#123D2A] hover:bg-[#EAF3E8]">
                Back to Home
              </Button>
            </Link>
          </div>
        </aside>
      </div>

      {result.duplicateWarning ? (
        <div className="mx-6 mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900 sm:mx-8">
          {result.duplicateWarning}
        </div>
      ) : null}

      {uploadError ? (
        <div role="alert" aria-live="assertive" className="mx-6 mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800 sm:mx-8">
          <p className="font-bold">Some uploads did not finish.</p>
          <p className="mt-1">{uploadError}</p>
          {onRetryUploads ? (
            <Button
              type="button"
              onClick={onRetryUploads}
              disabled={isRetryingUploads}
              className="mt-3 h-10 rounded-full bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]"
            >
              <RefreshCw className={`size-4 ${isRetryingUploads ? "animate-spin" : ""}`} />
              {isRetryingUploads ? "Uploading documents..." : "Retry document uploads"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CopyPanel({ label, value }: { label: string; value: string }) {
  const copyValue = async () => {
    await navigator.clipboard.writeText(value);
  };

  return (
    <div className="rounded-2xl border border-[#DDE8D8] bg-[#F8F1E5] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#365F4A]">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <code className="min-w-0 flex-1 break-all text-sm font-bold text-[#123D2A]">
          {value}
        </code>
        <button
          type="button"
          onClick={copyValue}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-[#DDE8D8] bg-white text-[#123D2A] transition hover:bg-[#EAF3E8]"
          aria-label={`Copy ${label}`}
        >
          <Copy className="size-4" />
        </button>
      </div>
    </div>
  );
}
