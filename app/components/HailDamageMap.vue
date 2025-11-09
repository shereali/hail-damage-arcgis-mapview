<!-- components/HailDamageMap.vue -->
<template>
  <client-only>
    <div class="min-h-screen flex flex-col md:flex-row">
      <!-- Sidebar -->
      <aside
        class="w-full md:w-96 bg-white/80 backdrop-blur-md border-r border-indigo-100 p-6 space-y-8 shadow-2xl overflow-y-auto"
      >
        <!-- USA Header -->
        <div class="text-center">
          <div class="flex items-center justify-center gap-2 mb-1">
            <h1 class="text-xl font-extrabold text-indigo-900 tracking-tight">
              USA Hail Damage Map
            </h1>
          </div>
          <p class="text-sm text-gray-600">1955–2024 • FEMA Data</p>
          <!-- <p class="text-xs text-green-600 font-medium mt-1">
            Exclusive USA Coverage
          </p> -->
        </div>

        <!-- Search Section -->
        <section
          class="bg-gradient-to-br from-indigo-50 to-blue-100 rounded-2xl shadow-md p-5"
        >
          <label
            class="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3"
          >
            <span>📍</span> USA Address Search
          </label>
          <div class="space-y-3">
            <input
              v-model="address"
              @keyup.enter="searchAndFilter"
              placeholder="Enter US city, ZIP code, or address"
              class="w-full px-4 py-1.5 border-2 border-indigo-200 rounded-md focus:ring-2 focus:ring-indigo-400 outline-none text-base"
            />
            <button
              @click="searchAndFilter"
              :disabled="loading"
              class="w-full bg-indigo-600 text-white py-1.5 rounded-md font-semibold hover:bg-indigo-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span v-if="!loading">Search USA Data</span>
              <span v-else class="flex items-center gap-2">
                <svg
                  class="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  ></path>
                </svg>
                Searching...
              </span>
            </button>
            <p class="text-xs text-gray-500 text-center">
              Supports all US addresses, cities, and ZIP codes
            </p>
          </div>
        </section>

        <!-- Filters -->
        <section
          class="bg-gradient-to-br from-white to-indigo-50 rounded-2xl shadow-md p-5 space-y-6"
        >
          <!-- Year Range -->
          <div>
            <label class="block font-semibold text-gray-800 mb-2"
              >Year Range</label
            >
            <div class="space-y-2">
              <div class="flex items-center gap-3">
                <input
                  type="range"
                  min="1955"
                  max="2024"
                  v-model.number="filters.minYear"
                  class="flex-1 accent-indigo-600"
                />
                <span
                  class="text-sm font-medium text-gray-700 w-12 text-center"
                  >{{ filters.minYear }}</span
                >
              </div>
              <div class="flex items-center gap-3">
                <input
                  type="range"
                  min="1955"
                  max="2024"
                  v-model.number="filters.maxYear"
                  class="flex-1 accent-indigo-600"
                />
                <span
                  class="text-sm font-medium text-gray-700 w-12 text-center"
                  >{{ filters.maxYear }}</span
                >
              </div>
            </div>
          </div>

          <!-- State Selector -->
          <div>
            <label class="block font-semibold text-gray-800 mb-2"
              >US State</label
            >
            <select
              v-model="filters.state"
              class="w-full border border-gray-300 rounded-md px-4 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All 50 States</option>
              <optgroup label="Northeast">
                <option v-for="s in northeastStates" :key="s" :value="s">
                  {{ s }}
                </option>
              </optgroup>
              <optgroup label="Midwest">
                <option v-for="s in midwestStates" :key="s" :value="s">
                  {{ s }}
                </option>
              </optgroup>
              <optgroup label="South">
                <option v-for="s in southernStates" :key="s" :value="s">
                  {{ s }}
                </option>
              </optgroup>
              <optgroup label="West">
                <option v-for="s in westernStates" :key="s" :value="s">
                  {{ s }}
                </option>
              </optgroup>
            </select>
          </div>

          <!-- Min Size -->
          <div>
            <label class="block font-semibold text-gray-800 mb-2"
              >Min Hail Size (inches)</label
            >
            <input
              v-model.number="filters.minSize"
              type="number"
              step="0.25"
              min="0"
              max="6"
              class="w-full border border-gray-300 rounded-md px-4 py-1.5 focus:ring-2 focus:ring-indigo-400"
              placeholder="0.00"
            />
            <p class="text-xs text-gray-500 mt-1">
              Typical range: 0.5–4.5 inches
            </p>
          </div>

          <!-- Damage Category -->
          <div>
            <label class="block font-semibold text-gray-800 mb-2"
              >Damage Category</label
            >
            <select
              v-model="filters.category"
              class="w-full border border-gray-300 rounded-md px-4 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Any</option>
              <option value="property">Property Damage</option>
              <option value="crop">Crop Damage</option>
              <option value="human">Injuries / Fatalities</option>
            </select>
          </div>

          <!-- Radius -->
          <div v-if="searchLocation">
            <label class="block font-semibold text-gray-800 mb-2"
              >Search Radius (miles)</label
            >
            <div class="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="200"
                v-model.number="searchRadiusMiles"
                class="flex-1 accent-indigo-600"
              />
              <span class="text-sm font-medium text-gray-700 w-16 text-center"
                >{{ searchRadiusMiles }} mi</span
              >
            </div>
            <p class="text-xs text-gray-500 mt-1">
              ≈ {{ Math.round(searchRadiusMiles * 1.60934) }} km
            </p>
          </div>
        </section>

        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            @click="loadDataWithFilters"
            :disabled="loading"
            class="flex-1 bg-green-600 text-white py-1.5 rounded-md font-semibold hover:bg-green-700 transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <span v-if="!loading">Apply Filters & Load</span>
            <span v-else class="flex items-center gap-2">
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                ></path>
              </svg>
              Loading...
            </span>
          </button>
          <button
            @click="reset"
            class="flex-1 border-2 border-red-500 text-red-600 py-1.5 rounded-md font-semibold hover:bg-red-50 transition-all duration-200"
          >
            Reset
          </button>
        </div>

        <!-- Stats -->
        <div
          v-if="features.length > 0"
          class="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 text-center shadow-inner"
        >
          <div class="flex items-center justify-center gap-2 mb-1">
            <span class="text-lg">🇺🇸</span>
            <p class="text-2xl font-bold text-indigo-900">
              {{ filtered.length.toLocaleString() }}
            </p>
          </div>
          <p class="text-sm text-gray-700">USA hail events loaded</p>
          <p v-if="searchLocation" class="text-sm text-green-600 mt-1">
            Within {{ searchRadiusMiles }} miles of search
          </p>
          <p v-else class="text-xs text-indigo-600 mt-1">
            {{ getStateDisplay() }} • {{ filters.minYear }}–{{
              filters.maxYear
            }}
          </p>
        </div>

        <!-- Basemap Toggle -->
        <button
          @click="toggleBasemap"
          class="w-full bg-indigo-500 text-white py-1.5 rounded-md font-medium hover:bg-indigo-600 transition-all duration-200"
        >
          {{ basemap === "satellite" ? "Terrain" : "Satellite" }} View
        </button>
      </aside>

      <!-- Map -->
      <main class="flex-1 relative">
        <div id="map" class="w-full h-screen"></div>

        <!-- USA Search Result -->
        <div
          v-if="searchResult"
          class="absolute top-4 left-4 bg-white/95 backdrop-blur-lg p-5 rounded-2xl shadow-2xl z-10 max-w-sm border-2 border-indigo-200"
        >
          <div class="flex items-center gap-2">
            <span class="text-red-500">📍</span>
            <p class="font-bold text-indigo-900 text-lg">
              {{ searchResult.address }}
            </p>
          </div>
          <p class="text-sm text-gray-600 mt-1">USA Location</p>
          <p class="text-sm text-green-600 mt-1">
            Showing {{ filtered.length }} events within
            {{ searchRadiusMiles }} miles
          </p>
        </div>

        <!-- Progress Bar -->
        <!-- <div
          v-if="loading"
          class="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-1.5 rounded-full shadow-2xl flex items-center gap-4 z-20"
        >
          <div class="w-64 bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-cyan-400 to-indigo-600 transition-all duration-500"
              :style="{ width: progress + '%' }"
            ></div>
          </div>
          <span class="text-sm font-medium">Loading hail data...</span>
        </div> -->

        <!-- Add this inside the <main> map container, just above the closing </main> -->
        <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <button
            v-if="hasMore && !loading"
            @click="loadMore"
            class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-full font-bold shadow-2xl hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center gap-3"
          >
            <span>Load More USA Hail Events</span>
            <span class="text-xs opacity-80"
              >({{ total.toLocaleString() - loaded }} remaining)</span
            >
          </button>

          <!-- Loading Spinner for Load More -->
          <div
            v-if="loading && loaded > 0"
            class="bg-black/80 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 backdrop-blur"
          >
            <div class="animate-spin">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                ></path>
              </svg>
            </div>
            <span class="font-medium"
              >Loading {{ Math.min(10000, total - loaded) }} events...</span
            >
          </div>
        </div>
      </main>
    </div>
  </client-only>
