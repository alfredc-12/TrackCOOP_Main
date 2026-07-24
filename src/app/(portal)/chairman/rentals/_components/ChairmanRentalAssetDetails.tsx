"use client";

import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Pencil,
  ShieldCheck,
  Tractor,
  WalletCards,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  EmptyState,
  ErrorState,
  ConfirmDialog,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { rentalApiRepository } from "@/app/rental/_lib/rentalApi";
import type {
  RentalInquiry,
  RentalMaintenanceRecord,
  RentalPayment,
  RentalSchedule,
  RentalService,
} from "@/app/rental/_types/rental";

type AssetDetailsData = {
  asset: RentalService;
  inquiries: RentalInquiry[];
  schedules: RentalSchedule[];
  maintenance: RentalMaintenanceRecord[];
  payments: RentalPayment[];
};

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: value.includes("T") ? "short" : undefined,
      }).format(date);
}

function formatDateRange(startDate?: string, endDate?: string) {
  if (!startDate) return "Not recorded";
  if (!endDate || startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

export function ChairmanRentalAssetDetails({
  serviceId,
}: {
  serviceId: string;
}) {
  const [data, setData] = useState<AssetDetailsData>();
  const [error, setError] = useState("");
  const [maintenanceToComplete, setMaintenanceToComplete] =
    useState<RentalMaintenanceRecord>();

  useEffect(() => {
    let active = true;
    void Promise.all([
      rentalApiRepository.getManagedRentalServiceById(serviceId),
      rentalApiRepository.getRentalInquiries(),
      rentalApiRepository.getRentalSchedules(),
      rentalApiRepository.getRentalMaintenanceRecords(serviceId),
      rentalApiRepository.getRentalPayments(),
    ])
      .then(([asset, inquiries, schedules, maintenance, payments]) => {
        if (!active) return;
        setData({
          asset,
          inquiries: inquiries.filter((item) => item.serviceId === serviceId),
          schedules: schedules.filter((item) => item.serviceId === serviceId),
          maintenance,
          payments: payments.filter((item) => item.equipmentName === asset.name),
        });
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Rental asset could not be loaded.");
        }
      });
    return () => {
      active = false;
    };
  }, [serviceId]);

  const totals = useMemo(() => {
    if (!data) return { income: 0, completed: 0, active: 0 };
    return {
      income: data.payments
        .filter((item) => item.status === "Paid")
        .reduce((sum, item) => sum + item.amount, 0),
      completed: data.inquiries.filter((item) => item.status === "Completed").length,
      active: data.schedules.filter((item) =>
        ["Confirmed", "In Progress"].includes(item.status),
      ).length,
    };
  }, [data]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingSkeleton />;

  const { asset } = data;

  async function completeMaintenance() {
    if (!maintenanceToComplete) return;
    try {
      const completed = await rentalApiRepository.completeRentalMaintenance(
        maintenanceToComplete.maintenanceId,
      );
      setData((current) =>
        current
          ? {
              ...current,
              maintenance: current.maintenance.map((item) =>
                item.maintenanceId === completed.maintenanceId
                  ? completed
                  : item,
              ),
            }
          : current,
      );
      setMaintenanceToComplete(undefined);
      toast.success("Maintenance marked completed.");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Maintenance could not be completed.",
      );
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={`Operations - ${asset.serviceId}`}
        title={asset.name}
        description={asset.description}
        actions={
          <>
            <Link
              href="/chairman/rentals/assets"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A]"
            >
              <ArrowLeft className="size-4" />
              Assets
            </Link>
            <Link
              href={`/chairman/rentals/assets/${serviceId}/edit`}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white"
            >
              <Pencil className="size-4" />
              Edit Asset
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Booking History" value={String(data.inquiries.length)} icon={CalendarDays} />
        <StatCard label="Active Schedules" value={String(totals.active)} icon={Tractor} />
        <StatCard label="Completed Rentals" value={String(totals.completed)} icon={ShieldCheck} />
        <StatCard
          label="Confirmed Income"
          value={new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
          }).format(totals.income)}
          icon={WalletCards}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-lg border border-[#CAD8CB] bg-white p-5">
          <div
            className="grid min-h-72 place-items-center rounded-lg bg-[#E7F2E4] bg-cover bg-center"
            style={
              asset.imageUrl
                ? { backgroundImage: `url("${asset.imageUrl.replaceAll('"', "%22")}")` }
                : undefined
            }
          >
            {!asset.imageUrl ? (
              <Tractor className="size-28 text-[#1F6B43]" strokeWidth={1.1} />
            ) : null}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <StatusBadge tone={asset.visibility === "Public" ? "success" : "neutral"}>
              {asset.visibility}
            </StatusBadge>
            <StatusBadge
              tone={asset.availability === "Available" ? "success" : "warning"}
            >
              {asset.availability}
            </StatusBadge>
            <StatusBadge
              tone={
                asset.operationalStatus === "Ready for Use"
                  ? "success"
                  : asset.operationalStatus === "Archived"
                    ? "danger"
                    : "warning"
              }
            >
              {asset.operationalStatus}
            </StatusBadge>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Detail label="Category" value={asset.category} />
            <Detail label="Unit of usage" value={asset.unitOfUsage || "Unconfigured"} />
            <Detail label="Capacity" value={asset.capacity || "Unconfigured"} />
            <Detail label="Service area" value={asset.serviceArea} />
            <Detail label="Operator" value={asset.operatorRequirement} />
            <Detail label="Condition" value={asset.assetCondition ?? "Not recorded"} />
            <Detail label="Last maintenance" value={formatDate(asset.lastMaintenanceDate)} />
            <Detail label="Next maintenance" value={formatDate(asset.nextMaintenanceDate)} />
          </dl>
        </section>

        <div className="grid content-start gap-5">
          <section className="rounded-lg border border-[#CAD8CB] bg-white p-5">
            <h2 className="text-lg font-black text-[#123D2A]">Public Listing Preview</h2>
            <p className="mt-3 text-sm leading-6 text-[#5D6D63]">
              {asset.publicDescription || asset.shortDescription}
            </p>
            <p className="mt-3 text-sm font-semibold text-[#294B39]">
              {asset.publicAvailabilityMessage ||
                "Final availability is confirmed during cooperative review."}
            </p>
            <Link
              href={`/rental/services/${asset.serviceId}`}
              target="_blank"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#123D2A]"
            >
              Open Public Preview
              <ExternalLink className="size-4" />
            </Link>
          </section>
          <section className="rounded-lg border border-[#E7C968] bg-[#FFF8E7] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6200]">
              Pending Client Validation
            </p>
            <p className="mt-2 text-sm leading-6 text-[#6C541A]">
              Rental pricing, member discounts, gasoline handling, deposits,
              cancellation rules, payment deadlines, and rescheduling policies
              remain unconfigured.
            </p>
          </section>
        </div>
      </div>

      <RecordSection
        title="Current and Upcoming Bookings"
        empty="No active or upcoming bookings for this asset."
        icon={CalendarDays}
        records={data.schedules
          .filter((item) => !["Completed", "Cancelled"].includes(item.status))
          .map((item) => ({
            id: item.rentalId,
            title: item.requesterName,
            detail: `${formatDateRange(item.date, item.endDate)} · ${item.startTime}–${item.endTime} · ${item.status}`,
            href: `/chairman/rentals/bookings/${item.inquiryId}`,
          }))}
      />
      <RecordSection
        title="Maintenance History"
        empty="No persisted maintenance records for this asset."
        icon={Wrench}
        records={data.maintenance.map((item) => ({
          id: item.maintenanceId,
          title: item.maintenanceType,
          detail: `${formatDate(item.startAt)} - ${item.status} - ${item.operationalImpact}`,
          action:
            item.status === "Completed" || item.status === "Cancelled"
              ? undefined
              : {
                  label: "Mark Completed",
                  onClick: () => setMaintenanceToComplete(item),
                },
        }))}
      />
      <RecordSection
        title="Booking History"
        empty="No booking history for this asset."
        icon={Tractor}
        records={data.inquiries.map((item) => ({
          id: item.inquiryId,
          title: item.requester.fullName,
          detail: `${formatDateRange(item.preferredDate, item.preferredEndDate)} · ${item.status} · ${item.paymentStatus}`,
          href: `/chairman/rentals/bookings/${item.inquiryId}`,
        }))}
      />

      <section className="rounded-lg border border-[#CAD8CB] bg-white p-5">
        <h2 className="text-lg font-black text-[#123D2A]">
          Internal and Audit Information
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#5D6D63]">
          {asset.internalNotes || "No internal asset notes have been recorded."}
        </p>
        <p className="mt-3 text-xs text-[#6C7A70]">
          Last database update: {formatDate(asset.updatedAt)}. Rental asset
          mutations create records in the shared audit_logs table.
        </p>
      </section>
      <ConfirmDialog
        open={Boolean(maintenanceToComplete)}
        onOpenChange={(open) => {
          if (!open) setMaintenanceToComplete(undefined);
        }}
        title="Mark maintenance completed?"
        description={`${maintenanceToComplete?.maintenanceType ?? "This maintenance period"} will stop blocking matching schedule times. The completion is recorded in the audit trail.`}
        confirmLabel="Mark Completed"
        onConfirm={() => void completeMaintenance()}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#6C7A70]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[#294B39]">{value}</dd>
    </div>
  );
}

function RecordSection({
  title,
  empty,
  icon,
  records,
}: {
  title: string;
  empty: string;
  icon: typeof Tractor;
  records: Array<{
    id: string;
    title: string;
    detail: string;
    href?: string;
    action?: { label: string; onClick: () => void };
  }>;
}) {
  if (!records.length) {
    return <EmptyState icon={icon} title={title} description={empty} />;
  }
  return (
    <section className="rounded-lg border border-[#CAD8CB] bg-white p-5">
      <h2 className="text-lg font-black text-[#123D2A]">{title}</h2>
      <div className="mt-4 grid gap-3">
        {records.map((record) => {
          const content = (
            <>
              <div>
                <p className="font-bold text-[#123D2A]">{record.title}</p>
                <p className="mt-1 text-sm text-[#5D6D63]">{record.detail}</p>
              </div>
              <span className="font-mono text-xs text-[#6C7A70]">{record.id}</span>
            </>
          );
          return record.href ? (
            <Link
              key={record.id}
              href={record.href}
              className="flex min-h-16 items-center justify-between gap-4 rounded-md border border-[#E2E8E2] p-4 hover:bg-[#F7F8F3]"
            >
              {content}
            </Link>
          ) : (
            <div
              key={record.id}
              className="flex min-h-16 items-center justify-between gap-4 rounded-md border border-[#E2E8E2] p-4"
            >
              {content}
              {record.action ? (
                <button
                  type="button"
                  onClick={record.action.onClick}
                  className="min-h-11 shrink-0 rounded-md border border-[#CAD8CB] px-3 text-xs font-bold text-[#123D2A]"
                >
                  {record.action.label}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
