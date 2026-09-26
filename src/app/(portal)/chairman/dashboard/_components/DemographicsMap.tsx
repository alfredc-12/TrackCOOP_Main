"use client";

import { useEffect, useState, Fragment } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Tooltip, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Nasugbu barangay coordinates supplied for the dashboard map.
const BARANGAY_COORDS: Record<string, [number, number]> = {
  // Balaytigui exact pin supplied from Google Maps.
  "Balaytigui": [14.129825401565403, 120.59968783720495],
  "Banilad": [14.0667, 120.7347],
  // Bucana exact pin supplied from Google Maps.
  "Bucana": [14.062835327089608, 120.62681259349544],
  // Bulihan exact pin supplied from Google Maps.
  "Bulihan": [14.165532666005786, 120.66021110698438],
  // Bunducan exact pin supplied from Google Maps.
  "Bunducan": [14.107082883806378, 120.65163155142082],
  // Butucan exact pin supplied from Google Maps.
  "Butucan": [14.141805739919162, 120.68363826279183],
  // Calayo exact pin supplied from Google Maps.
  "Calayo": [14.139187049107806, 120.60492957788271],
  // Catandaan exact pin supplied from Google Maps.
  "Catandaan": [14.077031892932094, 120.68058135701342],
  "Cogunan": [14.0606, 120.6588],
  // Dayap exact pin supplied from Google Maps.
  "Dayap": [14.10041060260889, 120.66286961704407],
  // Latag exact pin supplied from Google Maps.
  "Latag": [14.130282842848473, 120.70841849788772],
  // Looc exact pin supplied from Google Maps.
  "Looc": [14.178625448830696, 120.63741226992902],
  // Lumbangan exact pin supplied from Google Maps.
  "Lumbangan": [14.050413856716903, 120.6508227706272],
  // Malapad Na Bato exact pin supplied from Google Maps.
  "Malapad Na Bato": [14.113683008705417, 120.6809363081479],
  // Maugat exact pin supplied from Google Maps.
  "Maugat": [14.086389962641155, 120.67882907773526],
  // Munting Indan exact pin supplied from Google Maps.
  "Munting Indan": [14.100459325559283, 120.69864628430298],
  // Natipuan exact pin supplied from Google Maps.
  "Natipuan": [14.121494180997534, 120.62298340937204],
  // Pantalan exact pin supplied from Google Maps.
  "Pantalan": [14.09294791743802, 120.63234715952021],
  // Putat exact pin supplied from Google Maps.
  "Putat": [14.08426964488521, 120.6486797707608],
  // Reparo exact pin supplied from Google Maps.
  "Reparo": [14.064803049947379, 120.69249099453631],
  // Talangan exact pin supplied from Google Maps.
  "Talangan": [14.077738146533651, 120.63479149438506],
  // Tumalim exact pin supplied from Google Maps.
  "Tumalim": [14.084910988169234, 120.71806527925034],
  // Utod exact pin supplied from Google Maps.
  "Utod": [14.123186069251071, 120.64668114459467],
  // Wawa exact pin supplied from Google Maps.
  "Wawa": [14.086042304088634, 120.62729344539997],
  "Poblacion": [14.0735, 120.6322],
  // Barangay 1 exact pin supplied from Google Maps.
  "1": [14.07466392128959, 120.62916933611362],
  // Barangay 2 exact pin supplied from Google Maps.
  "2": [14.080283809180822, 120.63009635875885],
  // Barangay 3 exact pin supplied from Google Maps.
  "3": [14.072326007219097, 120.63030493885402],
  // Barangay 4 exact pin supplied from Google Maps.
  "4": [14.073007632695475, 120.63405986899713],
  // Barangay 5 exact pin supplied from Google Maps.
  "5": [14.07481522389929, 120.63510469451009],
  "Biga": [14.1205, 120.6723],
  // Bilaran exact pin supplied from Google Maps.
  "Bilaran": [14.056610949719374, 120.68004827924797],
  // Kaylaway exact pin supplied from Google Maps.
  "Kaylaway": [14.082354358873559, 120.81092927974643],
  // Kayrilaw exact pin supplied from Google Maps.
  "Kayrilaw": [14.109892865513881, 120.77756915006908],
  // Papaya exact pin supplied from Google Maps.
  "Papaya": [14.2043566109275, 120.6033762811596],
  // Barangay 6 exact pin supplied from Google Maps.
  "6": [14.069779591393539, 120.63785056815918],
  // Barangay 7 exact pin supplied from Google Maps.
  "7": [14.069370442767541, 120.63507179470942],
  // Barangay 8 exact pin supplied from Google Maps.
  "8": [14.069566769428839, 120.63366673623561],
  // Barangay 9 exact pin supplied from Google Maps.
  "9": [14.06938163635641, 120.63243503033969],
  // Barangay 10 exact pin supplied from Google Maps.
  "10": [14.069282857350828, 120.63022973616187],
  // Barangay 11 exact pin supplied from Google Maps.
  "11": [14.061442822795089, 120.63394545789123],
  // Barangay 12 exact pin supplied from Google Maps.
  "12": [14.06560033408298, 120.63606873033967],
  // Aga exact pin supplied from Google Maps.
  "Aga": [14.094421149552048, 120.78781049798043],
};

