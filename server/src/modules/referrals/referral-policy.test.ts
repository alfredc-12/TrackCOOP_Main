import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateReferralRewardCredits,
  DEFAULT_REFERRAL_REWARD_POLICY,
  normalizeReferralRewardPolicy,
} from "./referral-policy";

test("referral reward policy uses safe defaults for incomplete values", () => {
  assert.deepEqual(normalizeReferralRewardPolicy({}), DEFAULT_REFERRAL_REWARD_POLICY);
  assert.deepEqual(normalizeReferralRewardPolicy(null), DEFAULT_REFERRAL_REWARD_POLICY);
});

test("referral reward policy clamps credits and preserves custom labels", () => {
  assert.deepEqual(normalizeReferralRewardPolicy({ enabled: false, creditsPerSuccessfulReferral: 250, label: "Recruitment points" }), {
    enabled: false,
    creditsPerSuccessfulReferral: 100,
    label: "Recruitment points",
  });
});

test("referral reward credits follow the configured policy", () => {
  assert.equal(calculateReferralRewardCredits(3, DEFAULT_REFERRAL_REWARD_POLICY), 3);
  assert.equal(calculateReferralRewardCredits(3, { ...DEFAULT_REFERRAL_REWARD_POLICY, creditsPerSuccessfulReferral: 4 }), 12);
  assert.equal(calculateReferralRewardCredits(3, { ...DEFAULT_REFERRAL_REWARD_POLICY, enabled: false }), 0);
});
