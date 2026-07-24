"use client";

import {
  Archive,
  CalendarCheck2,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Tractor,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { rentalApiRepository } from "@/app/rental/_lib/rentalApi";
import type {
  EquipmentAvailability,
  RentalMaintenanceRecord,
  RentalSchedule,
  RentalService,
} from "@/app/rental/_types/rental";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FormDialog,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";

type PendingAction = {
  title: string;
  description: string;
  label: string;
  run: () => Promise<unknown>;
};

type AssetStatusFilter = "All" | "Available" | "Maintenance" | "Unavailable" | "Archived";

const statusFilters: AssetStatusFilter[] = [
  "All",
  "Available",
  "Maintenance",
  "Unavailable",
  "Archived",
];

const quickAvailabilityOptions: Array<EquipmentAvailability["status"]> = [
  "Available",
  "Under Maintenance",
  "Unavailable",
];

function tone(value: string): "neutral" | "success" | "warning" | "danger" {
  if (["Public", "Available", "Ready for Use"].includes(value)) return "success";
  if (["Limited Availability", "Reserved", "In Use", "Under Maintenance"].includes(value)) {
    return "warning";
  }
  if (["Unavailable", "Out of Service", "Archived"].includes(value)) return "danger";
  return "neutral";
}

function displayDate(value?: string) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(parsed);
}

