"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { ApiClientError } from "@/lib/api-client";
import { getMembershipApplicationStatus } from "../membership-application-api";
import type { PublicApplicationStatus } from "../membership-application-types";

const statusSchema = z.object({
  applicationCode: z.string().trim().min(1, "Enter the application code."),
  trackingToken: z.string().trim().min(1, "Enter the tracking secret."),
});

type StatusFormValues = z.infer<typeof statusSchema>;

export function ApplicationStatusLookup() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<PublicApplicationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StatusFormValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: {
      applicationCode: searchParams.get("code") ?? "",
      trackingToken: "",
    },
  });

  const onSubmit = async (values: StatusFormValues) => {
    setError(null);
    setStatus(null);

    try {
      const response = await getMembershipApplicationStatus(values);
      setStatus(response);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Unable to load the application status. Please try again.",
      );
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_rgba(18,61,42,0.10)] ring-1 ring-[#DDE8D8] sm:p-8"
      >
        <h1 className="text-3xl font-black leading-tight tracking-normal text-[#123D2A]">
          Application Status
        </h1>
        <p className="mt-3 text-sm leading-7 text-[#365F4A]">
          Enter the application code and tracking secret from your submission receipt.
        </p>

        <div className="mt-7 grid gap-5">
          <Field
            label="Application code"
            error={errors.applicationCode?.message}
            inputProps={register("applicationCode")}
          />
          <Field
            label="Tracking secret"
            error={errors.trackingToken?.message}
            inputProps={register("trackingToken")}
          />
        </div>

        {error ? (
          <div className="mt-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 h-11 w-full rounded-full bg-[#123D2A] text-white hover:bg-[#1F6B43]"
        >
          <Search className="size-4" />
          {isSubmitting ? "Checking..." : "Check Status"}
        </Button>
      </form>

      <section className="rounded-[2rem] border border-[#DDE8D8] bg-[#F8F1E5] p-6 shadow-sm sm:p-8">
        {status ? (
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#f4b62a]">
              {status.applicationStatus}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-normal text-[#123D2A]">
              {status.applicationCode}
            </h2>
            <dl className="mt-6 grid gap-4 text-sm">
              <StatusRow label="Applicant" value={status.fullName} />
              <StatusRow label="Submitted" value={status.submittedAt} />
              <StatusRow
                label="Applicant message"
                value={status.latestApplicantMessage ?? "No message posted yet."}
              />
            </dl>

            {status.missingOrRejectedRequirements.length ? (
              <div className="mt-7">
                <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-[#123D2A]">
                  Requirements
                </h3>
                <ul className="mt-3 grid gap-2 text-sm text-[#365F4A]">
                  {status.missingOrRejectedRequirements.map((requirement) => (
                    <li
                      key={`${requirement.requirementType}-${requirement.requirementStatus}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#DDE8D8] bg-white px-3 py-2"
                    >
                      <span>{requirement.requirementType}</span>
                      <span className="font-bold text-[#123D2A]">
                        {requirement.requirementStatus}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
                <Search className="size-6" />
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-normal text-[#123D2A]">
                Track a submitted application.
              </h2>
              <p className="mt-2 max-w-md text-sm leading-7 text-[#365F4A]">
                Public status only shows safe review details. Chairman-only review
                information stays inside the portal.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  error,
  inputProps,
}: {
  label: string;
  error?: string;
  inputProps: UseFormRegisterReturn;
}) {
  return (
    <label className="block text-sm font-semibold text-[#365F4A]">
      {label}
      <input
        className="mt-2 h-12 w-full rounded-2xl border border-[#DDE8D8] bg-white px-4 text-base text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
        aria-invalid={Boolean(error)}
        {...inputProps}
      />
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold text-[#123D2A]">{label}</dt>
      <dd className="mt-1 text-[#365F4A]">{value}</dd>
    </div>
  );
}
