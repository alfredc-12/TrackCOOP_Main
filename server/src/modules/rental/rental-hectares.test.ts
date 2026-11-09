import assert from "node:assert/strict";
import test from "node:test";
import * as apiWork from "./rental-hectares";
import * as webWork from "../../../../src/app/rental/_lib/rentalHectares";
import { estimateRentalFee as apiEstimate } from "./rental-estimate";
import { estimateRentalFee as webEstimate } from "../../../../src/app/rental/_lib/rentalEstimate";
import { checkRentalScheduleConflict as apiConflict } from "./rental-conflict";
import { checkRentalScheduleConflict as webConflict } from "../../../../src/app/rental/_lib/rentalConflict";
import { rentalScheduleContent, rentalSubmittedContent, renderRentalEmail } from "./rental-email";
import { scheduleVersion } from "./rental-outbox";
import { rentalDailyWorkSchema } from "./rental-validation";
import type { RentalSchedule, RentalService } from "./rental.types";

const tractor = { serviceId: "TRACTOR-1", name: "Farm tractor", category: "Land Preparation", standardRate: 500, availability: "Available", operationalStatus: "Ready for Use" } as RentalService;
const schedule = (id: string, hectares?: number, overrides: Partial<RentalSchedule> = {}): RentalSchedule => ({
  scheduleId: id, inquiryId: id, rentalId: id, serviceId: tractor.serviceId,
  equipmentName: tractor.name, requesterName: id, requesterType: "Member",
  date: "2099-11-09", endDate: "2099-11-09", startTime: "08:00", endTime: "17:00",
  assignedOperator: "Operator A", serviceLocation: "Farm", barangay: "Wawa",
  preparationMinutes: 30, travelMinutes: 30, bufferMinutes: 30,
  status: "Confirmed", paymentStatus: "Paid",
  ...(hectares === undefined ? {} : { dailyWork: [{ date: "2099-11-09", hectares }] }),
  ...overrides,
});

for (const [name, work, estimate, conflict] of [["API", apiWork, apiEstimate, apiConflict], ["web", webWork, webEstimate, webConflict]] as const) {
  test(`${name}: tractor fees use hectares, including decimals and the existing member discount`, () => {
    const dailyWork = [{ date: "2099-11-09", hectares: 5 }, { date: "2099-11-11", hectares: 2.5 }];
    const input = { service: tractor, requesterType: "Public or Non-member" as const, startDate: "2099-11-09", endDate: "2099-11-11", dailyWork };
    assert.equal(estimate(input)?.total, 3750);
    assert.equal(estimate(input)?.totalHectares, 7.5);
    assert.equal(estimate(input)?.days, 2);
    assert.equal(estimate(input)?.pricingUnit, "hectare");
    assert.equal(estimate({ ...input, requesterType: "Member" })?.total, 3562.5);
    assert.equal(estimate({ ...input, dailyWork: undefined }), undefined);
    assert.equal(estimate({ ...input, service: { standardRate: 500, name: "Meeting hall" } })?.total, 1500);
  });

  test(`${name}: rejects duplicate, out-of-range, missing and excessive area entries`, () => {
    const start = "2099-11-09";
    for (const entries of [undefined, [], [{ date: start, hectares: 0 }], [{ date: start, hectares: 5.01 }], [{ date: start, hectares: 1.001 }], [{ date: start, hectares: Infinity }], [{ date: "2099-11-10", hectares: 1 }], [{ date: start, hectares: 1 }, { date: start, hectares: 2 }]]) {
      assert.ok(work.dailyWorkError(entries, start, start));
    }
    assert.equal(work.dailyWorkError([{ date: start, hectares: 2.5 }], start, start), undefined);
  });

  test(`${name}: customers share 5 hectares per tractor per day even with the same daily operator`, () => {
    assert.equal(conflict(schedule("new", 2), [schedule("one", 3)], [tractor]).hasConflict, false);
    const result = conflict(schedule("new", 2.01), [schedule("one", 2), schedule("two", 1)], [tractor]);
    assert.equal(result.hasConflict, true);
    assert.match(result.reasons[0], /only 2 hectares remaining/);
    assert.equal(result.conflictingSchedules.length, 2);
    assert.deepEqual(result.suggestedSlots, []);
    assert.equal(conflict(schedule("new", 2.01), [schedule("completed", 3, { status: "Completed" })], [tractor]).hasConflict, true);
    assert.equal(conflict(schedule("new", 4.9), [schedule("one", 0.1)], [tractor]).hasConflict, false);
  });

  test(`${name}: releases cancelled capacity, separates assets and dates, excludes the edited booking`, () => {
    const current = schedule("same", 5);
    assert.equal(conflict(current, [current], [tractor]).hasConflict, false);
    assert.equal(conflict(schedule("new", 5), [schedule("old", 5, { status: "Cancelled" })], [tractor]).hasConflict, false);
    assert.equal(conflict(schedule("new", 5), [schedule("old", 5, { serviceId: "OTHER", assignedOperator: "Other" })], [tractor]).hasConflict, false);
    assert.equal(conflict(schedule("new", 5, { date: "2099-11-10", endDate: "2099-11-10", dailyWork: [{ date: "2099-11-10", hectares: 5 }] }), [schedule("old", 5)], [tractor]).hasConflict, false);
    assert.equal(conflict(schedule("new", 5), [schedule("old", 5, { serviceId: "OTHER" })], [tractor]).hasConflict, true);
  });

  test(`${name}: legacy tractor bookings reserve full dates, and maintenance remains unavailable`, () => {
    assert.equal(conflict(schedule("new", 0.1, { startTime: "18:00", endTime: "19:00" }), [schedule("old")], [tractor]).hasConflict, true);
    assert.equal(conflict(schedule("new", 1), [schedule("maintenance", undefined, { status: "Maintenance" })], [tractor]).hasConflict, true);
    assert.equal(conflict(schedule("new", 1), [], [{ ...tractor, operationalStatus: "Under Maintenance" }]).hasConflict, true);
  });

  test(`${name}: the assigned tractor operator is reserved for each work date without clock times`, () => {
    const other = schedule("pump", undefined, { serviceId: "PUMP", startTime: "22:00", endTime: "23:00" });
    const result = conflict(schedule("new", 1), [other], [tractor]);
    assert.equal(result.hasConflict, true);
    assert.match(result.reasons[0], /operator already has work/);
    assert.doesNotMatch(result.reasons[0], /22:00|23:00/);
  });

  test(`${name}: no-work dates do not reserve capacity or the operator`, () => {
    const work = [{ date: "2099-11-09", hectares: 3 }, { date: "2099-11-11", hectares: 2 }];
    const candidate = schedule("new", undefined, { endDate: "2099-11-11", dailyWork: work });
    const other = schedule("other", undefined, { serviceId: "PUMP", date: "2099-11-10", endDate: "2099-11-10" });
    assert.equal(conflict(candidate, [other], [tractor]).hasConflict, false);
    assert.equal(conflict({ ...candidate, date: "2099-11-10", endDate: "2099-11-10", serviceId: "PUMP", dailyWork: undefined }, [schedule("old", undefined, { endDate: "2099-11-11", dailyWork: work })], [tractor]).hasConflict, false);
  });

  test(`${name}: rescheduling shifts work dates and preserves total hectares`, () => {
    const entries = [{ date: "2099-11-09", hectares: 5 }, { date: "2099-11-11", hectares: 2.5 }];
    const shifted = work.shiftDailyWork(entries, "2099-11-09", "2099-11-13");
    assert.deepEqual(shifted, [{ date: "2099-11-13", hectares: 5 }, { date: "2099-11-15", hectares: 2.5 }]);
    assert.equal(work.totalWorkHectares(shifted), 7.5);
    assert.equal(work.dailyWorkError(shifted, "2099-11-13", "2099-11-15"), undefined);
    assert.ok(work.dailyWorkError(shifted, "2099-11-13", "2099-11-14"));
  });
}

