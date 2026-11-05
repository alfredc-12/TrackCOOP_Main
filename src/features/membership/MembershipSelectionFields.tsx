"use client";
import { useId, useState } from "react";
import { Info } from "lucide-react";
import { StyledSelect } from "@/components/ui/StyledSelect";
import dataset from "./batangas-locations.json";
import { PRIMARY_SECTOR_OPTIONS } from "./sector-options";
export function MembershipLocationFields({
  municipality,
  barangay,
  onChange,
}: {
  municipality: string;
  barangay: string;
  onChange: (value: {
    municipality: string;
    barangay: string;
    province: string;
    municipalityPsgc: string;
    barangayPsgc: string;
  }) => void;
}) {
  const id = useId();
  const city = dataset.cities.find((c) => c.name === municipality);
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
      <div>
        <label htmlFor={id + "city"} className="mb-2 block text-sm font-bold">
          Municipality / City
        </label>
        <StyledSelect
          id={id + "city"}
          searchable
          value={city?.name ?? ""}
          options={dataset.cities.map((c) => c.name)}
          onChange={(name) => {
            const c = dataset.cities.find((c) => c.name === name)!;
            onChange({
              municipality: c.name,
              barangay: "",
              province: "Batangas",
              municipalityPsgc: c.code,
              barangayPsgc: "",
            });
          }}
        />
      </div>
      <div>
        <label
          htmlFor={id + "barangay"}
          className="mb-2 block text-sm font-bold"
        >
          Barangay
        </label>
        <StyledSelect
          id={id + "barangay"}
          searchable
          disabled={!city}
          value={barangay}
          options={city?.barangays.map((b) => b[1]) ?? []}
          onChange={(name) =>
            onChange({
              municipality: city!.name,
              barangay: name,
              province: "Batangas",
              municipalityPsgc: city!.code,
              barangayPsgc: city!.barangays.find((b) => b[1] === name)![0],
            })
          }
        />
      </div>
      <p className="text-xs text-coop-muted sm:col-span-2">
        Batangas · Location names and codes: Philippine Statistics Authority,
        PSGC 2026 Q2.
      </p>
    </div>
  );
}
const descriptions: Record<string, string> = {
  Rice: "Rice cultivation and related agricultural production.",
  Corn: "Corn cultivation and related agricultural production.",
  Fishery: "Fishing, aquaculture and fisherfolk livelihoods.",
  Livestock: "Raising and managing farm animals.",
  "High-value crops (gulayan)":
    "Vegetables, root crops and other qualifying high-value crops; classification does not depend on temporary market prices.",
  Coffee: "Coffee cultivation and related agricultural production.",
};
export function AgriculturalSectorFields({
  value,
  onChange,
}: {
  value: readonly string[];
  onChange: (sectors: string[]) => void;
}) {
  const id = useId();
  const [info, setInfo] = useState<string | null>(null);
  return (
    <fieldset
      onKeyDown={(event) => {
        if (event.key === "Escape") setInfo(null);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setInfo(null);
      }}
    >
      <legend className="mb-3 text-sm font-bold">Agricultural sectors</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PRIMARY_SECTOR_OPTIONS.map((sector, i) => (
          <div
            key={sector}
            className="relative flex items-center gap-2 rounded-lg bg-coop-subtle p-3"
          >
            <label className="flex min-h-8 flex-1 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.includes(sector)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, sector]
                      : value.filter((v) => v !== sector),
                  )
                }
                className="size-4 accent-coop-green"
              />
              {sector === "High-value crops (gulayan)"
                ? "High-Value Crops"
                : sector}
            </label>
            <button
              type="button"
              aria-label={"About " + sector}
              aria-expanded={info === sector}
              aria-controls={id + i}
              onClick={() => setInfo(info === sector ? null : sector)}
              className="grid size-9 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-coop-green"
            >
              <Info className="size-4" aria-hidden="true" />
            </button>
            {info === sector && (
              <p
                id={id + i}
                className="absolute inset-x-0 top-full z-10 rounded-lg bg-white p-3 text-sm shadow-lg"
              >
                {descriptions[sector]}
              </p>
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