</template>

<script setup lang="ts">
let clickHandler: __esri.Handle | null = null;
const address = ref("");
const searchResult = ref<any>(null);
const searchLocation = ref<any>(null);
const searchRadiusMiles = ref(25); // Default to miles for USA users
const filters = ref({
  minYear: 1955,
  maxYear: 2024,
  state: "",
  minSize: 0,
  category: "",
});
const basemap = ref<"terrain" | "satellite">("terrain");
const loading = ref(false);
const total = ref(0);
const loaded = ref(0);
const progress = ref(0);
const hasSearched = ref(false);

let view: any = null;
let graphicsLayer: any = null;
let Point: any = null;
let Graphic: any = null;

const features = ref<any[]>([]);
const filtered = ref<any[]>([]);

// Track click handler to prevent duplicates

// USA-specific state groupings
const northeastStates = [
  "CT",
  "DE",
  "ME",
  "MD",
  "MA",
  "NH",
  "NJ",
  "NY",
  "PA",
  "RI",
  "VT",
];
const midwestStates = [
  "IL",
  "IN",
  "IA",
  "KS",
  "MI",
  "MN",
  "MO",
  "NE",
  "ND",
  "OH",
  "SD",
  "WI",
];
const southernStates = [
  "AL",
  "AR",
  "FL",
  "GA",
  "KY",
  "LA",
  "MS",
  "NC",
  "SC",
  "TN",
  "TX",
  "VA",
  "WV",
];
const westernStates = [
  "AK",
  "AZ",
  "CA",
  "CO",
  "HI",
  "ID",
  "MT",
  "NV",
  "NM",
  "OR",
  "UT",
  "WA",
  "WY",
];

