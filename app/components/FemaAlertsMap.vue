<template>
  <client-only>
    <div class="min-h-screen flex flex-col md:flex-row">
      <!-- Sidebar / Filters -->
      <aside
        class="w-full md:w-96 p-4 bg-white shadow-md space-y-4 overflow-y-auto"
      >
        <h2 class="text-xl font-semibold">FEMA IPAWS Alerts</h2>

        <!-- Loading Indicator -->
        <div
          v-if="loading"
          class="text-blue-600 text-sm bg-blue-50 p-2 rounded"
        >
          <div class="flex items-center">
            <svg
              class="animate-spin -ml-1 mr-3 h-4 w-4 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Loading alerts...
          </div>
        </div>

        <!-- Search Bar for Addresses Only -->
        <div>
          <label class="block text-sm font-medium mb-1">Address Search</label>
          <div class="relative">
            <input
              :value="filters.search"
              @input="debouncedUpdateFilter('search', $event.target.value)"
              placeholder="Street address, ZIP code (e.g., '123 Main St', '90210')"
              class="w-full border rounded px-3 py-2 pr-10 text-sm"
            />
            <div class="absolute right-3 top-2 text-gray-400">
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            Search by street address or ZIP code only
          </p>
        </div>

        <!-- Individual Location Filters -->
        <div class="grid grid-cols-2 gap-3">
          <!-- State Filter -->
          <div>
            <label class="block text-sm font-medium mb-1">State</label>
            <select
              :value="filters.state"
              @change="updateFilter('state', $event.target.value)"
              class="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="">— All States —</option>
              <option v-for="state in commonStates" :key="state" :value="state">
                {{ state }}
              </option>
            </select>
          </div>

          <!-- County Filter -->
          <div>
            <label class="block text-sm font-medium mb-1">County</label>
            <input
              :value="filters.county"
              @input="debouncedUpdateFilter('county', $event.target.value)"
              placeholder="County name"
              class="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
        </div>

        <!-- City Filter -->
        <div>
          <label class="block text-sm font-medium mb-1">City</label>
          <input
            :value="filters.city"
            @input="debouncedUpdateFilter('city', $event.target.value)"
            placeholder="City name"
            class="w-full border rounded px-2 py-1 text-sm"
          />
        </div>

        <!-- Date Range Filter -->
        <div>
          <label class="block text-sm font-medium">Date Range</label>
          <div class="grid grid-cols-2 gap-2 mt-1">
            <div>
              <label class="text-xs text-gray-500">Start Date</label>
              <input
                type="date"
                :value="filters.startDate"
                @input="updateFilter('startDate', $event.target.value)"
                class="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label class="text-xs text-gray-500">End Date</label>
              <input
                type="date"
                :value="filters.endDate"
                @input="updateFilter('endDate', $event.target.value)"
                class="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
          </div>
        </div>

        <!-- Quick Date Presets -->
        <div class="flex gap-1">
          <button
            @click="setDatePreset('today')"
            class="flex-1 px-2 py-1 text-xs border rounded hover:bg-gray-50"
          >
            Today
          </button>
          <button
            @click="setDatePreset('week')"
            class="flex-1 px-2 py-1 text-xs border rounded hover:bg-gray-50"
          >
            This Week
          </button>
          <button
            @click="setDatePreset('month')"
            class="flex-1 px-2 py-1 text-xs border rounded hover:bg-gray-50"
          >
            This Month
          </button>
          <button
            @click="setDatePreset('year')"
            class="flex-1 px-2 py-1 text-xs border rounded hover:bg-gray-50"
          >
            This Year
          </button>
        </div>

        <!-- Alert Type Filter -->
        <div>
          <label class="block text-sm font-medium">Alert Type</label>
          <select
            :value="filters.alertType"
            @change="updateFilter('alertType', $event.target.value)"
            class="mt-1 w-full border rounded px-2 py-1 text-sm"
          >
            <option value="">— Any Alert Type —</option>
            <option value="Alert">Alert</option>
            <option value="Update">Update</option>
            <option value="Cancel">Cancel</option>
            <option value="Ack">Acknowledgment</option>
            <option value="Error">Error</option>
          </select>
        </div>

        <!-- Event Type Filter -->
        <div>
          <label class="block text-sm font-medium">Event Type</label>
          <select
            :value="filters.event"
            @change="updateFilter('event', $event.target.value)"
            class="mt-1 w-full border rounded px-2 py-1 text-sm"
          >
            <option value="">— Any Event —</option>
            <option value="Hail">Hail</option>
            <option value="Tornado">Tornado</option>
            <option value="Flash Flood">Flash Flood</option>
            <option value="Severe Thunderstorm">Severe Thunderstorm</option>
            <option value="Winter Storm">Winter Storm</option>
            <option value="Hurricane">Hurricane</option>
            <option value="Earthquake">Earthquake</option>
            <option value="Tsunami">Tsunami</option>
            <option value="Fire">Fire</option>
          </select>
        </div>

        <!-- Results Limit -->
        <div>
          <label class="block text-sm font-medium">Max Results</label>
          <select
            :value="filters.top"
            @change="updateFilter('top', $event.target.value)"
            class="mt-1 w-full border rounded px-2 py-1 text-sm"
          >
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
          </select>
        </div>

        <!-- Control Buttons -->
        <div class="flex gap-2">
          <button
            @click="resetFilters"
            class="flex-1 px-4 py-2 border rounded hover:bg-gray-50 text-sm"
          >
            Reset Filters
          </button>
          <button
            @click="zoomToUs"
            class="flex-1 px-4 py-2 border rounded hover:bg-gray-50 text-sm"
          >
            Zoom to USA
          </button>
        </div>

        <!-- Results Info -->
        <div class="text-sm text-gray-600 p-2 bg-gray-50 rounded">
          <p><b>Displayed:</b> {{ currentAlerts.length }} alerts</p>
          <p><b>Total Available:</b> {{ metadata.count || 0 }}</p>
          <p v-if="lastUpdated" class="text-xs mt-1">
            Last updated: {{ lastUpdated }}
          </p>
          <p class="text-xs mt-2">Source: FEMA IPAWS Archived Alerts API</p>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="text-red-600 text-sm bg-red-50 p-2 rounded">
          <div class="flex items-center">
            <svg
              class="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            {{ error }}
          </div>
        </div>

        <!-- Alerts List -->
        <div v-if="currentAlerts.length > 0" class="mt-4">
          <h3 class="font-semibold text-lg mb-2">
            FEMA Alerts ({{ currentAlerts.length }})
          </h3>
          <div class="max-h-96 overflow-y-auto border rounded">
            <div
              v-for="(alert, idx) in currentAlerts"
              :key="alert.id || idx"
              class="p-3 border-b cursor-pointer hover:bg-blue-50 transition-colors"
              @click="highlightOnMap(alert)"
              :class="{ 'bg-blue-100': highlightedAlert === alert.id }"
            >
              <div class="flex justify-between items-start mb-1">
                <span class="font-semibold text-sm flex-1">{{
                  alert.LOCATION
                }}</span>
                <span
                  class="text-xs px-2 py-1 rounded-full ml-2"
                  :class="getAlertBadgeClass(alert.ALERT_TYPE)"
                >
                  {{ alert.ALERT_TYPE }}
                </span>
              </div>
              <div class="text-xs text-gray-600 space-y-1">
                <div class="flex justify-between">
                  <span
                    ><strong>Event:</strong> {{ alert.EVENT || "N/A" }}</span
                  >
                  <span v-if="alert.STATE"
                    ><strong>State:</strong> {{ alert.STATE }}</span
                  >
                </div>
                <div class="flex justify-between">
                  <span v-if="alert.CITY"
                    ><strong>City:</strong> {{ alert.CITY }}</span
                  >
                  <span v-if="alert.COUNTY"
                    ><strong>County:</strong>
                    {{ truncateText(alert.COUNTY, 15) }}</span
                  >
                </div>
                <div>
                  <strong>Date:</strong> {{ formatDate(alert.UTC_DATETIME) }}
                </div>
                <div
                  v-if="alert.REMARKS && alert.REMARKS !== 'FEMA Alert'"
                  class="text-xs text-gray-500 mt-1"
                >
                  {{ truncateText(alert.REMARKS, 60) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-else-if="!loading"
          class="text-gray-500 text-sm mt-4 p-4 text-center bg-gray-50 rounded"
        >
          <svg
            class="w-8 h-8 mx-auto mb-2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          No alerts found for current filters.
        </div>
      </aside>

      <!-- Map -->
      <main class="flex-1 flex justify-center items-center relative">
        <div id="fema-map" class="w-full h-screen rounded-xl shadow-md"></div>
        <div
          v-if="mapLoading"
          class="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10"
        >
          <div class="bg-white p-4 rounded-lg shadow-lg flex items-center">
            <svg
              class="animate-spin h-5 w-5 mr-3 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Updating map...</span>
          </div>
        </div>
      </main>
    </div>
  </client-only>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";

const { $L } = useNuxtApp();

// Refs
const mapRef = ref<any>(null);
const layerRef = ref<any>(null);
const currentAlerts = ref<any[]>([]);
const error = ref("");
const loading = ref(false);
const mapLoading = ref(false);
const metadata = ref({ count: 0 });
const lastUpdated = ref("");
const highlightedAlert = ref<string | null>(null);
let debounceTimer: NodeJS.Timeout | null = null;

// Common US states for dropdown
const commonStates = ref([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
]);

// Filters with default values
const filters = ref({
  search: "", // For addresses and ZIP codes only
  state: "", // 2-letter state code
  county: "", // County name
  city: "", // City name
  startDate: "",
  endDate: "",
  alertType: "",
  event: "",
  top: "100",
});

// Debounce function for performance
const debounce = (fn: Function, delay: number) => {
  return (...args: any[]) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), delay);
  };
};

