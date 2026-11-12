import assert from "node:assert/strict";
import test from "node:test";
import { buildPatronageHistory, money, type DemoAsset, type DemoMember } from "./patronage-demo-data";
import { workDateKeys } from "../modules/rental/rental-hectares";

test("historical fixture uses existing members, increasing broad participation, valid pricing and conflict-free equipment dates", () => {
  const members: DemoMember[] = Array.from({ length: 71 }, (_, i) => ({ member_id: String(i + 1), member_code: `M${i}`, full_name: `Member ${i}`, sector: ["Rice", "Corn", "Fishery", "Livestock", "High-value crops"][i % 5], contact_number: null, barangay: null, municipality: null, complete_address: null }));
  const assets: DemoAsset[] = ["Farm Tractor", "Hand Tractor", "Rice Thresher", "Corn Sheller", "Water Pump"].map((asset_name, i) => ({ rental_asset_id: String(i + 1), asset_code: `A${i}`, asset_name, category: "Equipment", rate_amount: [3500, 1800, 2200, 1800, 900][i], rate_unit: "Per Day" }));
  const bookings = buildPatronageHistory(members, assets);
  assert.deepEqual(bookings, buildPatronageHistory(members, assets));
  assert.equal(new Set(bookings.map((b) => b.number)).size, bookings.length);
  assert.equal(new Set(bookings.map((b) => b.member.member_id)).size, 71);
  const occupied = new Set<string>();
  for (const booking of bookings) {
    assert.ok(members.includes(booking.member));
    assert.ok(assets.includes(booking.asset));
    assert.equal(booking.estimate.total, money(booking.gross * 0.95));
    assert.ok(booking.expense < booking.estimate.total);
    for (const day of workDateKeys(booking.date, booking.end)) {
      const key = `${booking.asset.rental_asset_id}:${day}`;
      assert.ok(!occupied.has(key), `Overlapping equipment day: ${key}`);
      occupied.add(key);
    }
  }
  for (let i = 0; i < 4; i++) {
    const annual = bookings.filter((b) => b.year === 2021 + i);
    assert.equal(new Set(annual.map((b) => b.member.member_id)).size, 54 + i * 2);
    const net = annual.reduce((sum, b) => sum + b.estimate.total - b.expense, 0);
    assert.ok(net * 0.7 * 0.3 > annual.reduce((sum, b) => sum + b.estimate.total * 0.03, 0));
  }
});
