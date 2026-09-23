"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ChevronDown,
} from "lucide-react";
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
  updateRequestStatus,
  addRequestReply,
  getRequestDetail,
} from "@/features/communication/communication-api";
import { getAuthenticatedUser } from "@/lib/auth-client";
import type { AuthUser } from "@/features/auth/types";
import type {
  ListRequestsQuery,
  RequestRecord,
  RequestStatus,
} from "@/features/communication/communication-types";
import { requestTypes, requestPriorities } from "@/features/communication/communication-types";

const defaultQuery: ListRequestsQuery = {
  page: 1,
  pageSize: 5,
  sortBy: "submittedAt",
  sortDirection: "desc",
  status: "All",
  requestType: "All",
  priority: "All",
};

function RequestThemedSelect({ value, onChange, options, ariaLabel, prefix }: { value: string; onChange: (value: string) => void; options: string[]; ariaLabel: string; prefix?: string }) {
  const [open, setOpen] = useState(false);
  const selected = value || "All";
  return <div className="relative"><button type="button" onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} className="flex min-w-[160px] items-center justify-between gap-4 rounded-xl border border-[#BBD7C1] bg-[#F8FBF8] px-4 py-3 text-left text-sm font-semibold text-[#123D2A] outline-none transition hover:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"><span>{prefix ? `${prefix}: ` : ""}{selected}</span><ChevronDown className={`size-4 text-[#52705D] transition ${open ? "rotate-180" : ""}`} /></button>{open && <div role="listbox" className="absolute left-0 top-full z-[80] mt-2 min-w-full overflow-hidden rounded-xl border border-[#CDE2D1] bg-white p-1.5 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">{options.map((option) => <button type="button" role="option" aria-selected={selected === option} key={option} onClick={() => { onChange(option); setOpen(false); }} className={`flex w-full items-center justify-between whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm transition ${selected === option ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#52705D] hover:bg-[#F5F8F3] hover:text-[#123D2A]"}`}>{option}{selected === option && <span className="text-lg text-[#1F6B43]">✓</span>}</button>)}</div>}</div>;
}

function getStatusTone(status: RequestStatus) {
  if (status === "Resolved" || status === "Closed") return "success";
  if (status === "Assigned" || status === "In Progress" || status === "Under Review") return "warning";
  if (status === "Rejected" || status === "Cancelled") return "danger";
  return "neutral";
}