// All states for reference
const states = [
  ...northeastStates,
  ...midwestStates,
  ...southernStates,
  ...westernStates,
];

// Convert miles to km for API
const searchRadiusKm = computed(() =>
  Math.round(searchRadiusMiles.value * 1.60934)
);

const hasMore = ref(false);
const nextStart = ref(0);

// Load more data (10,000 at a time)
const loadMore = async () => {
  if (loading.value || !hasMore.value) return;

  loading.value = true;
  const params = new URLSearchParams({
    minYear: filters.value.minYear.toString(),
    maxYear: filters.value.maxYear.toString(),
    state: filters.value.state,
    minSize: filters.value.minSize.toString(),
    category: filters.value.category,
    country: "US",
    start: nextStart.value.toString(),
    limit: "10000",
  });

  if (searchLocation.value) {
    params.append("lat", searchLocation.value.latitude.toString());
    params.append("lon", searchLocation.value.longitude.toString());
    params.append("radius", searchRadiusKm.value.toString());
  }

  try {
    const res = await fetch(`/api/hail?${params}`);
    const json = await res.json();

    if (json.error) throw new Error(json.error);

    // Append new features
    const newFeatures = json.features || [];
    features.value = [...features.value, ...newFeatures];
    filtered.value = features.value;

    loaded.value += newFeatures.length;
    hasMore.value = json.hasMore;
    nextStart.value = loaded.value;

    renderMap();
  } catch (err) {
    console.error("Load more failed:", err);
  } finally {
    loading.value = false;
  }
};

