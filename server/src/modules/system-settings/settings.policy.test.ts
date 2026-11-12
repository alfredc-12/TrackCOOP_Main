import assert from "node:assert/strict";
import test from "node:test";
import {
  byKey,
  categories,
  definitions,
  validateValue,
  parseStored,
  revision,
  validateRfmState,
} from "./settings.registry";
import {
  safeAuditValues,
  activityLabel,
  areaFor,
  safeText,
  matchingActions,
  safeActionCode,
} from "../audit-logs/activity.presentation";
import { activityScope } from "../audit-logs/activity.repository";
import { parseActivityQuery } from "../audit-logs/activity.schema";
test("settings approve only real consumers and leave inconsistent capital/inventory policies read-only", () => {
  for (const key of [
    "membership.initial_share_capital",
    "membership.true_member_required_capital",
    "membership.maximum_share_capital",
    "inventory.allow_negative_stock",
  ]) {
    assert.equal(byKey.get(key)!.editable, false);
    assert.throws(() => validateValue(byKey.get(key)!, 100));
  }
  assert.equal(byKey.has("membership.registration_fee"), false);
  assert.equal(
    byKey.has("member_indicators.minimum_quintile_population"),
    false,
  );
  assert.equal(new Set(definitions.map((d) => d.key)).size, definitions.length);
});
test("share-capital policy rates are editable percentages with a safe interest default", () => {
  const reserve = byKey.get("share_capital.statutory_reserve_rate")!,
    interest = byKey.get("share_capital.interest_allocation_rate")!;
  assert.equal(reserve.editable, true);
  assert.equal(reserve.fallback, 10);
  assert.equal(interest.editable, true);
  assert.equal(interest.fallback, null);
  assert.equal(validateValue(reserve, 50), 50);
  assert.equal(validateValue(interest, 25), 25);
  assert.throws(() => validateValue(reserve, 100.01));
  assert.throws(() => validateValue(interest, -1));
});

test("patronage policy follows share capital and validates its surplus allocation percentage", () => {
  const definition = byKey.get("patronage.allocation_rate")!;
  assert.equal(categories[categories.findIndex((category) => category.id === "share_capital") + 1].id, "patronage");
  assert.equal(definition.fallback, 30);
  assert.equal(definition.editable, true);
  assert.equal(validateValue(definition, 30), 30);
  assert.equal(validateValue(definition, 40), 40);
  assert.throws(() => validateValue(definition, 29.99));
  assert.throws(() => validateValue(definition, 100.01));
  const memberRate = byKey.get("patronage.member_refund_rate")!;
  assert.equal(memberRate.fallback, 3);
  assert.equal(validateValue(memberRate, 4.25), 4.25);
  for (const invalid of [0, -1, 100.01, 3.125, NaN]) assert.throws(() => validateValue(memberRate, invalid));
});
test("unapproved referral rewards are read-only; historical stored values remain readable", () => {
 const d=byKey.get("referrals.reward_policy")!;
 assert.equal(d.editable,false);
 assert.throws(()=>validateValue(d,{enabled:true,creditsPerSuccessfulReferral:1,label:"Credits"}));
 const legacy={enabled:true,creditsPerSuccessfulReferral:7,label:"Participation credits"};
 assert.deepEqual(parseStored(d,JSON.stringify(legacy)),legacy);
 assert.deepEqual(d.fallback,{enabled:false,creditsPerSuccessfulReferral:0,label:"Referrals"});
});

