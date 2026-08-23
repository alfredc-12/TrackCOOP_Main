"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Inbox,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  RefreshCcw,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
  FormDialog,
} from "@/components/portal/PortalPrimitives";
import { Button } from "@/components/ui/Button";
import { ApiClientError } from "@/lib/api-client";
import {
  listRequests,
  getRequestDetail,
  updateRequestStatus,
} from "@/features/communication/communication-api";
import type {
  ListRequestsQuery,
  RequestRecord,
  RequestStatus,
} from "@/features/communication/communication-types";

const defaultQuery: ListRequestsQuery = {
  page: 1,
  pageSize: 5,
  sortBy: "submittedAt",
  sortDirection: "desc",
  status: "All",
  requestType: "All",
};

function getStatusTone(status: RequestStatus) {
  if (status === "Resolved" || status === "Closed") return "success";
  if (status === "Assigned" || status === "In Progress" || status === "Under Review") return "warning";
  if (status === "Rejected" || status === "Cancelled") return "danger";
  return "neutral";
}

export function RequestsClient() {
  const [query, setQuery] = useState<ListRequestsQuery>(defaultQuery);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RequestRecord | null>(null);
  const [selectedRequestHistory, setSelectedRequestHistory] = useState<any[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'thread'>('view');
  const [isMutating, setIsMutating] = useState(false);
  
  const [replyText, setReplyText] = useState("");
  const [newStatus, setNewStatus] = useState<RequestStatus | "">("");

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await listRequests(query);
      setRequests(result.items);
      setTotal(result.total);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Failed to load requests and inquiries."
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
      setNewStatus(detail.request.requestStatus);
      setReplyText("");
      
      // Optimistically mark as read locally
      setRequests(prev => prev.map(r => r.id === id ? { ...r, isReadByAdmin: true } : r));
    } catch (caught) {
      toast.error("Failed to load request details.");
      setSelectedId(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRequest || !newStatus) return;
    setIsMutating(true);
    try {
      await updateRequestStatus(selectedRequest.id, {
        requestStatus: newStatus as RequestStatus,
        publicResponse: replyText || undefined,
      });
      toast.success("Request updated successfully.");
      void fetchRequests();
      setSelectedId(null);
      setSelectedRequest(null);
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError ? caught.message : "Failed to update request."
      );
    } finally {
      setIsMutating(false);
    }
  };

  // Derive simple metrics from the current page of results for the summary cards
  const metrics = useMemo(() => {
    return {
      submitted: requests.filter((r) => r.requestStatus === "Submitted").length,
      underReview: requests.filter((r) => r.requestStatus === "Under Review").length,
      inProgress: requests.filter((r) => r.requestStatus === "In Progress").length,
      resolved: requests.filter((r) => r.requestStatus === "Resolved").length,
      unread: requests.filter((r) => !r.isReadByAdmin).length,
    };
  }, [requests]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Communication"
        title="Requests and Inquiries"
        description="Member and public requests with assignment, response, and status history."
        actions={
          <Button
            type="button"
            onClick={() => void fetchRequests()}
            className="h-11 border border-[#CAD8CB] bg-white px-4 text-[#123D2A] hover:bg-[#EEF2EC]"
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-5">
        <StatCard label="Unread" value={String(metrics.unread)} icon={AlertCircle} className={metrics.unread > 0 ? "border-red-400 bg-red-50 text-red-700" : ""} />
        <StatCard label="Submitted" value={String(metrics.submitted)} icon={AlertCircle} />
        <StatCard label="Under Review" value={String(metrics.underReview)} icon={Clock} />
        <StatCard label="In Progress" value={String(metrics.inProgress)} icon={Clock} />
        <StatCard label="Resolved" value={String(metrics.resolved)} icon={CheckCircle2} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
          <input
            className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
            placeholder="Search by reference code or name..."
            type="search"
            value={query.search || ""}
            onChange={(e) => setQuery({ ...query, search: e.target.value, page: 1 })}
          />
        </label>
        <div className="flex gap-2">
          <select
            className="h-11 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-semibold text-[#294B39] outline-none"
            value={query.status || "All"}
            onChange={(e) => setQuery({ ...query, status: e.target.value, page: 1 })}
          >
            <option value="All">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}
      
      {isLoading ? (
        <LoadingSkeleton />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No requests found"
          description="There are currently no requests or inquiries matching your filters."
        />
      ) : (
        <DataTable>
          <table className="w-full text-left text-sm text-[#294B39]">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-wider text-[#6C7A70]">
              <tr>
                <th className="px-6 py-4 font-bold">Reference</th>
                <th className="px-6 py-4 font-bold">Sender</th>
                <th className="px-6 py-4 font-bold">Category</th>
                <th className="px-6 py-4 font-bold">Date</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC]">
              {requests.map((req) => (
                <tr key={req.id} className="transition hover:bg-[#F7F8F3]">
                  <td className="px-6 py-4 font-medium">{req.referenceCode}</td>
                  <td className="px-6 py-4">
                    <p className="font-bold">{req.requesterName}</p>
                    <p className="text-xs text-[#6C7A70]">{req.requestSource}</p>
                  </td>
                  <td className="px-6 py-4">{req.requestType}</td>
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
                      {!req.isReadByAdmin && (
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
                    <p className="text-xs font-semibold text-[#6C7A70] uppercase tracking-wider">Sender Name</p>
                    <p className="mt-1 font-medium">{selectedRequest.requesterName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#6C7A70] uppercase tracking-wider">Contact Info</p>
                    <p className="mt-1 font-medium">{selectedRequest.requesterEmail || selectedRequest.requesterPhone || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#6C7A70] uppercase tracking-wider">Category</p>
                    <p className="mt-1 font-medium">{selectedRequest.requestType}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#6C7A70] uppercase tracking-wider flex items-center gap-2">
                      Update Status
                      <span className="inline-block scale-75 origin-left">
                        <StatusBadge tone={getStatusTone(selectedRequest.requestStatus)}>
                          Current: {selectedRequest.requestStatus}
                        </StatusBadge>
                      </span>
                    </p>
                    <select 
                      className="mt-1 h-9 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm outline-none w-full focus:border-[#1F6B43]"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as RequestStatus)}
                      disabled={isMutating}
                    >
                      <option value="Submitted">Submitted</option>
                      <option value="Under Review">Under Review</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-[#123D2A] mb-2 border-b border-[#CAD8CB] pb-2">Original Message</p>
                  <div className="bg-white rounded-lg border border-[#CAD8CB] p-4 text-sm leading-relaxed whitespace-pre-wrap text-[#294B39] max-h-[200px] overflow-y-auto custom-scrollbar">
                    {selectedRequest.subject && <strong className="block mb-2">{selectedRequest.subject}</strong>}
                    {selectedRequest.message}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-white border border-[#CAD8CB] rounded-lg p-4">
                  <p className="text-sm font-bold text-[#123D2A] mb-4 border-b border-[#CAD8CB] pb-2">Conversation Thread</p>
                  <div className="grid gap-4 relative max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Timeline Line */}
                    <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-[#CAD8CB]" />
                    
                    {selectedRequestHistory
                      .filter(h => h.userVisibleMessage)
                      .map((historyItem, idx) => {
                        // NULL changedBy = public user reply, changedBy = staff/member reply
                        const isPublicReply = !historyItem.changedBy;
                        const isAdminReply = !isPublicReply;

                        let senderLabel = "";
                        if (isPublicReply) {
                          senderLabel = selectedRequest.requesterName || "Public User";
                        } else {
                          senderLabel = historyItem.changedByName || "Admin";
                        }

                        return (
                          <div key={historyItem.id || idx} className="relative pl-10">
                            {/* Timeline Dot */}
                            <div className={`absolute left-2 top-1.5 size-3.5 rounded-full border-2 border-white shadow-sm ${isAdminReply ? 'bg-[#1F6B43]' : 'bg-blue-400'}`} />
                            
                            <div className={`rounded-lg border p-4 text-sm leading-relaxed ${isAdminReply ? 'bg-[#E7F2E4] border-[#CAD8CB] text-[#1F6B43]' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
                              <div className={`flex items-center justify-between mb-2 pb-2 border-b ${isAdminReply ? 'border-[#CAD8CB]/50' : 'border-blue-100'}`}>
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
                      <div className="absolute left-2 top-1.5 size-3.5 rounded-full border-2 border-white shadow-sm bg-[#123D2A]" />
                      <div className="rounded-lg border p-4 text-sm leading-relaxed bg-white border-[#E5E7EB] text-[#294B39]">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E5E7EB]">
                          <span className="font-bold">
                            {selectedRequest.requesterName || "Public Inquiry"}
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
                    className="w-full rounded-md border border-[#CAD8CB] p-2.5 text-sm outline-none focus:border-[#1F6B43] custom-scrollbar"
                    rows={2}
                    placeholder="Type a reply here..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={isMutating}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[#CAD8CB]/50">
              <Button variant="secondary" onClick={() => setSelectedId(null)}>
                Close
              </Button>
              <Button onClick={handleUpdate} disabled={isMutating}>
                {isMutating ? "Updating..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </FormDialog>
    </div>
  );
}
