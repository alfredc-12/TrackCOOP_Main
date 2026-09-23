"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { MapPin, Calendar, Clock, RefreshCw, AlertCircle, CheckCircle2, MessageSquare, Clock3, ArrowLeft, KeyRound, ClipboardPaste, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toaster, toast } from "sonner";
import { trackPublicRequest, addPublicRequestReply, type RequestDetailResponse } from "@/features/communication/communication-api";

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
  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);
  useEffect(() => {
    if (result?.history?.length) requestAnimationFrame(() => { if (timelineRef.current) timelineRef.current.scrollTop = timelineRef.current.scrollHeight; });
  }, [result]);

  useEffect(() => {
    if (code) {
      handleSearch();
    }
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
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
    } catch (error: any) {
      setResult(null);
      if (error.statusCode === 404) {
        toast.error("Invalid tracking code. Please check and try again.");
      } else {
        toast.error("An error occurred while tracking. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

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
    if (!replyText.trim() || !result) return;
    
    setIsSubmittingReply(true);
    try {
      const data = await addPublicRequestReply(result.request.referenceCode, replyText.trim());
      setResult(data);
      setReplyText("");
      toast.success("Reply sent successfully.");
    } catch (error: any) {
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
    <div className="mx-auto h-screen w-full max-w-7xl overflow-hidden px-4 pt-8 pb-10 sm:px-6 sm:pt-10 sm:pb-12 lg:px-8">
      <div className="mb-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#365F4A] hover:text-[#1F6B43] transition">
          <ArrowLeft className="size-4" />
          Back to Home
        </Link>
      </div>
      <div className="relative mx-auto mb-6 w-full max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D432D] via-[#125A3B] to-[#1F7A4D] px-6 py-7 text-center text-white shadow-[0_16px_34px_rgba(13,67,45,0.22)] sm:px-8">
        <div className="absolute -right-10 -top-16 size-48 rounded-full border-[18px] border-white/10" />
        <h1 className="relative text-2xl font-black tracking-tight sm:text-3xl">
          Track Your Inquiry
        </h1>
        <p className="relative mx-auto mt-2 max-w-2xl text-sm text-white/75">
          Enter your reference code below to check the current status and latest updates on your request.
        </p>
      </div>

      <div className="hidden">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.16em] text-[#527765]">Enter your tracking code</p>
        <form onSubmit={handleSearch} className="mx-auto w-full max-w-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#5E8972]" />
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="REQ-1789962454768-0GW8V"
                aria-label="Tracking code"
                className="h-12 w-full pl-12 pr-24 text-base uppercase bg-white border-[#CAD8CB] placeholder:text-[#527765] placeholder:opacity-100 focus-visible:ring-[#82E6A7]"
                disabled={isLoading}
              />
              {code ? (
                <button type="button" onClick={() => setCode("")} aria-label="Clear tracking code" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#789181] transition hover:bg-[#EAF5EC] hover:text-[#123D2A]">
                  <X className="size-4" />
                </button>
              ) : (
                <button type="button" onClick={handlePaste} aria-label="Paste tracking code" className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold text-[#1F6B43] transition hover:bg-[#EAF5EC]">
                  <ClipboardPaste className="size-4" /> Paste
                </button>
              )}
            </div>
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="h-12 px-8 text-base font-semibold sm:min-w-[120px]"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Searching...
              </span>
            ) : (
              "Track"
            )}
          </Button>
          </div>
          <p className="mt-2 text-center text-xs text-[#789181]">Example format: REQ-1789962454768-0GW8V</p>
        </form>
      </div>

      {!hasSearched && !result && (
        <div className="mx-auto mt-5 grid w-full max-w-6xl gap-4 md:grid-cols-2">
          <div style={{ height: 520, maxHeight: 520 }} className="box-border rounded-xl border border-[#D7E5D8] bg-white p-5 pb-8 shadow-sm overflow-hidden">
            <div className="mb-5 border-b border-[#E2ECE2] pb-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#527765]">Enter your tracking code</p>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5E8972]" />
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="REQ-1789962454768-0GW8V" aria-label="Tracking code" className="h-10 w-full pl-9 text-sm uppercase placeholder:text-[#527765] placeholder:opacity-100" disabled={isLoading} />
                </div>
                <Button type="submit" disabled={isLoading} className="h-10 px-5">Track</Button>
              </form>
            </div>
            <div className="mb-5 flex items-center justify-between border-b border-[#E2ECE2] pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#789181]">Request details</p>
                <h2 className="mt-1 text-lg font-bold text-[#123D2A]">Your inquiry details will appear here</h2>
              </div>
              <div className="rounded-lg bg-[#EAF5EC] px-3 py-2 text-xs font-bold text-[#527765]">Waiting for code</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {["Subject", "Category", "Name", "Submitted"].map((label) => (
                <div key={label} className="rounded-lg bg-[#F7F8F3] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#789181]">{label}</p>
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded-full bg-[#DCE9DD]" />
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-[#E2ECE2] pt-4">
              <p className="text-sm font-bold text-[#123D2A]">Send a Reply</p>
              <div className="mt-2 h-16 rounded-lg border border-dashed border-[#C7DCCB] bg-[#FBFCF9]" />
            </div>
          </div>
          <div style={{ height: 520, maxHeight: 520 }} className="box-border rounded-xl border border-[#D7E5D8] bg-white p-5 pb-8 shadow-sm overflow-hidden">
            <p className="text-xs font-bold uppercase tracking-wider text-[#789181]">Conversation thread</p>
            <h2 className="mt-1 text-lg font-bold text-[#123D2A]">Latest updates will appear here</h2>
            <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-[#C7DCCB] bg-[#F7F8F3] px-5 py-10 text-center">
              <MessageSquare className="size-8 text-[#7DA58A]" />
              <p className="mt-3 text-sm font-semibold text-[#365F4A]">Enter a tracking code to view the thread</p>
              <p className="mt-1 text-xs text-[#789181]">Replies and status updates will appear in chronological order.</p>
            </div>
          </div>
        </div>
      )}

      {hasSearched && !isLoading && !result && (
        <div className="mx-auto mt-10 max-w-2xl rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-800">
          <AlertCircle className="mx-auto mb-2 size-8 text-red-500" />
          <h3 className="text-lg font-bold">Request Not Found</h3>
          <p className="mt-1 text-sm">
            We couldn't find any inquiry matching that code. Please verify the code and try again.
          </p>
        </div>
      )}

      {result && (
        <div className="mx-auto mt-4 w-full max-w-6xl grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
          <div style={{ height: 520, maxHeight: 520 }} className="box-border flex flex-col rounded-xl border border-[#CAD8CB] bg-white pb-8 shadow-sm overflow-hidden">
            <div className="border-b border-[#CAD8CB] bg-[#F7F8F3] p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#527765]">Enter your tracking code</p>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5E8972]" />
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="REQ-1789962454768-0GW8V" aria-label="Tracking code" className="h-10 w-full pl-9 pr-3 text-sm uppercase placeholder:text-[#527765] placeholder:opacity-100" disabled={isLoading} />
                </div>
                <Button type="submit" disabled={isLoading} className="h-10 px-5">Track</Button>
              </form>
            </div>
            <div className="border-b border-[#CAD8CB] bg-[#F7F8F3] px-4 py-3 shrink-0">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1F6B43]">Tracking Code</p>
                  <p className="text-xl font-black text-[#123D2A]">{result.request.referenceCode}</p>
                </div>
                <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold ${getStatusColor(result.request.requestStatus)}`}>
                  {getStatusIcon(result.request.requestStatus)}
                  {result.request.requestStatus}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 pb-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-black/50">
                    Subject
                  </h3>
                  <p className="font-medium text-[#123D2A]">{result.request.subject || "No subject provided"}</p>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-black/50">
                    Category
                  </h3>
                  <p className="font-medium text-[#123D2A]">{result.request.requestType}</p>
                </div>
                {result.request.requesterName && (
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-black/50">
                      Name
                    </h3>
                    <p className="font-medium text-[#123D2A]">{result.request.requesterName}</p>
                  </div>
                )}
                {result.request.requesterEmail && (
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-black/50">
                      Email
                    </h3>
                    <p className="font-medium text-[#123D2A]">{result.request.requesterEmail}</p>
                  </div>
                )}
                {result.request.requesterPhone && (
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-black/50">
                      Phone
                    </h3>
                    <p className="font-medium text-[#123D2A]">{result.request.requesterPhone}</p>
                  </div>
                )}
                {result.request.requesterBarangay && (
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-black/50">
                      Barangay
                    </h3>
                    <p className="font-medium text-[#123D2A]">{result.request.requesterBarangay}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-[#CAD8CB]/50 pt-4">
                <form onSubmit={handleReply}>
                  <p className="mb-2 text-sm font-bold text-[#123D2A]">Send a Reply</p>
                  <textarea
                    className="w-full rounded-md border border-[#CAD8CB] p-3 text-sm outline-none transition focus:border-[#1F6B43] custom-scrollbar"
                    rows={1}
                    placeholder="Type your reply to the admin here..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={isSubmittingReply}
                  />
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setIsCancelConfirmOpen(true)} disabled={isCancelling || isSubmittingReply} className="h-10 flex-1 rounded-md border border-[#D64545] bg-[#D64545] px-4 text-sm font-bold text-white transition hover:bg-[#B93636] disabled:opacity-60">
                      {isCancelling ? "Cancelling..." : "Cancel Inquiry"}
                    </button>
                    <Button type="submit" disabled={isSubmittingReply || !replyText.trim()} className="h-10 flex-1">
                      {isSubmittingReply ? "Sending..." : "Send Reply"}
                    </Button>
                  </div>
                </form>
              </div>

            </div>
          </div>

          <div className="relative flex h-full flex-col">
            <div style={{ height: 520, maxHeight: 520 }} className="box-border flex h-full flex-col rounded-xl border border-[#CAD8CB] bg-white pb-8 shadow-sm overflow-hidden">
              <div className="border-b border-[#CAD8CB] bg-[#F7F8F3] px-4 py-3 shrink-0">
                <h2 className="text-lg font-bold text-[#123D2A]">Timeline & Updates</h2>
              </div>
            <div ref={timelineRef} className="max-h-[520px] overflow-y-auto p-4 pb-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="grid gap-4 relative pr-2">
                {/* Timeline Line */}
                <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-[#CAD8CB]" />
                
                <div className="relative pl-10"><div className="absolute left-2 top-1.5 size-3.5 rounded-full border-2 border-white shadow-sm bg-slate-400" /><div className="rounded-lg border p-4 text-sm leading-relaxed bg-white border-slate-200 text-slate-800"><div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100"><span className="font-bold text-[#123D2A]">You (Submitted Inquiry)</span><span className="text-xs opacity-75">{format(new Date(result.request.submittedAt), "MMM d, h:mm a")}</span></div>{result.request.subject && <strong className="block mb-2">{result.request.subject}</strong>}<div className="whitespace-pre-wrap">{result.request.message}</div></div></div>

                {result.history.slice().sort((a: any, b: any) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()).map((item: any, index: number) => {
                  const isPublicReply = !item.changedBy; // NULL changed_by = public user reply
                  const isStatusChange = item.newStatus !== item.oldStatus;
                  
                  let senderLabel = "";
                  if (isPublicReply) {
                    senderLabel = "You (Public Reply)";
                  } else if (isStatusChange) {
                    senderLabel = `Status changed to ${item.newStatus}`;
                  } else {
                    // Never expose internal staff account names on the public tracker.
                    senderLabel = "Chairman";
                  }

                  return (
                    <div key={item.id} className="relative pl-10">
                      {/* Timeline Dot */}
                      <div className={`absolute left-2 top-1.5 size-3.5 rounded-full border-2 border-white shadow-sm ${isPublicReply ? 'bg-blue-400' : !item.userVisibleMessage ? 'bg-slate-400' : 'bg-[#1F6B43]'}`} />
                      
                      <div className={`rounded-lg border p-4 text-sm leading-relaxed ${isPublicReply ? 'bg-blue-50 border-blue-200 text-blue-900' : !item.userVisibleMessage ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#E7F2E4] border-[#CAD8CB] text-[#1F6B43]'}`}>
                        <div className={`flex items-center justify-between mb-2 pb-2 border-b ${isPublicReply ? 'border-blue-100' : !item.userVisibleMessage ? 'border-slate-100' : 'border-[#CAD8CB]/50'}`}>
                          <span className="font-bold text-[#123D2A]">
                            {senderLabel}
                          </span>
                          <span className="text-xs opacity-75">
                            {format(new Date(item.changedAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                        {item.userVisibleMessage && (
                          <div className="whitespace-pre-wrap">{item.userVisibleMessage}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                  
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {isCancelConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#123D2A]/45 px-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-[#D7E5D8] bg-white p-6 shadow-[0_24px_70px_rgba(18,61,42,0.25)]">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[#FDE7E4] text-[#D64545]"><AlertCircle className="size-6" /></div>
            <h2 className="text-xl font-black text-[#123D2A]">Cancel this inquiry?</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5E7467]">A cancellation request will be sent to the Chairman for review.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setIsCancelConfirmOpen(false)} className="h-11 flex-1 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#365F4A] hover:bg-[#F4F8F3]">Keep Inquiry</button>
              <button type="button" onClick={handleCancelInquiry} className="h-11 flex-1 rounded-md bg-[#D64545] px-4 text-sm font-bold text-white hover:bg-[#B93636]">Confirm Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <div className="min-h-screen bg-[#EEF2EC]">
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center">
          <span className="flex items-center gap-2 text-[#1F6B43]">
            <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading...
          </span>
        </div>
      }>
        <TrackContent />
      </Suspense>
    </div>
  );
}
