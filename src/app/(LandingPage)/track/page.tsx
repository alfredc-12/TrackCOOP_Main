"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { MapPin, Calendar, Clock, RefreshCw, AlertCircle, CheckCircle2, MessageSquare, Clock3, ArrowLeft } from "lucide-react";
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
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 min-h-screen flex flex-col justify-center">
      <div className="mb-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#365F4A] hover:text-[#1F6B43] transition">
          <ArrowLeft className="size-4" />
          Back to Home
        </Link>
      </div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#123D2A] sm:text-3xl">
          Track Your Inquiry
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-[#294B39]">
          Enter your reference code below to check the current status and latest updates on your request.
        </p>
      </div>

      <div className="mx-auto max-w-2xl">
        <form onSubmit={handleSearch} className="mx-auto flex w-full max-w-lg flex-col gap-4 sm:flex-row items-center justify-center">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ENTER TRACKING CODE"
            className="h-12 w-full sm:w-[320px] text-center text-lg uppercase bg-white border-[#CAD8CB] focus-visible:ring-[#82E6A7]"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="h-12 px-8 text-base font-semibold"
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
        </form>
      </div>

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
        <div className="mx-auto mt-4 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 rounded-xl border border-[#CAD8CB] bg-white shadow-sm flex flex-col">
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

            <div className="px-4 py-4">
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
                    rows={2}
                    placeholder="Type your reply to the admin here..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={isSubmittingReply}
                  />
                  <div className="mt-3 flex justify-end">
                    <Button type="submit" disabled={isSubmittingReply || !replyText.trim()}>
                      {isSubmittingReply ? "Sending..." : "Send Reply"}
                    </Button>
                  </div>
                </form>
              </div>

            </div>
          </div>

          <div className="lg:col-span-2 relative h-[500px] lg:h-auto">
            <div className="lg:absolute lg:inset-0 w-full h-full rounded-xl border border-[#CAD8CB] bg-white shadow-sm flex flex-col">
              <div className="border-b border-[#CAD8CB] bg-[#F7F8F3] px-4 py-3 shrink-0">
                <h2 className="text-lg font-bold text-[#123D2A]">Timeline & Updates</h2>
              </div>
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid gap-4 relative pr-2">
                {/* Timeline Line */}
                <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-[#CAD8CB]" />
                
                {result.history.map((item: any, index: number) => {
                  const isPublicReply = !item.changedBy; // NULL changed_by = public user reply
                  const isStatusChange = item.newStatus !== item.oldStatus;
                  
                  let senderLabel = "";
                  if (isPublicReply) {
                    senderLabel = "You (Public Reply)";
                  } else if (isStatusChange) {
                    senderLabel = `Status changed to ${item.newStatus}`;
                  } else {
                    senderLabel = item.changedByName || "Admin";
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
                  
                {/* Initial Message */}
                <div className="relative pl-10">
                  {/* Timeline Dot */}
                  <div className="absolute left-2 top-1.5 size-3.5 rounded-full border-2 border-white shadow-sm bg-slate-400" />
                  
                  <div className="rounded-lg border p-4 text-sm leading-relaxed bg-white border-slate-200 text-slate-800">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                      <span className="font-bold text-[#123D2A]">
                        You (Submitted Inquiry)
                      </span>
                      <span className="text-xs opacity-75">
                        {format(new Date(result.request.submittedAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
