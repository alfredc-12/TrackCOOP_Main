"use client";

import { ArrowLeft, ExternalLink, ImagePlus, Save, Tractor } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { ErrorState, LoadingSkeleton } from "@/components/portal/PortalPrimitives";
import {
  PENDING_POLICY_LABEL,
  POLICY_NOTICE,
} from "@/app/rental/_lib/rentalConstants";
import { rentalApiRepository } from "@/app/rental/_lib/rentalApi";
import type {
  AvailabilityStatus,
  OperationalStatus,
  RentalService,
  ServiceVisibility,
} from "@/app/rental/_types/rental";

const blank: RentalService = {
  serviceId: "",
  name: "",
  category: "Land Preparation",
  shortDescription: "",
  description: "",
  imageUrl: "",
  imageUrls: [],
  availability: "Available",
  operationalStatus: "Ready for Use",
  visibility: "Hidden",
  unitOfUsage: "",
  suitableActivity: "",
  capacity: "",
  serviceArea: "Nasugbu service barangays",
  operatorRequirement: "Cooperative operator confirmation required",
  operationalNotes: "",
  safetyReminders: [],
  upcomingBookings: 0,
  availableDays: [],
  availableStartTime: "",
  availableEndTime: "",
  maximumBookingsPerDay: 1,
  preparationMinutes: 0,
  travelMinutes: 0,
  bufferMinutes: 0,
  featured: false,
  standardRate: null,
  memberRate: null,
  nonMemberRate: null,
  gasolineHandling: null,
  depositRequirement: null,
  cancellationPolicy: null,
  reschedulingPolicy: null,
  paymentDeadline: null,
  updatedAt: "",
};

