export type MemberLivelihood = { activity: string; plantingDate?: string };
export const cropActivities = ["Sugarcane", "Rice", "Corn", "Vegetables"];
export const livelihoodActivities = [...cropActivities, "Livestock", "Poultry", "Fishing", "Aquaculture"];

export function manilaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map((key) => parts.find((part) => part.type === key)?.value).join("-");
}

export function isValidPlantingDate(value: string, today = manilaDateKey()) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value >= "1900-01-01" && value <= today;
}

export const guideSources = {
  sugarcane: { title: "SRA: sugarcane harvesting-age research", url: "https://www.sra.gov.ph/view_file/researches/oerJGfpFLGwzc0Z" },
  localSugarcane: { title: "SRA: Batangas mill schedules, 2024–2025", url: "https://www.sra.gov.ph/view_file/milling_schedule/IyQqtA0vPXdy5f4" },
  olderSugarcane: { title: "SRA: Batangas mill schedules, 2023–2024", url: "https://www.sra.gov.ph/view_file/milling_schedule/xVTxN5b9SZ5aidH" },
  rice: { title: "PhilRice: rice maturity varies by variety", url: "https://binhingpalay.philrice.gov.ph/" },
  corn: { title: "DA–ATI: corn production and harvesting", url: "https://ati2.da.gov.ph/ati-5/content/sites/default/files/users/user17/Corn%20Production%20%289%20Basic%20Steps%20for%20Bountiful%20Harvest%29.pdf" },
};

type SeasonGuide = { stage: string; basis: string; production: string; sales: string; income: string; expenses: string; sources: { title: string; url: string }[] };

export function getSeasonGuide(item: MemberLivelihood, province: string, today = manilaDateKey()): SeasonGuide {
  const crop = cropActivities.includes(item.activity);
  let stage = crop ? "Add a planting date" : "Your production cycle";
  let basis = "Timing depends on your activity, local conditions, and production cycle.";
  let harvest = false;
  let growing = false;
  const sources: SeasonGuide["sources"] = [];
  if (item.activity === "Sugarcane") sources.push(guideSources.sugarcane);
  if (item.activity === "Rice") sources.push(guideSources.rice);
  if (item.activity === "Corn") sources.push(guideSources.corn);
  if (crop && item.plantingDate && isValidPlantingDate(item.plantingDate, today)) {
    const days = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${item.plantingDate}T00:00:00Z`)) / 86400000);
    const start = new Date(`${item.plantingDate}T00:00:00Z`);
    const now = new Date(`${today}T00:00:00Z`);
    const months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + now.getUTCMonth() - start.getUTCMonth() - (now.getUTCDate() < start.getUTCDate() ? 1 : 0);
    const age = item.activity === "Sugarcane" ? months : days;
    const range = item.activity === "Sugarcane" ? [10, 12] : item.activity === "Corn" ? [90, 110] : item.activity === "Rice" ? [100, 130] : null;
    if (range) {
      harvest = age >= range[0] && age <= range[1];
      growing = age < range[0];
      stage = harvest ? "Possible harvest window" : growing ? "Growing period — estimate" : "Review your crop dates";
      basis = `${days} days since your sowing date. ${item.activity === "Sugarcane" ? "The reference studies harvesting at 10–12 months." : item.activity === "Corn" ? "The reference describes roughly 90–110 days for grain corn; sweet and baby corn differ." : "This broad 100–130 day guide covers many rice varieties, not all. Use the maturity on your seed label."} Confirm crop maturity locally; this is an estimate, not a harvest instruction.`;
    } else {
      stage = "Check your crop variety";
      basis = `${days} days since sowing. Vegetables have different growing periods; ask the cooperative about your specific crop.`;
    }
  } else if (item.activity === "Sugarcane" && province.trim().toLowerCase() === "batangas") {
    const month = Number(today.slice(5, 7));
    harvest = month >= 10 || month <= 5;
    stage = harvest ? "Typical harvest / milling period" : "Outside the broad milling guide";
    basis = "Historical Batangas schedules ranged from Oct–May (2023–2024) to Dec–Mar (2024–2025). These are not this year's confirmed dates or proof your cane is ready. Confirm your mill schedule and add a planting date.";
    sources.push(guideSources.localSugarcane, guideSources.olderSugarcane);
  } else if (crop) {
    basis = "Add your sowing date for a crop-age estimate. Location, variety, irrigation, and weather affect the actual stage; no local season is confirmed here.";
  }
  if (crop) return {
    stage, basis, sources,
    production: harvest ? "If the crop is mature, more produce may be ready to harvest." : growing ? "The crop is developing; saleable produce may not be ready yet." : "Production depends on the crop stage, variety, and field conditions.",
    sales: harvest ? "Sales may increase when harvested produce reaches buyers." : "Sales depend on available produce, buyers, and harvest timing.",
    income: "Money comes in when produce is sold and paid for; profit also depends on your costs.",
    expenses: harvest ? "Budget for harvesting labor, hauling, drying or milling where needed." : "Planting and growing can require spending on seed, fertilizer, water, and labor.",
  };
  if (!["Livestock", "Poultry", "Fishing", "Aquaculture"].includes(item.activity)) return {
    stage, basis, sources,
    production: "Production depends on your activity and its growing or working cycle.",
    sales: "Sales depend on when your products or services are available and buyers need them.",
    income: "Income depends on actual sales and payment timing.",
    expenses: "Plan for supplies, labor, and other costs between sales. Ask the cooperative for guidance about this activity.",
  };
  return {
    stage, basis, sources,
    production: item.activity === "Fishing" ? "Catch depends on weather, fishing rules, and fishing conditions." : "Output depends on feeding, care, health, and your production cycle.",
    sales: "Sales depend on when animals, eggs, fish, or other products are ready and buyers are available.",
    income: "Income may arrive by batch or regularly, depending on your activity and actual sales.",
    expenses: "Feed, care, supplies, fuel, and labor can continue between sales. Confirm local conditions with the cooperative.",
  };
}
