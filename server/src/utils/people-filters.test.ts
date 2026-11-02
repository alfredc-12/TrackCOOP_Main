import assert from "node:assert/strict";
import test from "node:test";
import { listMembersQuerySchema, unifiedStatusHistorySummaryQuerySchema } from "../modules/members/member.schema";
import { chairmanApplicationListQuerySchema, chairmanApplicationSummaryQuerySchema } from "../modules/membership-applications/membership-application.schema";
import {
  isPrePaymentRequirementsComplete,
  prePaymentRequirementsCompleteSql,
} from "../modules/membership-applications/membership-application.requirements";
import type { ChairmanApplicationRequirement, RequirementStatus, RequirementType } from "../modules/membership-applications/membership-application.types";
import { listUsersQuerySchema, userSummaryQuerySchema } from "../modules/users/user.schema";
import { userFilterConditions } from "../modules/users/user.repository";
import { applicationFilterConditions } from "../modules/membership-applications/membership-application.repository";
import { memberFilterConditions, unifiedHistoryConditions } from "../modules/members/member.repository";
import { barangayFilter, joinFilters, likeTerm, manilaDateRangeFilter, manilaRangeBounds } from "./people-filters";

test("Manila date ranges become exact UTC instants", () => {
  assert.deepEqual(manilaRangeBounds("2026-03-02", "2026-03-02"), {
    startUtc: "2026-03-01 16:00:00",
    endExclusiveUtc: "2026-03-02 16:00:00",
  });
  assert.deepEqual(manilaRangeBounds("2026-12-31", null), { startUtc: "2026-12-30 16:00:00", endExclusiveUtc: null });
  assert.deepEqual(manilaRangeBounds(undefined, "2026-01-01"), { startUtc: null, endExclusiveUtc: "2026-01-01 16:00:00" });
  assert.deepEqual(manilaDateRangeFilter("c", undefined, undefined), []);
  assert.deepEqual(
    manilaDateRangeFilter("c", "2026-03-02", "2026-03-02").map((filter) => filter.sql),
    ["c >= ?", "c < ?"],
  );
});

test("barangay matching is case-insensitive and finds blanks", () => {
  assert.deepEqual(barangayFilter("a.barangay", "  Wawa "), { sql: "LOWER(TRIM(a.barangay)) = ?", values: ["wawa"] });
  assert.match(barangayFilter("a.barangay", "unspecified").sql, /IS NULL/);
});

test("LIKE wildcards in a search are escaped", () => {
  assert.equal(likeTerm("50%_off\\"), "%50\\%\\_off\\\\%");
});

test("joinFilters preserves placeholder order", () => {
  const joined = joinFilters([
    { sql: "a = ?", values: [1] },
    { sql: "b IN (?, ?)", values: [2, 3] },
  ]);
  assert.equal(joined.whereSql, " WHERE a = ? AND b IN (?, ?)");
  assert.deepEqual(joined.values, [1, 2, 3]);
});

test("the SQL requirement predicate is generated from the rule that gates payment approval", () => {
  const sql = prePaymentRequirementsCompleteSql("a");
  for (const excluded of ["Associate Membership Fee", "Initial Share Capital", "Orientation/Seminar"]) assert.match(sql, new RegExp(excluded.replace("/", "\\/")));
  for (const complete of ["Verified", "Waived"]) assert.match(sql, new RegExp(`'${complete}'`));
  assert.match(sql, /EXISTS[\s\S]+NOT EXISTS/);
});

test("pre-payment completion needs at least one gating requirement and ignores payment and orientation rows", () => {
  const requirement = (requirementType: RequirementType, requirementStatus: RequirementStatus) =>
    ({ requirementType, requirementStatus }) as ChairmanApplicationRequirement;
  assert.equal(isPrePaymentRequirementsComplete([]), false);
  assert.equal(isPrePaymentRequirementsComplete([requirement("Associate Membership Fee", "Pending")]), false);
  assert.equal(isPrePaymentRequirementsComplete([requirement("Signed Application", "Verified"), requirement("Associate Membership Fee", "Pending"), requirement("Orientation/Seminar", "Pending")]), true);
  assert.equal(isPrePaymentRequirementsComplete([requirement("Signed Application", "Waived"), requirement("Valid ID", "Verified")]), true);
  assert.equal(isPrePaymentRequirementsComplete([requirement("Signed Application", "Verified"), requirement("Valid ID", "Submitted")]), false);
  assert.equal(isPrePaymentRequirementsComplete([requirement("Signed Application", "Rejected")]), false);
});

test("user filters validate dates, status lists and defaults", () => {
  const parsed = listUsersQuerySchema.parse({ statuses: "Suspended|Inactive", memberLink: "unlinked", lastLogin: "inactive", createdFrom: "2026-01-01", createdTo: "2026-01-31" });
  assert.deepEqual(parsed.statuses, ["Suspended", "Inactive"]);
  assert.equal(parsed.lastLoginDays, 30);
  assert.equal(parsed.includeHidden, false);
  assert.throws(() => listUsersQuerySchema.parse({ createdFrom: "2026-02-01", createdTo: "2026-01-01" }));
  assert.throws(() => listUsersQuerySchema.parse({ statuses: "Suspended|Bogus" }));
  assert.throws(() => listUsersQuerySchema.parse({ createdFrom: "2026-13-40" }));
  assert.deepEqual(Object.keys(userSummaryQuerySchema.parse({})).sort(), ["includeHidden", "lastLoginDays"]);
});