export function ChairmanRentalAssetEditor({
  serviceId,
}: {
  serviceId?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<RentalService>(blank);
  const [loading, setLoading] = useState(Boolean(serviceId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!serviceId) return;
    let active = true;
    void rentalApiRepository
      .getManagedRentalServiceById(serviceId)
      .then((asset) => {
        if (active) setForm(asset);
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Rental asset could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [serviceId]);

  function update<K extends keyof RentalService>(
    key: K,
    value: RentalService[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(visibility: ServiceVisibility) {
    if (
      !form.serviceId.trim() ||
      !form.name.trim() ||
      !form.shortDescription.trim() ||
      !form.description.trim()
    ) {
      setError("Asset code, name, short description, and full description are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, visibility };
      if (serviceId) {
        await rentalApiRepository.updateRentalService(serviceId, payload);
      } else {
        const createPayload = Object.fromEntries(
          Object.entries(payload).filter(([key]) => key !== "updatedAt"),
        ) as Omit<RentalService, "updatedAt">;
        await rentalApiRepository.createRentalService(createPayload);
      }
      toast.success(visibility === "Public" ? "Rental asset published." : "Rental asset saved.");
      router.push("/chairman/rentals/assets");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rental asset could not be saved.");
      setSaving(false);
    }
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Operations - Rental Assets"
        title={serviceId ? "Edit Rental Asset" : "Add Rental Asset"}
        description="Maintain the shared database record used by both the public Rental Module and Chairman operations."
        actions={
          <Link
            href="/chairman/rentals/assets"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A]"
          >
            <ArrowLeft className="size-4" />
            Back to Assets
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save("Public");
        }}
        className="grid gap-5"
      >
        <Section title="Basic Information" icon={Tractor}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Asset or service name" required>
              <input
                required
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </Field>
            <Field label="Asset code" required>
              <input
                required
                disabled={Boolean(serviceId)}
                value={form.serviceId}
                onChange={(event) =>
                  update(
                    "serviceId",
                    event.target.value.toUpperCase().replaceAll(" ", "-"),
                  )
                }
                placeholder="RNT-TRACTOR-002"
              />
            </Field>
            <Field label="Category">
              <input
                value={form.category}
                onChange={(event) => update("category", event.target.value)}
              />
            </Field>
            <Field label="Short description" required>
              <input
                required
                value={form.shortDescription}
                onChange={(event) =>
                  update("shortDescription", event.target.value)
                }
              />
            </Field>
            <Field label="Full description" wide required>
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </Field>
            <Field label="Main image URL">
              <input
                value={form.imageUrl ?? ""}
                onChange={(event) => update("imageUrl", event.target.value)}
                placeholder="/uploads/equipment.jpg"
              />
            </Field>
            <Field label="Additional image URLs">
              <input
                value={form.imageUrls.join(", ")}
                onChange={(event) =>
                  update(
                    "imageUrls",
                    event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="Separate URLs with commas"
              />
            </Field>
            <div className="grid min-h-28 place-items-center rounded-lg border border-dashed border-[#B9CABD] bg-[#F7F8F3] text-center text-sm font-semibold text-[#5D6D63] md:col-span-2">
              <span>
                <ImagePlus className="mx-auto mb-2 size-6 text-[#1F6B43]" />
                Images are stored as paths in the same rental asset record.
              </span>
            </div>
          </div>
        </Section>

        <Section title="Usage Details">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Unit of usage">
              <input
                value={form.unitOfUsage}
                onChange={(event) => update("unitOfUsage", event.target.value)}
                placeholder="Per hour, hectare, trip, or use"
              />
            </Field>
            <Field label="Capacity">
              <input
                value={form.capacity}
                onChange={(event) => update("capacity", event.target.value)}
              />
            </Field>
            <Field label="Suitable agricultural activity">
              <input
                value={form.suitableActivity}
                onChange={(event) =>
                  update("suitableActivity", event.target.value)
                }
              />
            </Field>
            <Field label="Service area">
              <input
                value={form.serviceArea}
                onChange={(event) => update("serviceArea", event.target.value)}
              />
            </Field>
            <Field label="Operator required">
              <input
                value={form.operatorRequirement}
                onChange={(event) =>
                  update("operatorRequirement", event.target.value)
                }
              />
            </Field>
            <Field label="Assigned operator or custodian">
              <input
                value={form.assignedCustodian ?? ""}
                onChange={(event) =>
                  update("assignedCustodian", event.target.value)
                }
              />
            </Field>
            <Field label="Usage restrictions and operating instructions" wide>
              <textarea
                rows={4}
                value={form.operationalNotes}
                onChange={(event) =>
                  update("operationalNotes", event.target.value)
                }
              />
            </Field>
            <Field label="Safety reminders" wide>
              <textarea
                rows={3}
                value={form.safetyReminders.join("\n")}
                onChange={(event) =>
                  update(
                    "safetyReminders",
                    event.target.value
                      .split("\n")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                }
              />
            </Field>
          </div>
        </Section>

        <Section title="Availability and Maintenance">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SelectField
              label="Base availability"
              value={form.availability}
              options={[
                "Available",
                "Limited Availability",
                "Unavailable",
                "By Schedule Only",
              ]}
              onChange={(value) =>
                update("availability", value as AvailabilityStatus)
              }
            />
            <SelectField
              label="Operational status"
              value={form.operationalStatus}
              options={[
                "Ready for Use",
                "Under Maintenance",
                "Out of Service",
                "Archived",
              ]}
              onChange={(value) =>
                update("operationalStatus", value as OperationalStatus)
              }
            />
            <Field label="Available start time">
              <input
                type="time"
                value={form.availableStartTime ?? ""}
                onChange={(event) =>
                  update("availableStartTime", event.target.value)
                }
              />
            </Field>
            <Field label="Available end time">
              <input
                type="time"
                value={form.availableEndTime ?? ""}
                onChange={(event) =>
                  update("availableEndTime", event.target.value)
                }
              />
            </Field>
            <Field label="Available days">
              <input
                value={(form.availableDays ?? []).join(", ")}
                onChange={(event) =>
                  update(
                    "availableDays",
                    event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                }
              />
            </Field>
            <NumberField
              label="Maximum bookings per day"
              value={form.maximumBookingsPerDay ?? 1}
              onChange={(value) => update("maximumBookingsPerDay", value)}
            />
            <NumberField
              label="Preparation minutes"
              value={form.preparationMinutes ?? 0}
              onChange={(value) => update("preparationMinutes", value)}
            />
            <NumberField
              label="Travel minutes"
              value={form.travelMinutes ?? 0}
              onChange={(value) => update("travelMinutes", value)}
            />
            <NumberField
              label="Buffer minutes"
              value={form.bufferMinutes ?? 0}
              onChange={(value) => update("bufferMinutes", value)}
            />
            <Field label="Asset condition">
              <input
                value={form.assetCondition ?? ""}
                onChange={(event) =>
                  update("assetCondition", event.target.value)
                }
              />
            </Field>
            <Field label="Last maintenance date">
              <input
                type="date"
                value={form.lastMaintenanceDate?.slice(0, 10) ?? ""}
                onChange={(event) =>
                  update("lastMaintenanceDate", event.target.value)
                }
              />
            </Field>
            <Field label="Next maintenance date">
              <input
                type="date"
                value={form.nextMaintenanceDate?.slice(0, 10) ?? ""}
                onChange={(event) =>
                  update("nextMaintenanceDate", event.target.value)
                }
              />
            </Field>
          </div>
        </Section>

        <Section title="Public Listing">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Public visibility"
              value={form.visibility}
              options={["Public", "Member-only", "Internal only", "Hidden"]}
              onChange={(value) =>
                update("visibility", value as ServiceVisibility)
              }
            />
            <Field label="Public title">
              <input
                value={form.publicTitle ?? ""}
                onChange={(event) => update("publicTitle", event.target.value)}
              />
            </Field>
            <Field label="Public description" wide>
              <textarea
                rows={4}
                value={form.publicDescription ?? ""}
                onChange={(event) =>
                  update("publicDescription", event.target.value)
                }
              />
            </Field>
            <Field label="Public notes">
              <textarea
                rows={3}
                value={form.publicNotes ?? ""}
                onChange={(event) => update("publicNotes", event.target.value)}
              />
            </Field>
            <Field label="Public availability message">
              <textarea
                rows={3}
                value={form.publicAvailabilityMessage ?? ""}
                onChange={(event) =>
                  update("publicAvailabilityMessage", event.target.value)
                }
              />
            </Field>
            <label className="flex min-h-11 items-center gap-3 text-sm font-bold text-[#294B39]">
              <input
                type="checkbox"
                checked={Boolean(form.featured)}
                onChange={(event) => update("featured", event.target.checked)}
                className="size-5 accent-[#1F6B43]"
              />
              Feature this asset on the public listing
            </label>
          </div>
        </Section>

        <Section title="Internal Details">
          <Field label="Internal notes">
            <textarea
              rows={4}
              value={form.internalNotes ?? ""}
              onChange={(event) => update("internalNotes", event.target.value)}
            />
          </Field>
        </Section>

        <Section title="Pricing and Policy - Pending Client Validation">
          <div className="rounded-lg border border-[#E7C968] bg-[#FFF8E7] p-4 text-sm leading-6 text-[#6C541A]">
            <strong>{PENDING_POLICY_LABEL}.</strong> {POLICY_NOTICE} Rental
            pricing, member discounts, non-member rates, gasoline handling,
            deposits, cancellation rules, payment deadlines, and rescheduling
            policies remain null or unconfigured.
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              "Standard rate",
              "Member rate",
              "Non-member rate",
              "Gasoline handling",
              "Deposit requirement",
              "Cancellation policy",
              "Rescheduling policy",
              "Payment deadline",
            ].map((label) => (
              <Field key={label} label={label}>
                <input disabled value={PENDING_POLICY_LABEL} readOnly />
              </Field>
            ))}
          </div>
        </Section>

        <div className="flex flex-col-reverse gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:justify-end">
          <Link
            href="/chairman/rentals/assets"
            className="inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-bold text-[#5D6D63]"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save("Hidden")}
            className="min-h-11 rounded-md border border-[#CAD8CB] px-5 text-sm font-bold text-[#123D2A]"
          >
            Save Draft
          </button>
          {serviceId ? (
            <Link
              href={`/rental/services/${serviceId}`}
              target="_blank"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] px-5 text-sm font-bold text-[#123D2A]"
            >
              Preview Public Listing
              <ExternalLink className="size-4" />
            </Link>
          ) : null}
          <button
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-6 text-sm font-bold text-white disabled:opacity-60"
          >
            <Save className="size-4" />
            {saving
              ? "Saving..."
              : serviceId
                ? "Update & Publish"
                : "Publish Asset"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof Tractor;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-sm">
      <legend className="flex items-center gap-2 px-2 text-xl font-black text-[#123D2A]">
        {Icon ? <Icon className="size-5" /> : null}
        {title}
      </legend>
      <div className="mt-2">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  required,
  wide,
  children,
}: {
  label: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactElement;
}) {
  return (
    <label
      className={`grid gap-2 text-sm font-bold text-[#294B39] ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <span className="[&>*]:min-h-11 [&>*]:w-full [&>*]:rounded-md [&>*]:border [&>*]:border-[#CAD8CB] [&>*]:bg-white [&>*]:p-3 [&>*]:font-normal [&>*]:outline-none focus-within:[&>*]:border-[#1F6B43] disabled:[&>*]:bg-[#EEF2EC]">
        {children}
      </span>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </Field>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}
