"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { PostcodeCluster } from "@/app/map/page";
import "leaflet/dist/leaflet.css";

interface GeoCluster extends PostcodeCluster {
  lat: number;
  lng: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function FitBounds({ markers }: { markers: GeoCluster[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (markers.length > 0 && !fitted.current) {
      fitted.current = true;
      const bounds = markers.map((m) => [m.lat, m.lng] as [number, number]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [markers, map]);

  return null;
}

function getRadius(count: number, max: number): number {
  const min = 5;
  const maxR = 25;
  if (max <= 1) return min;
  return min + (count / max) * (maxR - min);
}

function getColor(profit: number): string {
  if (profit >= 10) return "#10b981";
  if (profit >= 0) return "#6366f1";
  return "#ef4444";
}

async function geocodePostcodes(postcodes: string[]): Promise<Map<string, { lat: number; lng: number }>> {
  const results = new Map<string, { lat: number; lng: number }>();

  for (let i = 0; i < postcodes.length; i += 100) {
    const batch = postcodes.slice(i, i + 100);
    try {
      const res = await fetch("https://api.postcodes.io/postcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcodes: batch }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of data.result ?? []) {
        if (item.result?.latitude && item.result?.longitude) {
          results.set(item.query, {
            lat: item.result.latitude,
            lng: item.result.longitude,
          });
        }
      }
    } catch {
      // skip failed batch
    }
  }

  return results;
}

export default function OrderMap({ clusters }: { clusters: PostcodeCluster[] }) {
  const [geoMarkers, setGeoMarkers] = useState<GeoCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const postcodes = clusters.map((c) => c.postcode);
      const total = postcodes.length;
      const allResults = new Map<string, { lat: number; lng: number }>();

      for (let i = 0; i < postcodes.length; i += 100) {
        if (cancelled) return;
        const batch = postcodes.slice(i, i + 100);
        const batchResults = await geocodePostcodes(batch);
        for (const [k, v] of batchResults) allResults.set(k, v);
        setProgress(Math.min(i + 100, total));
      }

      if (cancelled) return;

      const markers: GeoCluster[] = [];
      for (const cluster of clusters) {
        const geo = allResults.get(cluster.postcode);
        if (geo) {
          markers.push({ ...cluster, ...geo });
        }
      }

      setGeoMarkers(markers);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [clusters]);

  const maxCount = Math.max(...clusters.map((c) => c.orderCount), 1);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-foreground">
          Geocoding postcodes...
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {progress} / {clusters.length} postcodes
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: "70vh", width: "100%" }}>
      <MapContainer
        center={[54.5, -2.5]}
        zoom={6}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds markers={geoMarkers} />
        {geoMarkers.map((marker) => (
          <CircleMarker
            key={marker.postcode}
            center={[marker.lat, marker.lng]}
            radius={getRadius(marker.orderCount, maxCount)}
            pathOptions={{
              fillColor: getColor(marker.profit),
              fillOpacity: 0.7,
              color: "white",
              weight: 1.5,
            }}
          >
            <Popup maxWidth={360} minWidth={280}>
              <div style={{ fontFamily: "system-ui" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{marker.postcode}</span>
                  <span style={{ fontSize: 11, color: "#888" }}>{marker.orderCount} orders</span>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12, marginBottom: 8, padding: "6px 0", borderBottom: "1px solid #eee" }}>
                  <div>
                    <span style={{ color: "#888" }}>Revenue </span>
                    <span style={{ fontWeight: 600 }}>{fmt(marker.revenue)}</span>
                  </div>
                  <div>
                    <span style={{ color: "#888" }}>Profit </span>
                    <span style={{ fontWeight: 600, color: marker.profit >= 0 ? "#10b981" : "#ef4444" }}>
                      {fmt(marker.profit)}
                    </span>
                  </div>
                </div>
                <div style={{ maxHeight: 240, overflowY: "auto" }}>
                  {marker.orders.map((o) => (
                    <div key={o.amazonOrderId} style={{ borderTop: "1px solid #eee", padding: "6px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                        <span style={{ color: "#888" }}>
                          {o.date ? new Date(o.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </span>
                        <span style={{ fontWeight: 600, color: o.profit >= 0 ? "#10b981" : "#ef4444" }}>
                          {fmt(o.profit)}
                        </span>
                      </div>
                      {o.items.map((item, i) => (
                        <div key={i} style={{ fontSize: 11, display: "flex", justifyContent: "space-between", gap: 8, paddingLeft: 4 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                            {item.qty > 1 ? `${item.qty}× ` : ""}{item.title}
                          </span>
                          <span style={{ flexShrink: 0, color: "#666" }}>{fmt(item.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
