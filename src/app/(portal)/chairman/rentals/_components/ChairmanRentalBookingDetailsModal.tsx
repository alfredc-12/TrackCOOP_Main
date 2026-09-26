"use client";


import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  FileText,
  History,
  Info,
  RefreshCcw,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { rentalApiRepository } from "@/app/rental/_lib/rentalApi";
import { formatPeso } from "@/app/rental/_lib/rentalFormatting";
import { rentalScheduleSchema } from "@/app/rental/_lib/rentalValidation";
import {
  type EquipmentAvailability,
  type RentalInquiry,
  type RentalSchedule,
  type RentalService,
  type RentalStatus,
  type RentalStatusHistoryEntry,
  type ScheduleConflict,
  type ScheduleStatus,
} from "@/app/rental/_types/rental";
import {
  getChairmanRentalActions,
  type ChairmanRentalAction,
} from "@/app/rental/_lib/rentalWorkflow";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormDialog,
  FormField,
  LoadingSkeleton,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { Modal } from "@/components/ui/Modal";

type ReviewDraft = {
  decision: RentalStatus;
  publicNote: string;
  internalNote: string;
};

type ScheduleDraft = {
  serviceId: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  assignedOperator: string;
  serviceLocation: string;
  barangay: string;
  preparationMinutes: number;
  travelMinutes: number;
  bufferMinutes: number;
  specialInstructions: string;
  status: ScheduleStatus;
};

const ASSIGNED_OPERATOR_OPTIONS = [
  "Cooperative operator",
  "Equipment custodian",
  "Barangay coordinator",
  "Certified member operator",
  "Chairman to assign",
];
function displayDate(value?: string, includeTime = false) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function displayDateRange(startDate?: string, endDate?: string) {
  if (!startDate) return "Not provided";
  if (!endDate || endDate === startDate) return displayDate(startDate);
  return `${displayDate(startDate)} – ${displayDate(endDate)}`;
}

function tone(
  status: string,
): "neutral" | "success" | "warning" | "danger" {
  if (["Completed", "Paid", "Payment Confirmed"].includes(status)) {
    return "success";
  }
  if (["Cancelled", "Rejected", "Unavailable", "Out of Service"].includes(status)) {
    return "danger";
  }
  if (
    status.includes("Awaiting") ||
    status.includes("Pending") ||
    status.includes("Maintenance") ||
    status.includes("Review")
  ) {
    return "warning";
  }
  return "neutral";
}

function defaultPublicResponse(
  action: ChairmanRentalAction,
  inquiry: RentalInquiry,
) {
  if (action.id === "start-review") {
    return "Your rental inquiry is now under review by NFFAC.";
  }
  if (action.id === "approve-scheduling") {
    return "Your rental inquiry is approved for scheduling. NFFAC will send the proposed date and time after checking availability.";
  }
  if (action.id === "mark-in-progress") {
    return `Your ${inquiry.equipmentName} rental is now in progress.`;
  }
  if (action.id === "mark-completed") {
    return `Your ${inquiry.equipmentName} rental has been completed. Thank you.`;
  }
  return "";
}

function rentalEstimateDetails(inquiry: RentalInquiry) {
  const estimate = inquiry.estimatedFee;
  if (!estimate) {
    return {
      originalRate: "Not set",
      discount: inquiry.requester.requesterType === "Member" ? "20% off when rate is set" : "None",
      finalAmount: "Pending rate confirmation",
    };
  }

  const originalDailyRate =
    estimate.originalDailyRate ??
    estimate.dailyRate + (estimate.discountAmount ?? 0);
  const discount =
    estimate.discountPercent && estimate.discountAmount
      ? `${estimate.discountPercent}% off (${formatPeso(estimate.discountAmount)} per day)`
      : "None";

  return {
    originalRate: formatPeso(originalDailyRate),
    discount,
    finalAmount: `${formatPeso(estimate.total)} estimated (${estimate.days} day${estimate.days === 1 ? "" : "s"} x ${formatPeso(estimate.dailyRate)})`,
  };
}

type TabType = "Details" | "Actions" | "History";

