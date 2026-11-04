"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, Popup, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { Expand, RefreshCw, RotateCcw } from "lucide-react";
import { barangayFill, isBarangayBoundaries, joinBarangayMembers, normalizeBarangayName, zeroMemberColor, type BarangayArea, type BarangayBoundaries, type BarangayMembers } from "./barangay-choropleth";
import "leaflet/dist/leaflet.css";
import styles from "./DemographicsMap.module.css";

const number = (value: number) => value.toLocaleString("en-PH");

type GeographicAnalytics = { barangay: string; trueMembers: number; associates: number; engagementCounts: Record<string, number>; newApprovals: number; change: number };
function BarangayInfo({ area, detail, expanded = false }: { area: BarangayArea; detail?: GeographicAnalytics; expanded?: boolean }) {
  return <div className={styles.info}>
    <h3>{area.barangay}</h3>
    <dl>
      <div className={styles.total}><dt>Total members</dt><dd>{number(area.totalMembers)}</dd></div>
      {detail && <><div><dt>True Members</dt><dd>{number(detail.trueMembers)}</dd></div><div><dt>Associates</dt><dd>{number(detail.associates)}</dd></div></>}
      {area.sectorCounts.map((sector) => <div key={sector.sector}><dt>{sector.sector}</dt><dd>{number(sector.count)}</dd></div>)}
      {detail && expanded && <><div><dt>New approvals in period</dt><dd>{number(detail.newApprovals)}</dd></div><div><dt>Yearly member change</dt><dd>{detail.change > 0 ? "+" : ""}{number(detail.change)}</dd></div>{Object.entries(detail.engagementCounts).map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{number(count)}</dd></div>)}</>}
    </dl>
    {!area.totalMembers && <p>No member records in the current results.</p>}
  </div>;
}

