"use client";

import { ArrowLeft, ExternalLink, ImagePlus, Save, Tractor } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { ErrorState, LoadingSkeleton } from "@/components/portal/PortalPrimitives";
import { rentalApiRepository } from "@/app/rental/_lib/rentalApi";
import { getMemberDiscountedRate } from "@/app/rental/_lib/rentalEstimate";
import { formatPeso } from "@/app/rental/_lib/rentalFormatting";
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
    const errors: Record<string, string> = {};
    const photos = cleanRentalAssetPhotoUrls([form.imageUrl, ...form.imageUrls]);
    const rentalRate = Number(form.standardRate ?? 0);

    if (!form.serviceId.trim()) errors.serviceId = "Enter the asset code.";
    if (!form.name.trim()) errors.name = "Enter the asset name.";
    if (!form.category.trim()) errors.category = "Choose a category.";
    if (!form.shortDescription.trim()) {
      errors.shortDescription = "Enter a short description.";
    }
    if (!form.description.trim()) errors.description = "Enter the full description.";
    if (!form.unitOfUsage.trim()) errors.unitOfUsage = "Choose a unit.";
    if (!form.standardRate || Number.isNaN(rentalRate) || rentalRate <= 0) {
      errors.standardRate = "Enter the rental rate.";
    }
    if (visibility === "Public" && photos.length === 0) {
      errors.imageUrls = "Upload at least one photo.";
    }
    if (
      !["Available", "Limited Availability", "Unavailable", "By Schedule Only"].includes(
        form.availability,
      ) ||
      !["Ready for Use", "Under Maintenance", "Out of Service", "Archived"].includes(
        form.operationalStatus,
      )
    ) {
      errors.status = "Choose a valid status.";
    }

    return { errors, photos, rentalRate };
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
      const payload = {
        ...form,
        visibility,
        imageUrl: validation.photos[0] ?? "",
        imageUrls: validation.photos,
        standardRate: validation.rentalRate,
        memberRate: getMemberDiscountedRate(validation.rentalRate) ?? null,
        nonMemberRate: validation.rentalRate,
      };
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
        description="Keep the asset easy to book: photos, simple details, status, and one rental rate."
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
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save("Public");
        }}
        className="grid gap-5"
      >
        <Section title="Basic Information" icon={Tractor}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Asset name" required error={fieldErrors.name}>
              <input
                required
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
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
              />
            </Field>
            <Field label="Category" required error={fieldErrors.category}>
              <input
                value={form.category}
                onChange={(event) => update("category", event.target.value)}
              />
            </Field>
            <Field label="Short description" required error={fieldErrors.shortDescription}>
              <input
                required
                value={form.shortDescription}
                onChange={(event) =>
                  update("shortDescription", event.target.value)
                }
              />
            </Field>
            <Field label="Full description" wide required error={fieldErrors.description}>
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
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
                            backgroundImage: `url("${url.replaceAll('"', "%22")}")`,
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

        <Section title="Usage Details">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Unit of usage" required error={fieldErrors.unitOfUsage}>
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
              error={fieldErrors.status}
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
              error={fieldErrors.status}
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

        <Section title="Rental Rate">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Rental rate"
              required
              error={fieldErrors.standardRate}
              hint="Enter the original rental rate. Members automatically get 20% off."
            >
              <input
                type="number"
                min="0"
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
      <span className="[&>*]:min-h-11 [&>*]:w-full [&>*]:rounded-md [&>*]:border [&>*]:border-[#CAD8CB] [&>*]:bg-white [&>*]:p-3 [&>*]:font-normal [&>*]:outline-none focus-within:[&>*]:border-[#1F6B43] disabled:[&>*]:bg-[#EEF2EC]">
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