// Utility functions
const truncateText = (text: string, maxLength: number) => {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
};

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getAlertBadgeClass = (alertType: string) => {
  const classes = {
    Alert: "bg-green-100 text-green-800",
    Update: "bg-blue-100 text-blue-800",
    Cancel: "bg-red-100 text-red-800",
    Ack: "bg-yellow-100 text-yellow-800",
    Error: "bg-gray-100 text-gray-800",
  };
  return (
    classes[alertType as keyof typeof classes] || "bg-gray-100 text-gray-800"
  );
};

// Date presets
const setDatePreset = (preset: string) => {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case "today":
      filters.value.startDate = today.toISOString().split("T")[0];
      filters.value.endDate = now.toISOString().split("T")[0];
      break;
    case "week":
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      filters.value.startDate = weekAgo.toISOString().split("T")[0];
      filters.value.endDate = now.toISOString().split("T")[0];
      break;
    case "month":
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      filters.value.startDate = monthAgo.toISOString().split("T")[0];
      filters.value.endDate = now.toISOString().split("T")[0];
      break;
    case "year":
      const yearAgo = new Date(today);
      yearAgo.setFullYear(today.getFullYear() - 1);
      filters.value.startDate = yearAgo.toISOString().split("T")[0];
      filters.value.endDate = now.toISOString().split("T")[0];
      break;
  }

  loadData();
};