function normalizeBarangayName(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/^barangay\s+/i, "")
    .replace(/[.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized === "poblacion 1" || normalized === "poblacion") return "poblacion";
  if (normalized === "munting indan") return "munting indang";
  return normalized;
}

function heatColor(value: number, maximum: number) {
  const ratio = maximum > 0 ? value / maximum : 0;
  const hue = Math.round(120 - ratio * 120);
  return `hsl(${hue} 90% 45%)`;
}

const NORMALIZED_BARANGAY_COORDS = Object.fromEntries(
  Object.entries(BARANGAY_COORDS).map(([name, coords]) => [normalizeBarangayName(name), coords]),
) as Record<string, [number, number]>;

type DemographicsMapProps = {
  demographics: { barangay: string; totalMembers: number; sectorCounts?: { sector: string; count: number }[] }[];
  selectedBarangay?: string;
  onSelectBarangay?: (barangay: string) => void;
};

function MapController({
  selectedBarangay,
  boundaryCenters,
}: {
  selectedBarangay?: string;
  boundaryCenters: Record<string, [number, number]>;
}) {
  const map = useMap();
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;

      try {
        const mapPane = map.getPane("mapPane");
        const size = map.getSize();
        if (!mapPane || !map.getContainer().isConnected || size.x <= 0 || size.y <= 0) return;

        map.invalidateSize({ animate: false });
        const normalizedName = selectedBarangay ? normalizeBarangayName(selectedBarangay) : "";
        const selectedCoords = normalizedName
          ? NORMALIZED_BARANGAY_COORDS[normalizedName]
          : undefined;
        const target = selectedCoords
          ? selectedCoords
          : [14.0735, 120.6322] as [number, number];
        const zoom = selectedCoords ? 14 : 12;
        if (target.every(Number.isFinite)) {
          map.setView(target, zoom, { animate: false });
        }
      } catch {
        // Leaflet can be unmounted while React is reconnecting effects in development.
      }
    }, 50);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedBarangay, boundaryCenters, map]);
  return null;
}