test("the user summary scope omits only the status filter", () => {
  const filters = { statuses: ["Suspended" as const], role: "member" as const, memberLink: "linked" as const, search: "ana" };
  const list = joinFilters(userFilterConditions(filters));
  const summary = joinFilters(userFilterConditions(filters, { omitStatus: true }));
  assert.match(list.whereSql, /account_status IN/);
  assert.doesNotMatch(summary.whereSql, /account_status IN/);
  assert.match(summary.whereSql, /role_slug = \?/);
  assert.match(summary.whereSql, /member_id IS NOT NULL/);
  assert.match(summary.whereSql, /NOT \(u\.username = 'paymongo-system'/);
  assert.equal(joinFilters(userFilterConditions({ includeHidden: true })).whereSql, "");
});

test("last-login windows use an explicit cutoff", () => {
  const now = new Date("2026-06-30T00:00:00Z");
  const recent = userFilterConditions({ includeHidden: true, lastLogin: "recent", lastLoginDays: 30 }, { now });
  assert.deepEqual(recent[0].values, ["2026-05-31 00:00:00"]);
  const inactive = userFilterConditions({ includeHidden: true, lastLogin: "inactive", lastLoginDays: 30 }, { now });
  assert.match(inactive[0].sql, /IS NOT NULL/);
});

test("application filters parse status groups, dates and requirement completion", () => {
  const parsed = chairmanApplicationListQuerySchema.parse({ statuses: "Submitted,Under Review", requirementCompletion: "complete", submittedFrom: "2026-04-01" });
  assert.deepEqual(parsed.statuses, ["Submitted", "Under Review"]);
  assert.equal(parsed.requirementCompletion, "complete");
  assert.throws(() => chairmanApplicationListQuerySchema.parse({ requirementCompletion: "maybe" }));
  assert.throws(() => chairmanApplicationSummaryQuerySchema.parse({ submittedFrom: "2026-05-01", submittedTo: "2026-04-01" }));
});

test("application list and summary share predicates except the status filter", () => {
  const filters = { statuses: ["Submitted" as const], barangay: "Wawa", requirementCompletion: "incomplete" as const, search: "x" };
  const list = joinFilters(applicationFilterConditions(filters));
  const summary = joinFilters(applicationFilterConditions(filters, { omitStatus: true }));
  assert.match(list.whereSql, /IN \(\?\)/);
  assert.doesNotMatch(summary.whereSql, /IN \(\?\)/);
  assert.match(summary.whereSql, /NOT \(EXISTS/);
  assert.equal(list.values.length, summary.values.length + 1);
});

test("member filters parse and the summary omits the partition filters", () => {
  const parsed = listMembersQuerySchema.parse({ approvalStatus: "Approved", accountLink: "unlinked", sector: "Rice", approvedFrom: "2026-04-01", approvedTo: "2026-04-30" });
  assert.equal(parsed.accountLink, "unlinked");
  assert.throws(() => listMembersQuerySchema.parse({ accountLink: "sideways" }));
  assert.throws(() => listMembersQuerySchema.parse({ approvedFrom: "2026-05-01", approvedTo: "2026-04-01" }));
  const list = joinFilters(memberFilterConditions(parsed));
  const summary = joinFilters(memberFilterConditions(parsed, { omitPartition: true }));
  assert.match(list.whereSql, /approval_status = \?/);
  assert.doesNotMatch(summary.whereSql, /approval_status = \?/);
  assert.match(summary.whereSql, /m\.approved_at >= \?/);
  assert.match(summary.whereSql, /user_id IS NULL/);
});

test("history filters parse, treat one exact date as a one-day range, and map change types", () => {
  const parsed = unifiedStatusHistorySummaryQuerySchema.parse({ actorId: "none", changeType: "membership-type" });
  assert.equal(parsed.sourceModule, "All");
  assert.throws(() => unifiedStatusHistorySummaryQuerySchema.parse({ actorId: "abc" }));
  assert.throws(() => unifiedStatusHistorySummaryQuerySchema.parse({ from: "2026-02-01", to: "2026-01-01" }));
  assert.throws(() => unifiedStatusHistorySummaryQuerySchema.parse({ changeType: "everything" }));

  const exact = unifiedHistoryConditions({ date: "2026-04-05", from: "2026-01-01", to: "2026-12-31" });
  assert.deepEqual(exact.flatMap((filter) => filter.values), ["2026-04-04 16:00:00", "2026-04-05 16:00:00"]);
  const type = unifiedHistoryConditions({ changeType: "membership-type" });
  assert.deepEqual(type[0].values, ["membership-type", "member-status-and-type"]);
  const noSource = unifiedHistoryConditions({ sourceModule: "Member", actorId: "none" }, { omitSource: true });
  assert.deepEqual(noSource.map((filter) => filter.sql), ["actorId IS NULL"]);
});
