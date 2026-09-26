"use client";

import { ArrowLeft, ExternalLink, ImagePlus, Save, Tractor } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cssUploadUrl } from "@/lib/upload-url";
import { PageHeader } from "@/components/portal/PageHeader";
import { ErrorState, LoadingSkeleton } from "@/components/portal/PortalPrimitives";
import { rentalApiRepository } from "@/app/rental/_lib/rentalApi";
import { getMemberDiscountedRate } from "@/app/rental/_lib/rentalEstimate";
import { formatPeso } from "@/app/rental/_lib/rentalFormatting";
import { rentalServiceSchema } from "@/app/rental/_lib/rentalValidation";
import {
  MAX_RENTAL_ASSET_PHOTOS,
  cleanRentalAssetPhotoUrls,
  validateRentalAssetPhoto,
} from "@/app/rental/_lib/rentalPhotos";
import type {
  AvailabilityStatus,
  OperationalStatus,
  RentalService,
  ServiceVisibility,
} from "@/app/rental/_types/rental";
import { env } from "@/config/env";

const ASSET_CATEGORIES = [
  "Land Preparation",
  "Irrigation",
  "Crop Care",
  "Harvesting",
  "Transport",
  "Post-harvest",
  "Other Farm Service",
];

const USAGE_UNITS = ["Per Day", "Per Hour", "Per Hectare", "Per Trip", "Per Use"];
const OPERATOR_REQUIREMENTS = [
  "Cooperative operator required",
  "Cooperative operator confirmation required",
  "Trained member may operate",
  "Requester may operate after approval",
  "No operator required",
];
const ASSIGNED_CUSTODIANS = [
  "Assign during booking review",
  "Cooperative operator",
  "Equipment custodian",
  "Barangay coordinator",
  "Chairman to assign",
];
const OPERATING_RULES = [
  "Use only after cooperative schedule approval.",
  "Use only with the assigned operator present.",
  "Use only in safe field conditions.",
  "Requester must report damage or problems immediately.",
  "No special operating rules.",
];
const SAFETY_REMINDERS = [
  "Follow the assigned operator's safety briefing.",
  "Keep children and bystanders away from the equipment.",
  "Use only in the approved farm or service area.",
  "Stop work and report any damage or unusual noise.",
  "Do not use during heavy rain or unsafe weather.",
];

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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!serviceId) return;
    let active = true;
    void rentalApiRepository
      .getManagedRentalServiceById(serviceId)
      .then((asset) => {
        if (active) {
          const imageUrls = cleanRentalAssetPhotoUrls([
            asset.imageUrl,
            ...asset.imageUrls,
          ]);
          setForm({ ...asset, imageUrl: imageUrls[0] ?? "", imageUrls });
        }
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
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[String(key)];
      return next;
    });
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    event.currentTarget.value = "";

    const currentPhotos = cleanRentalAssetPhotoUrls([
      form.imageUrl,
      ...form.imageUrls,
    ]);
    if (currentPhotos.length + files.length > MAX_RENTAL_ASSET_PHOTOS) {
      setFieldErrors((current) => ({
        ...current,
        imageUrls: "Upload up to 5 photos only.",
      }));
      toast.error("Upload up to 5 photos only.");
      return;
    }

    const invalid = files
      .map((file) => validateRentalAssetPhoto(file))
      .find(Boolean);
    if (invalid) {
      setFieldErrors((current) => ({ ...current, imageUrls: invalid }));
      toast.error(invalid);
      return;
    }

    setUploading(true);
    const uploadForm = new FormData();
    files.forEach((file) => uploadForm.append("images", file));
    try {
      const response = await fetch(`${env.apiUrl}/api/rental/upload-image`, {
        method: "POST",
        body: uploadForm,
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not upload photo.");
      }
      const data = await response.json();
      const uploaded = Array.isArray(data.urls)
        ? data.urls
        : data.url
          ? [data.url]
          : [];
      const imageUrls = cleanRentalAssetPhotoUrls([
        ...currentPhotos,
        ...uploaded,
      ]);
      setForm((current) => ({ ...current, imageUrl: imageUrls[0] ?? "", imageUrls }));
      setFieldErrors((current) => {
        const next = { ...current };
        delete next.imageUrls;
        return next;
      });
      toast.success("Photo uploaded.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not upload photo.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    const imageUrls = cleanRentalAssetPhotoUrls([
      form.imageUrl,
      ...form.imageUrls,
    ]).filter((item) => item !== url);
    update("imageUrl", imageUrls[0] ?? "");
    update("imageUrls", imageUrls);
  }

  function validateAsset(visibility: ServiceVisibility) {
    const photos = cleanRentalAssetPhotoUrls([form.imageUrl, ...form.imageUrls]);
    const rentalRate = Number(form.standardRate ?? 0);
    const payload = {
      ...form,
      visibility,
      imageUrl: photos[0] ?? "",
      imageUrls: photos,
      standardRate: form.standardRate,
      memberRate: form.standardRate
        ? getMemberDiscountedRate(rentalRate) ?? null
        : null,
      nonMemberRate: form.standardRate,
      publicTitle: "",
      publicDescription: "",
      publicNotes: "",
      publicAvailabilityMessage: "",
      featured: false,
      availableDays: [],
      availableStartTime: "",
      availableEndTime: "",
      maximumBookingsPerDay: 1,
      preparationMinutes: 0,
      travelMinutes: 0,
      bufferMinutes: 0,
      assetCondition: "",
      lastMaintenanceDate: "",
      nextMaintenanceDate: "",
    };
    const result = rentalServiceSchema.safeParse(payload);
    const errors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "form");
        errors[key] ??= issue.message;
      }
    }
    return { errors, photos, rentalRate, payload };
  }

  async function save(visibility: ServiceVisibility) {
    const validation = validateAsset(visibility);
    if (Object.keys(validation.errors).length) {
      setFieldErrors(validation.errors);
      setError("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      const payload = validation.payload;
      if (serviceId) {
        await rentalApiRepository.updateRentalService(serviceId, payload);
      } else {
        const createPayload = Object.fromEntries(
          Object.entries(payload).filter(([key]) => key !== "updatedAt"),
        ) as Omit<RentalService, "updatedAt">;
        await rentalApiRepository.createRentalService(createPayload);
      }
      toast.success(visibility === "Public" ? "Rental asset published." : "Rental asset saved.");
      router.push("/portal/chairman/rentals/assets");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rental asset could not be saved.");
      setSaving(false);
    }
  }

  if (loading) return <LoadingSkeleton />;

  const photoUrls = cleanRentalAssetPhotoUrls([form.imageUrl, ...form.imageUrls]);
  const rentalRate = Number(form.standardRate ?? 0);
  const memberRate = getMemberDiscountedRate(rentalRate);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Operations - Rental Assets"
        title={serviceId ? "Edit Rental Asset" : "Add Rental Asset"}
        description="Add the equipment name, photo, farm use, availability, and rental price. Keep it simple enough for cooperative staff to update quickly."
        actions={
          <Link
            href="/portal/chairman/rentals/assets"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A]"
          >
            <ArrowLeft className="size-4" />
            Back to Assets
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}
      <div className="rounded-lg border border-[#B9CABD] bg-[#E7F2E4] p-4 text-sm leading-6 text-[#294B39]">
        <strong className="text-[#123D2A]">Simple guide:</strong> Fields marked * are required. You can save without a photo or price by using Save Draft. Publish only when the asset is ready for requests.
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save("Public");
        }}
        className="grid gap-5"
      >
        <Section title="Equipment details" icon={Tractor}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Asset name" required error={fieldErrors.name}>
              <input
                required
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                maxLength={190}
                placeholder="Example: Four-wheel farm tractor"
              />
            </Field>
            <Field label="Asset code" required error={fieldErrors.serviceId}>
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
                maxLength={80}
              />
            </Field>
            <Field label="Category" required error={fieldErrors.category}>
              <select
                value={form.category}
                onChange={(event) => update("category", event.target.value)}
              >
                {!ASSET_CATEGORIES.includes(form.category) ? (
                  <option>{form.category}</option>
                ) : null}
                {ASSET_CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </Field>
            <Field label="Short description" required error={fieldErrors.shortDescription}>
              <input
                required
                value={form.shortDescription}
                onChange={(event) =>
                  update("shortDescription", event.target.value)
                }
                maxLength={500}
                placeholder="One short sentence farmers can understand"
              />
            </Field>
            <Field label="Full description" wide required error={fieldErrors.description}>
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                maxLength={2000}
                placeholder="Describe what the equipment does and its important limits"
              />
            </Field>
            <Field
              label="Asset photos"
              wide
              required
              error={fieldErrors.imageUrls}
              hint="Upload 1 to 5 photos. The first photo appears on the public page."
            >
              <div className="grid gap-3 rounded-md border border-[#CAD8CB] bg-white p-3">
                {photoUrls.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {photoUrls.map((url, index) => (
                      <div
                        key={url}
                        className="overflow-hidden rounded-md border border-[#CAD8CB] bg-[#F7F8F3]"
                      >
                        <div
                          className="h-28 bg-[#E7F2E4] bg-cover bg-center"
                          style={{
                            backgroundImage: cssUploadUrl(url),
                          }}
                        />
                        <div className="flex items-center justify-between gap-2 p-2 text-xs">
                          <span className="font-bold text-[#294B39]">
                            Photo {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removePhoto(url)}
                            className="font-bold text-[#8A2F1B]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid min-h-28 place-items-center rounded-md border border-dashed border-[#B9CABD] bg-[#F7F8F3] text-center text-sm font-semibold text-[#5D6D63]">
                    <span>
                      <ImagePlus className="mx-auto mb-2 size-6 text-[#1F6B43]" />
                      Upload at least one photo before publishing.
                    </span>
                  </div>
                )}
                <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC]">
                  {uploading ? "Uploading..." : "Upload photos"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    disabled={uploading || photoUrls.length >= MAX_RENTAL_ASSET_PHOTOS}
                    onChange={handlePhotoUpload}
                  />
                </label>
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Rental setup">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Unit of usage" required error={fieldErrors.unitOfUsage}>
              <select
                value={form.unitOfUsage}
                onChange={(event) => update("unitOfUsage", event.target.value)}
              >
                <option value="">Choose a charging unit</option>
                {form.unitOfUsage && !USAGE_UNITS.includes(form.unitOfUsage) ? (
                  <option>{form.unitOfUsage}</option>
                ) : null}
                {USAGE_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
              </select>
            </Field>
            <Field label="Capacity" error={fieldErrors.capacity}>
              <input
                value={form.capacity}
                onChange={(event) => update("capacity", event.target.value)}
                maxLength={160}
                placeholder="Example: Up to 2 hectares per day"
              />
            </Field>
            <Field label="Suitable agricultural activity" required error={fieldErrors.suitableActivity}>
              <input
                value={form.suitableActivity}
                onChange={(event) =>
                  update("suitableActivity", event.target.value)
                }
                maxLength={160}
                placeholder="Example: Plowing and land preparation"
              />
            </Field>
            <Field label="Service area" required error={fieldErrors.serviceArea}>
              <input
                value={form.serviceArea}
                onChange={(event) => update("serviceArea", event.target.value)}
                maxLength={190}
              />
            </Field>
            <Field label="Operator needed" required error={fieldErrors.operatorRequirement}>
              <select
                value={form.operatorRequirement}
                onChange={(event) =>
                  update("operatorRequirement", event.target.value)
                }
              >
                {form.operatorRequirement &&
                !OPERATOR_REQUIREMENTS.includes(form.operatorRequirement) ? (
                  <option>{form.operatorRequirement}</option>
                ) : null}
                {OPERATOR_REQUIREMENTS.map((requirement) => (
                  <option key={requirement}>{requirement}</option>
                ))}
              </select>
            </Field>
            <Field label="Assigned operator or custodian" error={fieldErrors.assignedCustodian}>
              <select
                value={form.assignedCustodian ?? ""}
                onChange={(event) =>
                  update("assignedCustodian", event.target.value)
                }
              >
                <option value="">Choose who usually handles this asset</option>
                {form.assignedCustodian &&
                !ASSIGNED_CUSTODIANS.includes(form.assignedCustodian) ? (
                  <option>{form.assignedCustodian}</option>
                ) : null}
                {ASSIGNED_CUSTODIANS.map((custodian) => (
                  <option key={custodian}>{custodian}</option>
                ))}
              </select>
            </Field>
            <Field label="Use rule" wide error={fieldErrors.operationalNotes}>
              <select
                value={form.operationalNotes}
                onChange={(event) =>
                  update("operationalNotes", event.target.value)
                }
              >
                <option value="">Choose a simple rule</option>
                {form.operationalNotes &&
                !OPERATING_RULES.includes(form.operationalNotes) ? (
                  <option>{form.operationalNotes}</option>
                ) : null}
                {OPERATING_RULES.map((rule) => (
                  <option key={rule}>{rule}</option>
                ))}
              </select>
            </Field>
            <Field label="Safety reminders" wide error={fieldErrors.safetyReminders} hint="Tick the reminders that apply.">
              <CheckboxGroup
                options={SAFETY_REMINDERS}
                value={form.safetyReminders}
                onChange={(safetyReminders) =>
                  update("safetyReminders", safetyReminders)
                }
              />
            </Field>
          </div>
        </Section>

        <Section title="Availability and maintenance">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SelectField
              label="Base availability"
              value={form.availability}
              error={fieldErrors.availability}
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
              error={fieldErrors.operationalStatus}
              options={[
                "Ready for Use",
                "Under Maintenance",
                "Out of Service",
                "Archived",
              ]}
              onChange={(value) => {
                const status = value as OperationalStatus;
                update("operationalStatus", status);
                if (["Under Maintenance", "Out of Service", "Archived"].includes(status)) {
                  update("availability", "Unavailable");
                }
                if (status === "Archived") update("visibility", "Hidden");
              }}
            />
          </div>
        </Section>

        <Section title="Rental price">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Rental rate"
              required
              error={fieldErrors.standardRate}
              hint="Enter the original rental rate. Members automatically get 20% off."
            >
              <input
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                value={form.standardRate ?? ""}
                onChange={(event) =>
                  update(
                    "standardRate",
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                placeholder="300"
              />
            </Field>
            <div className="rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4 text-sm leading-6 text-[#294B39]">
              <p className="font-black text-[#123D2A]">Automatic estimate</p>
              {rentalRate > 0 && memberRate ? (
                <div className="mt-2 grid gap-1">
                  <p>Original rental rate: {formatPeso(rentalRate)}</p>
                  <p>Member discount: 20% off</p>
                  <p>Member price: {formatPeso(memberRate)}</p>
                  <p>Non-member price: {formatPeso(rentalRate)}</p>
                </div>
              ) : (
                <p className="mt-2 font-semibold">Enter the rental rate.</p>
              )}
              <p className="mt-2 text-xs text-[#5D6D63]">
                Final amount is still confirmed by the cooperative.
              </p>
            </div>
          </div>
        </Section>

        <div className="flex flex-col-reverse gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:justify-end">
          <Link
            href="/portal/chairman/rentals/assets"
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
                ? "Save and Publish"
                : "Publish Equipment"}
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
  optional = false,
}: {
  title: string;
  icon?: typeof Tractor;
  children: React.ReactNode;
  optional?: boolean;
}) {
  if (optional) {
    return (
      <details className="rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-lg font-black text-[#123D2A]">
          {title}
          <span className="ml-2 text-xs font-semibold text-[#6C7A70]">Open if needed</span>
        </summary>
        <div className="mt-5">{children}</div>
      </details>
    );
  }
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
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  wide?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactElement;
}) {
  return (
    <div
      className={`grid gap-2 text-sm font-bold text-[#294B39] ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <span className={`[&>*]:min-h-11 [&>*]:w-full [&>*]:rounded-md [&>*]:border [&>*]:bg-white [&>*]:p-3 [&>*]:font-normal [&>*]:outline-none focus-within:[&>*]:border-[#1F6B43] disabled:[&>*]:bg-[#EEF2EC] ${error ? "[&>*]:border-[#B42318]" : "[&>*]:border-[#CAD8CB]"}`}>
        {children}
      </span>
      {hint && !error ? (
        <span className="text-xs font-semibold text-[#5D6D63]">{hint}</span>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs font-bold text-[#B42318]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
function CheckboxGroup({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  compact?: boolean;
}) {
  const selected = new Set(value);
  return (
    <div className={`grid gap-2 ${compact ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}>
      {options.map((option) => (
        <label
          key={option}
          className="flex min-h-11 items-center gap-3 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 py-2 text-sm font-semibold text-[#294B39]"
        >
          <input
            type="checkbox"
            checked={selected.has(option)}
            onChange={(event) => {
              const next = event.target.checked
                ? [...value, option]
                : value.filter((item) => item !== option);
              onChange(next);
            }}
            className="size-5 accent-[#1F6B43]"
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <Field label={label} error={error}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </Field>
  );
}
