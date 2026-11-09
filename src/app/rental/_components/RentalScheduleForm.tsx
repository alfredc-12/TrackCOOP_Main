"use client";

import { AlertTriangle, CalendarCheck, SearchCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRental } from "../_context/RentalProvider";
import { rentalRepository } from "../_lib/rentalRepository";
import type {
  RentalInquiry,
  RentalSchedule,
  ScheduleConflict,
  ScheduleStatus,
} from "../_types/rental";
import { useRentalData } from "../_hooks/useRentalData";
import { RentalAccessGate } from "./RentalAccessGate";
import { RentalConflictModal } from "./RentalConflictModal";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { TractorWorkPlan } from "./TractorWorkPlan";
import { isTractorService, TRACTOR_SCHEDULE_DEFAULTS, shiftDailyWork } from "../_lib/rentalHectares";
import { RentalPageHeader } from "./RentalPageHeader";

const blank: RentalSchedule = {
  scheduleId: "",
  inquiryId: "",
  rentalId: "",
  serviceId: "",
  equipmentName: "",
  requesterName: "",
  requesterType: "Member",
  date: "",
  endDate: "",
  startTime: "08:00",
  endTime: "17:00",
  assignedOperator: "",
  serviceLocation: "",
  barangay: "",
  preparationMinutes: 30,
  travelMinutes: 30,
  bufferMinutes: 30,
  specialInstructions: "",
  customerInstructions: "",
  status: "Proposed",
  paymentStatus: "Pending",
};

function scheduleWithInquiry(
  current: RentalSchedule,
  inquiry: RentalInquiry,
): RentalSchedule {
  return {
    ...current,
    dailyWork: inquiry.dailyWork,
    inquiryId: inquiry.inquiryId,
    rentalId: inquiry.rentalId,
    serviceId: inquiry.serviceId,
    equipmentName: inquiry.equipmentName,
    requesterName: inquiry.requester.fullName,
    requesterType: inquiry.requester.requesterType,
    date: inquiry.preferredDate,
    endDate: inquiry.preferredEndDate,
    startTime: inquiry.preferredStartTime ?? current.startTime,
    endTime: inquiry.preferredEndTime ?? current.endTime,
    serviceLocation: inquiry.serviceLocation,
    barangay: inquiry.serviceBarangay,
    paymentStatus: inquiry.paymentStatus,
  };
}

function scheduleCandidate(
  form: RentalSchedule,
): Omit<RentalSchedule, "scheduleId" | "status" | "paymentStatus"> {
  return {
    dailyWork: form.dailyWork,
    inquiryId: form.inquiryId,
    rentalId: form.rentalId,
    serviceId: form.serviceId,
    equipmentName: form.equipmentName,
    requesterName: form.requesterName,
    requesterType: form.requesterType,
    date: form.date,
    endDate: form.endDate,
    startTime: form.startTime,
    endTime: form.endTime,
    assignedOperator: form.assignedOperator,
    serviceLocation: form.serviceLocation,
    barangay: form.barangay,
    preparationMinutes: form.preparationMinutes,
    travelMinutes: form.travelMinutes,
    bufferMinutes: form.bufferMinutes,
    specialInstructions: form.specialInstructions,
    customerInstructions: form.customerInstructions,
    ...(isTractorService({ name: form.equipmentName, serviceId: form.serviceId }) ? TRACTOR_SCHEDULE_DEFAULTS : {}),
  };
}

function schedulePayload(
  form: RentalSchedule,
  status: ScheduleStatus,
): Omit<RentalSchedule, "scheduleId"> {
  return {
    ...scheduleCandidate(form),
    status,
    paymentStatus: form.paymentStatus,
  };
}