// Optimized filter update
const updateFilter = (key: string, value: any) => {
  filters.value = { ...filters.value, [key]: value };
  loadData();
};

// Debounced version for text inputs
const debouncedUpdateFilter = debounce(updateFilter, 500);

// Load data with performance optimizations
const loadData = async () => {
  loading.value = true;
  error.value = "";
  highlightedAlert.value = null;

  try {
    // Build query parameters - only include non-empty values
    const query: any = {};
    Object.keys(filters.value).forEach((key) => {
      const value = (filters.value as any)[key];
      if (value !== "" && value !== null && value !== undefined) {
        query[key] = value;
      }
    });

    console.log("Loading data with query:", query);

    const { data, error: fetchError } = await useFetch("/api/fema-alerts", {
      query,
      key: `fema-alerts-${JSON.stringify(query)}`,
      server: false,
    });

    if (fetchError.value) {
      error.value = fetchError.value.message || "Failed to load data";
      currentAlerts.value = [];
      console.error("API Error:", fetchError.value);
    } else if (data.value) {
      console.log("Data loaded:", data.value.features?.length, "alerts");
      metadata.value = data.value.metadata || { count: 0 };
      currentAlerts.value = data.value.features || [];
      lastUpdated.value = new Date().toLocaleTimeString();

      if (data.value.error) {
        error.value = data.value.error;
      }

      updateMap();
    }
  } catch (err: any) {
    error.value = err.message || "An unexpected error occurred";
    currentAlerts.value = [];
    console.error("Load data error:", err);
  } finally {
    loading.value = false;
  }
};

