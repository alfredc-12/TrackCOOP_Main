"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Download,
  ImagePlus,
  Inbox,
  Plus,
  QrCode,
  Search,
  X,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { ConfirmDialog, FormDialog, PaginationControls, StatCard, StatusBadge } from "@/components/portal/PortalPrimitives";
import { DatePicker } from "@/components/ui/DatePicker";
import { Modal } from "@/components/ui/Modal";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { env } from "@/config/env";
import { apiRequest } from "@/lib/api-client";
import { resolveUploadUrl } from "@/lib/upload-url";
import { ChairmanAttendanceScanner } from "./ChairmanAttendanceScanner";

type Activity = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  details: string;
  imagePath?: string | null;
  status: "Scheduled" | "Completed" | "Cancelled";
  cancellationReason?: string | null;
  completedAt?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  qualifies: number | boolean;
};

type Attendance = {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  date: string;
  status: string;
  remarks: string | null;
};

type Detail = Activity & { eligibleMemberCount: number; attendance: Attendance[] };
type CorrectionRequest = { eventId: string; row: Attendance };
type Draft = { title: string; date: string; time: string; location: string; details: string; imagePath: string; qualifies: boolean };
type EventFilter = "All" | "Upcoming" | "Past" | "Completed" | "Cancelled";

const empty: Draft = { title: "", date: "", time: "", location: "", details: "", imagePath: "", qualifies: true };
const field = "coop-field min-h-11 w-full rounded-coop-control border border-coop-border bg-coop-surface px-3 py-2 text-coop-forest";
const action = "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-coop-control bg-coop-green px-4 py-2 font-semibold text-white transition hover:bg-coop-forest disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-coop-control border border-coop-border bg-coop-surface px-4 py-2 font-semibold text-coop-forest transition hover:bg-coop-subtle disabled:cursor-not-allowed disabled:opacity-50";

const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  const value = `${String(hour).padStart(2, "0")}:${minute}`;
  const twelveHour = hour % 12 || 12;
  const meridiem = hour < 12 ? "AM" : "PM";
  return { value, label: `${twelveHour}:${minute} ${meridiem}` };
});
const timeOptionLabels = ["Select time", ...timeOptions.map((option) => option.label)];

function timeLabel(value: string) {
  return timeOptions.find((option) => option.value === value)?.label ?? "";
}

function timeValue(label: string) {
  return timeOptions.find((option) => option.label === label)?.value ?? "";
}

function formatEventDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day));
}

function manilaTodayKey() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function eventIsUpcoming(event: Activity) {
  const time = String(event.time || "00:00").slice(0, 5);
  return event.status === "Scheduled" && Date.parse(`${event.date}T${time}:00+08:00`) >= Date.now();
}

function EventPhoto({ path }: { path?: string | null }) {
  const src = resolveUploadUrl(path);
  if (!src) return null;

  return (
    <div className="h-20 w-28 shrink-0 overflow-hidden rounded-coop-control border border-coop-border bg-coop-subtle">
      {/* eslint-disable-next-line @next/next/no-img-element -- Event photos may be served by the configured public storage provider. */}
      <img src={src} alt="" className="size-full object-cover" />
    </div>
  );
}

async function downloadAttendanceExcel(detail: Detail) {
  const response = await fetch(`${env.apiUrl}/api/activities/${detail.id}/attendance/export`, { credentials: "include" });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(data?.message ?? "The attendance Excel export could not be created.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `trackcoop-attendance-${detail.date}-${detail.id}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function uploadActivityImage(file: File) {
  const formData = new FormData();
  formData.append("image", file);
  const result = await apiRequest<{ url: string; urls: string[] }>("/api/announcements/upload-image", {
    method: "POST",
    body: formData,
  });
  return result.url || result.urls[0] || "";
}

type AttendanceDetailsBodyProps = {
  selected: Detail;
  busy: boolean;
  reason: string;
  setReason: (value: string) => void;
  perform: (work: () => Promise<void>, success: string) => void;
  refreshSelected: () => Promise<void>;
  load: () => Promise<void>;
  requestCorrection: (row: Attendance) => void;
};

type AttendanceActionsProps = Pick<AttendanceDetailsBodyProps, "selected" | "busy"> & {
  canRecordAttendance: boolean;
  canComplete: boolean;
  onScan: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onExport: () => void;
};
type AttendanceDetailsViewProps = Pick<AttendanceDetailsBodyProps, "selected" | "busy" | "requestCorrection"> & { attendanceOpen: boolean };

function AttendanceActions({ selected, busy, canRecordAttendance, canComplete, onScan, onComplete, onCancel, onExport }: AttendanceActionsProps) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {selected.status === "Scheduled" && <button type="button" className={secondary} disabled={busy || !canRecordAttendance} onClick={onScan} title={canRecordAttendance ? undefined : "Attendance opens at the event start time"}><QrCode className="size-4" aria-hidden="true" />Scan member QR</button>}
      {selected.status === "Scheduled" && canComplete && <button type="button" className={secondary} disabled={busy} onClick={onComplete}><CheckCircle2 className="size-4" aria-hidden="true" />Complete event</button>}
      <button type="button" className={secondary} disabled={busy} onClick={onExport}><Download className="size-4" aria-hidden="true" />Export Excel</button>
      {selected.status === "Scheduled" && <button type="button" className={secondary} disabled={busy} onClick={onCancel}>Cancel event</button>}
    </div>
  );
}