// Get display text for current state filter
const getStateDisplay = () => {
  if (filters.value.state) return `${filters.value.state} State`;
  return "All USA States";
};

// Calculate distance between two points (haversine formula)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// SINGLE DATA FETCH - No batching
const fetchData = async (
  lat: number | null = null,
  lon: number | null = null,
  start = 0,
  limit = 10000
) => {
  const params = new URLSearchParams({
    minYear: filters.value.minYear.toString(),
    maxYear: filters.value.maxYear.toString(),
    state: filters.value.state,
    minSize: filters.value.minSize.toString(),
    category: filters.value.category,
    country: "US",
    start: start.toString(),
    limit: limit.toString(),
  });

  if (lat && lon) {
    params.append("lat", lat.toString());
    params.append("lon", lon.toString());
    params.append("radius", searchRadiusKm.value.toString());
  }

  const res = await fetch(`/api/hail?${params}`);
  const json = await res.json();

  if (json.error) {
    console.error(json.error);
    return { features: [], total: 0, hasMore: false };
  }

  return {
    features: json.features || [],
    total: json.total || 0,
    hasMore: json.hasMore || false,
  };
};

// LOAD DATA WITH CURRENT FILTERS
const loadDataWithFilters = async () => {
  if (loading.value) return;

  loading.value = true;
  features.value = [];
  filtered.value = [];
  loaded.value = 0;
  total.value = 0;
  nextStart.value = 0;
  hasMore.value = false;

  graphicsLayer?.removeAll();

  const {
    features: newFeatures,
    total: newTotal,
    hasMore: more,
  } = await fetchData(
    searchLocation.value?.latitude || null,
    searchLocation.value?.longitude || null,
    0,
    10000
  );

  features.value = newFeatures;
  filtered.value = newFeatures;
  total.value = newTotal;
  loaded.value = newFeatures.length;
  hasMore.value = more;
  nextStart.value = loaded.value;

  renderMap();
  loading.value = false;
};

// APPLY FILTERS (client-side on loaded data)
const applyFilters = () => {
  let tempFiltered = features.value.filter((f) => {
    if (f.year < filters.value.minYear || f.year > filters.value.maxYear)
      return false;
    if (filters.value.state && f.state !== filters.value.state) return false;
    if (f.magnitude < filters.value.minSize) return false;
    if (filters.value.category) {
      const cat = getDamageCategory(f);
      if (cat !== filters.value.category) return false;
    }
    return true;
  });

  // Apply address proximity filter if we have a search location
  if (searchLocation.value) {
    tempFiltered = tempFiltered.filter((f) => {
      const distance = calculateDistance(
        searchLocation.value.latitude,
        searchLocation.value.longitude,
        f.lat,
        f.lon
      );
      // Show events within the search radius
      return distance <= searchRadiusKm.value;
    });
  }

  filtered.value = tempFiltered;
  renderMap();
};

// APPLY FILTERS TO CURRENTLY LOADED DATA
const applyFiltersToCurrentData = () => {
  //   if (features.value.length === 0) return;

  let tempFiltered = features.value.filter((f) => {
    // Year filter
    if (f.year < filters.value.minYear || f.year > filters.value.maxYear)
      return false;

    // State filter
    if (filters.value.state && f.state !== filters.value.state) return false;

    // Size filter
    if (f.magnitude < filters.value.minSize) return false;

    // Category filter
    if (filters.value.category) {
      const cat = getDamageCategory(f);
      if (cat !== filters.value.category) return false;
    }

    return true;
  });

  filtered.value = tempFiltered;
  renderMap();

  console.log(`🔧 Applied filters: ${filtered.length} events match criteria`);
};

// Enhanced damage category detection
const getDamageCategory = (f: any) => {
  if (f.propertyLoss > 100000 || f.cropLoss > 50000) return "major";
  if (f.propertyLoss > 50000 || f.cropLoss > 25000) return "moderate";
  if (f.injuries > 0 || f.fatalities > 0) return "human";
  if (f.propertyLoss > 10000 || f.cropLoss > 5000) return "minor";
  return "light";
};

