"use client";

import {
  CalendarCheck2,
  Download,
  Eye,
  FileSearch,
  ListChecks,
  Plus,
  RefreshCcw,
  Search,
  WalletCards,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { rentalApiRepository } from "@/app/rental/_lib/rentalApi";
import {
  canTransitionRentalStatus,
  getChairmanRentalActions,
} from "@/app/rental/_lib/rentalWorkflow";
import {
  PAYMENT_STATUSES,
  type RentalInquiry,
  type RentalSchedule,
  type RentalStatus,
} from "@/app/rental/_types/rental";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
  PaginationControls,
} from "@/components/portal/PortalPrimitives";
import { ChairmanRentalBookingDetailsModal } from "./ChairmanRentalBookingDetailsModal";

type BookingView =
  | "All"
  | "New"
  | "To Schedule"
  | "Payments"
  | "Active"
  | "Done";

const bookingViews: BookingView[] = [
  "All",
  "New",
  "To Schedule",
  "Payments",
  "Active",
  "Done",
];

function matchesBookingView(item: RentalInquiry, view: BookingView) {
  if (view === "All") return true;
  if (view === "New") {
    return [
      "New Inquiry",
      "Under Review",
      "Awaiting Information",
      "On Hold",
    ].includes(item.status);
  }
  if (view === "To Schedule") {
    return [
      "Approved for Scheduling",
      "Awaiting Confirmation",
      "Scheduled",
      "Rescheduled",
    ].includes(item.status);
  }
  if (view === "Payments") {
    return (
      ["Payment Pending", "Payment Under Review", "Payment Confirmed"].includes(item.status) ||
      ["Under Review", "Partially Paid", "Paid", "Needs Clarification"].includes(item.paymentStatus)
    );
  }
  if (view === "Active") return item.status === "In Progress";
  return ["Completed", "Cancelled", "Rejected"].includes(item.status);
}

function formatDate(value?: string) {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(parsed);
}

