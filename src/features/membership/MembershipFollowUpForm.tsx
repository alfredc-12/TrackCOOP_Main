"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ApiClientError } from "@/lib/api-client";
import {
  submitAdditionalInformation,
  submitMembershipPayment,
} from "./membership-api";

type Verification = { reference: string; contactNumber: string };

export function MembershipFollowUpForm({
  mode,
}: {
  mode: "information" | "payment";
}) {
  const params = useParams<{ reference: string }>();
  const router = useRouter();
  const [verification] = useState<Verification | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(
      "trackcoop-membership-status-verification",
    );
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as Verification;
      return value.reference === decodeURIComponent(params.reference)
        ? value
        : null;
    } catch {
      return null;
    }
  });
  const [information, setInformation] = useState("");
  const [provider, setProvider] = useState("Direct GCash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!verification) return;
    setPending(true);
    setError("");
    try {
      if (mode === "information") {
        await submitAdditionalInformation(
          verification.reference,
          verification.contactNumber,
          information,
          files,
        );
      } else {
        const proof = files[0];
        if (!proof) throw new Error("Select payment proof.");
        await submitMembershipPayment({
          reference: verification.reference,
          contactNumber: verification.contactNumber,
          provider,
          referenceNumber,
          amount: Number(amount),
          notes,
          proof,
        });
      }
      router.push("/membership/application-status");
    } catch (caught) {
      setError(
        caught instanceof ApiClientError || caught instanceof Error
          ? caught.message
          : "The information could not be submitted.",
      );
    } finally {
      setPending(false);
    }
  }

  if (!verification) {
    return (
      <div className="rounded-xl border border-[#E4C66A] bg-[#FFF4D7] p-6 text-sm leading-6 text-[#6B5000]">
        Verify the application reference and contact number on the status page
        before submitting private follow-up information.
        <button
          type="button"
          onClick={() => router.push("/membership/application-status")}
          className="mt-4 block min-h-11 rounded-md bg-[#123D2A] px-5 font-bold text-white"
        >
          Verify Application
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-sm sm:p-7"
    >
      <p className="text-sm font-bold text-[#123D2A]">
        {verification.reference}
      </p>
      {mode === "information" ? (
        <label className="mt-5 grid gap-2 text-sm font-semibold text-[#294B39]">
          Requested information
          <textarea
            required
            rows={6}
            value={information}
            onChange={(event) => setInformation(event.target.value)}
            className="rounded-md border border-[#CAD8CB] p-3 outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/25"
          />
        </label>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
            Payment method
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="h-11 rounded-md border border-[#CAD8CB] px-3"
            >
              {[
                "Direct GCash",
                "GCash Reference Upload",
                "Cash",
                "Bank Transfer",
                "Other Approved Method",
              ].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
            Reference number
            <input
              required
              value={referenceNumber}
              onChange={(event) => setReferenceNumber(event.target.value)}
              className="h-11 rounded-md border border-[#CAD8CB] px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
            Amount
            <input
              required
              min="1"
              step="0.01"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-11 rounded-md border border-[#CAD8CB] px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
            Note <span className="font-normal">(optional)</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="h-11 rounded-md border border-[#CAD8CB] px-3"
            />
          </label>
        </div>
      )}
      <label className="mt-5 grid min-h-24 cursor-pointer place-items-center rounded-lg border border-dashed border-[#9FB4A4] bg-[#F7F8F3] p-4 text-center text-sm font-semibold text-[#123D2A]">
        {mode === "payment"
          ? "Select payment proof (required)"
          : "Select requested documents (optional)"}
        <input
          className="sr-only"
          type="file"
          multiple={mode === "information"}
          required={mode === "payment"}
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        />
      </label>
      {files.length ? (
        <p className="mt-3 text-sm text-[#365F4A]">
          {files.map((file) => file.name).join(", ")}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-[#9A392A]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-5 min-h-11 rounded-md bg-[#123D2A] px-6 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending
          ? "Submitting…"
          : mode === "payment"
            ? "Submit Payment Proof"
            : "Submit Information"}
      </button>
    </form>
  );
}
