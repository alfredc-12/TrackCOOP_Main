import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  applicationChips,
  applicationQueryFromParams,
  applicationQueryToParams,
  applicationStatusChoice,
  defaultApplicationQuery,
  defaultHistoryQuery,
  defaultMemberQuery,
  defaultUserQuery,
  historyApiFilters,
  historyChips,
  historyQueryFromParams,
  historyQueryToParams,
  historyRangeError,
  manilaToday,
  memberChips,
  memberQueryFromParams,
  memberQueryToParams,
  mergeViewParams,
  resolveHistoryRange,
  userChips,
  userQueryFromParams,
  userQueryToParams,
  userStatusChoice,
  validateDateRange,
  viewParamKeys,
  viewParams,
} from "./people-filters";

const roundTrip = <Query extends object>(
  defaults: Query,
  toParams: (query: Query) => URLSearchParams,
  fromParams: (params: URLSearchParams) => Partial<Query>,
  query: Query,
) => ({ ...defaults, ...fromParams(new URLSearchParams(toParams(query).toString())) });

test("Manila today follows the +08:00 calendar, not the browser's", () => {
  assert.equal(manilaToday(new Date("2026-03-01T16:30:00Z")), "2026-03-02");
  assert.equal(manilaToday(new Date("2026-03-01T15:59:59Z")), "2026-03-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2024-03-01", -1), "2024-02-29");
});

test("date ranges are validated", () => {
  assert.equal(validateDateRange("2026-01-01", "2026-01-31"), null);
  assert.equal(validateDateRange("2026-02-01", "2026-01-31"), "The end date must be on or after the start date.");
  assert.match(validateDateRange("2026-13-01", undefined) ?? "", /valid start/);
  assert.equal(validateDateRange(undefined, undefined), null);
});

test("user filters survive a trip through the URL and ignore invalid values", () => {
  const query = {
    ...defaultUserQuery,
    search: "ana",
    role: "member" as const,
    statuses: ["Suspended" as const, "Inactive" as const],
    createdFrom: "2026-01-01",
    createdTo: "2026-01-31",
    memberLink: "unlinked" as const,
    lastLogin: "inactive" as const,
    lastLoginDays: 90,
    includeHidden: true,
    sortBy: "displayName" as const,
    sortDirection: "asc" as const,
  };
  assert.deepEqual(roundTrip(defaultUserQuery, userQueryToParams, userQueryFromParams, query), query);
  assert.equal(userQueryToParams(defaultUserQuery).toString(), "", "defaults leave the URL clean");

  const dirty = userQueryFromParams(new URLSearchParams("role=admin&status=Active|Bogus&from=2026-02-01&to=2026-01-01&link=maybe&login=sometimes&days=0&sort=password&dir=sideways"));
  assert.equal(dirty.role, "all");
  assert.deepEqual(dirty.statuses, ["Active"]);
  assert.equal(dirty.createdFrom, undefined, "a reversed range is dropped rather than showing nothing");
  assert.equal(dirty.memberLink, "all");
  assert.equal(dirty.lastLogin, "all");
  assert.equal(dirty.lastLoginDays, 30);
  assert.equal("sortBy" in dirty, false);
  assert.equal(dirty.sortDirection, "desc");
});

test("account status choices map to status lists, including the restricted group", () => {
  assert.equal(userStatusChoice({ statuses: [] }), "all");
  assert.equal(userStatusChoice({ statuses: ["Inactive", "Suspended"] }), "restricted");
  assert.equal(userStatusChoice({ statuses: ["Pending"] }), "Pending");
  assert.equal(userStatusChoice({ statuses: ["Active", "Pending"] }), "custom");
  assert.equal(userStatusChoice({ statuses: [], status: "Active" }), "Active");
});

test("user chips describe each active filter and clear exactly that filter", () => {
  const query = { ...defaultUserQuery, role: "member" as const, statuses: ["Pending" as const], lastLogin: "never" as const };
  const chips = userChips(query);
  assert.deepEqual(chips.map((chip) => chip.key), ["role", "status", "login"]);
  assert.equal(chips[2].label, "Never logged in");
  assert.deepEqual(userChips({ ...query, ...chips[1].clear }).map((chip) => chip.key), ["role", "login"]);
  assert.equal(userChips(defaultUserQuery).length, 0);
  assert.equal(userChips({ ...defaultUserQuery, lastLogin: "inactive", lastLoginDays: 60 })[0].label, "Last login more than 60 days ago");
});

test("application status choices cover groups and single statuses", () => {
  assert.equal(applicationStatusChoice({ statuses: ["Under Review", "Submitted"] })?.value, "group:review");
  assert.equal(applicationStatusChoice({ statuses: ["Payment Required", "Payment Confirmed"] })?.value, "group:payment");
  assert.equal(applicationStatusChoice({ statuses: ["Payment Confirmed"] })?.value, "Payment Confirmed");
  assert.equal(applicationStatusChoice({ statuses: ["Submitted", "Approved"] }), null);
  assert.equal(applicationStatusChoice({ statuses: [] })?.value, "all");
});

