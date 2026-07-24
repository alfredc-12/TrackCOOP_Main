"use client";

import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { rentalApiRepository } from "@/app/rental/_lib/rentalApi";
import type {
  RentalInquiry,
  RentalSchedule,
} from "@/app/rental/_types/rental";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";

type CalendarView = "Month" | "Week" | "Day" | "List";

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthDays(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));
  const result: Date[] = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    result.push(new Date(date));
  }
  return result;
}

function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions) {
  const date = typeof value === "string" ? parseDate(value) : value;
  return new Intl.DateTimeFormat("en-PH", options ?? { dateStyle: "medium" }).format(
    date,
  );
}

function scheduleCoversDate(schedule: RentalSchedule, dateKey: string) {
  return schedule.date <= dateKey && schedule.endDate >= dateKey;
}

function scheduleIntersects(
  schedule: RentalSchedule,
  startDate: string,
  endDate: string,
) {
  return schedule.date <= endDate && schedule.endDate >= startDate;
}

function formatDateRange(schedule: RentalSchedule) {
  return schedule.date === schedule.endDate
    ? formatDate(schedule.date)
    : `${formatDate(schedule.date)} – ${formatDate(schedule.endDate)}`;
}

export function ChairmanRentalCalendar() {
  const [schedules, setSchedules] = useState<RentalSchedule[]>([]);
  const [inquiries, setInquiries] = useState<RentalInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<CalendarView>("Month");
  const [cursor, setCursor] = useState(() => new Date());
  const [asset, setAsset] = useState("All");
  const [requester, setRequester] = useState("");
  const [requesterType, setRequesterType] = useState("All");
  const [requestStatus, setRequestStatus] = useState("All");
  const [scheduleStatus, setScheduleStatus] = useState("All");
  const [operator, setOperator] = useState("All");
  const [barangay, setBarangay] = useState("All");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextSchedules, nextInquiries] = await Promise.all([
        rentalApiRepository.getRentalSchedules(),
        rentalApiRepository.getRentalInquiries(),
      ]);
      setSchedules(nextSchedules);
      setInquiries(nextInquiries);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The rental calendar could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const inquiryByRental = useMemo(
    () => new Map(inquiries.map((item) => [item.rentalId, item])),
    [inquiries],
  );
  const filtered = useMemo(() => {
    const query = requester.trim().toLowerCase();
    return schedules
      .filter((item) => {
        const inquiry = inquiryByRental.get(item.rentalId);
        return (
          (asset === "All" || item.serviceId === asset) &&
          (!query ||
            `${item.requesterName} ${item.inquiryId}`
              .toLowerCase()
              .includes(query)) &&
          (requesterType === "All" ||
            item.requesterType === requesterType) &&
          (requestStatus === "All" ||
            inquiry?.status === requestStatus) &&
          (scheduleStatus === "All" || item.status === scheduleStatus) &&
          (operator === "All" ||
            (item.assignedOperator ?? "Unassigned") === operator) &&
          (barangay === "All" || item.barangay === barangay)
        );
      })
      .sort(
        (left, right) =>
          `${left.date} ${left.startTime}`.localeCompare(
            `${right.date} ${right.startTime}`,
          ),
      );
  }, [
    asset,
    barangay,
    inquiryByRental,
    operator,
    requestStatus,
    requester,
    requesterType,
    scheduleStatus,
    schedules,
  ]);

  const visible = useMemo(() => {
    const cursorKey = localDateKey(cursor);
    if (view === "Day") {
      return filtered.filter((item) => scheduleCoversDate(item, cursorKey));
    }
    if (view === "Week") {
      const start = new Date(cursor);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return filtered.filter((item) =>
        scheduleIntersects(item, localDateKey(start), localDateKey(end)),
      );
    }
    if (view === "Month") {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      return filtered.filter((item) =>
        scheduleIntersects(item, localDateKey(start), localDateKey(end)),
      );
    }
    return filtered;
  }, [cursor, filtered, view]);

  function move(direction: -1 | 1) {
    const next = new Date(cursor);
    if (view === "Month") next.setMonth(next.getMonth() + direction);
    else if (view === "Week") next.setDate(next.getDate() + 7 * direction);
    else next.setDate(next.getDate() + direction);
    setCursor(next);
  }

  const title =
    view === "Month"
      ? formatDate(cursor, { month: "long", year: "numeric" })
      : view === "Day"
        ? formatDate(cursor)
        : view === "Week"
          ? `Week of ${formatDate(
              (() => {
                const start = new Date(cursor);
                start.setDate(start.getDate() - start.getDay());
                return start;
              })(),
            )}`
          : "All persisted schedules";

  return (
    <div className="grid gap-6">
      <Link
        href="/chairman/rentals/bookings"
        className="inline-flex min-h-11 w-fit items-center gap-2 font-bold text-[#123D2A]"
      >
        <ArrowLeft className="size-4" /> Back to Rental Bookings
      </Link>
      <PageHeader
        eyebrow="Operations"
        title="Rental Calendar"
        description="View persisted rental schedules by month, week, day, or list. Maintenance and asset conflicts are enforced by the server when a schedule is saved."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A]"
          >
            <RefreshCcw className="size-4" /> Refresh
          </button>
        }
      />

      <section className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Filter
          label="Asset"
          value={asset}
          onChange={setAsset}
          options={[
            ["All", "All assets"],
            ...Array.from(
              new Map(
                schedules.map((item) => [
                  item.serviceId,
                  [item.serviceId, item.equipmentName] as [string, string],
                ]),
              ).values(),
            ),
          ]}
        />
        <label className="grid gap-1 text-xs font-bold text-[#5D6D63]">
          Requester or reference
          <input
            value={requester}
            onChange={(event) => setRequester(event.target.value)}
            type="search"
            className="h-11 rounded-md border border-[#CAD8CB] px-3 text-sm font-normal"
          />
        </label>
        <Filter
          label="Requester type"
          value={requesterType}
          onChange={setRequesterType}
          options={[
            ["All", "All requester types"],
            ["Member", "Member"],
            ["Public or Non-member", "Public or Non-member"],
          ]}
        />
        <Filter
          label="Request status"
          value={requestStatus}
          onChange={setRequestStatus}
          options={[
            ["All", "All request statuses"],
            ...Array.from(new Set(inquiries.map((item) => item.status))).map(
              (item) => [item, item] as [string, string],
            ),
          ]}
        />
        <Filter
          label="Schedule status"
          value={scheduleStatus}
          onChange={setScheduleStatus}
          options={[
            ["All", "All schedule statuses"],
            ...Array.from(new Set(schedules.map((item) => item.status))).map(
              (item) => [item, item] as [string, string],
            ),
          ]}
        />
        <Filter
          label="Operator"
          value={operator}
          onChange={setOperator}
          options={[
            ["All", "All operators"],
            ...Array.from(
              new Set(
                schedules.map((item) => item.assignedOperator ?? "Unassigned"),
              ),
            ).map((item) => [item, item] as [string, string]),
          ]}
        />
        <Filter
          label="Barangay"
          value={barangay}
          onChange={setBarangay}
          options={[
            ["All", "All barangays"],
            ...Array.from(
              new Set(schedules.map((item) => item.barangay).filter(Boolean)),
            ).map((item) => [item, item] as [string, string]),
          ]}
        />
        <div className="rounded-md bg-[#F7F8F3] p-3 text-xs leading-5 text-[#5D6D63]">
          <strong className="text-[#123D2A]">Conflict status:</strong> protected
          server-side at schedule creation and update.
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {view !== "List" ? (
            <>
              <button
                type="button"
                aria-label="Previous period"
                onClick={() => move(-1)}
                className="grid min-h-11 min-w-11 place-items-center rounded-md border border-[#CAD8CB]"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setCursor(new Date())}
                className="min-h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold"
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next period"
                onClick={() => move(1)}
                className="grid min-h-11 min-w-11 place-items-center rounded-md border border-[#CAD8CB]"
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          ) : null}
          <h2 className="ml-2 font-black text-[#123D2A]">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["Month", "Week", "Day", "List"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`min-h-11 rounded-md px-4 text-sm font-bold ${
                item === view
                  ? "bg-[#123D2A] text-white"
                  : "border border-[#CAD8CB] text-[#123D2A]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {error ? <ErrorState message={error} /> : null}
      {loading ? (
        <LoadingSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No rental schedules"
          description="Confirmed and proposed rental schedules will appear after the Chairman schedules a booking."
        />
      ) : view === "Month" ? (
        <MonthGrid cursor={cursor} schedules={filtered} />
      ) : visible.length ? (
        <ScheduleList schedules={visible} />
      ) : (
        <EmptyState
          icon={CalendarDays}
          title={`No schedules in this ${view.toLowerCase()}`}
          description="Move to another period or adjust the filters."
        />
      )}
    </div>
  );
}

function MonthGrid({
  cursor,
  schedules,
}: {
  cursor: Date;
  schedules: RentalSchedule[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#CAD8CB] bg-white">
      <div className="hidden grid-cols-7 border-b border-[#CAD8CB] bg-[#F7F8F3] md:grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="p-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-[#5D6D63]"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="hidden grid-cols-7 md:grid">
        {monthDays(cursor).map((date) => {
          const key = localDateKey(date);
          const records = schedules.filter((item) =>
            scheduleCoversDate(item, key),
          );
          return (
            <div
              key={key}
              className={`min-h-36 border-b border-r border-[#E2E8E2] p-2 ${
                date.getMonth() === cursor.getMonth()
                  ? "bg-white"
                  : "bg-[#F7F8F3] text-[#8A958E]"
              }`}
            >
              <span className="text-xs font-bold">{date.getDate()}</span>
              <div className="mt-2 grid gap-1">
                {records.slice(0, 3).map((item) => (
                  <Link
                    key={item.scheduleId}
                    href={`/chairman/rentals/bookings/${item.inquiryId}`}
                    className="rounded bg-[#E7F2E4] p-2 text-xs text-[#123D2A]"
                  >
                    <strong>
                      {key === item.date ? item.startTime : "Continues"}
                    </strong>{" "}
                    {item.equipmentName}
                  </Link>
                ))}
                {records.length > 3 ? (
                  <span className="text-xs font-bold">
                    +{records.length - 3} more
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 p-3 md:hidden">
        <ScheduleList
          schedules={schedules.filter((item) => {
            const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
            const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
            return scheduleIntersects(
              item,
              localDateKey(start),
              localDateKey(end),
            );
          })}
        />
      </div>
    </div>
  );
}

function ScheduleList({ schedules }: { schedules: RentalSchedule[] }) {
  return (
    <div className="grid gap-3">
      {schedules.map((item) => (
        <article
          key={item.scheduleId}
          className="grid gap-4 rounded-lg border border-[#CAD8CB] bg-white p-5 md:grid-cols-[0.7fr_1fr_1fr_auto] md:items-center"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6C7A70]">
              {formatDateRange(item)}
            </p>
            <p className="mt-1 flex items-center gap-2 font-black text-[#123D2A]">
              <Clock3 className="size-4" />
              {item.startTime}-{item.endTime}
            </p>
          </div>
          <div>
            <p className="font-black text-[#123D2A]">{item.equipmentName}</p>
            <p className="mt-1 text-sm text-[#5D6D63]">
              {item.requesterName} - {item.requesterType}
            </p>
          </div>
          <div className="text-sm text-[#5D6D63]">
            <p>{item.serviceLocation}</p>
            <p>{item.barangay || "Barangay not recorded"}</p>
            <p>{item.assignedOperator ?? "Operator unassigned"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <StatusBadge>{item.status}</StatusBadge>
            <StatusBadge>{item.paymentStatus}</StatusBadge>
            <Link
              href={`/chairman/rentals/bookings/${item.inquiryId}`}
              className="inline-flex min-h-11 items-center rounded-md border border-[#CAD8CB] px-3 text-xs font-bold text-[#123D2A]"
            >
              Open
            </Link>
          </div>
        </article>
      ))}
    </div>
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
  options: Array<[string, string]>;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-[#5D6D63]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-normal text-[#294B39]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