export function ChairmanRentalBookingDetailsModal({
  open,
  onClose,
  bookingId,
}: {
  bookingId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = React.useState<TabType>("Details");
  const [inquiry, setInquiry] = useState<RentalInquiry>();
  const [schedule, setSchedule] = useState<RentalSchedule>();
  const [services, setServices] = useState<RentalService[]>([]);
  const [availability, setAvailability] = useState<EquipmentAvailability>();
  const [history, setHistory] = useState<RentalStatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<ChairmanRentalAction>();
  const [review, setReview] = useState<ReviewDraft>({
    decision: "Under Review",
    publicNote: "",
    internalNote: "",
  });
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft>();
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<ScheduleConflict>();
  const [confirmAction, setConfirmAction] = useState<
    { kind: "review" | "schedule"; title: string; description: string } | undefined
  >();
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextInquiry, schedules, assets, availabilities, nextHistory] =
        await Promise.all([
          rentalApiRepository.getRentalInquiryById(bookingId),
          rentalApiRepository.getRentalSchedules(),
          rentalApiRepository.getManagedRentalServices(),
          rentalApiRepository.getEquipmentAvailability(),
          rentalApiRepository.getRentalStatusHistory(bookingId),
        ]);
      const nextSchedule = schedules.find(
        (item) => item.rentalId === nextInquiry.rentalId,
      );
      setInquiry(nextInquiry);
      setSchedule(nextSchedule);
      setServices(assets);
      setAvailability(
        availabilities.find(
          (item) => item.serviceId === nextInquiry.serviceId,
        ),
      );
      setHistory(nextHistory);
      setReview({
        decision: "Under Review",
        publicNote: nextInquiry.publicNote,
        internalNote: nextInquiry.internalNote ?? "",
      });
      setScheduleDraft({
        serviceId: nextSchedule?.serviceId ?? nextInquiry.serviceId,
        date:
          nextInquiry.status === "Rescheduled" &&
          nextInquiry.rescheduleRequest?.status === "Pending"
            ? nextInquiry.rescheduleRequest.requestedDate
            : nextSchedule?.date ?? nextInquiry.preferredDate,
        endDate:
          nextInquiry.status === "Rescheduled" &&
          nextInquiry.rescheduleRequest?.status === "Pending"
            ? nextInquiry.rescheduleRequest.requestedEndDate ??
              nextInquiry.rescheduleRequest.requestedDate
            : nextSchedule?.endDate ?? nextInquiry.preferredEndDate,
        startTime:
          nextSchedule?.startTime ??
          nextInquiry.preferredStartTime ??
          "08:00",
        endTime:
          nextSchedule?.endTime ?? nextInquiry.preferredEndTime ?? "17:00",
        assignedOperator: nextSchedule?.assignedOperator ?? "",
        serviceLocation:
          nextSchedule?.serviceLocation ?? nextInquiry.serviceLocation,
        barangay: nextSchedule?.barangay ?? nextInquiry.serviceBarangay,
        preparationMinutes: 0,
        travelMinutes: 0,
        bufferMinutes: 0,
        specialInstructions:
          nextSchedule?.specialInstructions ??
          nextInquiry.specialInstructions ??
          "",
        status: nextSchedule?.status ?? "Awaiting Confirmation",
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The rental booking could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const chairmanActions = useMemo(
    () =>
      inquiry
        ? getChairmanRentalActions(inquiry.status, schedule?.status)
        : [],
    [inquiry, schedule?.status],
  );

  function openChairmanAction(action: ChairmanRentalAction) {
    if (!inquiry) return;
    setActiveAction(action);
    if (action.kind === "status" && action.targetStatus) {
      setReview({
        decision: action.targetStatus,
        publicNote: defaultPublicResponse(action, inquiry),
        internalNote: "",
      });
      setReviewOpen(true);
      return;
    }
    setScheduleDraft((current) =>
      current
        ? {
            ...current,
            date:
              action.id === "approve-rescheduling"
                ? inquiry.rescheduleRequest?.requestedDate ?? current.date
                : current.date,
            endDate:
              action.id === "approve-rescheduling"
                ? inquiry.rescheduleRequest?.requestedEndDate ??
                  inquiry.rescheduleRequest?.requestedDate ??
                  current.endDate
                : current.endDate,
            status: action.scheduleStatus ?? current.status,
          }
        : current,
    );
    setConflict(undefined);
    setScheduleErrors({});
    setScheduleOpen(true);
  }

  function openScheduleEditor() {
    setActiveAction(undefined);
    setConflict(undefined);
    setScheduleErrors({});
    setScheduleDraft((current) =>
      current && schedule ? { ...current, status: schedule.status } : current,
    );
    setScheduleOpen(true);
  }

  function updateScheduleDraft<K extends keyof ScheduleDraft>(
    key: K,
    value: ScheduleDraft[K],
  ) {
    setScheduleDraft((current) => current ? { ...current, [key]: value } : current);
    setConflict(undefined);
    setScheduleErrors((current) => {
      const next = { ...current };
      delete next[String(key)];
      return next;
    });
  }

  function validateSchedule() {
    if (!inquiry || !scheduleDraft) return false;
    const result = rentalScheduleSchema.safeParse({
      ...scheduleDraft,
      rentalId: inquiry.rentalId,
    });
    const nextErrors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "schedule");
        nextErrors[key] ??= issue.message;
      }
    }
    const selectedAsset = services.find((item) => item.serviceId === scheduleDraft.serviceId);
    const operatorRequired = selectedAsset?.operatorRequirement &&
      !/not required|self[- ]?operated/i.test(selectedAsset.operatorRequirement);
    if (scheduleDraft.status === "Confirmed" && operatorRequired && !scheduleDraft.assignedOperator.trim()) {
      nextErrors.assignedOperator = "Assign an operator before confirming the schedule.";
    }
    setScheduleErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error("Please fix the highlighted schedule fields.");
      return false;
    }
    return true;
  }

  async function checkConflict() {
    if (!inquiry || !scheduleDraft) return;
    if (!validateSchedule()) return;
    try {
      const result = await rentalApiRepository.checkScheduleConflict({
        inquiryId: inquiry.inquiryId,
        rentalId: inquiry.rentalId,
        serviceId: scheduleDraft.serviceId,
        equipmentName:
          services.find((item) => item.serviceId === scheduleDraft.serviceId)
            ?.name ?? inquiry.equipmentName,
        requesterName: inquiry.requester.fullName,
        requesterType: inquiry.requester.requesterType,
        date: scheduleDraft.date,
        endDate: scheduleDraft.endDate,
        startTime: scheduleDraft.startTime,
        endTime: scheduleDraft.endTime,
        assignedOperator: scheduleDraft.assignedOperator || undefined,
        serviceLocation: scheduleDraft.serviceLocation,
        barangay: scheduleDraft.barangay,
        preparationMinutes: scheduleDraft.preparationMinutes,
        travelMinutes: scheduleDraft.travelMinutes,
        bufferMinutes: scheduleDraft.bufferMinutes,
        specialInstructions: scheduleDraft.specialInstructions || undefined,
      });
      setConflict(result);
      if (result.hasConflict) toast.error("A scheduling conflict was found.");
      else toast.success("No persisted schedule conflicts were found.");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Conflict check failed.",
      );
    }
  }

  async function saveReview() {
    if (!inquiry || !activeAction?.targetStatus) return;
    if (review.publicNote.trim().length < 10) {
      toast.error("Write a clear public response of at least 10 characters.");
      return;
    }
    if (review.publicNote.trim().length > 500 || review.internalNote.trim().length > 1000) {
      toast.error("Shorten the response or internal note before saving.");
      return;
    }
    setSaving(true);
    try {
      await rentalApiRepository.reviewRentalInquiry(
        inquiry.inquiryId,
        review.decision,
        review.publicNote,
        review.internalNote || undefined,
      );
      toast.success("Booking review saved.");
      setConfirmAction(undefined);
      setReviewOpen(false);
      setActiveAction(undefined);
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Review could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule() {
    if (!inquiry || !scheduleDraft) return;
    if (!validateSchedule()) return;
    if (!conflict || conflict.hasConflict) {
      toast.error("Check availability before saving the schedule.");
      return;
    }
    setSaving(true);
    try {
      const equipment =
        services.find((item) => item.serviceId === scheduleDraft.serviceId)
          ?.name ?? inquiry.equipmentName;
      const payload = {
        inquiryId: inquiry.inquiryId,
        rentalId: inquiry.rentalId,
        serviceId: scheduleDraft.serviceId,
        equipmentName: equipment,
        requesterName: inquiry.requester.fullName,
        requesterType: inquiry.requester.requesterType,
        date: scheduleDraft.date,
        endDate: scheduleDraft.endDate,
        startTime: scheduleDraft.startTime,
        endTime: scheduleDraft.endTime,
        assignedOperator: scheduleDraft.assignedOperator || undefined,
        serviceLocation: scheduleDraft.serviceLocation,
        barangay: scheduleDraft.barangay,
        preparationMinutes: scheduleDraft.preparationMinutes,
        travelMinutes: scheduleDraft.travelMinutes,
        bufferMinutes: scheduleDraft.bufferMinutes,
        specialInstructions: scheduleDraft.specialInstructions || undefined,
        status: scheduleDraft.status,
        paymentStatus: inquiry.paymentStatus,
      };
      if (schedule) {
        await rentalApiRepository.updateRentalSchedule(
          schedule.scheduleId,
          payload,
        );
      } else {
        await rentalApiRepository.createRentalSchedule(payload);
      }
      toast.success(
        schedule ? "Rental schedule updated." : "Rental schedule created.",
      );
      setConflict(undefined);
      setConfirmAction(undefined);
      setScheduleOpen(false);
      setActiveAction(undefined);
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Schedule could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (error) {
    return (
      <div className="grid gap-4">
        <Link
          href="/portal/chairman/rentals/bookings"
          className="inline-flex min-h-11 items-center gap-2 font-bold text-[#123D2A]"
        >
          <ArrowLeft className="size-4" /> Back to Rental Bookings
        </Link>
        <ErrorState message={error} />
      </div>
    );
  }
  if (!inquiry) {
    return (
      <EmptyState
        title="Booking not found"
        description="This booking does not exist or is no longer available."
      />
    );
  }
  const estimateDetails = rentalEstimateDetails(inquiry);

  return (
    <Modal
      trigger={null}
      open={open}
      onOpenChange={(val) => !val && onClose()}
      maxWidth="max-w-6xl"
      title={`Booking Details: ${inquiry.inquiryId}`}
      description={`${inquiry.equipmentName} requested by ${inquiry.requester.fullName} on ${displayDate(inquiry.submittedAt)}.`}
    >
      <div className="grid gap-6 max-h-[80vh] overflow-y-auto pr-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#CAD8CB] pb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {(["Details", "Actions", "History"] as TabType[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? "bg-[#123D2A] text-white"
                    : "bg-[#EEF2EC] text-[#5D6D63] hover:bg-[#CAD8CB] hover:text-[#123D2A]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A]"
            >
              <RefreshCcw className="size-4" /> Refresh
            </button>
            {schedule &&
            [
              "Approved for Scheduling",
              "Awaiting Confirmation",
              "Scheduled",
              "Payment Pending",
              "Payment Under Review",
              "Payment Confirmed",
            ].includes(inquiry.status) ? (
              <button
                type="button"
                onClick={openScheduleEditor}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-[#123D2A] px-4 text-sm font-bold text-white"
              >
                <CalendarPlus className="size-4" /> Edit Schedule
              </button>
            ) : null}
          </div>
        </div>
      <section className="flex flex-wrap gap-2 rounded-lg border border-[#CAD8CB] bg-white p-4">
        <StatusBadge tone={tone(inquiry.status)}>{inquiry.status}</StatusBadge>
        <StatusBadge tone={tone(inquiry.scheduleStatus)}>
          Schedule: {inquiry.scheduleStatus}
        </StatusBadge>
        <StatusBadge tone={tone(inquiry.paymentStatus)}>
          Payment: {inquiry.paymentStatus}
        </StatusBadge>
        <StatusBadge tone={tone(availability?.status ?? "")}>
          Asset: {availability?.status ?? "Unknown"}
        </StatusBadge>
      </section>

      {activeTab === "Actions" && (
      <section className="rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.05)]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#E7F2E4] text-[#1F6B43]">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-black text-[#123D2A]">
              Chairman rental actions
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#5D6D63]">
              Only actions valid for the current booking stage are shown. Every
              decision records the Chairman, public response, status history,
              and audit trail.
            </p>
          </div>
        </div>
        {chairmanActions.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {chairmanActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => openChairmanAction(action)}
                className={`min-h-20 rounded-md border p-4 text-left transition hover:-translate-y-0.5 ${
                  action.tone === "primary"
                    ? "border-[#1F6B43] bg-[#123D2A] text-white"
                    : action.tone === "danger"
                      ? "border-[#E7B8A8] bg-[#FFF4EC] text-[#7A3023]"
                      : "border-[#CAD8CB] bg-[#F7F8F3] text-[#123D2A]"
                }`}
              >
                <span className="flex items-center gap-2 font-black">
                  {action.kind === "schedule" ? (
                    <CalendarPlus className="size-4" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  {action.label}
                </span>
                <span
                  className={`mt-1 block text-xs leading-5 ${
                    action.tone === "primary"
                      ? "text-white/75"
                      : "text-[#5D6D63]"
                  }`}
                >
                  {action.description}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-md bg-[#F7F8F3] p-4 text-sm text-[#5D6D63]">
            This booking is closed. No further Chairman action is available.
          </p>
        )}
      </section>
      )}

      {activeTab === "Details" && (
        <>
      {inquiry.rescheduleRequest ? (
        <section
          className={`rounded-lg border p-5 ${
            inquiry.rescheduleRequest.status === "Pending"
              ? "border-[#E6C96C] bg-[#FFF9E8]"
              : "border-[#B9CABD] bg-[#E7F2E4]"
          }`}
        >
          <h2 className="font-black text-[#123D2A]">
            Reschedule request: {inquiry.rescheduleRequest.status}
          </h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#6C7A70]">
                Requested period
              </dt>
              <dd className="mt-1 font-bold text-[#123D2A]">
                {displayDateRange(
                  inquiry.rescheduleRequest.requestedDate,
                  inquiry.rescheduleRequest.requestedEndDate,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#6C7A70]">
                Alternative period
              </dt>
              <dd className="mt-1 font-bold text-[#123D2A]">
                {inquiry.rescheduleRequest.alternativeDate
                  ? displayDateRange(
                      inquiry.rescheduleRequest.alternativeDate,
                      inquiry.rescheduleRequest.alternativeEndDate,
                    )
                  : "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#6C7A70]">
                Reason
              </dt>
              <dd className="mt-1 text-[#294B39]">
                {inquiry.rescheduleRequest.reason}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#6C7A70]">
                Requested
              </dt>
              <dd className="mt-1 text-[#294B39]">
                {displayDate(inquiry.rescheduleRequest.requestedAt, true)}
              </dd>
            </div>
          </dl>
          {inquiry.rescheduleRequest.note ? (
            <p className="mt-4 rounded-md bg-white/70 p-3 text-sm text-[#294B39]">
              {inquiry.rescheduleRequest.note}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <DetailCard title="Booking details" icon={UserRound}>
          <InfoGrid
            items={[
              ["Booking number", inquiry.inquiryId],
              ["Customer name", inquiry.requester.fullName],
              ["Contact number", inquiry.requester.contactNumber],
              ["Email", inquiry.requester.email ?? "Not provided"],
              ["Customer type", inquiry.requester.requesterType],
              ["Equipment rented", inquiry.equipmentName],
              ["Start date", displayDate(inquiry.preferredDate)],
              ["End date", displayDate(inquiry.preferredEndDate)],
              ["Rental status", inquiry.status],
              ["Payment status", inquiry.paymentStatus],
              ["Notes or purpose", inquiry.requestDescription || inquiry.intendedUse],
            ]}
          />
          {inquiry.validId ? (
            <a
              href={rentalApiRepository.getRentalValidIdUrl(inquiry.inquiryId)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#123D2A] hover:bg-[#F1F5EF]"
            >
              <ShieldCheck className="size-4" />
              View valid ID
            </a>
          ) : null}
        </DetailCard>
        <DetailCard title="Rental amount estimate" icon={WalletCards}>
          <InfoGrid
            items={[
              ["Original rental rate", estimateDetails.originalRate],
              ["Discount if member", estimateDetails.discount],
              ["Final estimated amount", estimateDetails.finalAmount],
            ]}
          />
          <p className="mt-4 rounded-md bg-[#F7F8F3] p-3 text-sm font-semibold text-[#5D6D63]">
            This amount is only an estimate until the cooperative confirms the
            schedule and final payment.
          </p>
          <div className="hidden">
          <InfoGrid
            items={[
              ["Rental asset", inquiry.equipmentName],
              ["Intended use", inquiry.intendedUse],
              [
                "Preferred period",
                displayDateRange(
                  inquiry.preferredDate,
                  inquiry.preferredEndDate,
                ),
              ],
              [
                "Alternative period",
                inquiry.alternativeDate
                  ? displayDateRange(
                      inquiry.alternativeDate,
                      inquiry.alternativeEndDate,
                    )
                  : "Not provided",
              ],
              [
                "Preferred time",
                inquiry.preferredStartTime && inquiry.preferredEndTime
                  ? `${inquiry.preferredStartTime} – ${inquiry.preferredEndTime}`
                  : "Not provided",
              ],
              ["Duration", inquiry.estimatedDuration],
              [
                "Estimated usage",
                `${inquiry.estimatedUsage} ${inquiry.unitOfMeasurement}`,
              ],
              ["Service location", inquiry.serviceLocation],
              ["Service barangay", inquiry.serviceBarangay],
              ["Description", inquiry.requestDescription],
              [
                "Special instructions",
                inquiry.specialInstructions ?? "None provided",
              ],
              [
                "Preferred payment method",
                inquiry.preferredPaymentMethod ?? "Not specified",
              ],
            ]}
          />
          </div>
        </DetailCard>
        <div className="hidden">
          <InfoGrid
            items={[
              ["Request status", inquiry.status],
              ["Schedule status", inquiry.scheduleStatus],
              ["Payment status", inquiry.paymentStatus],
              ["Effective availability", availability?.status ?? "Unknown"],
              ["Assigned reviewer", inquiry.assignedReviewer ?? "Unassigned"],
              ["Assigned operator", schedule?.assignedOperator ?? "Unassigned"],
              [
                "Confirmed schedule",
                schedule
                  ? `${displayDateRange(schedule.date, schedule.endDate)} · ${schedule.startTime}–${schedule.endTime}`
                  : "Not scheduled",
              ],
            ]}
          />
        </div>
      </div>

      </>
      )}

      {activeTab === "History" && (
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <DetailCard title="Status timeline" icon={History}>
          {history.length ? (
            <ol className="grid gap-4">
              {history.map((item) => (
                <li
                  key={item.historyId}
                  className="relative border-l-2 border-[#B9CABD] pl-5"
                >
                  <span className="absolute -left-[7px] top-1 size-3 rounded-full bg-[#1F6B43]" />
                  <p className="font-bold text-[#123D2A]">
                    {item.previousStatus
                      ? `${item.previousStatus} -> ${item.newStatus}`
                      : item.newStatus}
                  </p>
                  <p className="mt-1 text-sm text-[#5D6D63]">
                    {item.remarks ?? "Status updated."}
                  </p>
                  <p className="mt-1 text-xs text-[#6C7A70]">
                    {displayDate(item.changedAt, true)} - {item.changedBy}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-[#5D6D63]">No status events recorded.</p>
          )}
        </DetailCard>
        <div className="grid gap-6">
          <DetailCard title="Notes" icon={Info}>
            <div className="grid gap-4 text-sm">
              <div className="rounded-md bg-[#E7F2E4] p-4">
                <strong className="text-[#123D2A]">Public note</strong>
                <p className="mt-2 leading-6 text-[#294B39]">
                  {inquiry.publicNote}
                </p>
              </div>
              <div className="rounded-md bg-[#F7F8F3] p-4">
                <strong className="text-[#123D2A]">Internal note</strong>
                <p className="mt-2 leading-6 text-[#5D6D63]">
                  {inquiry.internalNote ?? "No internal note."}
                </p>
              </div>
            </div>
          </DetailCard>
          <DetailCard title="Attachments" icon={FileText}>
            {inquiry.attachmentNames.length ? (
              <ul className="grid gap-2">
                {inquiry.attachmentNames.map((name) => (
                  <li
                    key={name}
                    className="rounded-md border border-[#CAD8CB] p-3 text-sm"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#5D6D63]">
                No inquiry attachments were submitted.
              </p>
            )}
          </DetailCard>
          <DetailCard title="Payment authority" icon={WalletCards}>
            <p className="text-sm leading-6 text-[#5D6D63]">
              Chairman can monitor payment progress. Recording, proof validation,
              receipt generation, and financial posting remain restricted to the
              Bookkeeper role.
            </p>
          </DetailCard>
        </div>
      </div>
      )}

      <FormDialog
        open={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open);
          if (!open && !saving) setActiveAction(undefined);
        }}
        title={activeAction?.label ?? "Chairman decision"}
        description={
          activeAction?.description ??
          "Save the requester-visible response and staff-only note together."
        }
      >
        <div className="grid gap-4">
          <div className="rounded-md border border-[#B9CABD] bg-[#E7F2E4] p-4 text-sm text-[#123D2A]">
            <strong>New request status:</strong> {review.decision}
          </div>
          <FormField
            label="Public response"
            required
            error={
              review.publicNote.trim().length > 0 && review.publicNote.trim().length < 10
                ? "Write at least 10 characters."
                : review.publicNote.length > 500
                  ? "Use 500 characters or fewer."
                  : undefined
            }
            hint="Required. Visible through the requester’s privacy-safe status view."
          >
            <textarea
              required
              rows={4}
              value={review.publicNote}
              maxLength={500}
              onChange={(event) =>
                setReview((current) => ({
                  ...current,
                  publicNote: event.target.value,
                }))
              }
              className="rounded-md border border-[#CAD8CB] p-3"
            />
          </FormField>
          <FormField label="Internal note" hint="Optional. Visible only to authorized staff." error={review.internalNote.length > 1000 ? "Use 1,000 characters or fewer." : undefined}>
            <textarea
              rows={3}
              value={review.internalNote}
              maxLength={1000}
              onChange={(event) =>
                setReview((current) => ({
                  ...current,
                  internalNote: event.target.value,
                }))
              }
              className="rounded-md border border-[#CAD8CB] p-3"
            />
          </FormField>
          <button
            type="button"
            disabled={!activeAction?.targetStatus || review.publicNote.trim().length < 10}
            onClick={() =>
              setConfirmAction({
                kind: "review",
                title: `${activeAction?.label ?? "Save this decision"}?`,
                description:
                  "This Chairman decision will update the public status and create history and audit records.",
              })
            }
            className="min-h-11 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </FormDialog>

      <FormDialog
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) {
            setConflict(undefined);
            if (!saving) setActiveAction(undefined);
          }
        }}
        title={
          activeAction?.kind === "schedule"
            ? activeAction.label
            : schedule
              ? "Edit rental schedule"
              : "Create rental schedule"
        }
        description={
          activeAction?.kind === "schedule"
            ? activeAction.description
            : "The server checks persisted bookings, maintenance periods, asset state, buffers, travel, and preparation time."
        }
      >
        {scheduleDraft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Rental asset">
              <select
                value={scheduleDraft.serviceId}
                onChange={(event) => updateScheduleDraft("serviceId", event.target.value)}
                className="h-11 rounded-md border border-[#CAD8CB] px-3"
              >
                {services
                  .filter(
                    (item) =>
                      !["Archived", "Out of Service"].includes(
                        item.operationalStatus,
                      ),
                  )
                  .map((item) => (
                    <option key={item.serviceId} value={item.serviceId}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </FormField>
            <FormField label="Schedule status">
              <select
                value={scheduleDraft.status}
                disabled={activeAction?.kind === "schedule"}
                onChange={(event) => updateScheduleDraft("status", event.target.value as ScheduleStatus)}
                className="h-11 rounded-md border border-[#CAD8CB] px-3 disabled:bg-[#F1F3EF] disabled:text-[#5D6D63]"
              >
                <option>Awaiting Confirmation</option>
                <option>Confirmed</option>
              </select>
            </FormField>
            <ScheduleInput
              label="Start date"
              type="date"
              value={scheduleDraft.date}
              error={scheduleErrors.date}
              onChange={(date) => updateScheduleDraft("date", date)}
            />
            <ScheduleInput
              label="End date"
              type="date"
              value={scheduleDraft.endDate}
              min={scheduleDraft.date}
              error={scheduleErrors.endDate}
              onChange={(endDate) => updateScheduleDraft("endDate", endDate)}
            />
            <div className="grid grid-cols-2 gap-3">
              <ScheduleInput
                label="Start"
                type="time"
                value={scheduleDraft.startTime}
                error={scheduleErrors.startTime}
                onChange={(startTime) => updateScheduleDraft("startTime", startTime)}
              />
              <ScheduleInput
                label="End"
                type="time"
                value={scheduleDraft.endTime}
                error={scheduleErrors.endTime}
                onChange={(endTime) => updateScheduleDraft("endTime", endTime)}
              />
            </div>
            <FormField
              label="Assigned operator"
              required={scheduleDraft.status === "Confirmed"}
              error={scheduleErrors.assignedOperator}
            >
              <select
                value={scheduleDraft.assignedOperator}
                onChange={(event) => updateScheduleDraft("assignedOperator", event.target.value)}
                className="rounded-md border border-[#CAD8CB] p-3"
              >
                <option value="">Choose operator</option>
                {scheduleDraft.assignedOperator &&
                !ASSIGNED_OPERATOR_OPTIONS.includes(scheduleDraft.assignedOperator) ? (
                  <option>{scheduleDraft.assignedOperator}</option>
                ) : null}
                {ASSIGNED_OPERATOR_OPTIONS.map((operator) => (
                  <option key={operator}>{operator}</option>
                ))}
              </select>
            </FormField>
            <ScheduleInput
              label="Service location"
              value={scheduleDraft.serviceLocation}
              error={scheduleErrors.serviceLocation}
              onChange={(serviceLocation) => updateScheduleDraft("serviceLocation", serviceLocation)}
            />
            <ScheduleInput
              label="Barangay"
              value={scheduleDraft.barangay}
              error={scheduleErrors.barangay}
              onChange={(barangay) => updateScheduleDraft("barangay", barangay)}
            />
            <div className="sm:col-span-2">
              <FormField label="Internal schedule instructions">
                <textarea
                  rows={3}
                  value={scheduleDraft.specialInstructions}
                  maxLength={1000}
                  onChange={(event) => updateScheduleDraft("specialInstructions", event.target.value)}
                  className="rounded-md border border-[#CAD8CB] p-3"
                />
              </FormField>
            </div>
            {conflict ? (
              <div
                className={`sm:col-span-2 rounded-md border p-4 text-sm ${
                  conflict.hasConflict
                    ? "border-[#E7B8A8] bg-[#FFF4EC] text-[#7A3023]"
                    : "border-[#B9CABD] bg-[#E7F2E4] text-[#123D2A]"
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {conflict.hasConflict ? (
                    <AlertTriangle className="size-4" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  {conflict.hasConflict
                    ? "Conflict requires action"
                    : "Schedule is available"}
                </div>
                {conflict.reasons.length ? (
                  <ul className="mt-2 list-disc pl-5">
                    {conflict.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
                {conflict.suggestedSlots.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {conflict.suggestedSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          const [startTime, endTime] = slot.split(/[–-]/);
                          updateScheduleDraft("startTime", startTime);
                          updateScheduleDraft("endTime", endTime);
                        }}
                        className="min-h-10 rounded-md border border-current bg-white px-3 font-bold"
                      >
                        Use {slot}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="button"
                onClick={() => void checkConflict()}
                className="min-h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#123D2A]"
              >
                Check Availability
              </button>
              <button
                type="button"
                disabled={!conflict || conflict.hasConflict}
                onClick={() =>
                  setConfirmAction({
                    kind: "schedule",
                    title: activeAction?.label
                      ? `${activeAction.label}?`
                      : schedule
                        ? "Update this rental schedule?"
                        : "Create this rental schedule?",
                    description:
                      "The server will re-check conflicts inside a database transaction before saving.",
                  })
                }
                className="min-h-11 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {activeAction?.kind === "schedule"
                  ? activeAction.label
                  : schedule
                    ? "Update Schedule"
                    : "Create Schedule"}
              </button>
            </div>
          </div>
        ) : null}
      </FormDialog>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open && !saving) setConfirmAction(undefined);
        }}
        title={confirmAction?.title ?? "Confirm rental action"}
        description={
          confirmAction?.description ??
          "Confirm this change to the shared rental database."
        }
        confirmLabel={saving ? "Saving..." : "Confirm"}
        onConfirm={() =>
          void (confirmAction?.kind === "schedule"
            ? saveSchedule()
            : saveReview())
        }
      />
    </div>
    </Modal>
  );
}

function DetailCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Info;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.05)]">
      <h2 className="flex items-center gap-2 text-lg font-black text-[#123D2A]">
        <Icon className="size-5 text-[#1F6B43]" />
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid gap-4">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#6C7A70]">
            {label}
          </dt>
          <dd className="mt-1 break-words text-sm leading-6 text-[#294B39]">
            {value || "Not provided"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ScheduleInput({
  label,
  value,
  onChange,
  type = "text",
  min,
  error,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date" | "time" | "number";
  min?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <FormField label={label} required={required} error={error}>
      <input
        type={type}
        min={type === "number" ? 0 : min}
        max={type === "number" ? 1440 : undefined}
        maxLength={type === "text" ? 250 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={`h-11 rounded-md border px-3 ${error ? "border-[#B42318]" : "border-[#CAD8CB]"}`}
      />
    </FormField>
  );
}