function AttendanceDetailsBody({ selected, busy, requestCorrection, attendanceOpen }: AttendanceDetailsViewProps) {
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendancePageSize, setAttendancePageSize] = useState(5);
  const participatedCount = selected.attendance.filter((row) => row.status === "Participated").length;
  const voidedCount = selected.attendance.filter((row) => row.status === "Voided").length;
  const recordedCount = selected.attendance.length;
  const eligibleCount = selected.eligibleMemberCount;
  const notRecordedCount = Math.max(eligibleCount - recordedCount, 0);
  const attendanceRate = eligibleCount > 0 ? Math.round((participatedCount / eligibleCount) * 100) : 0;
  const attendanceTotalPages = Math.max(1, Math.ceil(recordedCount / attendancePageSize));
  const safeAttendancePage = Math.min(attendancePage, attendanceTotalPages);
  const visibleAttendance = selected.attendance.slice((safeAttendancePage - 1) * attendancePageSize, safeAttendancePage * attendancePageSize);

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Participated" value={String(participatedCount)} icon={CircleCheck} variant="compact" className="p-3" />
        <StatCard label="Not recorded" value={String(notRecordedCount)} icon={Users} variant="compact" className="p-3" description={`${eligibleCount} eligible approved members`} />
        <StatCard label="Voided records" value={String(voidedCount)} icon={CircleX} variant="compact" className="p-3" />
        <StatCard label="Participation rate" value={`${attendanceRate}%`} icon={ClipboardCheck} variant="compact" className="p-3" description="Participated ÷ eligible members" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-coop-forest">Attendance records</h3><span className="text-sm text-coop-muted">{recordedCount} recorded</span></div>
      {selected.status === "Scheduled" && !attendanceOpen && <p className="rounded-coop-control border border-coop-border bg-coop-workspace p-3 text-sm text-coop-muted">Attendance opens at the event start time. Only approved members can be recorded.</p>}
      {selected.attendance.length === 0 ? <p className="rounded-coop-control border border-dashed border-coop-border bg-coop-workspace p-4 text-sm text-coop-muted">No attendance recorded yet. Scan an approved member&apos;s QR code to begin.</p> : <><ul className="space-y-2">{visibleAttendance.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-coop-control border border-coop-border bg-coop-workspace p-3"><div className="min-w-0"><p className="break-words font-semibold text-coop-forest">{row.memberName}</p><p className="text-sm text-coop-muted">{row.memberCode} · {row.status}</p></div>{selected.status === "Scheduled" && <button type="button" className={secondary} disabled={busy} onClick={() => requestCorrection(row)}>{row.status === "Participated" ? "Void attendance" : "Restore attendance"}</button>}</li>)}</ul><PaginationControls currentPage={safeAttendancePage} totalPages={attendanceTotalPages} totalItems={recordedCount} itemName="attendance records" onPageChange={setAttendancePage} pageSize={attendancePageSize} pageSizeOptions={[5, 10, 20]} onPageSizeChange={(size) => { setAttendancePageSize(size); setAttendancePage(1); }} disabled={busy} /></>}
    </div>
  );
}

