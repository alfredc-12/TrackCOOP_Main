"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, CreditCard, Loader2, Search, Wallet } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { ApiClientError } from "@/lib/api-client";
import {
  createMembershipApplicationPaymongoCheckout,
  getMembershipApplicationStatus,
} from "../membership-application-api";
import type {
  PublicApplicationStatus,
  PublicPaymentRequirement,
} from "../membership-application-types";

const statusSchema = z.object({
  applicationCode: z.string().trim().min(1, "Enter the application code."),
  dateOfBirth: z.string().trim().min(1, "Enter the applicant date of birth."),
});

type StatusFormValues = z.infer<typeof statusSchema>;

export function ApplicationStatusLookup() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<PublicApplicationStatus | null>(null);
  const [verifiedLookup, setVerifiedLookup] = useState<StatusFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutAction, setCheckoutAction] = useState<
    "Associate Membership Fee" | "Share Capital" | null
  >(null);
  const [shareCapitalAmount, setShareCapitalAmount] = useState("1500");

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StatusFormValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: {
      applicationCode: searchParams.get("code") ?? "",
      dateOfBirth: "",
    },
  });
  const dateOfBirth = useWatch({ control, name: "dateOfBirth" });

  const onSubmit = async (values: StatusFormValues) => {
    setError(null);
    setCheckoutError(null);
    setStatus(null);
    setVerifiedLookup(null);

    try {
      const response = await getMembershipApplicationStatus(values);
      setStatus(response);
      setVerifiedLookup({
        applicationCode: values.applicationCode.trim(),
        dateOfBirth: values.dateOfBirth.trim(),
      });
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
          Enter the application code and the date of birth used in the application.
        </p>

        <div className="mt-7 grid gap-5">
          <Field
            label="Application code"
            error={errors.applicationCode?.message}
            inputProps={register("applicationCode")}
          />
          <div>
            <input type="hidden" {...register("dateOfBirth")} />
            <DatePicker
              label="Applicant date of birth"
              value={dateOfBirth}
              onChange={(value) =>
                setValue("dateOfBirth", value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                })
              }
              min="1900-01-01"
              placeholder="Select birth date"
              error={errors.dateOfBirth?.message}
            />
          </div>
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

            <PaymentPanel
              status={status}
              credentials={verifiedLookup}
              checkoutAction={checkoutAction}
              checkoutError={checkoutError}
              shareCapitalAmount={shareCapitalAmount}
              onShareCapitalAmountChange={setShareCapitalAmount}
              onStartCheckout={async (paymentPurpose) => {
                if (!verifiedLookup || checkoutAction) return;
                setCheckoutError(null);
                setCheckoutAction(paymentPurpose);
                try {
                  const result = await createMembershipApplicationPaymongoCheckout({
                    applicationCode: verifiedLookup.applicationCode,
                    dateOfBirth: verifiedLookup.dateOfBirth,
                    paymentPurpose,
                    requestedAmount:
                      paymentPurpose === "Share Capital"
                        ? Number(shareCapitalAmount)
                        : undefined,
                  });
                  window.location.assign(result.checkoutUrl);
                } catch (err) {
                  setCheckoutError(
                    err instanceof ApiClientError
                      ? err.message
                      : "Unable to start PayMongo checkout. Please try again.",
                  );
                  setCheckoutAction(null);
                }
              }}
            />

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

function PaymentPanel({
  status,
  credentials,
  checkoutAction,
  checkoutError,
  shareCapitalAmount,
  onShareCapitalAmountChange,
  onStartCheckout,
}: {
  status: PublicApplicationStatus;
  credentials: StatusFormValues | null;
  checkoutAction: "Associate Membership Fee" | "Share Capital" | null;
  checkoutError: string | null;
  shareCapitalAmount: string;
  onShareCapitalAmountChange: (value: string) => void;
  onStartCheckout: (paymentPurpose: "Associate Membership Fee" | "Share Capital") => Promise<void>;
}) {
  const fee = status.paymentRequirements.find(
    (requirement) => requirement.paymentPurpose === "Associate Membership Fee",
  );
  const capital = status.paymentRequirements.find(
    (requirement) => requirement.paymentPurpose === "Share Capital",
  );

  if (!fee && !capital) return null;

  return (
    <div className="mt-7 rounded-2xl border border-[#DDE8D8] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b62a]">
            TEST MODE — No real money will be charged
          </p>
          <h3 className="mt-2 text-lg font-black tracking-normal text-[#123D2A]">
            PayMongo payment
          </h3>
        </div>
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
          <CreditCard className="size-5" />
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {fee ? (
          <PaymentRequirementRow
            requirement={fee}
            label="Membership fee"
            actionLabel="Pay Membership Fee with PayMongo"
            loading={checkoutAction === "Associate Membership Fee"}
            disabled={!credentials || Boolean(checkoutAction) || fee.paymentStatus === "Confirmed"}
            onClick={() => onStartCheckout("Associate Membership Fee")}
          />
        ) : null}

        {status.requestedMembershipType === "True Member" && capital ? (
          <div className="rounded-xl border border-[#DDE8D8] bg-[#F8F1E5] p-3">
            <PaymentRequirementSummary requirement={capital} label="Initial share capital" />
            {capital.paymentStatus !== "Confirmed" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="block text-xs font-bold uppercase tracking-[0.14em] text-[#365F4A]">
                  Amount
                  <input
                    type="number"
                    min={1500}
                    max={15000}
                    step={100}
                    value={shareCapitalAmount}
                    onChange={(event) => onShareCapitalAmountChange(event.target.value)}
                    className="mt-2 h-11 w-full rounded-full border border-[#DDE8D8] bg-white px-4 text-base font-bold text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
                  />
                </label>
                <Button
                  type="button"
                  disabled={!credentials || Boolean(checkoutAction)}
                  onClick={() => onStartCheckout("Share Capital")}
                  className="h-11 self-end rounded-full bg-[#123D2A] px-5 text-white hover:bg-[#1F6B43]"
                >
                  {checkoutAction === "Share Capital" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wallet className="size-4" />
                  )}
                  Pay Share Capital
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {checkoutError ? (
        <div className="mt-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{checkoutError}</p>
        </div>
      ) : null}
    </div>
  );
}

function PaymentRequirementRow({
  requirement,
  label,
  actionLabel,
  loading,
  disabled,
  onClick,
}: {
  requirement: PublicPaymentRequirement;
  label: string;
  actionLabel: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#DDE8D8] bg-[#F8F1E5] p-3">
      <PaymentRequirementSummary requirement={requirement} label={label} />
      {requirement.paymentStatus !== "Confirmed" ? (
        <Button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className="mt-3 h-11 w-full rounded-full bg-[#123D2A] px-5 text-white hover:bg-[#1F6B43]"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
          {loading ? "Opening PayMongo..." : actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

function PaymentRequirementSummary({
  requirement,
  label,
}: {
  requirement: PublicPaymentRequirement;
  label: string;
}) {
  const confirmed = requirement.paymentStatus === "Confirmed";
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold text-[#123D2A]">{label}</p>
        <p className="mt-1 text-xs text-[#365F4A]">
          {requirement.amount === null
            ? "Amount will be assigned when checkout starts."
            : new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(requirement.amount)}
        </p>
      </div>
      <span
        className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
          confirmed
            ? "bg-[#EAF3E8] text-[#1F6B43]"
            : "bg-amber-50 text-amber-800"
        }`}
      >
        {confirmed ? <CheckCircle2 className="size-4" /> : <CreditCard className="size-4" />}
        {requirement.paymentStatus}
      </span>
    </div>
  );
}

function Field({
  label,
  error,
  inputProps,
  type = "text",
}: {
  label: string;
  error?: string;
  inputProps: UseFormRegisterReturn;
  type?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-[#365F4A]">
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

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold text-[#123D2A]">{label}</dt>
      <dd className="mt-1 text-[#365F4A]">{value}</dd>
    </div>
  );
}