export default function DemographicsMap({ demographics, selectedBarangay, onSelectBarangay }: DemographicsMapProps) {
  const [mounted, setMounted] = useState(false);
  const [barangayBoundaries, setBarangayBoundaries] = useState<GeoJSON.GeoJsonObject | null>(null);
  const [boundaryCenters, setBoundaryCenters] = useState<Record<string, [number, number]>>({});

  useEffect(() => {
    setMounted(true);

    const query = new URLSearchParams({
      where: "prov_name='Batangas' AND city_name='Nasugbu'",
      outFields: "brgy_name,brgy_code,psgc_10d",
      returnGeometry: "true",
      outSR: "4326",
      f: "geojson",
    });

    fetch(`https://portal.georisk.gov.ph/arcgis/rest/services/PSA/Barangay/MapServer/4/query?${query}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.type === "FeatureCollection") {
          setBarangayBoundaries(data);
          const centers: Record<string, [number, number]> = {};
          for (const feature of data.features ?? []) {
            const name = feature.properties?.brgy_name;
            if (!name || !feature.geometry) continue;
            const bounds = L.geoJSON(feature).getBounds();
            if (bounds.isValid()) {
              const center = bounds.getCenter();
              centers[normalizeBarangayName(String(name))] = [center.lat, center.lng];
            }
          }
          setBoundaryCenters(centers);
        }
      })
      .catch(() => {
        // The map still works with verified coordinates if the official layer is unavailable.
      });
  }, []);

  if (!mounted) return null;
  const maximumMembers = Math.max(0, ...demographics.map((item) => item.totalMembers));

  return (
    <div className="w-full h-full relative z-0">
      <style>{`.member-location-marker { pointer-events: all !important; cursor: pointer; } .member-count-label { pointer-events: auto !important; cursor: pointer; background: transparent !important; border: 0 !important; }`}</style>
      <div className="absolute inset-0 overflow-hidden bg-[#cfeaf0]" aria-hidden="true">
        <svg viewBox="0 0 800 500" className="h-full w-full" preserveAspectRatio="none">
          <path d="M0 0H800V500H0Z" fill="#cfeaf0" />
          <path d="M275 0C245 85 330 120 292 205C255 290 350 350 305 500H800V0Z" fill="#dfe8d5" />
          <path d="M360 -20C405 80 360 145 438 220C505 286 452 390 520 520" fill="none" stroke="#f8f0d7" strokeWidth="18" />
          <path d="M80 420C220 350 300 370 430 310C535 260 625 265 820 180" fill="none" stroke="#f8f0d7" strokeWidth="13" />
          <path d="M120 70C250 135 300 180 440 165C575 150 650 95 770 70" fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="10 8" />
          <path d="M500 0L470 500M160 0L220 500M0 285L800 325" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.75" />
          <text x="560" y="115" fill="#6b7d70" fontSize="18" fontWeight="700">Nasugbu</text>
          <text x="615" y="360" fill="#6b7d70" fontSize="15">Barangay member areas</text>
        </svg>
      </div>
      {/* @ts-ignore */}
      <MapContainer
        center={[14.0735, 120.6322]} // Centered on Nasugbu Poblacion
        zoom={12}
        scrollWheelZoom={false}
        style={{ width: "100%", height: "100%", background: "transparent" }}
        attributionControl={false}
        className="relative z-10 !bg-transparent [&_.leaflet-pane]:!bg-transparent"
      >
        <MapController selectedBarangay={selectedBarangay} boundaryCenters={boundaryCenters} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {barangayBoundaries ? (
          <GeoJSON
            data={barangayBoundaries}
            style={{ color: "#1f6b43", weight: 1, opacity: 0.45, fillColor: "#1f6b43", fillOpacity: 0.04 }}
          />
        ) : null}
        {demographics.map((d) => {
          // Only plot barangays with a known coordinate. Never place a
          // marker randomly because that would make the location inaccurate.
          const normalizedName = normalizeBarangayName(d.barangay);
          const coords = NORMALIZED_BARANGAY_COORDS[normalizedName];
          if (!coords || !coords.every(Number.isFinite)) return null;
          
          return (
            <Fragment key={d.barangay}>
              {/* @ts-ignore */}
              <CircleMarker
                center={coords as [number, number]}
                radius={Math.max(9, Math.min(34, 8 + d.totalMembers * 3.5))}
                pathOptions={{
                  color: "#7f1d1d",
                  fillColor: heatColor(d.totalMembers, maximumMembers),
                  fillOpacity: 0.78,
                  weight: 2,
                  className: "member-location-marker",
                }}
                eventHandlers={{
                  click: () => {
                    if (onSelectBarangay) onSelectBarangay(d.barangay);
                  },
                }}
              >
                <Popup>
                  <div className="text-center font-sans">
                    <h3 className="font-bold text-[#123D2A] text-sm">{d.barangay}</h3>
                    <p className="text-xs text-[#5D6D63] m-0">
                      <strong className="text-[#1F6B43]">{d.totalMembers}</strong> members
                    </p>
                    {d.sectorCounts?.length ? (
                      <div className="mt-1 border-t border-[#DDE8D8] pt-1 text-left text-[10px] text-[#5D6D63]">
                        {d.sectorCounts.slice(0, 4).map((item) => (
                          <div key={item.sector} className="flex justify-between gap-3">
                            <span>{item.sector}</span><strong>{item.count}</strong>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Popup>
              </CircleMarker>
              <Marker
                position={coords as [number, number]}
                interactive
                icon={L.divIcon({
                  className: "member-count-label",
                  html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;color:#fff;font-size:12px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.65)">${d.totalMembers}</span>`,
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                })}
              >
                <Tooltip direction="top" offset={[0, -14]} opacity={0.98} sticky>
                  <div className="min-w-36 text-xs font-sans">
                    <strong className="text-[#123D2A]">{d.barangay}</strong>
                    <div className="mt-1 border-t border-[#DDE8D8] pt-1">
                      <div className="flex justify-between gap-3"><span>Total members</span><strong>{d.totalMembers}</strong></div>
                      {d.sectorCounts?.map((item) => (
                        <div key={item.sector} className="flex justify-between gap-3">
                          <span>{item.sector}</span><strong>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </Tooltip>
              </Marker>
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