function BarangayPolygon({ area, fill, register, detail, memberLink, dimmed, highlighted }: {
  area: BarangayArea;
  fill: string;
  register: (id: string, layer: L.GeoJSON | null) => void;
  detail?: GeographicAnalytics; memberLink?: (barangay: string) => string; dimmed?: boolean; highlighted?: boolean;
}) {
  const layerRef = useRef<L.GeoJSON>(null);
  const map = useMap();
  const baseStyle: L.PathOptions = { color: highlighted ? "#123d2a" : "#ffffff", weight: highlighted ? 3 : 1.3, opacity: 1, fillColor: fill, fillOpacity: dimmed ? .15 : 0.86, className: "barangay-boundary" };
  const highlight = () => { map.eachLayer(layer => { if (layer instanceof L.Tooltip && layer !== layerRef.current?.getTooltip()) map.closeTooltip(layer); }); layerRef.current?.setStyle({ color: "#123d2a", weight: 2.5, fillOpacity: 0.98 }); layerRef.current?.bringToFront(); };
  const reset = () => layerRef.current?.setStyle({ color: highlighted ? "#123d2a" : "#ffffff", weight: highlighted ? 3 : 1.3, fillOpacity: dimmed ? .15 : 0.86 });

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
      const focus = () => { map.eachLayer(layer => { if (layer instanceof L.Tooltip && layer !== group.getTooltip()) map.closeTooltip(layer); }); group.setStyle({ color: "#123d2a", weight: 2.5 }); group.openTooltip(); };
      const blur = () => { group.closeTooltip(); group.setStyle({ color: highlighted ? "#123d2a" : "#ffffff", weight: highlighted ? 3 : 1.3 }); };
      const activate = (event: Event) => {
        const key = (event as KeyboardEvent).key;
        if (key === "Enter" || key === " ") {
          event.preventDefault();
          // Leaflet also translates bubbled keypresses into popup toggles.
          // Handle this activation once, rather than immediately toggling it closed.
          event.stopPropagation();
          event.stopImmediatePropagation();
          map.stop();
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
  }, [area, register, map, highlighted]);

  return <GeoJSON ref={layerRef} data={area.feature} style={baseStyle} eventHandlers={{ mouseover: highlight, mouseout: reset }}>
    <Tooltip sticky direction="auto" opacity={1} className={styles.tooltip}><BarangayInfo area={area} detail={detail} /></Tooltip>
    <Popup maxWidth={300} maxHeight={380} className={styles.popup}><section aria-label={`${area.barangay} member details`}><BarangayInfo area={area} detail={detail} expanded />{memberLink && <Link className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4" href={memberLink(area.barangay)}>View matching members</Link>}</section></Popup>
  </GeoJSON>;
}

export default function DemographicsMap({ demographics, analytics, memberLink, highlightBarangay }: { demographics: BarangayMembers[]; analytics?: GeographicAnalytics[]; memberLink?: (barangay: string) => string; highlightBarangay?: string }) {
  const [boundaries, setBoundaries] = useState<BarangayBoundaries | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [chosen, setChosen] = useState("");
  const [legendRange, setLegendRange] = useState<{ min: number; max: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
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
  useEffect(() => {
    if (!highlightBarangay || !model) return;
    const area = model.areas.find(a => normalizeBarangayName(a.barangay) === normalizeBarangayName(highlightBarangay));
    const layer = area ? layers.current.get(area.id) : undefined;
    if (layer) { mapRef.current?.fitBounds(layer.getBounds(), { padding: [48, 48], maxZoom: 14, animate: false }); }
  }, [highlightBarangay, model]);
  useEffect(() => {
    const resize = () => { setNativeFullscreen(Boolean(document.fullscreenElement)); window.setTimeout(() => mapRef.current?.invalidateSize(), 100); };
    document.addEventListener("fullscreenchange", resize);
    return () => document.removeEventListener("fullscreenchange", resize);
  }, []);

  if (!model || !bounds) return <div className={styles.loading} role={error ? "alert" : "status"}>
    <p>{error || "Loading barangay boundaries…"}</p>
    {error && <button type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }} className="transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--portal-green)] mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--portal-forest)] px-4 text-sm font-semibold text-white"><RefreshCw aria-hidden="true" className="size-4" />Try again</button>}
  </div>;

  const showAll = () => {
    mapRef.current?.closePopup();
    mapRef.current?.fitBounds(bounds, { paddingTopLeft: [24, 72], paddingBottomRight: [24, 112], animate: false });
    setChosen("");
    setLegendRange(null);
  };
  const choose = (id: string) => {
    setChosen(id);
    const layer = layers.current.get(id);
    if (!layer) { showAll(); return; }
    mapRef.current?.fitBounds(layer.getBounds(), { padding: [48, 48], maxZoom: 16, animate: false });
    layer.openPopup();
  };
  const unmatchedMembers = model.unmapped.reduce((total, row) => total + Math.max(0, Number(row.totalMembers) || 0), 0);

  const toggleExpansion = async () => {
    if (expanded) { setExpanded(false); return; }
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    if (!fullscreenRef.current?.requestFullscreen) { setExpanded(true); return; }
    try { await fullscreenRef.current.requestFullscreen(); } catch { setExpanded(true); }
  };
  const mapView = <div ref={fullscreenRef} className={`${styles.map} ${expanded ? styles.expandedMap : ""}`} role={expanded ? "dialog" : "region"} aria-label={expanded ? "Expanded barangay map" : "Nasugbu member distribution map"}>
      {expanded && <><Dialog.Title className="sr-only">Expanded barangay map</Dialog.Title><Dialog.Description className="sr-only">Nasugbu member distribution. Use the map controls or press Escape to return to the dashboard.</Dialog.Description></>}
      <MapContainer ref={mapRef} bounds={bounds} boundsOptions={{ paddingTopLeft: [24, 72], paddingBottomRight: [24, 112] }} scrollWheelZoom={false} zoomControl={false} zoomSnap={0.25} className={styles.canvas}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' opacity={0.65} />
        <ZoomControl position="bottomright" />
        {model.areas.map((area) => <BarangayPolygon key={area.id} area={area} fill={barangayFill(area.totalMembers, model.bins)} register={register} detail={analytics ? analytics.find(a => normalizeBarangayName(a.barangay) === normalizeBarangayName(area.barangay)) ?? { barangay: area.barangay, trueMembers: 0, associates: 0, engagementCounts: {}, newApprovals: 0, change: 0 } : undefined} memberLink={memberLink} dimmed={Boolean(legendRange && (area.totalMembers < legendRange.min || area.totalMembers > legendRange.max))} highlighted={Boolean(highlightBarangay && normalizeBarangayName(area.barangay) === normalizeBarangayName(highlightBarangay))} />)}
      </MapContainer>

      <div className={styles.controls}>
        <label className="sr-only" htmlFor="map-barangay">Find a barangay</label>
        <StyledSelect id="map-barangay" aria-label="Find a barangay" className="min-w-0 flex-1 bg-white" value={model.areas.find(area => area.id === chosen)?.barangay ?? "Find a barangay"} options={["Find a barangay", ...[...model.areas].sort((a, b) => a.barangay.localeCompare(b.barangay, "en", { numeric: true })).map(area => area.barangay)]} onChange={name => choose(model.areas.find(area => area.barangay === name)?.id ?? "")} />
        <button type="button" onClick={showAll} aria-label="Show all barangays" title="Show all barangays" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--portal-green)] grid size-11 shrink-0 place-items-center rounded-md border border-[var(--portal-border)] bg-[var(--portal-surface)] text-[var(--portal-forest)] shadow-[0_4px_12px_rgba(18,61,42,0.06)] hover:bg-[#EAF3E8]"><RotateCcw aria-hidden="true" className="size-4" /></button>
        <button ref={expandButtonRef} type="button" onClick={() => void toggleExpansion()} aria-label={expanded || nativeFullscreen ? "Exit expanded map" : "Expand map to fullscreen"} title={expanded || nativeFullscreen ? "Exit expanded map" : "Expand map"} className="grid size-11 shrink-0 place-items-center rounded-md border border-[var(--portal-border)] bg-white text-[var(--portal-forest)]"><Expand className="size-4" aria-hidden="true" /></button>
      </div>

      <div className={styles.legend} aria-label="Member count color scale">
        <p className="text-sm font-semibold text-[var(--portal-forest)]">Members per barangay</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
          <button type="button" className={styles.key} aria-pressed={legendRange?.max === 0} onClick={() => setLegendRange(legendRange?.max === 0 ? null : { min: 0, max: 0 })}><i style={{ background: zeroMemberColor }} />0</button>
          {model.bins.map((bin) => <button type="button" key={bin.min} className={styles.key} aria-pressed={legendRange?.min === bin.min} onClick={() => setLegendRange(legendRange?.min === bin.min ? null : bin)}><i style={{ background: bin.color }} />{bin.min === bin.max ? number(bin.min) : `${number(bin.min)}–${number(bin.max)}`}</button>)}
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--portal-muted)]">Darker areas have more recorded members. Select a range to highlight it.</p>
      </div>
    </div>;
  return <div>
    {expanded ? <><div className={styles.expandedPlaceholder} /><Dialog.Root open onOpenChange={open => { if (!open) setExpanded(false); }}><Dialog.Portal><Dialog.Overlay className={styles.fullscreenBackdrop} /><Dialog.Content asChild onOpenAutoFocus={e => { e.preventDefault(); requestAnimationFrame(() => expandButtonRef.current?.focus()); }} onCloseAutoFocus={e => { e.preventDefault(); requestAnimationFrame(() => expandButtonRef.current?.focus()); }}>{mapView}</Dialog.Content></Dialog.Portal></Dialog.Root></> : mapView}
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