function getAgeLabel(date: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days waiting`;
}

function getPriorityClass(priority: string) {
  if (priority === "Urgent") return "bg-red-100 text-red-700";
  if (priority === "High") return "bg-orange-100 text-orange-700";
  if (priority === "Low") return "bg-blue-100 text-blue-700";
  return "bg-[#EEF4EF] text-[#52705D]";
}

export function RequestsClient() {
  const [query, setQuery] = useState<ListRequestsQuery>(defaultQuery);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    getAuthenticatedUser().then(setUser).catch(console.error);
  }, []);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RequestRecord | null>(null);
  const [selectedRequestHistory, setSelectedRequestHistory] = useState<any[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'thread'>('view');
  const [isMutating, setIsMutating] = useState(false);
  
  const [replyText, setReplyText] = useState("");
  const [newStatus, setNewStatus] = useState<RequestStatus | "">("");
  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!selectedId) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const scrollableElements = Array.from(document.querySelectorAll<HTMLElement>("*"))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return style.overflowY === "auto" || style.overflowY === "scroll";
      });
    const previousElementOverflow = scrollableElements.map((element) => [element, element.style.overflow] as const);
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    scrollableElements.forEach((element) => { element.style.overflow = "hidden"; });
    return () => {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overflow = "";
      html.style.overflow = "";
      previousElementOverflow.forEach(([element, overflow]) => { element.style.overflow = overflow; });
      window.scrollTo(0, scrollY);
    };
  }, [selectedId]);

  useEffect(() => {
    if (modalMode === "thread" && selectedRequestHistory.length > 0) {
      requestAnimationFrame(() => {
        const thread = threadScrollRef.current;
        if (thread) thread.scrollTop = thread.scrollHeight;
      });
    }
  }, [modalMode, selectedRequestHistory]);

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
      
      // Refresh the details instead of closing the modal
      const detail = await getRequestDetail(selectedRequest.id);
      setSelectedRequest(detail.request);
      setSelectedRequestHistory(detail.history || []);
      setReplyText("");
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
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D432D] via-[#125A3B] to-[#1F7A4D] px-6 py-7 text-white shadow-[0_16px_34px_rgba(13,67,45,0.24)] sm:px-8">
        <div className="absolute -right-12 -top-20 size-64 rounded-full border-[24px] border-[#D8F0DE]/10" />
        <div className="absolute -bottom-20 right-48 size-40 rounded-full bg-[#F6D354]/10 blur-2xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#F6D354]"><span className="h-2 w-2 rounded-full bg-[#F6D354]" /> Communication center</div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Requests & Inquiries</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Review questions from members and the public, respond clearly, and keep every conversation organized.</p></div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm"><div className="flex size-11 items-center justify-center rounded-xl bg-[#F6D354] text-[#0D432D]"><MessageSquare className="size-5" /></div><div><p className="text-xs font-semibold text-white/60">Inbox status</p><p className="font-bold">{metrics.unread ? `${metrics.unread} unread message${metrics.unread > 1 ? "s" : ""}` : "All messages reviewed"}</p></div></div>
        </div>
        <button type="button" onClick={() => void fetchRequests()} className="relative mt-6 inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"><RefreshCcw className="size-4" /> Refresh inbox</button>
      </section>

      <div className="grid gap-4 sm:grid-cols-5">
        <StatCard label="New Inquiries" value={String(metrics.submitted)} icon={Inbox} />
        <StatCard label="Unread" value={String(metrics.unread)} icon={AlertCircle} className={metrics.unread > 0 ? "border-red-400 bg-red-50 text-red-700" : ""} />
        <StatCard label="Awaiting Review" value={String(metrics.underReview)} icon={Clock} />
        <StatCard label="In Progress" value={String(metrics.inProgress)} icon={Clock} />
        <StatCard label="Resolved" value={String(metrics.resolved)} icon={CheckCircle2} />
      </div>

      {requests.length > 0 && (
        <div className="rounded-2xl border border-[#DCE9DE] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#789181]">Communication inbox</p><h2 className="mt-1 text-lg font-black text-[#123D2A]">Needs attention</h2></div><MessageSquare className="size-5 text-[#1F6B43]" /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <button type="button" onClick={() => setQuery({ ...query, status: "Submitted", page: 1 })} className="rounded-xl border border-[#E8D6A3] bg-[#FFF9E8] p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"><p className="text-xs font-bold text-[#8A6800]">New inquiries</p><p className="mt-1 text-2xl font-black text-[#123D2A]">{metrics.submitted}</p><p className="text-xs text-[#789181]">Awaiting first review</p></button>
            <button type="button" onClick={() => setQuery({ ...query, status: "All", page: 1 })} className="rounded-xl border border-red-200 bg-red-50 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"><p className="text-xs font-bold text-red-700">Unread messages</p><p className="mt-1 text-2xl font-black text-[#123D2A]">{metrics.unread}</p><p className="text-xs text-[#789181]">Open and respond promptly</p></button>
            <div className="rounded-xl border border-[#D8E5DB] bg-[#F5F8F3] p-3"><p className="text-xs font-bold text-[#52705D]">Current page</p><p className="mt-1 text-2xl font-black text-[#123D2A]">{requests.length}</p><p className="text-xs text-[#789181]">Inquiry conversations</p></div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#DCE9DE] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
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
        <div className="flex flex-wrap gap-2"><RequestThemedSelect prefix="Status" value={query.status || "All"} onChange={(value) => setQuery({ ...query, status: value, page: 1 })} ariaLabel="Filter request status" options={["All", "Submitted", "Under Review", "Assigned", "In Progress", "Resolved", "Closed", "Rejected"]} /><RequestThemedSelect prefix="Type" value={query.requestType || "All"} onChange={(value) => setQuery({ ...query, requestType: value, page: 1 })} ariaLabel="Filter request type" options={["All", ...requestTypes]} /><RequestThemedSelect prefix="Priority" value={query.priority || "All"} onChange={(value) => setQuery({ ...query, priority: value, page: 1 })} ariaLabel="Filter request priority" options={["All", ...requestPriorities]} /></div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#EEF4EF] pt-3 text-xs font-medium text-[#789181]"><span>Showing {requests.length} of {total} requests</span><button type="button" onClick={() => setQuery(defaultQuery)} className="font-bold text-[#1F6B43] hover:underline">Clear filters</button></div>
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
                <th className="px-6 py-4 font-bold">Source</th>
                <th className="px-6 py-4 font-bold">Category</th>
                <th className="px-6 py-4 font-bold">Priority</th>
                <th className="px-6 py-4 font-bold">Date</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC]">
              {requests.map((req) => (
                <tr key={req.id} className={`transition hover:-translate-y-0.5 hover:bg-[#F7F8F3] hover:shadow-sm ${!req.isReadByAdmin ? "bg-[#F5FBF6]" : ""}`}>
                  <td className="px-6 py-4 font-medium">{req.referenceCode}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${!req.isReadByAdmin ? "bg-red-500" : "bg-transparent"}`} /><div><p className={`font-bold ${!req.isReadByAdmin ? "text-[#123D2A]" : ""}`}>{req.requesterName}</p><p className="max-w-[240px] truncate text-xs text-[#789181]">{req.subject || req.message}</p></div></div>
                  </td>
                  <td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${req.requestSource === "Public Website" ? "bg-blue-100 text-blue-700" : req.requestSource === "Admin Entry" ? "bg-gray-100 text-gray-600" : "bg-[#EEF4EF] text-[#52705D]"}`}>{req.requestSource === "Public Website" ? "Public" : req.requestSource === "Admin Entry" ? "Admin" : "Member"}</span></td>
                  <td className="px-6 py-4">{req.requestType}</td>
                  <td className="px-6 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${getPriorityClass(req.priority)}`}>{req.priority}</span></td>
                  <td className="px-6 py-4"><p>{new Date(req.submittedAt).toLocaleDateString()}</p><p className="mt-1 text-[10px] font-semibold text-[#789181]">{getAgeLabel(req.submittedAt)}</p></td>
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
                      {req.isReadByAdmin ? "View details" : "Review now"}
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
        title={selectedRequest ? `${selectedRequest.referenceCode} · ${selectedRequest.requesterName || "Inquiry"}` : "Request Details"}
        contentClassName="w-[calc(100vw-2rem)] max-w-2xl max-h-[calc(100vh-1rem)] overflow-hidden sm:w-full"
      >
        {isDetailLoading || !selectedRequest ? (
          <div className="py-12 flex justify-center text-[#6C7A70]">Loading details...</div>
        ) : (
            <div className="grid gap-4 py-2">
            {selectedRequest && <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#DCE9DE] bg-[#F5F8F3] p-4"><span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${selectedRequest.requestSource === "Public Website" ? "bg-blue-100 text-blue-700" : "bg-[#EAF5EC] text-[#1F6B43]"}`}>{selectedRequest.requestSource === "Public Website" ? "Public" : "Member"}</span><span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${getPriorityClass(selectedRequest.priority)}`}>{selectedRequest.priority} priority</span><StatusBadge tone={getStatusTone(selectedRequest.requestStatus)}>{selectedRequest.requestStatus}</StatusBadge><span className="ml-auto text-xs font-semibold text-[#789181]">{getAgeLabel(selectedRequest.submittedAt)}</span></div>}
            <div className="flex border-b border-[#CAD8CB] mb-2">
              <button 
                type="button"
                className={`px-4 py-2 text-sm font-bold transition border-b-2 ${modalMode === 'view' ? 'border-[#123D2A] text-[#123D2A]' : 'border-transparent text-[#6C7A70] hover:text-[#123D2A]'}`}
                onClick={() => setModalMode('view')}
              >
                Request Details
              </button>
              <span className="mx-1 hidden h-5 w-px bg-[#CAD8CB] sm:block" />
              <span className="hidden items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#789181] sm:flex"><Clock className="size-3.5" /> {selectedRequestHistory.length} updates</span>
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
                <div className="grid gap-3 rounded-2xl border border-[#DCE9DE] bg-[#F7F8F3] p-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-[#6C7A70] uppercase tracking-wider">Sender Name</p>
                    <p className="mt-1 font-medium">{selectedRequest.requesterName}</p>
                  </div>
                  <div><p className="text-xs font-semibold uppercase tracking-wider text-[#6C7A70]">Source</p><p className="mt-1 font-medium">{selectedRequest.requestSource}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-wider text-[#6C7A70]">Submitted</p><p className="mt-1 font-medium">{new Date(selectedRequest.submittedAt).toLocaleString()}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-wider text-[#6C7A70]">Assigned to</p><p className="mt-1 font-medium">{selectedRequest.assigneeName || "Unassigned"}</p></div>
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
                    <div className="mt-1"><RequestThemedSelect value={newStatus || selectedRequest.requestStatus} onChange={(value) => setNewStatus(value as RequestStatus)} ariaLabel="Update request status" options={["Submitted", "Under Review", "Assigned", "In Progress", "Waiting for Information", "Resolved", "Closed", "Rejected", "Cancelled"]} /></div>
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
                  <p className="text-sm font-bold text-[#123D2A] mb-4 border-b border-[#CAD8CB] pb-2">Conversation Thread <span className="ml-2 text-xs font-normal text-[#789181]">Latest messages appear at the bottom</span></p>
                  <div ref={threadScrollRef} className="grid gap-4 relative max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Timeline Line */}
                    <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-[#CAD8CB]" />
                    
                    {/* Original inquiry always starts the conversation. */}
                    <div className="relative pl-10">
                      <div className="absolute left-2 top-1.5 size-3.5 rounded-full border-2 border-white shadow-sm bg-[#123D2A]" />
                      <div className="rounded-lg border p-4 text-sm leading-relaxed bg-white border-[#E5E7EB] text-[#294B39]"><div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E5E7EB]"><span className="font-bold">{selectedRequest.requesterName || "Public Inquiry"}</span><span className="text-xs opacity-75">{new Date(selectedRequest.submittedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>{selectedRequest.subject && <strong className="block mb-2">{selectedRequest.subject}</strong>}<div className="whitespace-pre-wrap">{selectedRequest.message}</div></div>
                    </div>

                    {selectedRequestHistory
                      .filter(h => h.userVisibleMessage)
                      .slice()
                      .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
                      .map((historyItem, idx) => {
                        const isOwnReply = Boolean(user && historyItem.changedBy === user.id);
                        const isPublicReply = !historyItem.changedBy;
                        const isOtherReply = !isOwnReply;

                        let senderLabel = "";
                        if (isOwnReply) {
                          senderLabel = "You";
                        } else {
                          senderLabel = historyItem.changedByName || selectedRequest.requesterName || (isPublicReply ? "Public User" : "Member");
                        }

                        return (
                          <div key={historyItem.id || idx} className="relative pl-10">
                            {/* Timeline Dot */}
                            <div className={`absolute left-2 top-1.5 size-3.5 rounded-full border-2 border-white shadow-sm ${isOwnReply ? 'bg-[#1F6B43]' : 'bg-[#CAD8CB]'}`} />
                            
                            <div className={`rounded-lg border p-4 text-sm leading-relaxed ${isOwnReply ? 'bg-[#E7F2E4] border-[#CAD8CB] text-[#1F6B43]' : 'bg-white border-[#CAD8CB] text-[#123D2A]'}`}>
                              <div className={`flex items-center justify-between mb-2 pb-2 border-b ${isOwnReply ? 'border-[#CAD8CB]/50' : 'border-[#CAD8CB]/50'}`}>
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
                      
                  </div>
                </div>

                <div className="mt-2">
                  <div className="mb-2 flex items-center justify-between"><label className="text-xs font-bold uppercase tracking-wide text-[#52705D]">Reply to {selectedRequest.requestSource === "Public Website" ? "public user" : "member"}</label><span className="text-xs text-[#789181]">{replyText.length}/1000</span></div>
                  <textarea
                    className="w-full rounded-md border border-[#CAD8CB] p-2.5 text-sm outline-none focus:border-[#1F6B43] custom-scrollbar"
                    rows={2}
                    placeholder="Type a reply here..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    maxLength={1000}
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
                {isMutating ? (modalMode === 'thread' ? "Sending..." : "Updating...") : (modalMode === 'thread' ? "Send Reply" : "Save Changes")}
              </Button>
            </div>
          </div>
        )}
      </FormDialog>
    </div>
  );
}