// Color coding based on damage severity
const getDamageColor = (category: string, magnitude: number) => {
  const colors = {
    major: [220, 38, 38, 0.9], // Red for major damage
    moderate: [255, 140, 0, 0.8], // Orange for moderate damage
    human: [139, 0, 139, 0.9], // Purple for human impact
    minor: [100, 180, 255, 0.7], // Blue for minor damage
    light: [100, 100, 200, 0.6], // Gray for light damage
  };
  return colors[category as keyof typeof colors] || [100, 100, 100, 0.5];
};

// Size based on hail size and damage
const getDamageSize = (
  magnitude: number,
  propertyLoss: number,
  cropLoss: number
) => {
  const baseSize = 8;
  const magnitudeSize = magnitude * 4;
  const damageSize =
    Math.log10(Math.max(1, (propertyLoss + cropLoss) / 1000)) * 2;
  return Math.min(30, baseSize + magnitudeSize + damageSize);
};

const renderMap = () => {
  if (!graphicsLayer || !view) return;
  graphicsLayer.removeAll();

  // === Remove old click handler ===
  if (clickHandler) {
    clickHandler.remove();
    clickHandler = null;
  }

  // === Add search location + radius circle (CORRECT GEOMETRY) ===
  if (searchLocation.value) {
    // Search marker
    const searchPoint = new Point({
      latitude: searchLocation.value.latitude,
      longitude: searchLocation.value.longitude,
    });

    const searchGraphic = new Graphic({
      geometry: searchPoint,
      symbol: {
        type: "simple-marker",
        style: "circle",
        size: 16,
        color: [255, 69, 58, 0.9], // bright red
        outline: {
          color: [255, 255, 255, 9],
          width: 3,
        },
      },
      attributes: { type: "search_location" },
    });

    graphicsLayer.add(searchGraphic);

    // Radius circle (FIXED: uses correct Circle geometry)
    const circle = new Graphic({
      geometry: {
        type: "polygon",
        rings: createCircleRing(
          searchLocation.value.longitude,
          searchLocation.value.latitude,
          searchRadiusMiles.value * 1609.34 // miles → meters
        ),
        spatialReference: { wkid: 4326 },
      },
      symbol: {
        type: "simple-fill",
        color: [255, 0, 0, 0.08],
        outline: { color: [255, 0, 0, 0.6], width: 2 },
      },
    });
    graphicsLayer.add(circle);
  }

  // === Render hail markers ===
  filtered.value.forEach((f) => {
    const damageCategory = getDamageCategory(f);
    const color = getDamageColor(damageCategory, f.magnitude);
    const size = getDamageSize(f.magnitude, f.propertyLoss, f.cropLoss);

    const distance = searchLocation.value
      ? calculateDistance(
          searchLocation.value.latitude,
          searchLocation.value.longitude,
          f.lat,
          f.lon
        )
      : null;

    const graphic = new Graphic({
      geometry: new Point({ latitude: f.lat, longitude: f.lon }),
      symbol: {
        type: "simple-marker",
        style: "circle",
        color: color,
        size: size,
        outline: { color: [255, 255, 255, 0.9], width: 2 },
      },
      attributes: f,
      popupTemplate: {
        title: `${f.state} • ${
          f.year
        } • ${damageCategory.toUpperCase()} Damage`,
        content: `
          <div style="font-family:system-ui; line-height:1.5">
            <b>Date:</b> ${f.year}-${String(f.month).padStart(2, "0")}-${String(
          f.day
        ).padStart(2, "0")}<br>
            <b>Hail Size:</b> ${f.magnitude.toFixed(2)}"<br>
            <b>Damage Category:</b> ${damageCategory}<br>
            <b>Property Loss:</b> $${f.propertyLoss.toLocaleString()}<br>
            <b>Crop Loss:</b> $${f.cropLoss.toLocaleString()}<br>
            <b>Injuries:</b> ${f.injuries} | <b>Fatalities:</b> ${f.fatalities}
            ${
              distance !== null
                ? `<br><b>Distance:</b> ${(distance * 0.621371).toFixed(
                    1
                  )} miles`
                : ""
            }
          </div>
        `,
      },
    });

    graphicsLayer.add(graphic);
  });

  // === Click handler (ONE TIME ONLY) ===
  clickHandler = view.on("click", (event: any) => {
    view.hitTest(event).then((response: any) => {
      const hit = response.results.find(
        (r: any) =>
          r.graphic.layer === graphicsLayer &&
          r.graphic.attributes?.type !== "search_location"
      );

      if (hit) {
        const g = hit.graphic;
        const deltaLat = 0.0012 / Math.pow(2, view.zoom / 4);

        view.popup.open({
          features: [g],
          location: new Point({
            latitude: g.geometry.latitude + deltaLat,
            longitude: g.geometry.longitude,
          }),
        });
      } else {
        view.popup.close();
      }
    });
  });

  // === Auto-zoom ===
  if (filtered.value.length > 0 && searchLocation.value) {
    const points = filtered.value.map((f) => [f.lon, f.lat]);
    points.push([
      searchLocation.value.longitude,
      searchLocation.value.latitude,
    ]);
    view.goTo({ target: points, padding: 100 });
  } else if (searchLocation.value) {
    view.goTo({
      center: [searchLocation.value.longitude, searchLocation.value.latitude],
      zoom: 10,
    });
  }
};