test("application filters round-trip through the URL under a prefix", () => {
  const query = {
    ...defaultApplicationQuery,
    search: "reyes",
    statuses: ["Needs Information" as const],
    requestedMembershipType: "True Member" as const,
    applicationSource: "Chairman Entry" as const,
    barangay: "Wawa",
    submittedFrom: "2026-04-01",
    submittedTo: "2026-04-30",
    requirementCompletion: "incomplete" as const,
    sortBy: "fullName" as const,
    sortDirection: "asc" as const,
  };
  assert.deepEqual(roundTrip(defaultApplicationQuery, applicationQueryToParams, applicationQueryFromParams, query), query);
  assert.deepEqual(applicationChips(query).map((chip) => chip.key), ["search", "status", "type", "source", "barangay", "submitted", "req"]);
  assert.equal(applicationQueryFromParams(new URLSearchParams("req=everything")).requirementCompletion, "All");
});

test("member directory filters round-trip and chips clear independently", () => {
  const query = {
    ...defaultMemberQuery,
    approvalStatus: "Approved" as const,
    officialMemberStatus: "Active" as const,
    membershipType: "True Member" as const,
    barangay: "Unspecified",
    sector: "Rice",
    accountLink: "unlinked" as const,
    approvedFrom: "2026-04-01",
  };
  assert.deepEqual(roundTrip(defaultMemberQuery, memberQueryToParams, memberQueryFromParams, query), query);
  const chips = memberChips(query);
  assert.equal(chips.length, 7);
  const cleared = { ...query, ...chips.find((chip) => chip.key === "approved")!.clear };
  assert.equal(cleared.approvedFrom, undefined);
  assert.equal(cleared.approvalStatus, "Approved");
});

test("history ranges resolve to inclusive Manila dates", () => {
  const today = "2026-05-15";
  assert.deepEqual(resolveHistoryRange({ ...defaultHistoryQuery, range: "today" }, today), { from: today, to: today });
  assert.deepEqual(resolveHistoryRange({ ...defaultHistoryQuery, range: "7d" }, today), { from: "2026-05-09", to: today });
  assert.deepEqual(resolveHistoryRange({ ...defaultHistoryQuery, range: "30d" }, today), { from: "2026-04-16", to: today });
  assert.deepEqual(resolveHistoryRange({ ...defaultHistoryQuery, range: "month" }, today), { from: "2026-05-01", to: today });
  assert.deepEqual(resolveHistoryRange({ ...defaultHistoryQuery, range: "all" }, today), {});
  assert.deepEqual(resolveHistoryRange({ ...defaultHistoryQuery, range: "date", date: "2026-04-05" }, today), { date: "2026-04-05" });
  assert.deepEqual(resolveHistoryRange({ ...defaultHistoryQuery, range: "custom", from: "2026-04-01", to: "2026-04-10" }, today), { from: "2026-04-01", to: "2026-04-10" });
  assert.deepEqual(resolveHistoryRange({ ...defaultHistoryQuery, range: "custom", from: "2026-04-10", to: "2026-04-01" }, today), { from: undefined, to: undefined });
  assert.match(historyRangeError({ range: "custom", from: "2026-04-10", to: "2026-04-01" }) ?? "", /on or after/);
  assert.equal(historyRangeError({ range: "7d", from: "2026-04-10", to: "2026-04-01" }), null);
});

test("history filters round-trip, keep the legacy exact date, and build API filters", () => {
  const query = { ...defaultHistoryQuery, search: "ana", sourceModule: "Member" as const, range: "custom" as const, from: "2026-04-01", to: "2026-04-30", actorId: "none", changeType: "membership-type" as const };
  assert.deepEqual(roundTrip(defaultHistoryQuery, historyQueryToParams, historyQueryFromParams, query), query);
  assert.equal(historyQueryFromParams(new URLSearchParams("range=date")).range, "all", "an exact-date range needs a date");
  assert.equal(historyQueryFromParams(new URLSearchParams("actor=abc")).actorId, "");

  const api = historyApiFilters({ ...defaultHistoryQuery, range: "7d", actorId: "12" }, "2026-05-15");
  assert.deepEqual({ from: api.from, to: api.to, actorId: api.actorId, date: api.date }, { from: "2026-05-09", to: "2026-05-15", actorId: "12", date: undefined });

  const chips = historyChips(query);
  assert.deepEqual(chips.map((chip) => chip.key), ["search", "source", "range", "change", "actor"]);
  assert.match(chips.find((chip) => chip.key === "actor")!.label, /No recorded actor/);
  assert.match(historyChips({ ...defaultHistoryQuery, actorId: "7" }, (id) => (id === "7" ? "Chair Person" : undefined))[0].label, /Chair Person/);
});

test("each view's params are namespaced so tabs keep their own filters", () => {
  const params = new URLSearchParams("tab=directory&a_status=Approved&d_official=Active&h_q=ana");
  assert.equal(viewParams(params, "a_").get("status"), "Approved");
  assert.equal(viewParams(params, "d_").get("official"), "Active");
  assert.equal(viewParams(params, "h_").get("q"), "ana");

  const next = mergeViewParams(params, viewParamKeys.applications, new URLSearchParams("status=Submitted"), "a_");
  assert.equal(next.get("a_status"), "Submitted");
  assert.equal(next.get("d_official"), "Active", "other tabs are untouched");
  assert.equal(next.get("tab"), "directory");
  const cleared = mergeViewParams(params, viewParamKeys.applications, new URLSearchParams(), "a_");
  assert.equal(cleared.has("a_status"), false);
});
