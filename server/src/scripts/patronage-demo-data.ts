import { estimateRentalFee } from "../modules/rental/rental-estimate";
import { isTractorService, workDateKeys } from "../modules/rental/rental-hectares";

export const HISTORY_MARKER = "PATRONAGE_HISTORY_DEMO_V1";
export const HISTORY_PREFIX = "DEMO-PR-";
export type DemoMember = { member_id: string; member_code: string; full_name: string; sector: string | null; contact_number: string | null; barangay: string | null; municipality: string | null; complete_address: string | null };
export type DemoAsset = { rental_asset_id: string; asset_code: string; asset_name: string; category: string; rate_amount: string | number; rate_unit: string };
export const money = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
export const shiftDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

// Fixed seed makes dry runs, backups and subsequent verification reproducible.
export function buildPatronageHistory(members: DemoMember[], assets: DemoAsset[]) {
  let seed = 20212024;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const shuffled = [...members].sort((a, b) => Number(a.member_id) - Number(b.member_id));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (members.length < 60 || assets.length !== 5) throw new Error("This fixture requires at least 60 existing True Members and the five configured equipment assets.");
  const core = shuffled.slice(0, 45), rotating = shuffled.slice(45);
  const occupied = new Set<string>();
  const bookings = [];
  for (let offset = 0; offset < 4; offset++) {
    const year = 2021 + offset;
    const participants = [...core, ...Array.from({ length: 9 + offset * 2 }, (_, i) => rotating[(offset * 7 + i) % rotating.length])];
    let sequence = 0;
    for (const member of participants) {
      const visits = 1 + Math.floor(random() * 4) + (offset >= 2 && random() > 0.45 ? 1 : 0);
      for (let visit = 0; visit < visits; visit++) {
        const sector = (member.sector ?? "").toLowerCase();
        const choices = assets.filter((asset) => {
          if (/fish|livestock|high.value/.test(sector)) return /pump|tractor/i.test(asset.asset_name);
          if (/corn/.test(sector)) return !/thresher/i.test(asset.asset_name);
          if (/rice/.test(sector)) return !/sheller/i.test(asset.asset_name);
          return true;
        });
        const asset = choices[Math.floor(random() * choices.length)];
        const service = { name: asset.asset_name, category: asset.category, serviceId: asset.asset_code, standardRate: Number(asset.rate_amount) };
        const tractor = isTractorService(service);
        const harvest = /thresher|sheller/i.test(asset.asset_name);
        const months = harvest ? [3, 4, 9, 10, 11] : /pump/i.test(asset.asset_name) ? [1, 2, 3, 4, 5, 6] : [1, 2, 5, 6, 7, 9, 10];
        const month = months[Math.floor(random() * months.length)];
        const duration = /pump/i.test(asset.asset_name) ? 1 + Math.floor(random() * 3) : 1;
        let date = `${year}-${String(month).padStart(2, "0")}-${String(2 + Math.floor(random() * 24)).padStart(2, "0")}`;
        let end = shiftDate(date, duration - 1);
        while (workDateKeys(date, end).some((day) => occupied.has(`${asset.rental_asset_id}:${day}`))) {
          date = shiftDate(date, 1); end = shiftDate(date, duration - 1);
        }
        if (!end.startsWith(String(year))) throw new Error("Fixture exceeds its calendar year.");
        for (const day of workDateKeys(date, end)) occupied.add(`${asset.rental_asset_id}:${day}`);
        const dailyWork = tractor ? [{ date, hectares: (2 + Math.floor(random() * 13)) / 4 }] : undefined;
        const estimate = estimateRentalFee({ service, requesterType: "Member", startDate: date, endDate: end, dailyWork });
        if (!estimate) throw new Error("Could not price fixture rental using the application estimator.");
        const gross = money(Number(asset.rate_amount) * (estimate.totalHectares ?? duration));
        bookings.push({ number: `${HISTORY_PREFIX}${year}-${String(++sequence).padStart(4, "0")}`, year, member, asset, date, end, dailyWork, estimate, gross, expense: money(estimate.total * (0.64 + random() * 0.16)) });
      }
    }
  }
  return bookings;
}
