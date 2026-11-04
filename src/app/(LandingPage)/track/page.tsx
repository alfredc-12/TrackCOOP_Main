"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { RefreshCw, AlertCircle, CheckCircle2, MessageSquare, Clock3, ArrowUpRight, KeyRound, ClipboardPaste, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { Modal } from "@/components/ui/Modal";
import { trackPublicRequest, addPublicRequestReply, type RequestDetailResponse } from "@/features/communication/communication-api";
import type { RequestStatusHistoryRecord } from "@/features/communication/communication-types";

type ApiError = { statusCode?: number };

function TrackContent() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") || "");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RequestDetailResponse | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const silentRefreshInFlightRef = useRef(false);
  const timelineMessageCount = result?.history?.length ?? 0;
  useEffect(() => {
    if (timelineMessageCount > 0) requestAnimationFrame(() => { if (timelineRef.current) timelineRef.current.scrollTop = timelineRef.current.scrollHeight; });
  }, [timelineMessageCount]);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!code.trim()) {
      toast.error("Please enter a tracking code.");
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    try {
      const data = await trackPublicRequest(code.trim());
      setResult(data);
    } catch (error: unknown) {
      setResult(null);
      if ((error as ApiError).statusCode === 404) {
        toast.error("Invalid tracking code. Please check and try again.");
      } else {
        toast.error("An error occurred while tracking. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (!code) return;
    const timer = window.setTimeout(() => void handleSearch(), 0);
    return () => window.clearTimeout(timer);
  }, [code, handleSearch]);

  useEffect(() => {
    const trackingCode = result?.request.referenceCode;
    if (!trackingCode) return;

    const refreshSilently = async () => {
      if (
        document.visibilityState !== "visible" ||
        silentRefreshInFlightRef.current ||
        isSubmittingReply ||
        isCancelling
      ) return;

      silentRefreshInFlightRef.current = true;
      try {
        const data = await trackPublicRequest(trackingCode);
        setResult(data);
      } catch {
        // Keep the last successful result visible during background refresh failures.
      } finally {
        silentRefreshInFlightRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => void refreshSilently(), 15_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshSilently();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isCancelling, isSubmittingReply, result?.request.referenceCode]);

  const handlePaste = async () => {
    try {
      const pasted = await navigator.clipboard.readText();
      if (pasted) setCode(pasted.trim());
    } catch {
      toast.error("Please paste the tracking code into the field.");
    }
  };

  const handleReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !result || isSubmittingReply) return;
    
    setIsSubmittingReply(true);
    try {
      const data = await addPublicRequestReply(result.request.referenceCode, replyText.trim());
      setResult(data);
      setReplyText("");
      toast.success("Reply sent successfully.");
    } catch {
      toast.error("Failed to send reply. Please try again.");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleCancelInquiry = async () => {
    if (!result || isCancelling) return;
    setIsCancelConfirmOpen(false);
    setIsCancelling(true);
    try {
      const data = await addPublicRequestReply(
        result.request.referenceCode,
        "The requester would like to cancel this inquiry."
      );
      setResult(data);
      toast.success("Cancellation request sent to the Chairman.");
    } catch {
      toast.error("Unable to send the cancellation request.");
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Submitted":
        return <CheckCircle2 className="size-5 text-gray-500" />;
      case "Under Review":
        return <AlertCircle className="size-5 text-yellow-500" />;
      case "In Progress":
        return <RefreshCw className="size-5 text-blue-500" />;
      case "Resolved":
        return <CheckCircle2 className="size-5 text-green-500" />;
      case "Closed":
        return <CheckCircle2 className="size-5 text-gray-500" />;
      default:
        return <Clock3 className="size-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Submitted":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "Under Review":
        return "bg-yellow-50 text-yellow-800 border-yellow-200";
      case "In Progress":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "Resolved":
        return "bg-green-50 text-green-800 border-green-200";
      case "Closed":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-10 pt-24 sm:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-coop-forest sm:text-4xl">Track Your Inquiry</h1>
          <p className="mt-2 text-base leading-7 text-coop-secondary">Enter your reference code below to check the current status and latest updates on your request.</p>
        </div>
        <Link href="/contact" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-coop-forest shadow-sm ring-1 ring-[#DDE8D8] transition hover:bg-[#EAF1E5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coop-green motion-reduce:transition-none">Submit an inquiry<ArrowUpRight aria-hidden="true" className="size-4" /></Link>
      </header>

      <section aria-label="Inquiry lookup" className="rounded-xl border border-[#DDE8D8] bg-white p-5 shadow-sm sm:p-6">
        <form onSubmit={handleSearch} className="max-w-3xl">
          <label htmlFor="inquiry-tracking-code" className="mb-2 block text-sm font-semibold text-coop-forest">Tracking code</label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="relative min-w-0 flex-1">
              <KeyRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-coop-green" />
              <Input id="inquiry-tracking-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="REQ-1789962454768-0GW8V" aria-describedby="tracking-help" className="h-12 w-full min-w-0 bg-[var(--public-canvas)] pl-9 pr-12 text-base uppercase placeholder:text-[#627468]" disabled={isLoading} />
              {code ? <button type="button" onClick={() => setCode("")} aria-label="Clear tracking code" className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-md text-coop-secondary hover:bg-[#EAF1E5] focus-visible:outline-2 focus-visible:outline-coop-green"><X aria-hidden="true" className="size-4" /></button>
                : <button type="button" onClick={handlePaste} aria-label="Paste tracking code" className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-md text-coop-secondary hover:bg-[#EAF1E5] focus-visible:outline-2 focus-visible:outline-coop-green"><ClipboardPaste aria-hidden="true" className="size-4" /></button>}
            </div>
            <Button type="submit" disabled={isLoading} className="h-12 gap-2 px-6 text-base">
              {isLoading ? <><RefreshCw aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />Searching...</> : "Track Inquiry"}
            </Button>
          </div>
          <p id="tracking-help" className="mt-3 text-sm leading-6 text-coop-secondary">Use the tracking code you received after submitting your inquiry.</p>
        </form>
      </section>

      {!hasSearched && !result && <div className="mt-5 flex items-start gap-3 rounded-xl bg-[#EAF1E5] p-5 text-coop-secondary">
        <MessageSquare aria-hidden="true" className="mt-1 size-5 shrink-0 text-coop-green" />
        <p className="text-base leading-7">Your inquiry details, replies, and status updates will appear here after you enter your code.</p>
      </div>}

      {hasSearched && !isLoading && !result && <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
        <AlertCircle aria-hidden="true" className="mt-1 size-5 shrink-0" />
        <div><h2 className="text-lg font-bold">Request Not Found</h2><p className="mt-1 text-base leading-7">We couldn&apos;t find any inquiry matching that code. Please verify the code and try again.</p></div>
      </div>}

      {result && <div className="mt-6 grid min-w-0 items-start gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section aria-labelledby="inquiry-details-title" className="min-w-0 overflow-hidden rounded-xl border border-[#DDE8D8] bg-white shadow-sm">
          <div className="bg-[#EAF1E5] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="inquiry-details-title" className="text-xl font-bold text-coop-forest">Inquiry details</h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${getStatusColor(result.request.requestStatus)}`}>{getStatusIcon(result.request.requestStatus)}{result.request.requestStatus}</span>
            </div>
            <p className="mt-3 break-words text-base font-semibold text-coop-forest">{result.request.referenceCode}</p>
          </div>
          <dl className="grid min-w-0 gap-x-5 gap-y-4 p-5 text-base sm:grid-cols-2 sm:p-6">
            {[
              ["Subject", result.request.subject || "No subject provided"],
              ["Category", result.request.requestType],
              ["Name", result.request.requesterName],
              ["Email", result.request.requesterEmail],
              ["Phone", result.request.requesterPhone],
              ["Barangay", result.request.requesterBarangay],
              ["Submitted", format(new Date(result.request.submittedAt), "MMM d, yyyy")],
            ].filter(([, value]) => value).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-coop-secondary">{label}</dt><dd className="mt-1 break-words font-medium leading-6 text-coop-forest">{value}</dd></div>)}
          </dl>
          <div className="border-t border-[#E0EADC] p-5 sm:p-6">
            <form onSubmit={handleReply}>
              <label htmlFor="inquiry-reply" className="mb-2 block text-base font-semibold text-coop-forest">Send a Reply</label>
              <textarea id="inquiry-reply" className="w-full resize-y rounded-md border border-coop-border bg-[var(--public-canvas)] p-3 text-base text-coop-forest outline-none placeholder:text-[#627468] focus:border-coop-green focus:ring-2 focus:ring-[#1F6B43]/15" rows={3} placeholder="Type your reply to the admin here..." value={replyText} onChange={(event) => setReplyText(event.target.value.slice(0, 8000))} maxLength={8000} disabled={isSubmittingReply} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setIsCancelConfirmOpen(true)} disabled={isCancelling || isSubmittingReply} className="min-h-11 rounded-md px-2 text-sm font-semibold text-[#A83535] underline underline-offset-4 hover:bg-red-50 disabled:opacity-60">{isCancelling ? "Sending cancellation request..." : "Request Cancellation"}</button>
                <Button type="submit" disabled={isSubmittingReply || !replyText.trim()} className="min-h-11">{isSubmittingReply ? "Sending..." : "Send Reply"}</Button>
              </div>
            </form>
          </div>
        </section>

        <section aria-labelledby="inquiry-timeline-title" className="min-w-0 overflow-hidden rounded-xl border border-[#DDE8D8] bg-white shadow-sm">
          <div className="px-5 pb-4 pt-5 sm:px-6 sm:pt-6"><h2 id="inquiry-timeline-title" className="text-xl font-bold text-coop-forest">Timeline &amp; Updates</h2><p className="mt-1 text-sm text-coop-secondary">Replies and status updates in chronological order.</p></div>
          <div ref={timelineRef} tabIndex={0} role="region" aria-label="Inquiry conversation" className="max-h-[560px] overflow-y-auto px-5 pb-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-coop-green sm:px-6 sm:pb-6">
            <div className="grid gap-4">
              <article className="min-w-0 rounded-lg bg-[var(--public-canvas)] p-4 text-base leading-7 text-coop-forest">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><h3 className="text-sm font-semibold">You (Submitted Inquiry)</h3><time className="text-xs text-coop-secondary" dateTime={result.request.submittedAt}>{format(new Date(result.request.submittedAt), "MMM d, h:mm a")}</time></div>
                {result.request.subject && <strong className="mb-2 block break-words">{result.request.subject}</strong>}
                <p className="whitespace-pre-wrap break-words">{result.request.message}</p>
              </article>
              {result.history.slice().sort((a: RequestStatusHistoryRecord, b: RequestStatusHistoryRecord) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()).map((item: RequestStatusHistoryRecord) => {
                const isPublicReply = !item.changedBy;
                const isStatusChange = item.newStatus !== item.oldStatus;
                // Public tracking must never expose staff account names or internal notes.
                const senderLabel = isPublicReply ? "You (Public Reply)" : isStatusChange ? `Status changed to ${item.newStatus}` : "Chairman";
                return <article key={item.id} className={`min-w-0 rounded-lg p-4 text-base leading-7 text-coop-forest ${isPublicReply ? "bg-[#F2F3EF]" : item.userVisibleMessage ? "bg-[#EAF1E5]" : "bg-[var(--public-canvas)]"}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><h3 className="text-sm font-semibold">{senderLabel}</h3><time className="text-xs text-coop-secondary" dateTime={item.changedAt}>{format(new Date(item.changedAt), "MMM d, h:mm a")}</time></div>
                  {item.userVisibleMessage && <p className="whitespace-pre-wrap break-words">{item.userVisibleMessage}</p>}
                </article>;
              })}
            </div>
          </div>
        </section>
      </div>}

      <Modal title="Request cancellation?" description="A cancellation request will be sent to the Chairman for review." trigger={<span className="hidden" />} open={isCancelConfirmOpen} onOpenChange={setIsCancelConfirmOpen}>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setIsCancelConfirmOpen(false)}>Keep Inquiry</Button>
          <Button type="button" onClick={handleCancelInquiry} className="bg-[#A83535] hover:bg-[#8E2929]">Send Cancellation Request</Button>
        </div>
      </Modal>
    </div>
  );
}

export default function TrackPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--public-canvas)] text-coop-forest">
      <SiteHeader initialActive="contact" />
      <main className="min-w-0 flex-1">
        <Suspense fallback={<p role="status" className="px-5 pb-10 pt-24 text-center text-coop-secondary">Loading inquiry tracker...</p>}>
          <TrackContent />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