// Add this function inside <script setup>
const createCircleRing = (lon: number, lat: number, radiusMeters: number) => {
  const rings: number[][] = [];
  const numPoints = 64;
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i * 360) / numPoints;
    const dx = radiusMeters * Math.cos((angle * Math.PI) / 180);
    const dy = radiusMeters * Math.sin((angle * Math.PI) / 180);
    const lat2 = lat + dy / 111111;
    const lon2 = lon + dx / (111111 * Math.cos((lat * Math.PI) / 180));
    rings.push([lon2, lat2]);
  }
  return [rings];
};
// SINGLE DATA FETCH - Only fetches data for specific location with filters
const fetchDataForLocation = async (lat: number, lon: number) => {
  const {
    features: newFeatures,
    total: newTotal,
    hasMore: more,
  } = await fetchData(lat, lon, 0, 10000);

  features.value = newFeatures;
  filtered.value = newFeatures;
  total.value = newTotal;
  loaded.value = newFeatures.length;
  hasMore.value = more;
  nextStart.value = loaded.value;

  renderMap();
  loading.value = false;
};

// SEARCH + LOAD DATA - USA optimized
const searchAndFilter = async () => {
  //   if (loading.value) return;

  // Reset previous search but keep hasSearched flag
  searchLocation.value = null;
  searchResult.value = null;
  features.value = [];
  filtered.value = [];

  let lat = null;
  let lon = null;

  // If we have address, do geocoding first
  if (address.value.trim()) {
    loading.value = true;
    hasSearched.value = true;

    try {
      // Load the locator module with proper error handling
      const [locator] = await (window as any)
        .loadModules(["esri/rest/locator"])
        .catch((error: any) => {
          console.error("Failed to load ArcGIS modules:", error);
          throw new Error("ArcGIS services unavailable");
        });

      // Use the USA geocoding service URL directly for better reliability
      const geocodeServiceUrl =
        "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";

      const res = await locator.addressToLocations(geocodeServiceUrl, {
        address: {
          SingleLine: address.value,
        },
        countryCode: "USA",
        outFields: ["*"],
        maxLocations: 1,
        outSR: {
          wkid: 4326,
        },
      });

      if (res && res.length > 0 && res[0]?.location) {
        searchResult.value = {
          address: res[0].address || address.value,
          score: res[0].score || 0,
        };
        searchLocation.value = {
          latitude: res[0].location.y,
          longitude: res[0].location.x,
        };
        lat = res[0].location.y;
        lon = res[0].location.x;

        console.log(
          `📍 USA Geocoding: ${address.value} → ${lat}, ${lon} (score: ${res[0].score})`
        );

        // Fetch ONLY the data for this specific location
        await fetchDataForLocation(lat, lon);
      } else {
        console.warn(`❌ No USA location found for: ${address.value}`);
        searchResult.value = {
          address: "Location not found - try different address",
          score: 0,
        };
        loading.value = false;
        searchResult.value = {};
      }
    } catch (e) {
      console.error("USA geocoding failed:", e);
      searchResult.value = {
        address: "Geocoding service unavailable",
        score: 0,
      };
      loading.value = false;
    }
  } else {
    // No address provided
    hasSearched.value = false;
  }
};

