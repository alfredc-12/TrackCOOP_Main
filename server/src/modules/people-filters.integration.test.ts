import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import mysql, { type Pool } from "mysql2/promise";
import { createMemberRepository } from "./members/member.repository";
import { createMembershipApplicationRepository } from "./membership-applications/membership-application.repository";
import { createUserRepository } from "./users/user.repository";

/**
 * Runs the People Management list/summary SQL against a real MySQL schema.
 *
 * Opt in with PEOPLE_TEST_DB_NAME (must end in `_test`) plus optional PEOPLE_TEST_DB_HOST / _PORT / _USER /
 * _PASSWORD. The database must already contain the TrackCOOP schema; every table this test touches is
 * emptied first, so it refuses to run against any database whose name does not end in `_test`.
 */
const database = process.env.PEOPLE_TEST_DB_NAME;
const enabled = Boolean(database && database.endsWith("_test"));

const tables = [
  "audit_logs", "member_status_history", "membership_application_status_history", "membership_application_requirements",
  "membership_application_documents", "membership_application_beneficiaries", "member_referrals", "membership_applications",
  "user_sessions", "user_activation_tokens", "member_profiles", "users",
];

describe("People Management SQL against MySQL", { skip: enabled ? false : "set PEOPLE_TEST_DB_NAME=<name>_test to run" }, () => {
  let pool: Pool;

  const run = (sql: string, values: unknown[] = []) => pool.query(sql, values);

  before(async () => {
    pool = mysql.createPool({
      host: process.env.PEOPLE_TEST_DB_HOST ?? "127.0.0.1",
      port: Number(process.env.PEOPLE_TEST_DB_PORT ?? 3306),
      user: process.env.PEOPLE_TEST_DB_USER ?? "root",
      password: process.env.PEOPLE_TEST_DB_PASSWORD ?? "",
      database,
      timezone: "Z",
      supportBigNumbers: true,
      bigNumberStrings: true,
      decimalNumbers: false,
    });
    await run("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of tables) await run(`TRUNCATE TABLE ${table}`);
    await run("SET FOREIGN_KEY_CHECKS = 1");
    await run("INSERT INTO roles (role_name, role_slug) VALUES ('Chairman', 'chairman'), ('Bookkeeper', 'bookkeeper'), ('Member', 'member') ON DUPLICATE KEY UPDATE role_slug = VALUES(role_slug)");
    const [roleRows] = await run("SELECT role_id AS id, role_slug AS slug FROM roles");
    const role = Object.fromEntries((roleRows as Array<{ id: number; slug: string }>).map((row) => [row.slug, row.id]));

    // Users. Times are UTC; 2026-03-01 16:30 UTC is already 2 March in Asia/Manila.
    const now = Date.now();
    const ago = (days: number) => new Date(now - days * 86_400_000).toISOString().slice(0, 19).replace("T", " ");
    const users: Array<[number, string, string, string, string, string | null, string | null, string]> = [
      // id, role, username, email, status, last login, created
      [1, "chairman", "chair", "chair@x.test", "Active", ago(2), "2026-01-10 02:00:00", "Chair"],
      [2, "bookkeeper", "book", "book@x.test", "Pending", null, "2026-02-01 02:00:00", "Book"],
      [3, "member", "m1", "m1@x.test", "Active", ago(5), "2026-03-01 16:30:00", "Member One"],
      [4, "member", "m2", "m2@x.test", "Suspended", ago(90), "2026-03-02 15:59:59", "Member Two"],
      [5, "member", "m3", "m3@x.test", "Inactive", null, "2026-03-02 16:00:00", "Member Three"],
      [6, "member", "m4", "m4@x.test", "Pending", null, "2026-03-04 02:00:00", "Member Four"],
      [7, "member", "paymongo-system", "paymongo-system@trackcoop.local", "Active", null, "2026-01-01 00:00:00", "PayMongo System"],
    ];
    for (const [id, slug, username, email, status, lastLogin, created, name] of users) {
      await run(
        "INSERT INTO users (user_id, role_id, username, email, password_hash, display_name, account_status, last_login_at, created_at) VALUES (?, ?, ?, ?, 'x', ?, ?, ?, ?)",
        [id, role[slug], username, email, name, status, lastLogin, created],
      );
    }

    // Member profiles: id, user, name, barangay, sector, type, approval, official, approved_at
    const members: Array<[number, number | null, string, string | null, string | null, string, string, string, string | null]> = [
      [1, 3, "Ana Reyes", "Wawa", "Rice", "Associate", "Approved", "Active", "2026-04-01 02:00:00"],
      [2, 4, "Ben Cruz", "  wawa ", "Corn", "True Member", "Approved", "Suspended", "2026-04-15 02:00:00"],
      [3, 6, "Cara Dizon", null, null, "True Member", "Approved", "Active", "2026-05-01 02:00:00"],
      [4, null, "Dan Lim", "Bilaran", "Fishery", "Associate", "Approved", "Inactive", "2026-05-02 02:00:00"],
      [5, null, "Eva Ong", "Aga", null, "Associate", "Pending", "Pending", null],
      [6, null, "Fil Tan", "", null, "Associate", "Rejected", "Pending", null],
    ];
    for (const [id, userId, name, barangay, sector, type, approval, official, approvedAt] of members) {
      await run(
        "INSERT INTO member_profiles (member_id, user_id, member_code, full_name, barangay, sector, membership_type, approval_status, official_member_status, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, userId, `NFFAC-${id}`, name, barangay, sector, type, approval, official, approvedAt],
      );
    }

    // Applications: id, status, source, type, barangay, submitted_at
    const applications: Array<[number, string, string, string, string | null, string]> = [
      [1, "Submitted", "Public Website", "Associate", "Wawa", "2026-04-01 02:00:00"],
      [2, "Under Review", "Chairman Entry", "True Member", "Bilaran", "2026-04-02 02:00:00"],
      [3, "Needs Information", "Public Website", "Associate", "wawa", "2026-04-03 02:00:00"],
      [4, "Payment Required", "Imported Paper Form", "Associate", "Aga", "2026-04-04 02:00:00"],
      [5, "Payment Confirmed", "Public Website", "True Member", "Aga", "2026-04-05 02:00:00"],
      [6, "Approved", "Public Website", "Associate", "Bilaran", "2026-04-06 02:00:00"],
      [7, "Rejected", "Public Website", "Associate", "Wawa", "2026-04-07 02:00:00"],
      [8, "Withdrawn", "Public Website", "Associate", null, "2026-04-08 02:00:00"],
    ];
    for (const [id, status, source, type, barangay, submittedAt] of applications) {
      await run(
        `INSERT INTO membership_applications
           (membership_application_id, application_code, public_tracking_token_hash, application_source, requested_membership_type,
            first_name, last_name, contact_number, current_address, barangay, terms_version, applicant_signature_name,
            signed_at, signed_place, application_status, submitted_at)
         VALUES (?, ?, ?, ?, ?, 'App', ?, '0917', 'Somewhere', ?, 'v1', 'Sig', ?, 'Nasugbu', ?, ?)`,
        [id, `APP-${id}`, String(id).padStart(64, "0"), source, type, `Person${id}`, barangay, submittedAt, status, submittedAt],
      );
    }
    // Requirements. Payment and orientation requirements never gate "complete".
    const requirements: Array<[number, string, string]> = [
      [1, "Signed Application", "Verified"], [1, "Valid ID", "Verified"], [1, "Associate Membership Fee", "Pending"], [1, "Orientation/Seminar", "Pending"],
      [2, "Signed Application", "Verified"], [2, "Valid ID", "Pending"],
      [4, "Signed Application", "Waived"], [4, "Valid ID", "Verified"], [4, "Proof of Residency", "Verified"],
      [5, "Signed Application", "Verified"], [5, "Valid ID", "Verified"],
      [6, "Signed Application", "Verified"], [6, "Valid ID", "Verified"],
      [7, "Signed Application", "Rejected"],
    ];
    for (const [id, type, status] of requirements) {
      await run("INSERT INTO membership_application_requirements (membership_application_id, requirement_type, requirement_status) VALUES (?, ?, ?)", [id, type, status]);
    }

    // Status history. 2026-04-04 16:30 UTC is 5 April in Asia/Manila.
    const appHistory: Array<[number, string | null, string, number | null, string]> = [
      [1, null, "Submitted", 1, "2026-04-01 02:00:00"],
      [1, "Submitted", "Under Review", 1, "2026-04-02 02:00:00"],
      [2, null, "Submitted", null, "2026-04-03 02:00:00"],
    ];
    for (const [id, from, to, actor, at] of appHistory) {
      await run("INSERT INTO membership_application_status_history (membership_application_id, old_status, new_status, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)", [id, from, to, actor, at]);
    }
    const memberHistory: Array<[number, string, string, string, string, number, string]> = [
      [1, "Associate", "Associate", "Pending", "Active", 1, "2026-04-04 16:30:00"],
      [2, "Associate", "True Member", "Active", "Active", 1, "2026-04-06 02:00:00"],
      [2, "True Member", "Associate", "Active", "Suspended", 2, "2026-04-07 02:00:00"],
    ];
    for (const [id, oldType, newType, oldStatus, newStatus, actor, at] of memberHistory) {
      await run("INSERT INTO member_status_history (member_id, old_membership_type, new_membership_type, old_official_status, new_official_status, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, oldType, newType, oldStatus, newStatus, actor, at]);
    }
    const audits: Array<[number, string, number, string, string, string]> = [
      [1, "user.status_changed", 3, '{"accountStatus":"Pending"}', '{"accountStatus":"Active"}', "2026-04-08 02:00:00"],
      [1, "user.role_changed", 3, '{"role":"member"}', '{"role":"bookkeeper"}', "2026-04-09 02:00:00"],
      [1, "user.status_changed", 5, '{"accountStatus":"Active"}', '{"accountStatus":"Inactive"}', "2026-04-10 02:00:00"],
      [1, "user.created", 3, "{}", "{}", "2026-04-11 02:00:00"],
    ];
    for (const [actor, action, record, oldValues, newValues, at] of audits) {
      await run("INSERT INTO audit_logs (user_id, action, entity_table, record_id, old_values, new_values, action_time) VALUES (?, ?, 'users', ?, ?, ?, ?)", [actor, action, record, oldValues, newValues, at]);
    }
  });

  after(async () => {
    await pool?.end();
  });

  describe("user accounts", () => {
    it("summarises everything except the status filter and honours the hidden-account policy", async () => {
      const repository = createUserRepository(pool);
      const summary = await repository.summary();
      assert.deepEqual(
        { total: summary.total, active: summary.active, pending: summary.pendingActivation, restricted: summary.suspendedInactive, suspended: summary.suspended, inactive: summary.inactive },
        { total: 6, active: 2, pending: 2, restricted: 2, suspended: 1, inactive: 1 },
      );
      assert.deepEqual(summary.byRole, { chairman: 1, bookkeeper: 1, member: 4 });
      assert.deepEqual(summary.memberAccounts, { eligible: 4, linked: 3 });
      assert.equal(summary.overallTotal, 6);

      const withHidden = await repository.summary({ includeHidden: true });
      assert.equal(withHidden.total, 7);
      assert.equal(withHidden.overallTotal, 7);
      assert.equal((await repository.list({ page: 1, pageSize: 20, includeHidden: true, sortBy: "createdAt", sortDirection: "desc" })).total, 7);
    });

    it("keeps list totals and the matching KPI card equal for every filter combination", async () => {
      const repository = createUserRepository(pool);
      const base = { page: 1, pageSize: 20, sortBy: "createdAt", sortDirection: "desc" } as const;
      const restricted = await repository.list({ ...base, statuses: ["Suspended", "Inactive"] });
      assert.equal(restricted.total, 2);
      assert.equal((await repository.summary({ statuses: ["Suspended", "Inactive"] })).total, 6, "the summary ignores the status filter");

      const members = await repository.list({ ...base, role: "member", status: "Pending" });
      const summary = await repository.summary({ role: "member" });
      assert.equal(members.total, summary.pendingActivation);
      assert.equal(members.total, 1);
    });

    it("filters unlinked member accounts without flagging staff accounts", async () => {
      const repository = createUserRepository(pool);
      const base = { page: 1, pageSize: 20, sortBy: "displayName", sortDirection: "asc" } as const;
      const unlinked = await repository.list({ ...base, memberLink: "unlinked" });
      assert.deepEqual(unlinked.users.map((user) => user.username), ["m3"]);
      assert.equal((await repository.list({ ...base, memberLink: "linked" })).total, 3);
    });

    it("separates never-logged-in, recent and not-seen-in-period accounts", async () => {
      const repository = createUserRepository(pool);
      const base = { page: 1, pageSize: 20, sortBy: "displayName", sortDirection: "asc" } as const;
      const usernames = async (lastLogin: "never" | "recent" | "inactive") =>
        (await repository.list({ ...base, lastLogin, lastLoginDays: 30 })).users.map((user) => user.username).sort();
      assert.deepEqual(await usernames("never"), ["book", "m3", "m4"]);
      assert.deepEqual(await usernames("recent"), ["chair", "m1"]);
      assert.deepEqual(await usernames("inactive"), ["m2"], "missing last login is not treated as inactive");
    });

    it("applies the creation-date range in Asia/Manila", async () => {
      const repository = createUserRepository(pool);
      const base = { page: 1, pageSize: 20, sortBy: "displayName", sortDirection: "asc" } as const;
      const usernames = async (createdFrom: string, createdTo: string) =>
        (await repository.list({ ...base, createdFrom, createdTo })).users.map((user) => user.username).sort();
      // 2026-03-01 16:30 UTC and 2026-03-02 15:59:59 UTC are both 2 March in Manila; 16:00:00 UTC is 3 March.
      assert.deepEqual(await usernames("2026-03-02", "2026-03-02"), ["m1", "m2"]);
      assert.deepEqual(await usernames("2026-03-03", "2026-03-03"), ["m3"]);
      assert.deepEqual(await usernames("2026-03-01", "2026-03-01"), []);
    });

    it("escapes LIKE wildcards in search", async () => {
      const repository = createUserRepository(pool);
      const result = await repository.list({ page: 1, pageSize: 20, search: "%", sortBy: "createdAt", sortDirection: "desc" });
      assert.equal(result.total, 0);
    });
  });

  describe("membership applications", () => {
    const base = { page: 1, pageSize: 20, sortBy: "submittedAt", sortDirection: "asc" } as const;

    it("summarises every status and the review and payment groups", async () => {
      const summary = await createMembershipApplicationRepository(pool).summary();
      assert.deepEqual(
        { total: summary.total, submitted: summary.submitted, underReview: summary.underReview, needs: summary.needsInformation, due: summary.paymentRequired, ok: summary.paymentConfirmed, approved: summary.approved, rejected: summary.rejected, withdrawn: summary.withdrawn },
        { total: 8, submitted: 1, underReview: 1, needs: 1, due: 1, ok: 1, approved: 1, rejected: 1, withdrawn: 1 },
      );
      assert.equal(summary.forReview, 2);
      assert.equal(summary.paymentStage, 2);
      assert.equal(summary.overallTotal, 8);
    });

    it("filters requirement completion across all pages with the shared rule", async () => {
      const repository = createMembershipApplicationRepository(pool);
      const complete = await repository.list({ ...base, requirementCompletion: "complete" });
      assert.deepEqual(complete.applications.map((application) => application.applicationCode), ["APP-1", "APP-4", "APP-5", "APP-6"]);
      const incomplete = await repository.list({ ...base, requirementCompletion: "incomplete" });
      assert.deepEqual(incomplete.applications.map((application) => application.applicationCode), ["APP-2", "APP-3", "APP-7", "APP-8"]);

      const secondPage = await repository.list({ ...base, pageSize: 2, page: 2, requirementCompletion: "complete" });
      assert.equal(secondPage.total, 4, "the total covers the whole filtered population");
      assert.deepEqual(secondPage.applications.map((application) => application.applicationCode), ["APP-5", "APP-6"]);
      assert.equal((await repository.summary({ requirementCompletion: "complete" })).total, 4);
    });

    it("reconciles list totals with the status cards and multi-status groups", async () => {
      const repository = createMembershipApplicationRepository(pool);
      const forReview = await repository.list({ ...base, statuses: ["Submitted", "Under Review"] });
      assert.equal(forReview.total, (await repository.summary()).forReview);
      const paymentStage = await repository.list({ ...base, statuses: ["Payment Required", "Payment Confirmed"] });
      assert.equal(paymentStage.total, 2);
      const wawaApproved = await repository.summary({ barangay: "WAWA" });
      assert.equal(wawaApproved.total, 3, "barangay matching ignores case and spacing");
    });

    it("applies the submission date range in Asia/Manila and finds blank barangays", async () => {
      const repository = createMembershipApplicationRepository(pool);
      const range = await repository.list({ ...base, submittedFrom: "2026-04-02", submittedTo: "2026-04-03" });
      assert.deepEqual(range.applications.map((application) => application.applicationCode), ["APP-2", "APP-3"]);
      const unspecified = await repository.list({ ...base, barangay: "Unspecified" });
      assert.deepEqual(unspecified.applications.map((application) => application.applicationCode), ["APP-8"]);
      const combined = await repository.list({ ...base, requestedMembershipType: "True Member", applicationSource: "Chairman Entry", barangay: "Bilaran" });
      assert.deepEqual(combined.applications.map((application) => application.applicationCode), ["APP-2"]);
    });

    it("lists distinct barangays once regardless of case", async () => {
      const options = await createMembershipApplicationRepository(pool).barangayOptions();
      assert.deepEqual(options.barangays.map((entry) => entry.barangay.toLowerCase()), ["aga", "bilaran", "wawa"]);
      assert.equal(options.unspecified, 1);
    });
  });

  describe("member directory", () => {
    const base = { page: 1, pageSize: 20, sortBy: "memberCode", sortDirection: "asc" } as const;

    it("keeps approved-only populations coherent", async () => {
      const summary = await createMemberRepository(pool).summary();
      assert.equal(summary.total, 6);
      assert.equal(summary.approvedMembers.total, 4);
      assert.equal(summary.approvedMembers.associate + summary.approvedMembers.trueMember, summary.approvedMembers.total);
      const official = summary.approvedMembers;
      assert.equal(official.active + official.inactive + official.suspended + official.terminated + official.pendingOfficial, official.total);
      assert.deepEqual(
        { active: official.active, inactive: official.inactive, suspended: official.suspended, associate: official.associate, trueMember: official.trueMember, unlinked: official.unlinked },
        { active: 2, inactive: 1, suspended: 1, associate: 2, trueMember: 2, unlinked: 1 },
      );
      assert.equal(summary.associate, 4, "the legacy field still counts every profile");
      assert.equal(summary.pendingApproval, 1);
      assert.equal(summary.rejected, 1);
      assert.equal(summary.overallTotal, 6);
    });

    it("lists the same population the KPI cards describe", async () => {
      const repository = createMemberRepository(pool);
      const active = await repository.list({ ...base, approvalStatus: "Approved", officialMemberStatus: "Active" });
      assert.equal(active.total, (await repository.summary()).approvedMembers.active);
      const trueMembers = await repository.list({ ...base, approvalStatus: "Approved", membershipType: "True Member" });
      assert.deepEqual(trueMembers.members.map((member) => member.memberCode), ["NFFAC-2", "NFFAC-3"]);
    });

    it("filters barangay, sector, account link and approval date without losing blank records", async () => {
      const repository = createMemberRepository(pool);
      const codes = async (filters: object) => (await repository.list({ ...base, ...filters })).members.map((member) => member.memberCode);
      assert.deepEqual(await codes({ barangay: "Wawa" }), ["NFFAC-1", "NFFAC-2"]);
      assert.deepEqual(await codes({ barangay: "Unspecified" }), ["NFFAC-3", "NFFAC-6"]);
      assert.deepEqual(await codes({ sector: "Rice" }), ["NFFAC-1"]);
      assert.deepEqual(await codes({ sector: "Unspecified" }), ["NFFAC-3", "NFFAC-5", "NFFAC-6"]);
      assert.deepEqual(await codes({ accountLink: "unlinked", approvalStatus: "Approved" }), ["NFFAC-4"]);
      assert.deepEqual(await codes({ approvedFrom: "2026-04-15", approvedTo: "2026-05-01" }), ["NFFAC-2", "NFFAC-3"]);
      const summary = await repository.summary({ approvedFrom: "2026-04-15", approvedTo: "2026-05-01" });
      assert.equal(summary.total, 2);
    });
  });

  describe("status history", () => {
    const base = { page: 1, pageSize: 50 } as const;
    const ids = async (filters: object) => (await createMemberRepository(pool).unifiedStatusHistory({ ...base, ...filters })).entries.map((entry) => entry.id).sort();

    it("counts events per source and distinct subjects", async () => {
      const summary = await createMemberRepository(pool).unifiedStatusHistorySummary();
      assert.deepEqual(
        { total: summary.total, application: summary.application, member: summary.member, account: summary.account, subjects: summary.distinctSubjects },
        { total: 8, application: 3, member: 3, account: 2, subjects: 5 },
      );
      assert.equal(summary.overallTotal, 8);
    });

    it("classifies member events by what actually changed", async () => {
      assert.equal((await ids({ changeType: "member-status" })).length, 2);
      assert.equal((await ids({ changeType: "membership-type" })).length, 2);
      const entries = (await createMemberRepository(pool).unifiedStatusHistory({ ...base, sourceModule: "Member" })).entries;
      assert.deepEqual(entries.map((entry) => entry.changeType).sort(), ["member-status", "member-status-and-type", "membership-type"]);
      assert.equal((await ids({ changeType: "account-role" })).length, 1);
      assert.equal((await ids({ changeType: "application-status" })).length, 3);
    });

    it("filters by actor, including events without a recorded actor", async () => {
      assert.deepEqual(await ids({ actorId: "none" }), ["application-3"]);
      assert.equal((await ids({ actorId: "2" })).length, 1);
      const actors = await createMemberRepository(pool).unifiedStatusHistoryActors();
      assert.deepEqual(actors.actors.map((actor) => [actor.id, actor.total]), [["2", 1], ["1", 6]]);
      assert.equal(actors.withoutActor, 1);
    });

    it("interprets dates in Asia/Manila and keeps the summary in step with the table", async () => {
      assert.deepEqual(await ids({ date: "2026-04-05" }), ["member-1"], "16:30 UTC on 4 April is 5 April in Manila");
      assert.deepEqual(await ids({ date: "2026-04-04" }), []);
      assert.equal((await ids({ from: "2026-04-05", to: "2026-04-07" })).length, 3);
      const summary = await createMemberRepository(pool).unifiedStatusHistorySummary({ from: "2026-04-05", to: "2026-04-07" });
      assert.equal(summary.total, 3);
      const table = await createMemberRepository(pool).unifiedStatusHistory({ ...base, from: "2026-04-05", to: "2026-04-07", sourceModule: "Member" });
      assert.equal(table.total, summary.member);
    });

    it("paginates over the filtered total", async () => {
      const page = await createMemberRepository(pool).unifiedStatusHistory({ page: 2, pageSize: 3, sourceModule: "All" });
      assert.equal(page.total, 8);
      assert.equal(page.entries.length, 3);
    });
  });
});
