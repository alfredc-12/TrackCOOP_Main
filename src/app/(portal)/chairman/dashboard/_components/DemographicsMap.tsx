"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, Popup, TileLayer, Tooltip, ZoomControl } from "react-leaflet";
import L from "leaflet";
import { Expand, RefreshCw } from "lucide-react";
import { barangayFill, isBarangayBoundaries, joinBarangayMembers, zeroMemberColor, type BarangayArea, type BarangayBoundaries, type BarangayMembers } from "./barangay-choropleth";
import "leaflet/dist/leaflet.css";
import styles from "./DemographicsMap.module.css";

const number = (value: number) => value.toLocaleString("en-PH");

function BarangayInfo({ area }: { area: BarangayArea }) {
  return <div className={styles.info}>
    <h3>{area.barangay}</h3>
    <dl>
      <div className={styles.total}><dt>Total members</dt><dd>{number(area.totalMembers)}</dd></div>
      {area.sectorCounts.map((sector) => <div key={sector.sector}><dt>{sector.sector}</dt><dd>{number(sector.count)}</dd></div>)}
    </dl>
    {!area.totalMembers && <p>No member records in the current results.</p>}
  </div>;
}

function BarangayPolygon({ area, fill, register }: {
  area: BarangayArea;
  fill: string;
  register: (id: string, layer: L.GeoJSON | null) => void;
}) {
  const layerRef = useRef<L.GeoJSON>(null);
  const baseStyle: L.PathOptions = { color: "#ffffff", weight: 1.3, opacity: 1, fillColor: fill, fillOpacity: 0.86, className: "barangay-boundary" };
  const highlight = () => { layerRef.current?.setStyle({ color: "#123d2a", weight: 2.5, fillOpacity: 0.98 }); layerRef.current?.bringToFront(); };
  const reset = () => layerRef.current?.setStyle({ color: "#ffffff", weight: 1.3, fillOpacity: 0.86 });

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    register(area.id, group);
    const cleanups: (() => void)[] = [];
    const attach = (layer: L.Layer) => {
      if (layer instanceof L.LayerGroup) { layer.eachLayer(attach); return; }
      if (!(layer instanceof L.Path)) return;
      const element = layer.getElement();
      if (!element) return;
      element.setAttribute("tabindex", "0");
      element.setAttribute("role", "button");
      element.setAttribute("aria-label", `${area.barangay}, ${number(area.totalMembers)} members`);
      const focus = () => { group.setStyle({ color: "#123d2a", weight: 2.5 }); group.openTooltip(); };
      const blur = () => { group.closeTooltip(); group.setStyle({ color: "#ffffff", weight: 1.3 }); };
      const activate = (event: Event) => {
        const key = (event as KeyboardEvent).key;
        if (key === "Enter" || key === " ") {
          event.preventDefault();
          group.closeTooltip();
          group.openPopup();
        }
      };
      element.addEventListener("focus", focus);
      element.addEventListener("blur", blur);
      element.addEventListener("keydown", activate);
      cleanups.push(() => {
        element.removeEventListener("focus", focus);
        element.removeEventListener("blur", blur);
        element.removeEventListener("keydown", activate);
      });
    };
    group.eachLayer(attach);
    return () => { cleanups.forEach((cleanup) => cleanup()); register(area.id, null); };
  }, [area, register]);

  return <GeoJSON ref={layerRef} data={area.feature} style={baseStyle} eventHandlers={{ mouseover: highlight, mouseout: reset }}>
    <Tooltip sticky direction="auto" opacity={1} className={styles.tooltip}><BarangayInfo area={area} /></Tooltip>
    <Popup maxWidth={300} maxHeight={300} className={styles.popup}><section aria-label={`${area.barangay} member details`}><BarangayInfo area={area} /></section></Popup>
  </GeoJSON>;
}