// Highly optimized map update
const updateMap = () => {
  if (!layerRef.value || !mapRef.value) {
    console.log("Map not ready yet");
    return;
  }

  mapLoading.value = true;

  // Use requestAnimationFrame for smoother updates
  requestAnimationFrame(() => {
    try {
      layerRef.value.clearLayers();

      if (currentAlerts.value.length === 0) {
        mapLoading.value = false;
        return;
      }

      console.log("Updating map with", currentAlerts.value.length, "alerts");

      // Precompute bounds for single fitBounds call
      const bounds = new (window as any).L.LatLngBounds();
      const markers: any[] = [];

      // Batch marker creation
      currentAlerts.value.forEach((alert: any) => {
        const color = getAlertColor(alert.ALERT_TYPE, alert.EVENT);
        const latLng = [alert.LAT, alert.LNG];

        const marker = $L.circleMarker(latLng, {
          radius: 8,
          color: color,
          fillColor: color,
          weight: 2,
          opacity: 0.9,
          fillOpacity: 0.7,
        });

        marker.bindPopup(makePopupContent(alert));
        marker.addTo(layerRef.value);

        bounds.extend(latLng);
        markers.push(marker);
        alert._marker = marker;
      });

      // Single map update
      if (markers.length > 0) {
        mapRef.value.fitBounds(bounds.pad(0.1), {
          maxZoom: 12,
          animate: true,
          duration: 1,
        });
      }
    } catch (err) {
      console.error("Map update error:", err);
    } finally {
      mapLoading.value = false;
    }
  });
};

// Color coding function
const getAlertColor = (alertType: string, event: string) => {
  if (alertType === "Cancel") return "#6b7280";
  if (alertType === "Error") return "#dc2626";
  if (event === "Tornado") return "#dc2626";
  if (event === "Flash Flood") return "#2563eb";
  if (event === "Hail") return "#f59e0b";
  if (event === "Fire") return "#ea580c";
  if (event === "Hurricane") return "#9333ea";
  if (alertType === "Alert") return "#10b981";
  return "#6b7280";
};

// Create popup content
const makePopupContent = (alert: any) => {
  const sentDate = alert.SENT ? new Date(alert.SENT).toLocaleString() : "N/A";
  const expiresDate = alert.EXPIRES
    ? new Date(alert.EXPIRES).toLocaleString()
    : "N/A";

  let locationDetails = "";
  if (alert.CITY && alert.STATE) {
    locationDetails = `${alert.CITY}, ${alert.STATE}`;
  } else if (alert.COUNTY && alert.STATE) {
    locationDetails = `${alert.COUNTY}, ${alert.STATE}`;
  } else if (alert.STATE) {
    locationDetails = alert.STATE;
  } else {
    locationDetails = alert.LOCATION;
  }

  return `<div style="font-size:13px; max-width:300px">
    <div style="font-weight:bold; margin-bottom:8px; font-size:14px;">${locationDetails}</div>
    <div><b>Alert Type:</b> ${alert.ALERT_TYPE || "N/A"}</div>
    <div><b>Event:</b> ${alert.EVENT || "N/A"}</div>
    <div><b>Sent:</b> ${sentDate}</div>
    <div><b>Expires:</b> ${expiresDate}</div>
    <div style="margin-top:8px;"><b>Remarks:</b> ${
      alert.REMARKS || "No additional information"
    }</div>
    <div style="margin-top:8px; font-size:11px; color:#666;">Source: ${
      alert.SOURCE || "FEMA IPAWS"
    }</div>
  </div>`;
};

// Highlight alert on map
const highlightOnMap = (alert: any) => {
  highlightedAlert.value = alert.id;
  if (alert._marker && mapRef.value) {
    mapRef.value.setView(alert._marker.getLatLng(), 10, {
      animate: true,
      duration: 0.8,
    });
    setTimeout(() => {
      alert._marker.openPopup();
    }, 800);
  }
};

// Reset filters
const resetFilters = () => {
  filters.value = {
    search: "",
    state: "",
    county: "",
    city: "",
    startDate: "",
    endDate: "",
    alertType: "",
    event: "",
    top: "100",
  };
  loadData();
};

// Zoom to US view
const zoomToUs = () => {
  if (mapRef.value) {
    mapRef.value.setView([39.5, -98.35], 4, {
      animate: true,
      duration: 1,
    });
  }
};

// Initialize map
onMounted(() => {
  nextTick(() => {
    const mapContainer = document.getElementById("fema-map");
    if (!mapContainer) {
      console.error("FEMA Map container not found");
      return;
    }

    const L = $L;
    mapRef.value = L.map(mapContainer).setView([39.5, -98.35], 4);

    // ArcGIS basemap
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri &mdash; Esri, USGS, NOAA",
        maxZoom: 20,
      }
    ).addTo(mapRef.value);

    layerRef.value = L.featureGroup().addTo(mapRef.value);

    // Set default date to today if no dates set
    if (!filters.value.startDate && !filters.value.endDate) {
      const today = new Date().toISOString().split("T")[0];
      filters.value.startDate = today;
      filters.value.endDate = today;
    }

    // Load initial data
    loadData();
  });
});
</script>

<style scoped>
#fema-map {
  height: 100%;
  width: 100%;
}
.leaflet-container {
  background: #fff;
}
</style>