test("API schema keeps hectare entries and rejects invalid numeric payloads", () => {
  assert.equal(rentalDailyWorkSchema.safeParse([{ date: "2099-11-09", hectares: 2.5 }]).success, true);
  assert.equal(rentalDailyWorkSchema.safeParse([{ date: "2099-11-09", hectares: "2.5" }]).success, false);
  assert.equal(rentalDailyWorkSchema.safeParse([{ date: "2099-11-09", hectares: 5.01 }]).success, false);
});

test("customer schedule emails include work dates and update when hectares are reallocated", () => {
  const first = schedule("booking", 3);
  const changed = { ...first, dailyWork: [{ date: first.date, hectares: 2 }] };
  assert.notEqual(scheduleVersion(first), scheduleVersion(changed));
  assert.equal(scheduleVersion(first), scheduleVersion({ ...first, startTime: "09:00", endTime: "12:00" }));
  const content = rentalScheduleContent({ ...first, reference: first.rentalId, confirmed: true });
  assert.ok(content.details.some((detail) => detail.label === "Work on 2099-11-09" && detail.value === "3 hectares"));
  const rendered = renderRentalEmail(content, "https://example.test/status");
  assert.doesNotMatch(rendered.text, /\b(?:AM|PM)\b|08:00|17:00|Philippine time/);
  assert.match(rendered.text, /Assigned operator: Operator A/);
  assert.match(rendered.text, /Total hectares: 3 hectares/);
});

test("tractor booking email describes the area without preferred working hours", () => {
  const content = rentalSubmittedContent({
    inquiryId: "RNT-TEST", equipmentName: "Hand Tractor", serviceId: "TRACTOR-TEST",
    requester: { fullName: "Juan Santos" }, preferredDate: "2099-11-09", preferredEndDate: "2099-11-09",
    preferredStartTime: "08:00", preferredEndTime: "17:00", dailyWork: [{ date: "2099-11-09", hectares: 3 }],
  } as Parameters<typeof rentalSubmittedContent>[0]);
  const rendered = renderRentalEmail(content, "https://example.test/status");
  assert.doesNotMatch(rendered.text, /Preferred time|08:00|17:00/);
  assert.match(rendered.text, /3 hectares/);
});
