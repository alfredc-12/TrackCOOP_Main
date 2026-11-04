import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { barangayFill, createHeatBins, isBarangayBoundaries, joinBarangayMembers, normalizeBarangayName, zeroMemberColor } from "./barangay-choropleth";

const boundaries: unknown = JSON.parse(readFileSync("src/lib/Nasugbu.geojson", "utf8"));
assert.ok(isBarangayBoundaries(boundaries));

test("the supplied source contains 42 unique Nasugbu polygon boundaries", () => {
  assert.equal(boundaries.features.length, 42);
  assert.equal(new Set(boundaries.features.map((feature) => feature.properties.adm4_psgc)).size, 42);
  assert.ok(boundaries.features.some((feature) => feature.geometry.type === "MultiPolygon"));
  assert.ok(!isBarangayBoundaries({ type: "FeatureCollection", features: [] }));
  assert.ok(!isBarangayBoundaries({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point" } }] }));
});

test("joins numbered, prefixed, accented and known alias names without assigning generic Poblacion to Barangay 1", () => {
  for (const value of ["1", "Barangay 01", "Brgy. 1", "Barangay 1 (Poblacion)", "Poblacion 1"]) assert.equal(normalizeBarangayName(value), "1");
  assert.equal(normalizeBarangayName("  Brgy. MUNTING INDANG  "), "munting indan");
  assert.equal(normalizeBarangayName("Brgy. Maugát"), "maugat");
  assert.notEqual(normalizeBarangayName("Poblacion"), "1");
});

test("aggregates aliases and all sector columns; preserves zero areas and reports unmatched data", () => {
  const result = joinBarangayMembers(boundaries, [
    { barangay: "1", totalMembers: 2, sectorCounts: [{ sector: "Farmer", count: 2 }] },
    { barangay: "Brgy. 1", totalMembers: 3, sectorCounts: [{ sector: "Fisherfolk", count: 3 }] },
    { barangay: "Munting Indang", totalMembers: 4, sectorCounts: [{ sector: "Farmer", count: 4 }] },
    { barangay: "Poblacion", totalMembers: 7 },
    { barangay: "Unknown location", totalMembers: 2 },
  ]);
  assert.equal(result.areas.length, 42);
  const numbered = result.areas.find((area) => area.barangay === "Barangay 1")!;
  assert.equal(numbered.totalMembers, 5);
  assert.deepEqual(numbered.sectorCounts, [{ sector: "Farmer", count: 2 }, { sector: "Fisherfolk", count: 3 }]);
  assert.equal(result.areas.find((area) => area.barangay === "Munting Indan")!.totalMembers, 4);
  assert.equal(result.areas.find((area) => area.barangay === "Papaya")!.totalMembers, 0);
  assert.equal(result.mappedMembers, 9);
  assert.deepEqual(result.unmapped.map((row) => row.barangay), ["Poblacion", "Unknown location"]);
});

test("legend bins are disjoint integer ranges and use the same colors as polygons", () => {
  for (const maximum of [0, 1, 2, 4, 5, 7, 58, 100]) {
    const bins = createHeatBins(maximum);
    assert.equal(barangayFill(0, bins), zeroMemberColor);
    for (let value = 1; value <= maximum; value++) {
      const matches = bins.filter((bin) => value >= bin.min && value <= bin.max);
      assert.equal(matches.length, 1);
      assert.equal(barangayFill(value, bins), matches[0].color);
    }
    if (maximum) assert.equal(bins.at(-1)!.max, maximum);
    else assert.deepEqual(bins, []);
  }
});