// RESET - Clears everything including data
const reset = () => {
  address.value = "";
  searchResult.value = null;
  searchLocation.value = null;
  searchRadiusMiles.value = 25;
  filters.value = {
    minYear: 1955,
    maxYear: 2024,
    state: "",
    minSize: 0,
    category: "",
  };
  features.value = [];
  filtered.value = [];
  loaded.value = 0;
  total.value = 0;
  progress.value = 0;
  loading.value = false;
  graphicsLayer?.removeAll();
};

// TOGGLE BASEMAP
const toggleBasemap = () => {
  basemap.value = basemap.value === "satellite" ? "terrain" : "satellite";
  view.map.basemap = basemap.value;
};

// Watch filters and apply to current data
watch(
  () => [
    filters.value.minYear,
    filters.value.maxYear,
    filters.value.state,
    filters.value.minSize,
    filters.value.category,
  ],
  () => {
    if (features.value.length > 0 && !loading.value) {
      applyFiltersToCurrentData();
    }
  },
  { deep: true }
);

// Watch search radius and refetch data with new radius
watch(searchRadiusMiles, () => {
  if (searchLocation.value && hasSearched.value && !loading.value) {
    loading.value = true;
    fetchDataForLocation(
      searchLocation.value.latitude,
      searchLocation.value.longitude
    ).finally(() => {
      loading.value = false;
    });
  }
});

onMounted(async () => {
  await (window as any).loadEsri();
  const [Map, MapView, GraphicsLayer, P, G] = await (window as any).loadModules(
    [
      "esri/Map",
      "esri/views/MapView",
      "esri/layers/GraphicsLayer",
      "esri/geometry/Point",
      "esri/Graphic",
    ]
  );

  // ASSIGN THEM! THIS WAS MISSING
  Point = P;
  Graphic = G;

  const map = new Map({ basemap: "terrain" });
  view = new MapView({
    container: "map",
    map,
    center: [-98.5, 39.5],
    zoom: 4,
  });

  graphicsLayer = new GraphicsLayer();
  map.add(graphicsLayer);

  await view.when();

  // Clean floating popup
  view.popup.dockEnabled = false;
  view.popup.visibleElements = { collapseButton: false };
  view.popup.dockOptions = { buttonEnabled: false, position: "manual" };
  view.popup.alignment = "top-center";

  // Remove footer junk
  view.ui.remove("attribution");
  view.ui.remove("zoom");

  // Clean Calcite bloat
  const style = document.createElement("style");
  style.textContent = `
    .esri-popup__header, .esri-popup__footer, .esri-popup__navigation,
    .esri-popup__button, calcite-action, calcite-action-bar,
    .esri-features__heading { display: none !important; }
    .esri-feature-content > div > div {
      display: block !important; padding: 16px !important;
      background: white !important; border-radius: 16px !important;
      box-shadow: 0 12px 40px rgba(0,0,0,0.3) !important;
      font-family: system-ui !important; font-size: 14px !important;
    }
    .esri-popup__pointer-direction { background: white !important; }
  `;
  document.head.appendChild(style);

  renderMap();
});
</script>

<style scoped>
:deep(.esri-popup__main-container) {
  max-width: 340px !important;
  border-radius: 16px !important;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3) !important;
  background: white;
  overflow: hidden;
}

:deep(.esri-popup__header) {
  background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
  color: white !important;
  padding: 12px 16px !important;
  font-weight: bold;
}

:deep(.esri-popup__content) {
  padding: 12px 16px !important;
  font-size: 14px;
  line-height: 1.6;
}

:deep(.esri-popup__pointer-direction-bottom) {
  background: white !important;
}
</style>