export default function DemographicsMap({ demographics }: { demographics: BarangayMembers[] }) {
  const [boundaries, setBoundaries] = useState<BarangayBoundaries | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [chosen, setChosen] = useState("");
  const mapRef = useRef<L.Map>(null);
  const layers = useRef(new Map<string, L.GeoJSON>());
  const register = useCallback((id: string, layer: L.GeoJSON | null) => { if (layer) layers.current.set(id, layer); else layers.current.delete(id); }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/maps/nasugbu", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Boundary request failed");
        const data: unknown = await response.json();
        if (!isBarangayBoundaries(data)) throw new Error("Invalid barangay boundaries");
        if (!controller.signal.aborted) setBoundaries(data);
      })
      .catch(() => { if (!controller.signal.aborted) setError("Barangay boundaries could not be loaded. Please try again."); });
    return () => controller.abort();
  }, [attempt]);

  const model = useMemo(() => boundaries ? joinBarangayMembers(boundaries, demographics) : null, [boundaries, demographics]);
  const bounds = useMemo(() => boundaries ? L.geoJSON(boundaries).getBounds() : null, [boundaries]);

  if (!model || !bounds) return <div className={styles.loading} role={error ? "alert" : "status"}>
    <p>{error || "Loading barangay boundaries…"}</p>
    {error && <button type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }} className="transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--portal-green)] mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--portal-forest)] px-4 text-sm font-semibold text-white"><RefreshCw aria-hidden="true" className="size-4" />Try again</button>}
  </div>;

  const showAll = () => {
    mapRef.current?.closePopup();
    mapRef.current?.fitBounds(bounds, { paddingTopLeft: [24, 72], paddingBottomRight: [24, 112], animate: false });
    setChosen("");
  };
  const choose = (id: string) => {
    setChosen(id);
    const layer = layers.current.get(id);
    if (!layer) { showAll(); return; }
    mapRef.current?.fitBounds(layer.getBounds(), { padding: [48, 48], maxZoom: 16, animate: false });
    layer.openPopup();
  };
  const unmatchedMembers = model.unmapped.reduce((total, row) => total + Math.max(0, Number(row.totalMembers) || 0), 0);

  return <div>
    <div className={styles.map} role="region" aria-label="Nasugbu member distribution map">
      <MapContainer ref={mapRef} bounds={bounds} boundsOptions={{ paddingTopLeft: [24, 72], paddingBottomRight: [24, 112] }} scrollWheelZoom={false} zoomControl={false} zoomSnap={0.25} className={styles.canvas}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' opacity={0.65} />
        <ZoomControl position="bottomright" />
        {model.areas.map((area) => <BarangayPolygon key={area.id} area={area} fill={barangayFill(area.totalMembers, model.bins)} register={register} />)}
      </MapContainer>

      <div className={styles.controls}>
        <label className="sr-only" htmlFor="map-barangay">Find a barangay</label>
        <select id="map-barangay" value={chosen} onChange={(event) => choose(event.target.value)} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--portal-green)] h-11 min-w-0 flex-1 rounded-md border border-[var(--portal-border)] bg-[var(--portal-surface)] px-3 text-sm font-semibold text-[var(--portal-forest)] shadow-[0_4px_12px_rgba(18,61,42,0.06)]">
          <option value="">Find a barangay</option>
          {[...model.areas].sort((a, b) => a.barangay.localeCompare(b.barangay, "en", { numeric: true })).map((area) => <option key={area.id} value={area.id}>{area.barangay}</option>)}
        </select>
        <button type="button" onClick={showAll} aria-label="Show all barangays" title="Show all barangays" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--portal-green)] grid size-11 shrink-0 place-items-center rounded-md border border-[var(--portal-border)] bg-[var(--portal-surface)] text-[var(--portal-forest)] shadow-[0_4px_12px_rgba(18,61,42,0.06)] hover:bg-[#EAF3E8]"><Expand aria-hidden="true" className="size-4" /></button>
      </div>

      <div className={styles.legend} aria-label="Member count color scale">
        <p className="text-sm font-semibold text-[var(--portal-forest)]">Members per barangay</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
          <span className={styles.key}><i style={{ background: zeroMemberColor }} />0</span>
          {model.bins.map((bin) => <span key={bin.min} className={styles.key}><i style={{ background: bin.color }} />{bin.min === bin.max ? number(bin.min) : `${number(bin.min)}–${number(bin.max)}`}</span>)}
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--portal-muted)]">Darker areas have more recorded members.</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-start justify-between gap-2 text-sm leading-6 text-[var(--portal-muted)]">
      <p>Hover for details. Tap a barangay or focus it and press Enter.</p>
      <p>{number(model.mappedMembers)} members mapped across {model.areas.length} barangays.</p>
    </div>
    {model.unmapped.length > 0 && <details className="mt-2 rounded-lg bg-[#FFF4D7] px-3 py-2 text-sm text-[#8A6200]">
      <summary className="cursor-pointer font-medium">{number(unmatchedMembers)} members in locations without a matching boundary</summary>
      <p className="mt-1 break-words">{model.unmapped.map((row) => `${row.barangay || "Unspecified"} (${number(row.totalMembers)})`).join(", ")}. These records are not assigned to a different barangay.</p>
    </details>}
  </div>;
}
