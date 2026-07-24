"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ApiClientError } from "@/lib/api-client";
import { activateMembershipAccount } from "./membership-api";

export function MembershipActivationForm() {
  const params = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [activated, setActivated] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await activateMembershipAccount(
        decodeURIComponent(params.token),
        password,
      );
      setActivated(true);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Account activation failed.",
      );
    } finally {
      setPending(false);
    }
  }

  if (activated) {
    return (
      <div className="rounded-xl border border-[#CAD8CB] bg-white p-7 text-center">
        <h2 className="text-2xl font-black text-[#123D2A]">
          Account activated
        </h2>
        <p className="mt-3 text-sm text-[#5D6D63]">
          Your password is set and your TrackCOOP Member account is active.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center rounded-md bg-[#123D2A] px-6 text-sm font-bold text-white"
        >
          Open Member Portal
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-xl rounded-xl border border-[#CAD8CB] bg-white p-6 shadow-sm sm:p-8"
    >
      <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
        New password
        <input
          required
          type="password"
          minLength={12}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11 rounded-md border border-[#CAD8CB] px-3"
        />
        <span className="text-xs font-normal text-[#6C7A70]">
          At least 12 characters with uppercase, lowercase, and a number.
        </span>
      </label>
      <label className="mt-4 grid gap-2 text-sm font-semibold text-[#294B39]">
        Confirm password
        <input
          required
          type="password"
          minLength={12}
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="h-11 rounded-md border border-[#CAD8CB] px-3"
        />
      </label>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-[#9A392A]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-6 min-h-11 w-full rounded-md bg-[#123D2A] px-6 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? "Activating…" : "Activate Account"}
      </button>
    </form>
  );
}
