// server/api/hail.ts
import { defineEventHandler, getQuery } from "h3";
import { readFileSync, existsSync } from "fs";
import path from "path";

const DATA_FILE = path.resolve("hail_data.json");

// USA bounds
const USA_BOUNDS = {
  minLat: 24.396308,
  maxLat: 49.384358,
  minLon: -125.0,
  maxLon: -66.93457,
};

// Safe parseFloat
const toNumber = (val: any, fallback: number): number => {
  const n = parseFloat(val as string);
  return isNaN(n) ? fallback : n;
};

// Haversine (km)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isPointInUSABounds(lat: number, lon: number): boolean {
  return (
    lat >= USA_BOUNDS.minLat &&
    lat <= USA_BOUNDS.maxLat &&
    lon >= USA_BOUNDS.minLon &&
    lon <= USA_BOUNDS.maxLon
  );
}

let cachedData: any[] | null = null;
function loadHailData() {
  if (cachedData) return cachedData;

  if (!existsSync(DATA_FILE)) {
    throw new Error("hail_data.json missing");
  }

  const rawData = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  cachedData = rawData
    .map((r: any) => {
      const mag = (+r.mag || 0) / 100;
      const loss = (+r.loss || 0) * 1000;
      const crop = (+r.closs || 0) * 1000;
      const lat = +r.slat || +r.elat || 0;
      const lon = +r.slon || +r.elon || 0;

      if (!lat || !lon) return null;

      return {
        id: r.om,
        year: +r.yr,
        month: +r.mo || 1,
        day: +r.da || 1,
        state: r.st,
        magnitude: mag,
        injuries: +r.inj || 0,
        fatalities: +r.fat || 0,
        propertyLoss: loss,
        cropLoss: crop,
        lat,
        lon,
        _cat:
          loss > 100000
            ? "property"
            : crop > 50000
            ? "crop"
            : +r.inj || +r.fat
            ? "human"
            : "minor",
      };
    })
    .filter(Boolean)
    .filter((f: any) => isPointInUSABounds(f.lat, f.lon));

  console.log(`Loaded ${cachedData.length} USA hail events`);
  return cachedData;
}

export default defineEventHandler(async (event) => {
  try {
    const q = getQuery(event);

    // Extract + validate
    const minYear = Math.max(1955, toNumber(q.minYear, 1955));
    const maxYear = Math.min(2024, toNumber(q.maxYear, 2024));
    const state = (q.state as string)?.toUpperCase().trim() || "";
    const minSize = toNumber(q.minSize, 0);
    const category = (q.category as string) || "";
    const start = Math.max(0, toNumber(q.start, 0));
    const limit = Math.min(10000, toNumber(q.limit, 10000));

    // Location search
    let searchLat: number | null = null;
    let searchLon: number | null = null;
    let searchRadius = 0;

    if (q.lat && q.lon && q.radius) {
      searchLat = toNumber(q.lat, NaN);
      searchLon = toNumber(q.lon, NaN);
      searchRadius = toNumber(q.radius, 0);

      if (isNaN(searchLat) || isNaN(searchLon) || searchRadius <= 0) {
        return { error: "Invalid lat/lon/radius", features: [], total: 0 };
      }

      if (!isPointInUSABounds(searchLat, searchLon)) {
        return { error: "Location outside USA", features: [], total: 0 };
      }
    }

    const hailData = loadHailData();
    let filtered = hailData.filter(
      (f) =>
        f.year >= minYear &&
        f.year <= maxYear &&
        (!state || f.state === state) &&
        f.magnitude >= minSize &&
        (!category || f._cat === category)
    );

    // Apply radius filter
    if (searchLat !== null && searchLon !== null) {
      filtered = filtered.filter(
        (f) =>
          calculateDistance(searchLat!, searchLon!, f.lat, f.lon) <=
          searchRadius
      );
    }

    const results = filtered.slice(start, start + limit);
    const hasMore = start + results.length < filtered.length;

    return {
      features: results,
      total: filtered.length,
      hasMore,
      nextStart: start + results.length,
      country: "USA",
    };
  } catch (err: any) {
    console.error("API Error:", err);
    return {
      error: err.message || "Server error",
      features: [],
      total: 0,
      hasMore: false,
    };
  }
});