function formatDateRange(startDate?: string, endDate?: string) {
  if (!startDate) return "Not scheduled";
  if (!endDate || startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (["Completed", "Paid", "Payment Confirmed"].includes(status)) return "success";
  if (["Rejected", "Cancelled"].includes(status)) return "danger";
  if (
    status.includes("Awaiting") ||
    status.includes("Pending") ||
    status.includes("Review") ||
    status.includes("Hold") ||
    status.includes("Clarification")
  ) {
    return "warning";
  }
  return "neutral";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function ChairmanRentalBookingsClient() {
  const [inquiries, setInquiries] = useState<RentalInquiry[]>([]);
  const [schedules, setSchedules] = useState<RentalSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<BookingView>("All");
  const [asset, setAsset] = useState("All");
  const [requesterType, setRequesterType] = useState("All");
  const [payment, setPayment] = useState("All");
  const [preferredDate, setPreferredDate] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextInquiries, nextSchedules] = await Promise.all([
        rentalApiRepository.getRentalInquiries(),
        rentalApiRepository.getRentalSchedules(),
      ]);
      setInquiries(nextInquiries);
      setSchedules(nextSchedules);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Rental bookings could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const scheduleByRental = useMemo(
    () => new Map(schedules.map((item) => [item.rentalId, item])),
    [schedules],
  );

  const viewCounts = useMemo(
    () =>
      new Map(
        bookingViews.map((item) => [
          item,
          inquiries.filter((inquiry) => matchesBookingView(inquiry, item)).length,
        ]),
      ),
    [inquiries],
  );

  const metrics = useMemo(
    () => [
      { label: "All Bookings", value: inquiries.length, icon: ListChecks },
      { label: "For Review", value: viewCounts.get("New") ?? 0, icon: FileSearch },
      {
        label: "To Schedule",
        value: viewCounts.get("To Schedule") ?? 0,
        icon: CalendarCheck2,
      },
      {
        label: "Payment Watch",
        value: viewCounts.get("Payments") ?? 0,
        icon: WalletCards,
      },
    ],
    [inquiries.length, viewCounts],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inquiries.filter((item) => {
      return (
        matchesBookingView(item, view) &&
        (!query ||
          `${item.inquiryId} ${item.requester.fullName} ${item.requester.contactNumber} ${item.equipmentName} ${item.requester.barangay}`
            .toLowerCase()
            .includes(query)) &&
        (asset === "All" || item.equipmentName === asset) &&
        (requesterType === "All" || item.requester.requesterType === requesterType) &&
        (payment === "All" || item.paymentStatus === payment) &&
        (!preferredDate ||
          (item.preferredDate <= preferredDate &&
            item.preferredEndDate >= preferredDate))
      );
    });
  }, [asset, inquiries, payment, preferredDate, requesterType, search, view]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, view, asset, requesterType, payment, preferredDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  async function bulkUpdate(status: RentalStatus) {
    const records = inquiries.filter(
      (item) =>
        selected.includes(item.inquiryId) &&
        canTransitionRentalStatus(item.status, status),
    );
    if (!records.length) {
      toast.error(`None of the selected bookings can move to ${status}.`);
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        records.map((item) =>
          rentalApiRepository.updateRentalStatus(item.inquiryId, status),
        ),
      );
      toast.success(`${records.length} booking(s) updated.`);
      setSelected([]);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Bulk update failed.");
    } finally {
      setSaving(false);
    }
  }

  function exportBookings(records = filtered) {
    const rows = [
      [
        "Booking Reference",
        "Requester",
        "Requester Type",
        "Contact",
        "Barangay",
        "Asset",
        "Preferred Date",
        "Request Status",
        "Schedule Status",
        "Payment Status",
        "Submitted At",
      ],
      ...records.map((item) => [
        item.inquiryId,
        item.requester.fullName,
        item.requester.requesterType,
        item.requester.contactNumber,
        item.requester.barangay,
        item.equipmentName,
        item.preferredDate,
        item.status,
        item.scheduleStatus,
        item.paymentStatus,
        item.submittedAt,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "trackcoop-rental-bookings.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Rental Bookings"
        description="Review, approve, schedule, reschedule, cancel, start, and complete rentals. Payment validation and receipts remain with the Bookkeeper."
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A]"
            >
              <RefreshCcw className="size-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => exportBookings()}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A]"
            >
              <Download className="size-4" />
              Export
            </button>
            <Link
              href="/chairman/rentals/bookings/calendar"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A]"
            >
              <CalendarCheck2 className="size-4" />
              Calendar
            </Link>
            <Link
              href="/rental"
              target="_blank"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white"
            >
              <Plus className="size-4" />
              New Booking
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <StatCard
            key={metric.label}
            label={metric.label}
            value={String(metric.value)}
            icon={metric.icon}
          />
        ))}
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          {bookingViews.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`min-h-11 rounded-full px-4 text-xs font-bold ${
                view === item
                  ? "bg-[#123D2A] text-white"
                  : "border border-[#CAD8CB] bg-white text-[#294B39]"
              }`}
            >
              {item}
              <span className="ml-2 opacity-70">{viewCounts.get(item) ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 md:grid-cols-2 xl:grid-cols-[2fr_repeat(4,minmax(0,1fr))]">
        <label className="grid gap-1 text-xs font-bold text-[#5D6D63]">
          Search
          <span className="relative">
            <Search className="absolute left-3 top-3.5 size-4 text-[#6C7A70]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              placeholder="Reference, requester, contact, asset"
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-3 text-sm font-normal"
            />
          </span>
        </label>
        <Filter
          label="Asset"
          value={asset}
          onChange={setAsset}
          options={["All", ...unique(inquiries.map((item) => item.equipmentName))]}
        />
        <Filter
          label="Requester type"
          value={requesterType}
          onChange={setRequesterType}
          options={["All", "Member", "Public or Non-member"]}
        />
        <Filter
          label="Payment"
          value={payment}
          onChange={setPayment}
          options={["All", ...PAYMENT_STATUSES]}
        />
        <label className="grid gap-1 text-xs font-bold text-[#5D6D63]">
          Preferred date
          <input
            type="date"
            value={preferredDate}
            onChange={(event) => setPreferredDate(event.target.value)}
            className="h-11 w-full rounded-md border border-[#CAD8CB] px-3 text-sm font-normal"
          />
        </label>
      </section>

      {selected.length ? (
        <section className="flex flex-wrap items-center gap-2 rounded-lg border border-[#CAD8CB] bg-[#E7F2E4] p-3 text-sm">
          <strong>{selected.length} selected</strong>
          <button
            type="button"
            disabled={saving}
            onClick={() => void bulkUpdate("Under Review")}
            className="min-h-10 rounded-md bg-white px-3 font-bold"
          >
            Mark Under Review
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void bulkUpdate("On Hold")}
            className="min-h-10 rounded-md bg-white px-3 font-bold"
          >
            Put On Hold
          </button>
          <button
            type="button"
            onClick={() =>
              exportBookings(
                inquiries.filter((item) => selected.includes(item.inquiryId)),
              )
            }
            className="min-h-10 rounded-md bg-white px-3 font-bold"
          >
            Export Selected
          </button>
        </section>
      ) : null}

      {error ? <ErrorState message={error} /> : null}
      {loading ? (
        <LoadingSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarCheck2}
          title={inquiries.length ? "No bookings match these filters" : "No rental bookings"}
          description={
            inquiries.length
              ? "Adjust the search, queue, or filters to see other rental requests."
              : "Public and member rental inquiries will appear here after they are submitted."
          }
        />
      ) : (
        <>
          <div className="hidden xl:block">
            <DataTable>
              <table className="min-w-[1150px] divide-y divide-[#E2E8E2] text-left text-sm">
                <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.1em] text-[#5D6D63]">
                  <tr>
                    <th className="px-4 py-4">
                      <span className="sr-only">Select</span>
                    </th>
                    {[
                      "Reference",
                      "Requester",
                      "Asset",
                      "Preferred Date",
                      "Schedule",
                      "Status",
                      "Payment",
                      "Actions",
                    ].map((heading) => (
                      <th key={heading} className="px-4 py-4">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
                  {paginated.map((inquiry) => (
                    <BookingRow
                      key={inquiry.inquiryId}
                      inquiry={inquiry}
                      schedule={scheduleByRental.get(inquiry.rentalId)}
                      selected={selected.includes(inquiry.inquiryId)}
                      onToggle={() =>
                        setSelected((current) =>
                          current.includes(inquiry.inquiryId)
                            ? current.filter((id) => id !== inquiry.inquiryId)
                            : [...current, inquiry.inquiryId],
                        )
                      }
                      onSelectBooking={() => setSelectedBookingId(inquiry.inquiryId)}
                    />
                  ))}
                </tbody>
              </table>
            </DataTable>
          </div>
          <div className="grid gap-3 xl:hidden">
            {paginated.map((inquiry) => (
              <BookingMobileCard
                key={inquiry.inquiryId}
                inquiry={inquiry}
                schedule={scheduleByRental.get(inquiry.rentalId)}
                selected={selected.includes(inquiry.inquiryId)}
                onToggle={() =>
                  setSelected((current) =>
                    current.includes(inquiry.inquiryId)
                      ? current.filter((id) => id !== inquiry.inquiryId)
                      : [...current, inquiry.inquiryId],
                  )
                }
                onSelectBooking={() => setSelectedBookingId(inquiry.inquiryId)}
              />
            ))}
          </div>

          <div className="border-t border-[#CAD8CB] bg-white px-4 py-4 sm:px-6">
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemName="bookings"
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {selectedBookingId ? (
        <ChairmanRentalBookingDetailsModal
          open={!!selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
          bookingId={selectedBookingId}
        />
      ) : null}
    </div>
  );
}

function BookingRow({
  inquiry,
  schedule,
  selected,
  onToggle,
  onSelectBooking,
}: {
  inquiry: RentalInquiry;
  schedule?: RentalSchedule;
  selected: boolean;
  onToggle: () => void;
  onSelectBooking: () => void;
}) {
  return (
    <tr className="align-top hover:bg-[#F7F8F3]">
      <td className="px-4 py-4">
        <input
          aria-label={`Select ${inquiry.inquiryId}`}
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="size-5 accent-[#1F6B43]"
        />
      </td>
      <td className="px-4 py-4 font-mono text-xs">{inquiry.inquiryId}</td>
      <td className="px-4 py-4">
        <p className="font-bold text-[#123D2A]">{inquiry.requester.fullName}</p>
        <p className="mt-1 text-xs text-[#6C7A70]">
          {inquiry.requester.requesterType} - {inquiry.requester.contactNumber}
        </p>
        <p className="mt-1 text-xs text-[#6C7A70]">
          {inquiry.requester.barangay || "Barangay not recorded"}
        </p>
      </td>
      <td className="px-4 py-4">
        <p className="font-semibold">{inquiry.equipmentName}</p>
        <p className="mt-1 text-xs text-[#6C7A70]">
          {inquiry.estimatedUsage} {inquiry.unitOfMeasurement}
        </p>
      </td>
      <td className="px-4 py-4">
        {formatDateRange(inquiry.preferredDate, inquiry.preferredEndDate)}
      </td>
      <td className="px-4 py-4">
        {schedule
          ? `${formatDateRange(schedule.date, schedule.endDate)} · ${schedule.startTime}–${schedule.endTime}`
          : "Not confirmed"}
      </td>
      <td className="px-4 py-4">
        <StatusBadge tone={statusTone(inquiry.status)}>{inquiry.status}</StatusBadge>
        <p className="mt-2 text-xs text-[#6C7A70]">
          Schedule: {inquiry.scheduleStatus}
        </p>
      </td>
      <td className="px-4 py-4">
        <StatusBadge tone={statusTone(inquiry.paymentStatus)}>
          {inquiry.paymentStatus}
        </StatusBadge>
      </td>
      <td className="px-4 py-4">
        <BookingActions
          inquiry={inquiry}
          schedule={schedule}
          onSelectBooking={onSelectBooking}
        />
      </td>
    </tr>
  );
}

function BookingMobileCard({
  inquiry,
  schedule,
  selected,
  onToggle,
  onSelectBooking,
}: {
  inquiry: RentalInquiry;
  schedule?: RentalSchedule;
  selected: boolean;
  onToggle: () => void;
  onSelectBooking: () => void;
}) {
  return (
    <article className="rounded-lg border border-[#CAD8CB] bg-white p-5">
      <div className="flex items-start gap-3">
        <input
          aria-label={`Select ${inquiry.inquiryId}`}
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 size-5 accent-[#1F6B43]"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-[#6C7A70]">{inquiry.inquiryId}</p>
          <h2 className="mt-1 truncate text-lg font-black text-[#123D2A]">
            {inquiry.requester.fullName}
          </h2>
          <p className="text-sm text-[#5D6D63]">
            {inquiry.equipmentName} -{" "}
            {formatDateRange(inquiry.preferredDate, inquiry.preferredEndDate)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge tone={statusTone(inquiry.status)}>{inquiry.status}</StatusBadge>
        <StatusBadge tone={statusTone(inquiry.paymentStatus)}>
          {inquiry.paymentStatus}
        </StatusBadge>
      </div>
      <p className="mt-4 text-sm text-[#5D6D63]">
        Schedule:{" "}
        <strong>
          {schedule
            ? `${formatDateRange(schedule.date, schedule.endDate)} ${schedule.startTime}–${schedule.endTime}`
            : "Not confirmed"}
        </strong>
      </p>
      <div className="mt-4">
        <BookingActions
          inquiry={inquiry}
          schedule={schedule}
          onSelectBooking={onSelectBooking}
        />
      </div>
    </article>
  );
}

function BookingActions({
  inquiry,
  schedule,
  onSelectBooking,
}: {
  inquiry: RentalInquiry;
  schedule?: RentalSchedule;
  onSelectBooking: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelectBooking}
      className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-[#CAD8CB] bg-white px-4 text-xs font-bold text-[#123D2A hover:bg-[#F7F8F3]"
    >
      <Eye className="mr-2 size-4" />
      View Details
    </button>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-[#5D6D63]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-normal text-[#294B39]"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