export function ActivityWorkspace() {
  const [events, setEvents] = useState<Activity[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<EventFilter>("All");
  const [eventPage, setEventPage] = useState(1);
  const [eventPageSize, setEventPageSize] = useState(5);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [archivedModalOpen, setArchivedModalOpen] = useState(false);
  const [archivedSearch, setArchivedSearch] = useState("");
  const [archivedPage, setArchivedPage] = useState(1);
  const [archivedPageSize, setArchivedPageSize] = useState(5);
  const [archiveTarget, setArchiveTarget] = useState<Activity | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Activity | null>(null);
  const [attendanceModalEventId, setAttendanceModalEventId] = useState<string | null>(null);
  const [scannerEventId, setScannerEventId] = useState<string | null>(null);
  const [cancelEventId, setCancelEventId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [completeEventId, setCompleteEventId] = useState<string | null>(null);
  const [correctionRequest, setCorrectionRequest] = useState<CorrectionRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const load = useCallback(async () => {
    const [active, archived] = await Promise.all([
      apiRequest<Activity[]>("/api/activities"),
      apiRequest<Activity[]>("/api/activities/archived"),
    ]);
    setEvents(active);
    setArchivedEvents(archived);
  }, []);

  useEffect(() => {
    void Promise.all([
      apiRequest<Activity[]>("/api/activities"),
      apiRequest<Activity[]>("/api/activities/archived"),
    ])
      .then(([active, archived]) => {
        setEvents(active);
        setArchivedEvents(archived);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Events could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  async function show(id: string) {
    setSelected(await apiRequest<Detail>(`/api/activities/${id}`));
  }

  function closeAttendanceModal() {
    setAttendanceModalEventId(null);
    setSelected(null);
    setReason("");
  }

  function openScanner(eventId: string) {
    setAttendanceModalEventId(null);
    setSelected(null);
    setReason("");
    setScannerEventId(eventId);
  }

  async function returnToAttendance(eventId: string) {
    try {
      await show(eventId);
      setAttendanceModalEventId(eventId);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Event details could not be loaded.";
      setError(message);
      toast.error("Event details could not be loaded.", { description: message });
    }
  }

  async function closeScanner(eventId: string) {
    setScannerEventId(null);
    await returnToAttendance(eventId);
  }

  function requestEventCancellation(eventId: string) {
    setAttendanceModalEventId(null);
    setSelected(null);
    setCancelReason("");
    setCancelEventId(eventId);
  }

  function closeCancellationConfirmation() {
    const eventId = cancelEventId;
    setCancelEventId(null);
    setCancelReason("");
    if (eventId) void returnToAttendance(eventId);
  }

  async function confirmEventCancellation() {
    if (!cancelEventId || cancelReason.trim().length < 3) return;
    const eventId = cancelEventId;
    await perform(async () => {
      await apiRequest(`/api/activities/${eventId}/cancel`, { method: "POST", body: JSON.stringify({ reason: cancelReason.trim() }) });
      await load();
      setCancelEventId(null);
      setCancelReason("");
      await returnToAttendance(eventId);
    }, "Event cancelled; its attendance no longer contributes to analytics.");
  }

  function requestEventCompletion(eventId: string) {
    setAttendanceModalEventId(null);
    setSelected(null);
    setCompleteEventId(eventId);
  }

  function closeCompletionConfirmation() {
    const eventId = completeEventId;
    setCompleteEventId(null);
    if (eventId) void returnToAttendance(eventId);
  }

  async function confirmEventCompletion() {
    if (!completeEventId) return;
    const eventId = completeEventId;
    await perform(async () => {
      await apiRequest(`/api/activities/${eventId}/complete`, { method: "POST" });
      await load();
      setCompleteEventId(null);
      await returnToAttendance(eventId);
    }, "Event marked as completed. Attendance is now read-only.");
  }

  async function confirmEventArchive() {
    if (!archiveTarget) return;
    const eventId = archiveTarget.id;
    await perform(async () => {
      await apiRequest(`/api/activities/${eventId}/archive`, { method: "POST" });
      await load();
      setArchiveTarget(null);
    }, "Event archived. Its attendance and history were preserved.");
  }

  async function confirmEventRestore() {
    if (!restoreTarget) return;
    const eventId = restoreTarget.id;
    await perform(async () => {
      await apiRequest(`/api/activities/${eventId}/restore`, { method: "POST" });
      await load();
      setRestoreTarget(null);
    }, "Event restored to the activity register.");
  }

  function requestCorrection(row: Attendance) {
    if (!selected) return;
    setAttendanceModalEventId(null);
    setSelected(null);
    setReason("");
    setCorrectionRequest({ eventId: selected.id, row });
  }

  function closeCorrectionModal() {
    const eventId = correctionRequest?.eventId;
    setCorrectionRequest(null);
    setReason("");
    if (eventId) void returnToAttendance(eventId);
  }

  const selectedId = selected?.id;
  const selectedStatus = selected?.status;
  const refreshSelected = useCallback(async () => {
    if (!selectedId) return;
    setSelected(await apiRequest<Detail>(`/api/activities/${selectedId}`));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || selectedStatus !== "Scheduled") return;
    const timer = window.setInterval(() => {
      void refreshSelected().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshSelected, selectedId, selectedStatus]);

  async function perform(work: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    try {
      await work();
      toast.success(success);
    } catch (e) {
      const message = e instanceof Error ? e.message : "The request could not be completed.";
      setError(message);
      toast.error("The request could not be completed.", { description: message });
    } finally {
      setBusy(false);
    }
  }

  async function confirmCorrection() {
    if (!correctionRequest || reason.trim().length < 3) return;
    const request = correctionRequest;
    await perform(async () => {
      await apiRequest(`/api/activities/${request.eventId}/attendance/${request.row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: request.row.status === "Participated" ? "Voided" : "Participated", reason }),
      });
      await show(request.eventId);
      setCorrectionRequest(null);
      setReason("");
      setAttendanceModalEventId(request.eventId);
    }, "Attendance corrected and recorded in the audit log.");
  }

  function change(name: keyof Draft, value: string | boolean) {
    setDraft((previous) => ({ ...previous, [name]: value }));
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file for the event photo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Event photos must be 5 MB or smaller.");
      return;
    }
    setError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    change("imagePath", "");
  }

  function clearEventImage() {
    setImageFile(null);
    setImagePreview(null);
    change("imagePath", "");
  }

  const manilaToday = manilaTodayKey();
  const occupiedEventDates = useMemo(
    () => new Set(
      [...events, ...archivedEvents]
        .filter((event) => event.id !== editing)
        .map((event) => event.date),
    ),
    [archivedEvents, editing, events],
  );
  const eventDateError = draft.date && draft.date < manilaToday
    ? "Past dates cannot be scheduled."
    : draft.date && occupiedEventDates.has(draft.date)
      ? "Another event already uses this date."
      : undefined;

  function edit(event: Activity) {
    setEditing(event.id);
    setDraft({
      title: event.title,
      date: event.date,
      time: event.time,
      location: event.location,
      details: event.details ?? "",
      imagePath: event.imagePath ?? "",
      qualifies: Boolean(event.qualifies),
    });
    setImageFile(null);
    setImagePreview(resolveUploadUrl(event.imagePath) || null);
    setEventModalOpen(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void perform(async () => {
      if (!draft.date) throw new Error("Select an event date.");
      if (draft.date < manilaToday) throw new Error("Events cannot be scheduled on a past date.");
      if (occupiedEventDates.has(draft.date)) throw new Error("Only one event can be scheduled per day. Choose another date.");
      const imagePath = imageFile ? await uploadActivityImage(imageFile) : draft.imagePath || null;
      const result = await apiRequest<{ id: string }>(editing ? `/api/activities/${editing}` : "/api/activities", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({ ...draft, imagePath }),
      });
      await load();
      await show(result.id);
      setDraft(empty);
      setImageFile(null);
      setImagePreview(null);
      setEditing(null);
      setEventModalOpen(false);
    }, editing ? "Event updated." : "Event scheduled.");
  }

  function openNewEvent() {
    setEditing(null);
    setDraft(empty);
    setImageFile(null);
    setImagePreview(null);
    setEventModalOpen(true);
  }

  function openArchivedEvents() {
    setArchivedSearch("");
    setArchivedPage(1);
    setArchivedModalOpen(true);
  }

  const filteredEvents = useMemo(() => {
    const query = eventSearch.trim().toLowerCase();
    return events.filter((event) => {
      const matchesSearch = !query || [event.title, event.location, event.details ?? ""].some((value) => value.toLowerCase().includes(query));
      const matchesFilter = eventFilter === "All"
        || (eventFilter === "Cancelled" && event.status === "Cancelled")
        || (eventFilter === "Completed" && event.status === "Completed")
        || (eventFilter === "Upcoming" && eventIsUpcoming(event))
        || (eventFilter === "Past" && event.status === "Scheduled" && !eventIsUpcoming(event));
      return matchesSearch && matchesFilter;
    });
  }, [eventFilter, eventSearch, events]);

  const filteredArchivedEvents = useMemo(() => {
    const query = archivedSearch.trim().toLowerCase();
    if (!query) return archivedEvents;
    return archivedEvents.filter((event) =>
      [event.title, event.location, event.details ?? ""]
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [archivedEvents, archivedSearch]);

  const eventTotalPages = Math.max(1, Math.ceil(filteredEvents.length / eventPageSize));
  const safeEventPage = Math.min(eventPage, eventTotalPages);
  const visibleEvents = filteredEvents.slice((safeEventPage - 1) * eventPageSize, safeEventPage * eventPageSize);
  const scheduledCount = events.filter((event) => event.status === "Scheduled").length;
  const upcomingCount = events.filter(eventIsUpcoming).length;
  const completedCount = events.filter((event) => event.status === "Completed").length;
  const cancelledCount = events.filter((event) => event.status === "Cancelled").length;
  const archivedTotalPages = Math.max(1, Math.ceil(filteredArchivedEvents.length / archivedPageSize));
  const safeArchivedPage = Math.min(archivedPage, archivedTotalPages);
  const visibleArchivedEvents = filteredArchivedEvents.slice(
    (safeArchivedPage - 1) * archivedPageSize,
    safeArchivedPage * archivedPageSize,
  );

  const eventForm = (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1 font-semibold sm:col-span-2">Event title<input name="title" aria-label="Event title" className={field} value={draft.title} onChange={(event) => change("title", event.target.value)} required maxLength={255} /></label>
      <div className="grid content-start gap-1">
        <DatePicker
          label="Date"
          value={draft.date}
          onChange={(value) => change("date", value)}
          min={manilaToday}
          max="2100-12-31"
          disabledDates={[...occupiedEventDates]}
          placeholder="Select date"
          error={eventDateError}
          triggerClassName="h-11 rounded-coop-control px-3"
        />
        {!eventDateError && <p className="text-xs font-normal text-coop-muted">Past dates and dates with an existing event are unavailable.</p>}
      </div>
      <div className="grid gap-1 font-semibold"><label htmlFor="activity-time">Time</label><StyledSelect id="activity-time" aria-label="Time" value={timeLabel(draft.time) || "Select time"} options={timeOptionLabels} onChange={(label) => change("time", timeValue(label))} placeholder="Select time" className="min-h-11" /></div>
      <label className="grid gap-1 font-semibold sm:col-span-2">Location<input name="location" aria-label="Location" className={field} value={draft.location} onChange={(event) => change("location", event.target.value)} required maxLength={255} /></label>
      <label className="grid gap-1 font-semibold sm:col-span-2">Details<textarea name="details" aria-label="Details" className={`${field} min-h-28`} value={draft.details} onChange={(event) => change("details", event.target.value)} maxLength={4000} /></label>
      <div className="grid gap-2 sm:col-span-2">
        <div>
          <label htmlFor="activity-image" className="font-semibold text-coop-forest">Event photo <span className="font-normal text-sm text-coop-muted">(optional)</span></label>
          <p id="activity-image-help" className="mt-1 text-sm font-normal text-coop-muted">Shown on the member announcement. JPG, PNG, or WebP up to 5 MB.</p>
        </div>
        {imagePreview ? <div className="relative overflow-hidden rounded-coop-control border border-coop-border bg-coop-workspace">
          {/* eslint-disable-next-line @next/next/no-img-element -- Uploaded event photos may be served by the configured public storage provider. */}
          <img src={imagePreview} alt="Event photo preview" className="h-48 w-full object-cover sm:h-56" />
          <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2">
            <label htmlFor="activity-image" className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-coop-control border border-white/70 bg-white/95 px-3 py-2 text-sm font-semibold text-coop-forest shadow-md hover:bg-white">Change photo</label>
            <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-coop-control border border-white/70 bg-white/95 px-3 py-2 text-sm font-semibold text-coop-forest shadow-md hover:bg-white" onClick={clearEventImage}><X className="size-4" aria-hidden="true" />Remove photo</button>
          </div>
        </div> : <label htmlFor="activity-image" className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-coop-control border border-dashed border-coop-border bg-coop-workspace px-4 text-center text-sm text-coop-secondary transition hover:border-coop-green hover:bg-coop-subtle">
          <ImagePlus className="size-6 text-coop-green" aria-hidden="true" />
          <span className="font-semibold text-coop-forest">Add event photo</span>
          <span>Members will see it with the event announcement.</span>
        </label>}
        <input id="activity-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-describedby="activity-image-help" onChange={handleImageChange} />
      </div>
      <label className="flex items-start gap-2 text-sm font-semibold text-coop-forest sm:col-span-2"><input name="qualifies" className="mt-1 size-4 accent-coop-green" type="checkbox" checked={draft.qualifies} onChange={(event) => change("qualifies", event.target.checked)} /> <span>Count qualifying attendance in member analytics</span></label>
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><button type="button" className={secondary} onClick={() => setEventModalOpen(false)}>Cancel</button><button type="submit" disabled={busy} className={action}>{editing ? "Save changes" : "Schedule event"}</button></div>
    </form>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communication"
        title="Events and Attendance"
        description="Schedule cooperative activities and maintain attendance records."
        actions={(
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondary} onClick={openArchivedEvents}>
              <Archive className="size-4" aria-hidden="true" />
              Archived events ({archivedEvents.length})
            </button>
            <FormDialog
              open={eventModalOpen}
              onOpenChange={setEventModalOpen}
              title={editing ? "Edit event" : "Schedule an event"}
              description="Define the activity details and whether attendance should count toward member analytics."
              trigger={<button type="button" className={action} onClick={openNewEvent}><Plus className="size-4" aria-hidden="true" />New event</button>}
              contentClassName="w-[min(42rem,calc(100vw-2rem))]"
            >
              {eventForm}
            </FormDialog>
          </div>
        )}
      />

      {error && <p role="alert" className="rounded-coop-panel border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}

      <section className="rounded-coop-panel border border-coop-border bg-coop-surface p-5" aria-labelledby="scheduled-events-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-coop-green">Activity register</p>
              <h2 id="scheduled-events-heading" className="mt-1 text-lg font-bold text-coop-forest">Scheduled events</h2>
            </div>
            <StatusBadge tone="neutral">{events.length} total</StatusBadge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Scheduled" value={String(scheduledCount)} icon={CalendarCheck2} variant="compact" />
            <StatCard label="Upcoming" value={String(upcomingCount)} icon={CalendarClock} variant="compact" />
            <StatCard label="Completed" value={String(completedCount)} icon={CheckCircle2} variant="compact" />
            <StatCard label="Cancelled" value={String(cancelledCount)} icon={CircleX} variant="compact" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block min-w-0">
              <span className="sr-only">Search events</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-coop-muted" aria-hidden="true" />
              <input type="search" aria-label="Search events" className={`${field} pl-10`} value={eventSearch} onChange={(event) => { setEventPage(1); setEventSearch(event.target.value); }} placeholder="Search title, location, or details" />
            </label>
            <StyledSelect aria-label="Event status" value={eventFilter} options={["All", "Upcoming", "Past", "Completed", "Cancelled"]} onChange={(value) => { setEventPage(1); setEventFilter(value as EventFilter); }} className="min-h-11 w-full min-w-[11rem] sm:w-44" />
          </div>

          {loading ? <p className="mt-4 text-sm text-coop-muted">Loading events...</p> : visibleEvents.length === 0 ? <div className="mt-4 rounded-coop-control border border-dashed border-coop-border bg-coop-workspace p-5 text-center"><CalendarDays className="mx-auto size-7 text-coop-green" aria-hidden="true" /><p className="mt-2 font-semibold text-coop-forest">{events.length === 0 ? "No events have been scheduled." : "No events match your filters."}</p><p className="mt-1 text-sm text-coop-muted">{events.length === 0 ? "Create an event to start tracking cooperative attendance." : "Try another search or status filter."}</p></div> : <ul className="mt-4 space-y-3">{visibleEvents.map((event) => <li key={event.id} className="rounded-coop-control border border-coop-border bg-coop-workspace p-3"><div className="flex flex-wrap items-start justify-between gap-3"><EventPhoto path={event.imagePath} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="break-words text-coop-forest">{event.title}</strong><StatusBadge tone={event.status === "Cancelled" ? "warning" : event.status === "Completed" ? "success" : eventIsUpcoming(event) ? "success" : "neutral"}>{event.status === "Scheduled" && eventIsUpcoming(event) ? "Upcoming" : event.status}</StatusBadge></div><p className="mt-1 text-sm text-coop-muted">{formatEventDate(event.date)} at {event.time} · {event.location}</p>{event.details && <p className="mt-1 line-clamp-2 text-sm text-coop-secondary">{event.details}</p>}{event.cancellationReason && <p className="mt-1 text-sm text-coop-muted">Cancellation reason: {event.cancellationReason}</p>}</div><div className="flex shrink-0 flex-wrap gap-2"><Modal
              open={attendanceModalEventId === event.id}
              onOpenChange={(open) => {
                if (open) {
                  setAttendanceModalEventId(event.id);
                  void perform(() => show(event.id), "Event details loaded.");
                } else {
                  closeAttendanceModal();
                }
              }}
              title={`Attendance: ${event.title}`}
              description={`${formatEventDate(event.date)} · ${event.location} · ${event.status}`}
              headerActions={selected?.id === event.id ? <AttendanceActions selected={selected} busy={busy} canRecordAttendance={!eventIsUpcoming(event)} canComplete={!eventIsUpcoming(event)} onScan={() => openScanner(event.id)} onComplete={() => requestEventCompletion(event.id)} onCancel={() => requestEventCancellation(event.id)} onExport={() => void perform(() => downloadAttendanceExcel(selected), "Attendance Excel exported.")} /> : null}
              maxWidth="max-w-[90rem]"
              mobileFullScreen
              trigger={<button type="button" className={secondary}>View attendance</button>}
            >
              {selected?.id === event.id ? <AttendanceDetailsBody selected={selected} busy={busy} requestCorrection={requestCorrection} attendanceOpen={!eventIsUpcoming(event)} /> : <p className="py-8 text-center text-sm text-coop-muted">Loading attendance details...</p>}
            </Modal>{event.status === "Scheduled" && event.date >= manilaToday && <button type="button" className={secondary} onClick={() => edit(event)}>Edit</button>}{event.status !== "Scheduled" && <button type="button" className={secondary} disabled={busy} onClick={() => setArchiveTarget(event)}><Archive className="size-4" aria-hidden="true" />Archive</button>}</div></div></li>)}</ul>}
          <PaginationControls currentPage={safeEventPage} totalPages={eventTotalPages} totalItems={filteredEvents.length} itemName="events" onPageChange={setEventPage} pageSize={eventPageSize} pageSizeOptions={[5, 10, 20]} onPageSizeChange={(size) => { setEventPageSize(size); setEventPage(1); }} disabled={loading || busy} />
         </section>

      <FormDialog
        open={archivedModalOpen && !restoreTarget}
        onOpenChange={(open) => {
          if (!open) setArchivedModalOpen(false);
        }}
        title="Archived events"
        description="Review closed events removed from the active register. Attendance and audit history remain preserved."
        contentClassName="w-[min(54rem,calc(100vw-2rem))]"
      >
        <div className="space-y-4">
          <label className="relative block min-w-0">
            <span className="sr-only">Search archived events</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-coop-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search archived events"
              className={`${field} pl-10`}
              value={archivedSearch}
              onChange={(event) => {
                setArchivedSearch(event.target.value);
                setArchivedPage(1);
              }}
              placeholder="Search title, location, or details"
            />
          </label>

          {visibleArchivedEvents.length === 0 ? (
            <div className="grid min-h-44 place-items-center rounded-coop-control border border-dashed border-coop-border bg-coop-workspace p-6 text-center">
              <div>
                <Inbox className="mx-auto size-7 text-coop-green" aria-hidden="true" />
                <h3 className="mt-3 font-bold text-coop-forest">{archivedEvents.length === 0 ? "No archived events" : "No archived events match your search"}</h3>
                <p className="mt-1 text-sm text-coop-muted">{archivedEvents.length === 0 ? "Completed or cancelled events can be archived from the activity register." : "Try another title, location, or keyword."}</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {visibleArchivedEvents.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-coop-control border border-coop-border bg-coop-workspace p-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <EventPhoto path={event.imagePath} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="break-words text-coop-forest">{event.title}</strong>
                        <StatusBadge tone={event.status === "Completed" ? "success" : "warning"}>{event.status}</StatusBadge>
                      </div>
                      <p className="mt-1 text-sm text-coop-muted">{formatEventDate(event.date)} at {event.time} · {event.location}</p>
                      {event.details && <p className="mt-1 line-clamp-2 text-sm text-coop-secondary">{event.details}</p>}
                    </div>
                  </div>
                  <button type="button" className={secondary} disabled={busy} onClick={() => setRestoreTarget(event)}>
                    <ArchiveRestore className="size-4" aria-hidden="true" />Restore
                  </button>
                </li>
              ))}
            </ul>
          )}

          <PaginationControls
            currentPage={safeArchivedPage}
            totalPages={archivedTotalPages}
            totalItems={filteredArchivedEvents.length}
            itemName="archived events"
            onPageChange={setArchivedPage}
            pageSize={archivedPageSize}
            pageSizeOptions={[5, 10, 20]}
            onPageSizeChange={(size) => {
              setArchivedPageSize(size);
              setArchivedPage(1);
            }}
            disabled={busy}
            className="border-t border-coop-border pt-4"
          />
        </div>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open && !busy) setArchiveTarget(null);
        }}
        title="Archive this event?"
        description={`“${archiveTarget?.title ?? "This event"}” will leave the active register, but its attendance and history will remain available.`}
        confirmLabel="Archive event"
        cancelLabel="Keep event"
        variant="warning"
        loading={busy}
        onConfirm={() => void confirmEventArchive()}
      />

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => {
          if (!open && !busy) setRestoreTarget(null);
        }}
        title="Restore this event?"
        description={`“${restoreTarget?.title ?? "This event"}” will return to the active event register.`}
        confirmLabel="Restore event"
        cancelLabel="Keep archived"
        variant="warning"
        loading={busy}
        onConfirm={() => void confirmEventRestore()}
      />

      <Modal
        open={Boolean(correctionRequest)}
        onOpenChange={(open) => {
          if (!open) closeCorrectionModal();
        }}
        title="Reason for correction"
        description="Explain why this attendance record should be voided or restored."
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="rounded-coop-control border border-coop-border bg-coop-workspace p-3 text-sm text-coop-muted">
            <p className="font-semibold text-coop-forest">{correctionRequest?.row.memberName}</p>
            <p>{correctionRequest?.row.memberCode} · {correctionRequest?.row.status}</p>
          </div>
          <label className="grid gap-1 font-semibold" htmlFor="correction-reason-modal">Reason for correction</label>
          <textarea id="correction-reason-modal" aria-label="Reason for correction" className={`${field} min-h-28`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the correction" />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondary} onClick={closeCorrectionModal}>Cancel</button>
            <button type="button" className={action} disabled={busy || reason.trim().length < 3} onClick={() => void confirmCorrection()}>{correctionRequest?.row.status === "Participated" ? "Confirm void" : "Confirm restore"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(cancelEventId)}
        onOpenChange={(open) => {
          if (!open) closeCancellationConfirmation();
        }}
        title="Cancel this event?"
        description="The event will be marked as cancelled, and its attendance will no longer contribute to member analytics."
        confirmLabel="Cancel event"
        cancelLabel="Keep event"
        variant="warning"
        loading={busy}
        confirmDisabled={cancelReason.trim().length < 3}
        onConfirm={() => void confirmEventCancellation()}
      >
        <label className="grid gap-1 text-sm font-semibold text-coop-forest" htmlFor="event-cancellation-reason">
          Cancellation reason
          <textarea id="event-cancellation-reason" className={`${field} min-h-24 text-left font-normal`} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Explain why the event is being cancelled" maxLength={500} />
        </label>
        <p className="mt-2 text-xs text-coop-muted">This reason will be saved in the event history.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(completeEventId)}
        onOpenChange={(open) => {
          if (!open) closeCompletionConfirmation();
        }}
        title="Complete this event?"
        description="Attendance will become read-only and this event will be included in completed-event reports."
        confirmLabel="Complete event"
        cancelLabel="Keep event open"
        variant="warning"
        loading={busy}
        onConfirm={() => void confirmEventCompletion()}
      />

      {scannerEventId && (
        <ChairmanAttendanceScanner
          eventId={scannerEventId}
          eventTitle={events.find((event) => event.id === scannerEventId)?.title ?? "event"}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) void closeScanner(scannerEventId);
          }}
          onRecorded={async () => undefined}
        />
      )}
    </div>
  );
}