export function RentalScheduleForm({ scheduleId }: { scheduleId?: string }) {
  const router = useRouter();
  const { services } = useRental();
  const { data } = useRentalData(
    async () => ({
      inquiries: await rentalRepository.getRentalInquiries(),
      schedules: await rentalRepository.getRentalSchedules(),
    }),
    [],
  );
  const [form, setForm] = useState(blank);
  const [conflict, setConflict] = useState<ScheduleConflict>();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const tractor = isTractorService({ name: form.equipmentName, serviceId: form.serviceId });

  useEffect(() => {
    if (!data) return;
    const initial = scheduleId
      ? data.schedules.find((item) => item.scheduleId === scheduleId)
      : data.inquiries.find(
          (item) =>
            item.inquiryId ===
            new URLSearchParams(window.location.search).get("inquiry"),
        );
    if (!initial) return;
    const timer = window.setTimeout(() => {
      setForm((current) =>
        "scheduleId" in initial
          ? initial
          : scheduleWithInquiry(current, initial),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data, scheduleId]);

  const update = <K extends keyof RentalSchedule>(
    key: K,
    value: RentalSchedule[K],
  ) => {
    setForm((current) => ({ ...current, ...(key === "date" ? { dailyWork: shiftDailyWork(current.dailyWork, current.date, String(value)) } : {}), [key]: value }));
    setChecked(false);
  };
  const selectInquiry = (inquiry: RentalInquiry) =>
    setForm((current) => scheduleWithInquiry(current, inquiry));
  const candidate = () => scheduleCandidate(form);
  const check = async () => {
    const result = await rentalRepository.checkScheduleConflict(candidate());
    setChecked(!result.hasConflict);
    if (result.hasConflict) setConflict(result);
    else window.alert("No schedule conflict was detected for the rental period.");
  };
  const save = async (status: ScheduleStatus) => {
    if (
      !form.inquiryId ||
      !form.serviceId ||
      !form.date ||
      !form.endDate ||
      !form.startTime ||
      !form.endTime
    ) {
      window.alert(
        "Inquiry, equipment, start/end dates, and start/end times are required.",
      );
      return;
    }
    const result = await rentalRepository.checkScheduleConflict(candidate());
    if (result.hasConflict) {
      setConflict(result);
      return;
    }
    setSaving(true);
    if (scheduleId) {
      await rentalRepository.updateRentalSchedule(scheduleId, {
        ...form,
        status,
      });
    } else {
      await rentalRepository.createRentalSchedule(
        schedulePayload(form, status),
      );
    }
    router.push("/rental/schedule");
  };

  return (
    <RentalAccessGate capability="schedule">
      <RentalPageHeader
        title={scheduleId ? "Edit rental schedule" : "Create rental schedule"}
        description="Multi-day ranges, preparation, travel, and buffer times are included in overlap detection."
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save("Proposed");
        }}
        className="grid gap-5 xl:grid-cols-[1fr_.72fr]"
      >
        <section className="rounded-2xl border border-[#dce7d6] bg-white p-5">
          <h2 className="text-lg font-extrabold text-[#123d2a]">
            Schedule details
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ScheduleField label="Inquiry ID" wide>
              <StyledSelect value={form.inquiryId || "Select inquiry"} options={["Select inquiry", ...(data?.inquiries.map((item) => item.inquiryId) ?? [])]} onChange={(id) => { const inquiry = data?.inquiries.find((item) => item.inquiryId === id); if (inquiry) selectInquiry(inquiry); }} />
            </ScheduleField>
            <ScheduleField label="Requester">
              <input value={form.requesterName} readOnly />
            </ScheduleField>
            <ScheduleField label="Equipment">
              <StyledSelect value={services.find((item) => item.serviceId === form.serviceId)?.name || "Select equipment"} options={["Select equipment", ...services.map((item) => item.name)]} onChange={(name) => { const service = services.find((item) => item.name === name); update("serviceId", service?.serviceId ?? ""); update("equipmentName", service?.name ?? ""); }} />
            </ScheduleField>
            <ScheduleField label="Start date">
              <input
                type="date"
                value={form.date}
                onChange={(event) => update("date", event.target.value)}
              />
            </ScheduleField>
            <ScheduleField label="End date">
              <input
                type="date"
                min={form.date}
                value={form.endDate}
                onChange={(event) => update("endDate", event.target.value)}
              />
            </ScheduleField>
            {form.dailyWork ? <div className="sm:col-span-2"><TractorWorkPlan allowShiftAssignment startDate={form.date} endDate={form.endDate} value={form.dailyWork} onChange={(work) => update("dailyWork", work)} /></div> : null}
            {!tractor ? <>
            <ScheduleField label="Start time">
              <input
                type="time"
                value={form.startTime}
                onChange={(event) => update("startTime", event.target.value)}
              />
            </ScheduleField>
            <ScheduleField label="End time">
              <input
                type="time"
                value={form.endTime}
                onChange={(event) => update("endTime", event.target.value)}
              />
            </ScheduleField>
            </> : null}
            <ScheduleField label="Assigned operator">
              <input
                value={form.assignedOperator ?? ""}
                onChange={(event) =>
                  update("assignedOperator", event.target.value)
                }
              />
            </ScheduleField>
            <ScheduleField label="Service location" wide>
              <input
                value={form.serviceLocation}
                onChange={(event) =>
                  update("serviceLocation", event.target.value)
                }
              />
            </ScheduleField>
            <ScheduleField label="Barangay">
              <input
                value={form.barangay}
                onChange={(event) => update("barangay", event.target.value)}
              />
            </ScheduleField>
            {!tractor && (
              [
                ["Preparation time (minutes)", "preparationMinutes"],
                ["Travel time (minutes)", "travelMinutes"],
                ["Buffer time (minutes)", "bufferMinutes"],
              ] as const
            ).map(([label, key]) => (
              <ScheduleField key={key} label={label}>
                <input
                  type="number"
                  min="0"
                  value={form[key]}
                  onChange={(event) => update(key, Number(event.target.value))}
                />
              </ScheduleField>
            ))}
            <ScheduleField label="Instructions for the customer (included in their schedule email)" wide>
              <textarea
                rows={3}
                maxLength={1000}
                value={form.customerInstructions ?? ""}
                onChange={(event) =>
                  update("customerInstructions", event.target.value)
                }
              />
            </ScheduleField>
            <ScheduleField label="Internal instructions (staff only, never sent to the customer)" wide>
              <textarea
                rows={3}
                value={form.specialInstructions ?? ""}
                onChange={(event) =>
                  update("specialInstructions", event.target.value)
                }
              />
            </ScheduleField>
          </div>
        </section>
        <aside className="grid content-start gap-5">
          <section className="rounded-2xl border border-[#dce7d6] bg-white p-5">
            <h2 className="text-lg font-extrabold text-[#123d2a]">
              Availability checks
            </h2>
            <ul className="mt-4 grid gap-3 text-sm">
              {[
                "Equipment availability",
                "Full rental date range",
                "Existing bookings",
                "Maintenance conflicts",
                "Operator availability",
                "Preparation and buffer overlap",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-xl bg-[#f7f9f5] p-3"
                >
                  <SearchCheck
                    className={`size-5 ${checked ? "text-[#1f6b43]" : "text-[#75837a]"}`}
                  />
                  {item}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void check()}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#9fbea2] bg-[#eef5eb] px-4 text-sm font-bold text-[#365f4a]"
            >
              <AlertTriangle className="size-4" />
              Check Conflict
            </button>
          </section>
          <section className="rounded-2xl border border-[#dce7d6] bg-white p-5">
            <div className="grid gap-2">
              <button
                disabled={saving}
                className="min-h-11 rounded-xl border px-4 text-sm font-bold"
              >
                Save Proposed Schedule
              </button>
              <button
                type="button"
                onClick={() => void save("Confirmed")}
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1f6b43] px-4 text-sm font-bold text-white"
              >
                <CalendarCheck className="size-4" />
                Confirm Schedule
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="min-h-11 rounded-xl px-4 text-sm font-bold text-[#66756c]"
              >
                Cancel
              </button>
            </div>
          </section>
        </aside>
      </form>
      {conflict ? (
        <RentalConflictModal
          conflict={conflict}
          onClose={() => setConflict(undefined)}
          onSelect={(slot) => {
            const [start, end] = slot.split(/[–-]/);
            update("startTime", start);
            update("endTime", end);
            setConflict(undefined);
          }}
        />
      ) : null}
    </RentalAccessGate>
  );
}

function ScheduleField({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactElement;
}) {
  return (
    <label
      className={`grid gap-1.5 text-sm font-bold text-[#365f4a] ${wide ? "sm:col-span-2" : ""}`}
    >
      {label}
      <span className="[&>*]:min-h-11 [&>*]:w-full [&>*]:rounded-xl [&>*]:border [&>*]:border-[#d5e1d0] [&>*]:bg-white [&>*]:p-3 [&>*]:text-sm [&>*]:font-normal">
        {children}
      </span>
    </label>
  );
}
