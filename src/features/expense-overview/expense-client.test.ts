import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChips, defaultQuery, filterParams, moreFilterCount, paramsFromQuery, peso, percentText, queryFromParams, recordParams, signedPeso,
  type ExpenseUiQuery,
} from "./expense-client";

const parse = (search: string) => queryFromParams(new URLSearchParams(search));
const names = { categories: [{ id: "3", name: "Fuel and Gasoline" }], recordedBy: [{ id: "2", name: "Book Keeper" }], postedBy: [], seasons: [] };

test("a clean page has a clean address and reads back as the defaults", () => {
  assert.equal(paramsFromQuery(defaultQuery).toString(), "");
  // Optional fields are absent, not undefined, once serialized: compare the visible shape.
  assert.deepEqual(JSON.parse(JSON.stringify(parse(""))), JSON.parse(JSON.stringify(defaultQuery)));
});

test("every filter survives a round trip through the address bar", () => {
  const query: ExpenseUiQuery = {
    period: "custom", startDate: "2026-01-01", endDate: "2026-03-31", compare: "last_year", categoryIds: ["3", "4"], sourceModules: ["Rental", "POS"],
    classes: ["operating", "capital"], amountMin: "100", amountMax: "5000.50", recordedBy: "2", postedBy: "1", seasonId: "7",
    search: "diesel", view: "unposted", page: 3, pageSize: 50, sortBy: "amount", sortDirection: "asc",
  };
  assert.deepEqual(parse(paramsFromQuery(query).toString()), query);
});

test("bad or hostile address-bar values fall back instead of failing", () => {
  const query = parse("period=forever&compare=never&categoryIds=1,abc,2;DROP&sourceModules=Bank,Rental&classes=bogus&view=nope&sort=password&pageSize=9999&page=-4&dir=sideways&seasonId=x1&amountMin=-5");
  assert.equal(query.period, "this_month");
  assert.equal(query.compare, "previous");
  assert.deepEqual(query.categoryIds, ["1"]);
  assert.deepEqual(query.sourceModules, ["Rental"]);
  assert.deepEqual(query.classes, ["operating"]);
  assert.equal(query.view, "posted");
  assert.equal(query.sortBy, "recordDate");
  assert.equal(query.pageSize, 20);
  assert.equal(query.page, 1);
  assert.equal(query.sortDirection, "desc");
  assert.equal(query.seasonId, undefined);
  assert.equal(query.amountMin, undefined);
});

test("a custom range must be real and ordered, and a range without a period means custom", () => {
  assert.equal(parse("period=custom&startDate=2026-02-30&endDate=2026-03-01").period, "this_month");
  assert.equal(parse("period=custom&startDate=2026-03-05&endDate=2026-03-01").period, "this_month");
  assert.equal(parse("period=custom").period, "this_month");
  const range = parse("startDate=2026-01-01&endDate=2026-01-31");
  assert.deepEqual([range.period, range.startDate, range.endDate], ["custom", "2026-01-01", "2026-01-31"]);
  assert.equal(parse("period=last_month&startDate=2026-01-01&endDate=2026-01-31").startDate, undefined);
});

test("a maximum below the minimum is dropped rather than emptying the page", () => {
  const query = parse("amountMin=500&amountMax=100");
  assert.deepEqual([query.amountMin, query.amountMax], ["500", undefined]);
});

test("analytics and the table send the same filters; only the table adds paging and sorting", () => {
  const query = parse("period=last_month&sourceModules=Rental&q=fuel&page=4&sort=amount");
  const filters = filterParams(query);
  const table = recordParams(query);
  for (const [key, value] of filters) assert.equal(table.get(key), value, key);
  assert.equal(filters.has("page"), false);
  assert.equal(filters.has("sortBy"), false);
  assert.equal(filters.get("search"), "fuel");
  assert.equal(filters.get("classes"), "operating");
  assert.deepEqual([table.get("page"), table.get("sortBy"), table.get("view")], ["4", "amount", "posted"]);
});

test("each active filter becomes a chip that clears only itself and returns to page one", () => {
  const query = parse("period=last_month&categoryIds=3&sourceModules=Rental,POS&amountMin=100&recordedBy=2&view=voided&q=fuel&page=5");
  const chips = buildChips(query, names);
  assert.deepEqual(chips.map((chip) => chip.label), [
    "Period: Last month", "Category: Fuel and Gasoline", "Source: Rental", "Source: POS", "Amount: from 100", "Recorded by: Book Keeper", "Records: Voided", "Search: fuel",
  ]);
  const source = chips.find((chip) => chip.key === "source-Rental")!;
  assert.deepEqual(source.clear, { sourceModules: ["POS"], page: 1 });
  assert.equal(chips.every((chip) => chip.clear.page === 1), true);
  assert.deepEqual(buildChips(defaultQuery, names), []);
});

test("the More filters badge counts only the filters inside it", () => {
  assert.equal(moreFilterCount(defaultQuery), 0);
  assert.equal(moreFilterCount({ ...defaultQuery, amountMin: "5", amountMax: "9", recordedBy: "2", seasonId: "7" }), 3);
});

test("money and percentages are formatted without inventing values", () => {
  assert.equal(peso(1234.5), "₱1,234.50");
  assert.equal(peso(null), "—");
  assert.equal(signedPeso(-20), "−₱20.00");
  assert.equal(signedPeso(5.5), "+₱5.50");
  assert.equal(signedPeso(null), "—");
  assert.equal(percentText(null), "N/A");
  assert.equal(percentText(12.5, true), "+12.5%");
  assert.equal(percentText(-3), "−3%");
});
