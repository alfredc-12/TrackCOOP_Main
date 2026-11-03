"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ApiClientError } from "@/lib/api-client";
import { activateMembershipAccount, requestActivationReplacement } from "./membership-api";

export function MembershipActivationForm() {
  const params = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [activated, setActivated] = useState(false);
  // 410 means the link expired or was already used: offer a replacement instead of a dead end.
  const [linkDead, setLinkDead] = useState(false);
  const [replacementEmail, setReplacementEmail] = useState("");
  const [replacement, setReplacement] = useState<"idle" | "sending" | "sent" | "error">("idle");

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
      setLinkDead(caught instanceof ApiClientError && caught.status === 410);
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Account activation failed.",
      );
    } finally {
      setPending(false);
    }
  }

  async function requestReplacement(event: React.FormEvent) {
    event.preventDefault();
    setReplacement("sending");
    try {
      await requestActivationReplacement(replacementEmail);
      setReplacement("sent");
    } catch {
      setReplacement("error");
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
      {linkDead ? (
        <section aria-labelledby="replacement-heading" className="mt-6 border-t border-[#CAD8CB] pt-5">
          <h2 id="replacement-heading" className="text-sm font-black text-[#123D2A]">
            Need a new activation link?
          </h2>
          <p className="mt-1 text-xs text-[#5D6D63]">
            Enter the email address on your membership application. If it matches an account waiting to be activated, we will send a new link that works for 72 hours.
          </p>
          {replacement === "sent" ? (
            <p role="status" className="mt-3 text-sm font-semibold text-[#1F6B43]">
              If an eligible account exists, a new activation link is on its way. Check your inbox and spam folder.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="replacement-email">Email address</label>
              <input
                id="replacement-email"
                type="email"
                autoComplete="email"
                value={replacementEmail}
                onChange={(event) => setReplacementEmail(event.target.value)}
                className="h-11 min-w-0 flex-1 rounded-md border border-[#CAD8CB] px-3"
              />
              <button
                type="button"
                onClick={requestReplacement}
                disabled={replacement === "sending" || !replacementEmail.includes("@")}
                className="min-h-11 rounded-md border border-[#123D2A] px-5 text-sm font-bold text-[#123D2A] disabled:opacity-60"
              >
                {replacement === "sending" ? "Sending…" : "Send a new link"}
              </button>
            </div>
          )}
          {replacement === "error" ? (
            <p role="alert" className="mt-2 text-sm text-[#9A392A]">The request could not be sent. Please try again in a few minutes.</p>
          ) : null}
        </section>
      ) : null}
    </form>
  );
}