test("numeric/text revisions and RFM validation preserve authoritative configuration and row order", () => {
  assert.throws(() =>
    validateValue(byKey.get("membership.activation_token_hours")!, 1.5),
  );
  assert.throws(() => validateValue(byKey.get("membership.associate_fee")!, 0));
  assert.notEqual(revision("a", "1", true), revision("a", "2", true));
  assert.notEqual(revision("a", null, true), revision("a", null, false));
  const d = byKey.get("member_indicators.fallback_thresholds")!;
  const value = parseStored(
    d,
    JSON.stringify({
      recencyDays: [
        { max: 70, score: 4 },
        { max: 40, score: 5 },
      ],
    }),
  ) as { recencyDays: unknown[] };
  assert.deepEqual(value.recencyDays, [
    { max: 70, score: 4 },
    { max: 40, score: 5 },
  ]);
  assert.throws(() =>
    validateRfmState(
      new Map([
        [
          "member_indicators.label_thresholds",
          '{"activeMin":7,"needsMonitoringMin":12}',
        ],
      ]),
    ),
  );
});
test("known actions read naturally and unknown codes never become fabricated descriptions", () => {
  assert.equal(
    activityLabel("system_setting.upserted"),
    "Updated a system setting",
  );
  assert.equal(activityLabel("landing.gallery.created"), "Created a gallery");
  assert.equal(
    activityLabel("financial_record.posted"),
    "Posted a financial record",
  );
  assert.equal(activityLabel("unknown.new_thing"), "Recorded system activity");
  assert.equal(
    areaFor("landing.gallery.created", "gallery_groups").id,
    "website",
  );
  assert.ok(
    matchingActions("created a gallery").includes("landing.gallery.created"),
  );
});
test("audit JSON snapshots with nested secret fields and encoded setting values never leak credentials", () => {
  const secret = "private-value-for-redaction-test";
  const result = safeAuditValues({
    recordNumber: "FIN-1",
    amount: 30,
    password: secret,
    apiKey: secret,
    session: { token: secret },
    activationUrl: "https://example.invalid/activate/private",
  });
  assert.deepEqual(result, { "Record number": "FIN-1", Amount: 30 });
  assert.equal(
    safeAuditValues({ settingKey: "smtp.password", settingValue: secret }),
    null,
  );
  const r = safeAuditValues({
    settingKey: "referrals.reward_policy",
    settingValue:
      '{"enabled":false,"creditsPerSuccessfulReferral":7,"label":"Credits"}',
  });
  assert.equal(r!["Credits per successful referral"], 7);
  assert.equal(r!["Enabled"], false);
  assert.ok(!JSON.stringify(r).includes('{\\"'));
});
test("free-text links, token assignments, quoted credential JSON, bearer tokens and secret-like action codes are withheld", () => {
  for (const input of [
    "password=unsafe",
    '"password_hash":"unsafe"',
    "https://example.invalid/activate/unsafe",
    "Bearer unsafe",
    "api_key:unsafe",
  ])
    assert.ok(!safeText(input).includes("unsafe"), input);
  assert.equal(
    safeActionCode("sk_live_" + "x".repeat(20)),
    "unrecognized_activity",
  );
  assert.throws(() =>
    validateValue(
      byKey.get("membership.terms_version")!,
      "https://example.invalid/token",
    ),
  );
});
test("activity filters use Manila UTC boundaries, shared count/page predicates and escaped parameter values", () => {
  const f = parseActivityQuery({
      start: "2026-11-01",
      end: "2026-11-02",
      search: "100%_!",
      userId: "2",
      category: "settings",
    }),
    q = activityScope(f);
  assert.ok(q.values.includes("2026-10-31 16:00:00"));
  assert.ok(q.values.includes("2026-11-02 16:00:00"));
  assert.ok(q.values.includes("%100!%!_!!%"));
  assert.ok(!q.sql.includes("100%"));
  assert.throws(() =>
    parseActivityQuery({ start: "2026-11-03", end: "2026-10-01" }),
  );
  assert.throws(() => parseActivityQuery({ pageSize: 101 }));
  assert.throws(() => parseActivityQuery({ category: "' OR 1=1" }));
});

test("partial recorded RFM settings are not expanded into invented historical values", () => {
  const values = safeAuditValues({
    settingKey: "member_indicators.fallback_thresholds",
    settingValue: '{"recencyDays":[{"max":30,"score":5}]}',
  });
  assert.ok(values?.["Days since participation"]);
  assert.equal(values?.["Participation count"], undefined);
  assert.equal(values?.["Capital contribution"], undefined);
});

test("escaped credential JSON and snake-case financial snapshots are safely handled", () => {
  assert.equal(
    safeText(String.raw`{\"password\":\"unsafe\"}`),
    "[sensitive detail omitted]",
  );
  assert.deepEqual(
    safeAuditValues({
      record_number: "FIN-9",
      record_status: "Corrected",
      password_hash: "unsafe",
    }),
    { "Record number": "FIN-9", "Record status": "Corrected" },
  );
  assert.equal(
    activityLabel("landing.partners.created"),
    "Created a partner or certification record",
  );
});

test("search alternatives always bind exactly one value per placeholder", () => {
  for (const search of [
    "referral reward policy",
    "system setting",
    "created a gallery",
    "drop%_?'",
    "123",
  ]) {
    const q = activityScope(parseActivityQuery({ search }));
    assert.equal((q.sql.match(/\?/g) ?? []).length, q.values.length, search);
  }
});

test("the displayed recorded reference is also searched, including application/member codes and old values", () => {
  const q = activityScope(parseActivityQuery({ search: "MEM-FIXTURE" }));
  assert.match(q.sql, /applicationCode/);
  assert.match(q.sql, /memberCode/);
  assert.match(q.sql, /old_values/);
  assert.equal((q.sql.match(/\?/g) ?? []).length, q.values.length);
});
