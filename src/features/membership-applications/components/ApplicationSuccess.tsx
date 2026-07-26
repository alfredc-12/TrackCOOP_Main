"use client";

import { CheckCircle2, Copy, RefreshCw } from "lucide-react";
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
    <section className="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_rgba(18,61,42,0.10)] ring-1 ring-[#DDE8D8] sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
          <CheckCircle2 className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#f4b62a]">
            Submitted
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-normal text-[#123D2A]">
            Your membership application was received.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#365F4A]">
            Keep this application code and tracking secret. The tracking secret is shown
            only once and is required to check the public status page.
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <CopyPanel label="Application code" value={result.applicationCode} />
        <CopyPanel label="Tracking secret" value={result.trackingToken} />
      </div>

      {result.duplicateWarning ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
          {result.duplicateWarning}
        </div>
      ) : null}

      {uploadError ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
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
              Retry uploads
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link href={statusHref}>
          <Button className="h-11 w-full rounded-full bg-[#123D2A] px-5 text-white hover:bg-[#1F6B43] sm:w-auto">
            Check Status
          </Button>
        </Link>
        <Link href="/">
          <Button className="h-11 w-full rounded-full border border-[#DDE8D8] bg-white px-5 text-[#123D2A] hover:bg-[#EAF3E8] sm:w-auto">
            Back to Home
          </Button>
        </Link>
      </div>
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
