"use client";

import { useEffect, useState, Fragment } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Approximate coordinates for some Nasugbu Barangays
const BARANGAY_COORDS: Record<string, [number, number]> = {
  "Poblacion": [14.0735, 120.6322],
  "Bucana": [14.0715, 120.6212],
  "Wawa": [14.0792, 120.6245],
  "Lumbangan": [14.0921, 120.6432],
  "Pantalan": [14.0682, 120.6278],
  "Talangan": [14.0532, 120.6355],
  "Biga": [14.1205, 120.6723],
  "Putat": [14.0456, 120.6489],
  "Bilaran": [14.0321, 120.6542],
  "Tumalim": [14.1432, 120.7231],
  "Reparo": [14.1124, 120.6945],
  "Kaylaway": [14.1542, 120.7621],
  "Calayo": [14.1632, 120.6012],
  "Papaya": [14.1845, 120.5899],
  "Looc": [14.1956, 120.5988],
  "Aga": [14.1356, 120.7511],
  "Utod": [14.0856, 120.6841],
  "Latag": [14.0756, 120.6541],
  "Munting Indang": [14.0956, 120.6741],
};

type DemographicsMapProps = {
  demographics: { barangay: string; totalMembers: number }[];
  selectedBarangay?: string;
  onSelectBarangay?: (barangay: string) => void;
};

function MapController({ selectedBarangay }: { selectedBarangay?: string }) {
  const map = useMap();
  useEffect(() => {
    if (selectedBarangay && BARANGAY_COORDS[selectedBarangay]) {
      map.flyTo(BARANGAY_COORDS[selectedBarangay], 14, { duration: 1.5 });
    } else {
      map.flyTo([14.0735, 120.6322], 12, { duration: 1.5 });
    }
  }, [selectedBarangay, map]);
  return null;
}

export default function DemographicsMap({ demographics, selectedBarangay, onSelectBarangay }: DemographicsMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="w-full h-full relative z-0">
      {/* @ts-ignore */}
      <MapContainer
        center={[14.0735, 120.6322]} // Centered on Nasugbu Poblacion
        zoom={12}
        scrollWheelZoom={false}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <MapController selectedBarangay={selectedBarangay} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {demographics.map((d) => {
          // If we don't have exact coordinates, jitter around center slightly
          const coords = BARANGAY_COORDS[d.barangay] || [
            14.0735 + (Math.random() - 0.5) * 0.05,
            120.6322 + (Math.random() - 0.5) * 0.05,
          ];
          
          return (
            <Fragment key={d.barangay}>
              {/* @ts-ignore */}
              <CircleMarker
                center={coords as [number, number]}
                radius={Math.max(5, Math.min(25, d.totalMembers * 1.5))} // Scale radius
                pathOptions={{
                  color: "#123D2A",
                  fillColor: "#1F6B43",
                  fillOpacity: 0.6,
                  weight: 1,
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
                  </div>
                </Popup>
              </CircleMarker>
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
