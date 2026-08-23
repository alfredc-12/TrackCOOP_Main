"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Inbox, Plus, RefreshCcw, Send, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusBadge,
  FormDialog,
} from "@/components/portal/PortalPrimitives";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiClientError } from "@/lib/api-client";
import {
  listRequests,
  createAuthenticatedRequest,
  getRequestDetail,
  addRequestReply,
} from "@/features/communication/communication-api";
import type {
  ListRequestsQuery,
  RequestRecord,
  RequestStatus,
  RequestType,
} from "@/features/communication/communication-types";

const defaultQuery: ListRequestsQuery = {
  page: 1,
  pageSize: 5,
  sortBy: "submittedAt",
  sortDirection: "desc",
};

const REQUEST_CATEGORIES: RequestType[] = [
  "Membership",
  "Payment",
  "Share Capital",
  "Rental",
  "Product/POS",
  "Document",
  "General",
];

function getStatusTone(status: RequestStatus) {
  if (status === "Resolved" || status === "Closed") return "success";
  if (status === "Assigned" || status === "In Progress" || status === "Under Review") return "warning";
  if (status === "Rejected" || status === "Cancelled") return "danger";
  return "neutral";
}

export function MemberRequestsClient() {
  const [query, setQuery] = useState<ListRequestsQuery>(defaultQuery);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'thread'>('view');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    requestType: "General" as RequestType,
    subject: "",
    message: "",
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedRequestHistory, setSelectedRequestHistory] = useState<any[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [memberReply, setMemberReply] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      // NOTE: For a real app, the backend should filter by the logged-in member.
      // Assuming listRequests endpoint naturally scopes to the user if they are a 'member'.
      const result = await listRequests(query);
      setRequests(result.items);
      setTotal(result.total);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Failed to load your requests."
      );
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setIsDetailLoading(true);
    try {
      const detail = await getRequestDetail(id);
      setSelectedRequest(detail.request);
      setSelectedRequestHistory(detail.history || []);

      // Optimistically mark as read locally
      setRequests(prev => prev.map(r => r.id === id ? { ...r, isReadByMember: true } : r));
    } catch (caught) {
      toast.error("Failed to load request details.");
      setSelectedId(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedId || !memberReply.trim()) return;
    setIsSendingReply(true);
    try {
      const detail = await addRequestReply(selectedId, memberReply);
      setSelectedRequest(detail.request);
      setSelectedRequestHistory(detail.history || []);
      setMemberReply("");
      toast.success("Reply sent successfully.");
    } catch (error) {
      toast.error("Failed to send reply. Please try again.");
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.subject.trim()) {
      newErrors.subject = "Subject is required.";
    }

    if (!formData.message.trim()) {
      newErrors.message = "Message is required.";
    } else if (formData.message.trim().length < 10) {
      newErrors.message = "Message must be at least 10 characters long.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    setIsSubmitting(true);
    try {
      await createAuthenticatedRequest({
        requestType: formData.requestType,
        subject: formData.subject || undefined,
        message: formData.message,
      });

      toast.success("Request submitted successfully!");
      setIsFormOpen(false);
      setFormData({ requestType: "General", subject: "", message: "" });
      setErrors({});
      void fetchRequests();
    } catch (caught) {
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Services"
        title="My Requests"
        description="Submit inquiries, track statuses, and communicate with the administration."
        actions={
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void fetchRequests()}
              className="h-11"
            >
              <RefreshCcw className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="h-11"
            >
              <Plus className="mr-2 size-4" aria-hidden="true" />
              New Request
            </Button>
          </div>
        }
      />

      {error ? <ErrorState message={error} /> : null}
      
      {isLoading ? (
        <LoadingSkeleton />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No requests found"
          description="You haven't submitted any requests or inquiries yet."
        />
      ) : (
        <DataTable>
          <table className="w-full text-left text-sm text-[#294B39]">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-wider text-[#6C7A70]">
              <tr>
                <th className="px-6 py-4 font-bold">Reference</th>
                <th className="px-6 py-4 font-bold">Category</th>
                <th className="px-6 py-4 font-bold">Subject</th>
                <th className="px-6 py-4 font-bold">Date Submitted</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC]">
              {requests.map((req) => (
                <tr key={req.id} className="transition hover:bg-[#F7F8F3]">
                  <td className="px-6 py-4 font-medium">{req.referenceCode}</td>
                  <td className="px-6 py-4">{req.requestType}</td>
                  <td className="px-6 py-4 font-medium">{req.subject || "N/A"}</td>
                  <td className="px-6 py-4">
                    {new Date(req.submittedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge tone={getStatusTone(req.requestStatus)}>
                      {req.requestStatus}
                    </StatusBadge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="relative"
                      onClick={() => { setModalMode('view'); openDetail(req.id); }}
                    >
                      {!req.isReadByMember && (
                        <span className="absolute -top-1 -right-1 flex size-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full size-2.5 bg-red-500 border border-white"></span>
                        </span>
                      )}
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}

      {!isLoading && requests.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <button
              className="grid size-9 place-items-center rounded-md border border-[#CAD8CB] bg-white text-[#6C7A70] transition hover:bg-[#F7F8F3] disabled:opacity-50 disabled:pointer-events-none shadow-sm"
              disabled={query.page === 1}
              onClick={() => setQuery(prev => ({ ...prev, page: 1 }))}
              title="First Page"
            >
              <ChevronsLeft className="size-4" />
            </button>
            <button
              className="grid size-9 place-items-center rounded-md border border-[#CAD8CB] bg-white text-[#6C7A70] transition hover:bg-[#F7F8F3] disabled:opacity-50 disabled:pointer-events-none shadow-sm"
              disabled={query.page === 1}
              onClick={() => setQuery(prev => ({ ...prev, page: prev.page - 1 }))}
              title="Previous Page"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>
          
          <div className="text-sm font-bold text-[#123D2A] flex items-center gap-2">
            <span>Page {query.page} of {Math.ceil(total / query.pageSize) || 1}</span>
            <span className="text-[#CAD8CB]">•</span>
            <span>{total} requests</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="grid size-9 place-items-center rounded-md border border-[#CAD8CB] bg-white text-[#6C7A70] transition hover:bg-[#F7F8F3] disabled:opacity-50 disabled:pointer-events-none shadow-sm"
              disabled={query.page * query.pageSize >= total}
              onClick={() => setQuery(prev => ({ ...prev, page: prev.page + 1 }))}
              title="Next Page"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              className="grid size-9 place-items-center rounded-md border border-[#CAD8CB] bg-white text-[#6C7A70] transition hover:bg-[#F7F8F3] disabled:opacity-50 disabled:pointer-events-none shadow-sm"
              disabled={query.page * query.pageSize >= total}
              onClick={() => setQuery(prev => ({ ...prev, page: Math.ceil(total / query.pageSize) }))}
              title="Last Page"
            >
              <ChevronsRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      <FormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title="Submit a New Request"
        description="Fill out the form below to submit a new inquiry or request to the administration."
        contentClassName="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="grid gap-6 mt-4">
          <div className="grid gap-2">
            <label htmlFor="requestType" className="text-sm font-bold text-[#123D2A]">
              Category
            </label>
            <select
              id="requestType"
              value={formData.requestType}
              onChange={(e) => setFormData({ ...formData, requestType: e.target.value as RequestType })}
              disabled={isSubmitting}
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-sm outline-none transition focus:border-[#1F6B43]"
            >
              {REQUEST_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-2 relative">
            <label htmlFor="subject" className="text-sm font-bold text-[#123D2A] flex items-center gap-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => {
                setFormData({ ...formData, subject: e.target.value });
                if (errors.subject) setErrors({ ...errors, subject: "" });
              }}
              placeholder="E.g. Follow up on my Share Capital"
              disabled={isSubmitting}
              className={`h-11 bg-[#F7F8F3] ${errors.subject ? 'border-red-500 focus-visible:ring-red-500/20' : ''}`}
            />
            {errors.subject && (
              <span className="text-xs font-semibold text-red-500 absolute -bottom-5 left-0">{errors.subject}</span>
            )}
          </div>

          <div className="grid gap-2 relative">
            <label htmlFor="message" className="text-sm font-bold text-[#123D2A] flex items-center gap-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              value={formData.message}
              onChange={(e) => {
                setFormData({ ...formData, message: e.target.value });
                if (errors.message) setErrors({ ...errors, message: "" });
              }}
              rows={5}
              placeholder="Please describe your request in detail..."
              disabled={isSubmitting}
              className={`w-full rounded-md border ${errors.message ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' : 'border-[#CAD8CB] focus:border-[#1F6B43]'} bg-[#F7F8F3] p-3 text-sm outline-none transition`}
            />
            {errors.message && (
              <span className="text-xs font-semibold text-red-500 absolute -bottom-5 left-0">{errors.message}</span>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : <><Send className="mr-2 size-4" /> Submit Request</>}
            </Button>
          </div>
        </form>
      </FormDialog>

      <FormDialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setSelectedRequest(null);
            setSelectedRequestHistory([]);
          }
        }}
        title={`Request Details - ${selectedRequest?.referenceCode ?? ""}`}
        contentClassName="max-w-2xl w-full"
      >
        {isDetailLoading || !selectedRequest ? (
          <div className="py-12 flex justify-center text-[#6C7A70]">Loading details...</div>
        ) : (
          <div className="grid gap-6 py-4">
            <div className="flex border-b border-[#CAD8CB] mb-2">
              <button 
                type="button"
                className={`px-4 py-2 text-sm font-bold transition border-b-2 ${modalMode === 'view' ? 'border-[#123D2A] text-[#123D2A]' : 'border-transparent text-[#6C7A70] hover:text-[#123D2A]'}`}
                onClick={() => setModalMode('view')}
              >
                Request Details
              </button>
              <button 
                type="button"
                className={`px-4 py-2 text-sm font-bold transition border-b-2 ${modalMode === 'thread' ? 'border-[#123D2A] text-[#123D2A]' : 'border-transparent text-[#6C7A70] hover:text-[#123D2A]'}`}
                onClick={() => setModalMode('thread')}
              >
                Conversation Thread
              </button>
            </div>

            {modalMode === 'view' ? (
              <>
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-[#F7F8F3] p-4">
                  <div>
                    <p className="text-xs font-semibold text-[#6C7A70] uppercase tracking-wider">Category</p>
                    <p className="mt-1 font-medium">{selectedRequest.requestType}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#6C7A70] uppercase tracking-wider">Current Status</p>
                    <p className="mt-1 font-medium">
                      <StatusBadge tone={getStatusTone(selectedRequest.requestStatus)}>
                        {selectedRequest.requestStatus}
                      </StatusBadge>
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-[#123D2A] mb-2 border-b border-[#CAD8CB] pb-2">Your Message</p>
                  <div className="bg-white rounded-lg border border-[#CAD8CB] p-4 text-sm leading-relaxed whitespace-pre-wrap text-[#294B39] max-h-[200px] overflow-y-auto custom-scrollbar">
                    {selectedRequest.subject && <strong className="block mb-2">{selectedRequest.subject}</strong>}
                    {selectedRequest.message}
                  </div>
                </div>
              </>
            ) : (
              <>
            <div>
              <p className="text-sm font-bold text-[#123D2A] mb-4 border-b border-[#CAD8CB] pb-2">Conversation</p>
              <div className="grid gap-4 relative max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                {/* Timeline Line */}
                <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-[#CAD8CB]" />
                
                {selectedRequestHistory
                  .filter(h => h.userVisibleMessage)
                  .map((historyItem, idx) => {
                    const isStaffReply = Boolean(historyItem.changedBy);
                    const isOwnReply = !isStaffReply;

                    let senderLabel = isStaffReply ? (historyItem.changedByName || "Admin") : "You";

                    return (
                      <div key={historyItem.id || idx} className="relative pl-10">
                        {/* Timeline Dot */}
                        <div className={`absolute left-2 top-1.5 size-3.5 rounded-full border-2 border-white shadow-sm ${isStaffReply ? 'bg-[#1F6B43]' : 'bg-slate-400'}`} />
                        
                        <div className={`rounded-lg border p-4 text-sm leading-relaxed ${isStaffReply ? 'bg-[#E7F2E4] border-[#CAD8CB] text-[#1F6B43]' : 'bg-white border-slate-200 text-slate-800'}`}>
                          <div className={`flex items-center justify-between mb-2 pb-2 border-b ${isStaffReply ? 'border-[#CAD8CB]/50' : 'border-slate-100'}`}>
                            <span className="font-bold">
                              {senderLabel}
                            </span>
                            <span className="text-xs opacity-75">
                              {new Date(historyItem.changedAt).toLocaleString("en-PH", {
                                timeZone: "Asia/Manila",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="whitespace-pre-wrap">{historyItem.userVisibleMessage}</div>
                        </div>
                      </div>
                    );
                  })}

                {/* Original Message (Oldest, at bottom) */}
                <div className="relative pl-10">
                  <div className="absolute left-2 top-1.5 size-3.5 rounded-full border-2 border-white shadow-sm bg-slate-400" />
                  <div className="rounded-lg border p-4 text-sm leading-relaxed bg-white border-slate-200 text-slate-800">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                      <span className="font-bold text-[#123D2A]">
                        You
                      </span>
                      <span className="text-xs opacity-75">
                        {new Date(selectedRequest.submittedAt).toLocaleString("en-PH", {
                          timeZone: "Asia/Manila",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {selectedRequest.subject && <strong className="block mb-2">{selectedRequest.subject}</strong>}
                    <div className="whitespace-pre-wrap">{selectedRequest.message}</div>
                  </div>
                </div>
              </div>
            </div>
                <div className="mt-2">
                  <textarea
                    className="w-full rounded-md border border-[#CAD8CB] p-2.5 text-sm outline-none transition focus:border-[#1F6B43] custom-scrollbar"
                    rows={2}
                    placeholder="Type a reply here..."
                    value={memberReply}
                    onChange={(e) => setMemberReply(e.target.value)}
                    disabled={isSendingReply}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[#CAD8CB]/50">
              <Button variant="secondary" onClick={() => setSelectedId(null)}>
                Close
              </Button>
              {modalMode === 'thread' && (
                <Button onClick={handleSendReply} disabled={isSendingReply || !memberReply.trim()}>
                  {isSendingReply ? "Sending..." : "Send Reply"}
                </Button>
              )}
            </div>
          </div>
        )}
      </FormDialog>
    </div>
  );
}