function displayDateRange(startDate?: string, endDate?: string) {
  if (!startDate) return "Not recorded";
  if (!endDate || startDate === endDate) return displayDate(startDate);
  return `${displayDate(startDate)} – ${displayDate(endDate)}`;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function matchesStatusFilter(
  asset: RentalService,
  effective: EquipmentAvailability | undefined,
  filter: AssetStatusFilter,
) {
  const effectiveStatus = effective?.status ?? asset.availability;
  if (filter === "All") return true;
  if (filter === "Available") {
    return effectiveStatus === "Available" && asset.operationalStatus === "Ready for Use";
  }
  if (filter === "Maintenance") {
    return effectiveStatus === "Under Maintenance" || asset.operationalStatus === "Under Maintenance";
  }
  if (filter === "Unavailable") {
    return effectiveStatus === "Unavailable" || asset.operationalStatus === "Out of Service";
  }
  return asset.operationalStatus === "Archived";
}

export function ChairmanRentalAssetsClient() {
  const [assets, setAssets] = useState<RentalService[]>([]);
  const [availability, setAvailability] = useState<EquipmentAvailability[]>([]);
  const [schedules, setSchedules] = useState<RentalSchedule[]>([]);
  const [maintenance, setMaintenance] = useState<RentalMaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [visibility, setVisibility] = useState("All");
  const [statusFilter, setStatusFilter] = useState<AssetStatusFilter>("All");
  const [sort, setSort] = useState("updated-desc");
  const [pending, setPending] = useState<PendingAction>();
  const [maintenanceAsset, setMaintenanceAsset] = useState<RentalService>();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextAssets, nextAvailability, nextSchedules, nextMaintenance] =
        await Promise.all([
          rentalApiRepository.getManagedRentalServices(),
          rentalApiRepository.getEquipmentAvailability(),
          rentalApiRepository.getRentalSchedules(),
          rentalApiRepository.getRentalMaintenanceRecords(),
        ]);
      setAssets(nextAssets);
      setAvailability(nextAvailability);
      setSchedules(nextSchedules);
      setMaintenance(nextMaintenance);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Rental assets could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const availabilityById = useMemo(
    () => new Map(availability.map((item) => [item.serviceId, item])),
    [availability],
  );

  const nextScheduleById = useMemo(() => {
    const result = new Map<string, RentalSchedule>();
    const activeSchedules = schedules
      .filter((item) => !["Cancelled", "Completed"].includes(item.status))
      .sort((left, right) =>
        `${left.date} ${left.startTime}`.localeCompare(`${right.date} ${right.startTime}`),
      );
    for (const schedule of activeSchedules) {
      if (!result.has(schedule.serviceId)) result.set(schedule.serviceId, schedule);
    }
    return result;
  }, [schedules]);

  const latestMaintenanceById = useMemo(() => {
    const result = new Map<string, RentalMaintenanceRecord>();
    const sorted = [...maintenance].sort((left, right) =>
      `${right.startAt} ${right.createdAt}`.localeCompare(`${left.startAt} ${left.createdAt}`),
    );
    for (const record of sorted) {
      if (!result.has(record.serviceId)) result.set(record.serviceId, record);
    }
    return result;
  }, [maintenance]);

  const metrics = useMemo(() => {
    const availableNow = assets.filter((asset) =>
      matchesStatusFilter(asset, availabilityById.get(asset.serviceId), "Available"),
    ).length;
    const needsAttention = assets.filter((asset) =>
      ["Under Maintenance", "Out of Service", "Archived"].includes(asset.operationalStatus),
    ).length;
    return [
      { label: "Total Assets", value: assets.length, icon: Tractor },
      {
        label: "Public Assets",
        value: assets.filter((item) => item.visibility === "Public").length,
        icon: Eye,
      },
      { label: "Available Now", value: availableNow, icon: CalendarCheck2 },
      { label: "Needs Attention", value: needsAttention, icon: ShieldAlert },
    ];
  }, [assets, availabilityById]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets
      .filter((asset) => {
        const effective = availabilityById.get(asset.serviceId);
        return (
          (!query ||
            `${asset.serviceId} ${asset.name} ${asset.category} ${asset.shortDescription}`
              .toLowerCase()
              .includes(query)) &&
          (category === "All" || asset.category === category) &&
          (visibility === "All" || asset.visibility === visibility) &&
          matchesStatusFilter(asset, effective, statusFilter)
        );
      })
      .sort((left, right) => {
        if (sort === "name") return left.name.localeCompare(right.name);
        if (sort === "next-booking") {
          return (nextScheduleById.get(left.serviceId)?.date ?? "9999").localeCompare(
            nextScheduleById.get(right.serviceId)?.date ?? "9999",
          );
        }
        return (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "");
      });
  }, [
    assets,
    availabilityById,
    category,
    nextScheduleById,
    search,
    sort,
    statusFilter,
    visibility,
  ]);

  function queueAction(action: PendingAction) {
    setPending(action);
  }

  async function runPending() {
    if (!pending) return;
    const action = pending;
    setPending(undefined);
    try {
      await action.run();
      toast.success(`${action.label} completed.`);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Action failed.");
    }
  }

  function updateAsset(
    asset: RentalService,
    updates: Partial<RentalService>,
    title: string,
    description: string,
    label: string,
  ) {
    queueAction({
      title,
      description,
      label,
      run: () => rentalApiRepository.updateRentalService(asset.serviceId, updates),
    });
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Rental Assets"
        description="Manage equipment availability, public visibility, maintenance, and upcoming rental use."
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
            <Link
              href="/chairman/rentals/assets/new"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43]"
            >
              <Plus className="size-4" />
              Add Asset
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

      <section className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 md:grid-cols-2 xl:grid-cols-[2fr_repeat(4,minmax(0,1fr))]">
        <label className="grid gap-1 text-xs font-bold text-[#5D6D63]">
          Search
          <span className="relative">
            <Search className="absolute left-3 top-3.5 size-4 text-[#6C7A70]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              placeholder="Asset code, name, category"
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-3 text-sm font-normal outline-none focus:border-[#1F6B43]"
            />
          </span>
        </label>
        <Filter
          label="Category"
          value={category}
          onChange={setCategory}
          options={["All", ...unique(assets.map((item) => item.category))]}
        />
        <Filter
          label="Visibility"
          value={visibility}
          onChange={setVisibility}
          options={["All", "Public", "Member-only", "Internal only", "Hidden"]}
        />
        <Filter
          label="Status"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as AssetStatusFilter)}
          options={statusFilters}
        />
        <Filter
          label="Sort"
          value={sort}
          onChange={setSort}
          options={["updated-desc", "name", "next-booking"]}
          labels={{
            "updated-desc": "Recently updated",
            name: "Name",
            "next-booking": "Next booking",
          }}
        />
      </section>

      {error ? <ErrorState message={error} /> : null}
      {loading ? (
        <LoadingSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Tractor}
          title={assets.length ? "No assets match these filters" : "No rental assets"}
          description={
            assets.length
              ? "Adjust the search or filters to see other equipment."
              : "Create the first database-backed rental asset for NFFAC."
          }
        />
      ) : (
        <>
          <div className="hidden xl:block">
            <DataTable>
              <table className="min-w-[1100px] divide-y divide-[#E2E8E2] text-left text-sm">
                <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.1em] text-[#5D6D63]">
                  <tr>
                    {[
                      "Asset",
                      "Status",
                      "Visibility",
                      "Next Booking",
                      "Maintenance",
                      "Updated",
                      "Actions",
                    ].map((heading) => (
                      <th key={heading} className="px-4 py-4">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
                  {filtered.map((asset) => (
                    <AssetRow
                      key={asset.serviceId}
                      asset={asset}
                      effective={availabilityById.get(asset.serviceId)}
                      schedule={nextScheduleById.get(asset.serviceId)}
                      maintenance={latestMaintenanceById.get(asset.serviceId)}
                      onAction={queueAction}
                      onUpdate={updateAsset}
                      onMaintenance={() => setMaintenanceAsset(asset)}
                    />
                  ))}
                </tbody>
              </table>
            </DataTable>
          </div>
          <div className="grid gap-3 xl:hidden">
            {filtered.map((asset) => (
              <AssetMobileCard
                key={asset.serviceId}
                asset={asset}
                effective={availabilityById.get(asset.serviceId)}
                schedule={nextScheduleById.get(asset.serviceId)}
                onAction={queueAction}
                onUpdate={updateAsset}
                onMaintenance={() => setMaintenanceAsset(asset)}
              />
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(undefined);
        }}
        title={pending?.title ?? "Confirm rental asset action"}
        description={pending?.description ?? "Confirm this asset change."}
        confirmLabel={pending?.label ?? "Confirm"}
        onConfirm={() => void runPending()}
      />
      <MaintenanceDialog
        asset={maintenanceAsset}
        onClose={() => setMaintenanceAsset(undefined)}
        onSaved={async () => {
          setMaintenanceAsset(undefined);
          await load();
        }}
      />
    </div>
  );
}

function AssetRow({
  asset,
  effective,
  schedule,
  maintenance,
  onAction,
  onUpdate,
  onMaintenance,
}: {
  asset: RentalService;
  effective?: EquipmentAvailability;
  schedule?: RentalSchedule;
  maintenance?: RentalMaintenanceRecord;
  onAction: (action: PendingAction) => void;
  onUpdate: (
    asset: RentalService,
    updates: Partial<RentalService>,
    title: string,
    description: string,
    label: string,
  ) => void;
  onMaintenance: () => void;
}) {
  return (
    <tr className="align-top hover:bg-[#F7F8F3]">
      <td className="px-4 py-4">
        <AssetSummary asset={asset} />
      </td>
      <td className="px-4 py-4">
        <StatusBadge tone={tone(effective?.status ?? asset.availability)}>
          {effective?.status ?? asset.availability}
        </StatusBadge>
        <p className="mt-2 text-xs text-[#6C7A70]">
          Operational: {asset.operationalStatus}
        </p>
      </td>
      <td className="px-4 py-4">
        <StatusBadge tone={tone(asset.visibility)}>{asset.visibility}</StatusBadge>
      </td>
      <td className="px-4 py-4">
        {schedule ? (
          <>
            <p className="font-semibold">
              {displayDateRange(schedule.date, schedule.endDate)}
            </p>
            <p className="mt-1 text-xs text-[#6C7A70]">
              {schedule.startTime}-{schedule.endTime} - {schedule.requesterName}
            </p>
          </>
        ) : (
          "None scheduled"
        )}
      </td>
      <td className="px-4 py-4">
        <p>{maintenance?.status ?? "No active record"}</p>
        <p className="mt-1 text-xs text-[#6C7A70]">
          Next: {displayDate(asset.nextMaintenanceDate)}
        </p>
      </td>
      <td className="px-4 py-4">{displayDate(asset.updatedAt)}</td>
      <td className="px-4 py-4">
        <AssetActions
          asset={asset}
          onAction={onAction}
          onUpdate={onUpdate}
          onMaintenance={onMaintenance}
        />
      </td>
    </tr>
  );
}

function AssetMobileCard({
  asset,
  effective,
  schedule,
  onAction,
  onUpdate,
  onMaintenance,
}: {
  asset: RentalService;
  effective?: EquipmentAvailability;
  schedule?: RentalSchedule;
  onAction: (action: PendingAction) => void;
  onUpdate: (
    asset: RentalService,
    updates: Partial<RentalService>,
    title: string,
    description: string,
    label: string,
  ) => void;
  onMaintenance: () => void;
}) {
  return (
    <article className="rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-sm">
      <AssetSummary asset={asset} />
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge tone={tone(effective?.status ?? asset.availability)}>
          {effective?.status ?? asset.availability}
        </StatusBadge>
        <StatusBadge tone={tone(asset.visibility)}>{asset.visibility}</StatusBadge>
        <StatusBadge tone={tone(asset.operationalStatus)}>
          {asset.operationalStatus}
        </StatusBadge>
      </div>
      <p className="mt-4 text-sm text-[#5D6D63]">
        Next booking:{" "}
        <strong>
          {schedule
            ? displayDateRange(schedule.date, schedule.endDate)
            : "None scheduled"}
        </strong>
      </p>
      <div className="mt-4">
        <AssetActions
          asset={asset}
          onAction={onAction}
          onUpdate={onUpdate}
          onMaintenance={onMaintenance}
        />
      </div>
    </article>
  );
}

function AssetSummary({ asset }: { asset: RentalService }) {
  return (
    <div className="flex items-start gap-4">
      <AssetImage asset={asset} />
      <div className="min-w-0">
        <p className="font-mono text-xs text-[#6C7A70]">{asset.serviceId}</p>
        <h2 className="mt-1 text-base font-black text-[#123D2A]">{asset.name}</h2>
        <p className="mt-1 text-sm text-[#5D6D63]">{asset.category}</p>
        {asset.shortDescription ? (
          <p className="mt-1 max-w-md text-xs leading-5 text-[#6C7A70]">
            {asset.shortDescription}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AssetImage({ asset }: { asset: RentalService }) {
  return asset.imageUrl ? (
    <span
      role="img"
      aria-label={`${asset.name} image`}
      className="block size-14 shrink-0 rounded-md bg-[#E7F2E4] bg-cover bg-center"
      style={{ backgroundImage: `url("${asset.imageUrl.replaceAll('"', "%22")}")` }}
    />
  ) : (
    <span className="grid size-14 shrink-0 place-items-center rounded-md bg-[#E7F2E4] text-[#1F6B43]">
      <Tractor className="size-6" />
    </span>
  );
}

function AssetActions({
  asset,
  onAction,
  onUpdate,
  onMaintenance,
}: {
  asset: RentalService;
  onAction: (action: PendingAction) => void;
  onUpdate: (
    asset: RentalService,
    updates: Partial<RentalService>,
    title: string,
    description: string,
    label: string,
  ) => void;
  onMaintenance: () => void;
}) {
  const archived = asset.operationalStatus === "Archived";
  return (
    <details className="relative">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-md border border-[#CAD8CB] px-3 text-xs font-bold text-[#123D2A]">
        Actions
      </summary>
      <div className="absolute right-0 z-20 mt-2 grid min-w-56 gap-1 rounded-lg border border-[#CAD8CB] bg-white p-2 shadow-xl">
        <ActionLink
          href={`/chairman/rentals/assets/${asset.serviceId}`}
          icon={Eye}
          label="Open Details"
        />
        <ActionLink
          href={`/chairman/rentals/assets/${asset.serviceId}/edit`}
          icon={Pencil}
          label="Edit Asset"
        />
        <button
          type="button"
          onClick={() =>
            onUpdate(
              asset,
              { visibility: asset.visibility === "Public" ? "Hidden" : "Public" },
              asset.visibility === "Public" ? "Hide this asset?" : "Publish this asset?",
              asset.visibility === "Public"
                ? `${asset.name} will stop accepting new public inquiries.`
                : `${asset.name} will appear on the public Rental Module.`,
              asset.visibility === "Public" ? "Hide" : "Publish",
            )
          }
          className="flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold hover:bg-[#EEF2EC]"
        >
          {asset.visibility === "Public" ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
          {asset.visibility === "Public" ? "Hide From Public" : "Publish"}
        </button>
        <button
          type="button"
          onClick={onMaintenance}
          className="flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold hover:bg-[#EEF2EC]"
        >
          <Wrench className="size-4" />
          Add Maintenance
        </button>
        {quickAvailabilityOptions.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() =>
              onAction({
                title: `Set ${asset.name} to ${status}?`,
                description:
                  status === "Available"
                    ? "The asset can be considered for new rental schedules."
                    : "Public availability and new schedules can be affected immediately.",
                label: `Set ${status}`,
                run: () =>
                  rentalApiRepository.updateEquipmentAvailability(
                    asset.serviceId,
                    status,
                  ),
              })
            }
            className="min-h-10 rounded-md px-3 text-left text-xs font-semibold hover:bg-[#EEF2EC]"
          >
            Set {status}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            archived
              ? onUpdate(
                  asset,
                  {
                    operationalStatus: "Ready for Use",
                    availability: "Available",
                    visibility: "Hidden",
                  },
                  "Restore this asset?",
                  `${asset.name} will return as an internal asset. Publish it separately when ready.`,
                  "Restore",
                )
              : onAction({
                  title: "Archive this asset?",
                  description: `${asset.name} will be removed from new public requests. Historical bookings remain preserved.`,
                  label: "Archive",
                  run: () =>
                    rentalApiRepository.archiveRentalService(asset.serviceId),
                })
          }
          className="flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold hover:bg-[#EEF2EC]"
        >
          <Archive className="size-4" />
          {archived ? "Restore" : "Archive"}
        </button>
      </div>
    </details>
  );
}

function ActionLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold hover:bg-[#EEF2EC]"
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
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
          <option key={option} value={option}>
            {labels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MaintenanceDialog({
  asset,
  onClose,
  onSaved,
}: {
  asset?: RentalService;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [type, setType] = useState("Preventive Maintenance");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] =
    useState<RentalMaintenanceRecord["operationalImpact"]>("Unavailable");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!asset) return;
    setSaving(true);
    setError("");
    try {
      await rentalApiRepository.createRentalMaintenanceRecord({
        serviceId: asset.serviceId,
        maintenanceType: type,
        startAt,
        endAt,
        description,
        operationalImpact: impact,
        status: "Scheduled",
      });
      toast.success("Maintenance period added.");
      await onSaved();
      setType("Preventive Maintenance");
      setStartAt("");
      setEndAt("");
      setDescription("");
      setImpact("Unavailable");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Maintenance could not be saved.");
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={Boolean(asset)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={asset ? `Add Maintenance - ${asset.name}` : "Add Maintenance"}
      description="Blocking maintenance is checked against existing bookings before it is saved."
    >
      <form onSubmit={submit} className="grid gap-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        <Field label="Maintenance type">
          <input required value={type} onChange={(event) => setType(event.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts">
            <input
              required
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
            />
          </Field>
          <Field label="Ends">
            <input
              required
              type="datetime-local"
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Operational impact">
          <select
            value={impact}
            onChange={(event) =>
              setImpact(
                event.target.value as RentalMaintenanceRecord["operationalImpact"],
              )
            }
          >
            <option>Limited Availability</option>
            <option>Unavailable</option>
            <option>Out of Service</option>
          </select>
        </Field>
        <Field label="Description">
          <textarea
            required
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            className="min-h-11 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add Maintenance"}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[#294B39]">
      {label}
      <span className="[&>*]:min-h-11 [&>*]:w-full [&>*]:rounded-md [&>*]:border [&>*]:border-[#CAD8CB] [&>*]:p-3 [&>*]:font-normal">
        {children}
      </span>
    </label>
  );
}
