<template>
  <client-only>
    <div class="min-h-screen flex flex-col md:flex-row">
      <!-- Sidebar / Filters -->
      <aside class="w-full md:w-96 p-4 bg-white shadow-md space-y-4">
        <h2 class="text-xl font-semibold">Hail Map Filters</h2>

        <div>
          <label class="block text-sm font-medium">State (2-letter code)</label>
          <input
            v-model="filters.state"
            placeholder="e.g. TX"
            class="mt-1 w-full border rounded px-2 py-1"
          />
        </div>

        <div>
          <label class="block text-sm font-medium">County (partial name)</label>
          <input
            v-model="filters.county"
            placeholder="e.g. Harris"
            class="mt-1 w-full border rounded px-2 py-1"
          />
        </div>

        <div>
          <label class="block text-sm font-medium"
            >Minimum Hail Size (inches)</label
          >
          <input
            type="number"
            step="0.01"
            v-model.number="filters.minSize"
            class="mt-1 w-full border rounded px-2 py-1"
          />
        </div>

        <div class="flex items-center gap-2">
          <input
            id="severe"
            type="checkbox"
            v-model="filters.onlySevere"
            class="w-4 h-4"
          />
          <label for="severe" class="text-sm">Only severe (≥ 1.75 in)</label>
        </div>

        <div>
          <label class="block text-sm font-medium">Date range</label>
          <div class="flex gap-2 mt-1">
            <input
              type="date"
              v-model="filters.startDate"
              class="w-1/2 border rounded px-2 py-1"
            />
            <input
              type="date"
              v-model="filters.endDate"
              class="w-1/2 border rounded px-2 py-1"
            />
          </div>
          <p class="text-xs text-gray-500 mt-1">
            Dates filter by report UTC datetime
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium">Hail Damage Category</label>
          <select
            v-model="filters.category"
            class="mt-1 w-full border rounded px-2 py-1"
          >
            <option value="">— Any —</option>
            <option value="property">Property Damage</option>
            <option value="vehicle">Vehicle Damage</option>
            <option value="crop">Crop Damage</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="economic">Economic Impact</option>
          </select>
          <p class="text-xs text-gray-500 mt-1">
            Category filters are mapped to sample data
          </p>
        </div>

        <div class="flex gap-2">
          <button @click="resetFilters" class="px-4 py-2 border rounded">
            Reset
          </button>
          <button @click="zoomToUs" class="px-4 py-2 border rounded">
            Zoom USA
          </button>
        </div>

        <div class="text-sm text-gray-600">
          <p><b>Results:</b> {{ currentEvents.length }} features</p>
          <p class="mt-2 text-xs">
            Source: Sample JSON (switch to NOAA API later)
          </p>
        </div>

        <div v-if="error" class="text-red-600 text-sm">{{ error }}</div>

        <!-- Sidebar List of Hail Events -->
        <div v-if="currentEvents.length" class="mt-4">
          <h3 class="font-semibold text-lg">Hail Events</h3>
          <ul class="max-h-64 overflow-y-auto border rounded p-2 space-y-1">
            <li
              v-for="(event, idx) in currentEvents"
              :key="idx"
              class="p-2 border rounded cursor-pointer hover:bg-gray-100"
              @click="highlightOnMap(event)"
            >
              <b>{{ event.LOCATION || "N/A" }}, {{ event.STATE }}</b
              ><br />
              Date: {{ new Date(event.UTC_DATETIME).toLocaleDateString()
              }}<br />
              Size: {{ event.HAIL_SIZE }} in
            </li>
          </ul>
        </div>
      </aside>

      <!-- Map -->
      <main class="flex-1 flex justify-center items-center">
        <div id="map" class="w-full h-screen rounded-xl shadow-md"></div>
      </main>
    </div>
  </client-only>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from "vue";

const { $L } = useNuxtApp();
let map: any = null;

const mapRef = ref<any>(null);
const layerRef = ref<any>(null);
const currentEvents = ref<any[]>([]);
const error = ref("");

const filters = ref({
  state: "",
  county: "",
  minSize: 0,
  onlySevere: false,
  startDate: "",
  endDate: "",
  category: "",
});

// Sample JSON data with LAT/LNG for map
const sampleData = [
  {
    LOCATION: "Oklahoma City",
    STATE: "OK",
    COUNTY: "Oklahoma",
    LAT: 35.4676,
    LNG: -97.5164,
    UTC_DATETIME: 1713408000000,
    HAIL_SIZE: 1.5,
    DAMAGE_PROPERTY: 0,
    DAMAGE_CROPS: 1000,
    REMARKS: "Minor roof damage",
  },
  {
    LOCATION: "Houston",
    STATE: "TX",
    COUNTY: "Harris",
    LAT: 29.7604,
    LNG: -95.3698,
    UTC_DATETIME: 1713494400000,
    HAIL_SIZE: 2.0,
    DAMAGE_PROPERTY: 500,
    DAMAGE_CROPS: 0,
    REMARKS: "Vehicle damage reported",
  },
  {
    LOCATION: "Dallas",
    STATE: "TX",
    COUNTY: "Dallas",
    LAT: 32.7767,
    LNG: -96.797,
    UTC_DATETIME: 1713580800000,
    HAIL_SIZE: 2.5,
    DAMAGE_PROPERTY: 1000,
    DAMAGE_CROPS: 200,
    REMARKS: "Severe roof damage",
  },
];

// Filter logic including date range
function filterData(data: any[]) {
  return data.filter((event) => {
    if (
      filters.value.state &&
      event.STATE.toUpperCase() !== filters.value.state.toUpperCase()
    )
      return false;
    if (
      filters.value.county &&
      !event.COUNTY.toUpperCase().includes(filters.value.county.toUpperCase())
    )
      return false;
    if (filters.value.minSize && event.HAIL_SIZE < filters.value.minSize)
      return false;
    if (filters.value.onlySevere && event.HAIL_SIZE < 1.75) return false;
    // Date range filter
    if (filters.value.startDate) {
      const startMs = new Date(filters.value.startDate).getTime();
      if (event.UTC_DATETIME < startMs) return false;
    }
    if (filters.value.endDate) {
      const endMs = new Date(filters.value.endDate).setHours(23, 59, 59, 999);
      if (event.UTC_DATETIME > endMs) return false;
    }
    // Category filter
    if (filters.value.category) {
      const cat = filters.value.category;
      if (
        cat === "property" &&
        (!event.DAMAGE_PROPERTY || event.DAMAGE_PROPERTY === 0)
      )
        return false;
      if (cat === "crop" && (!event.DAMAGE_CROPS || event.DAMAGE_CROPS === 0))
        return false;
      if (
        cat === "vehicle" &&
        !(event.REMARKS && /(VEHICLE|CAR|AUTOMOB)/i.test(event.REMARKS))
      )
        return false;
      if (
        cat === "infrastructure" &&
        !(event.REMARKS && /(ROAD|POWER|UTILITY|BRIDGE)/i.test(event.REMARKS))
      )
        return false;
      if (
        cat === "economic" &&
        (!event.DAMAGE_PROPERTY || event.DAMAGE_PROPERTY === 0) &&
        (!event.DAMAGE_CROPS || event.DAMAGE_CROPS === 0)
      )
        return false;
    }
    return true;
  });
}

// Popup content
function makePopupContent(event: any) {
  const dt = event.UTC_DATETIME
    ? new Date(event.UTC_DATETIME).toUTCString()
    : "N/A";
  const hail = event.HAIL_SIZE ?? "N/A";
  return `
    <div style="font-size:13px">
      <b>Location:</b> ${event.LOCATION || "N/A"} <br/>
      <b>State:</b> ${event.STATE || "N/A"} <br/>
      <b>County:</b> ${event.COUNTY || "N/A"} <br/>
      <b>Date (UTC):</b> ${dt} <br/>
      <b>Hail size:</b> ${hail} in <br/>
      <b>Property damage:</b> ${event.DAMAGE_PROPERTY || 0} <br/>
      <b>Crop damage:</b> ${event.DAMAGE_CROPS || 0} <br/>
      <b>Remarks:</b> ${event.REMARKS || "N/A"}
    </div>
  `;
}

// Apply filters and update map
function applyFilters() {
  const filtered = filterData(sampleData);
  currentEvents.value = filtered;

  if (!layerRef.value) return;

  layerRef.value.clearLayers();

  filtered.forEach((event) => {
    const marker = $L
      .circleMarker([event.LAT, event.LNG], {
        radius: Math.min(20, 4 + event.HAIL_SIZE * 4),
        fillOpacity: 0.8,
        weight: 1,
        color: "#1d4ed8",
        fillColor: "#3b82f6",
      })
      .addTo(layerRef.value);

    marker.bindPopup(makePopupContent(event));
    event._marker = marker;
  });

  if (filtered.length) {
    const group = $L.featureGroup(filtered.map((e) => e._marker));
    mapRef.value.fitBounds(group.getBounds(), { maxZoom: 8 });
  }
}

// Highlight map marker from sidebar click
function highlightOnMap(event: any) {
  if (event._marker) {
    mapRef.value.setView(event._marker.getLatLng(), 8);
    event._marker.openPopup();
  }
}

// Reset filters
function resetFilters() {
  filters.value = {
    state: "",
    county: "",
    minSize: 0,
    onlySevere: false,
    startDate: "",
    endDate: "",
    category: "",
  };
}

// Zoom to USA
function zoomToUs() {
  mapRef.value.setView([39.5, -98.35], 4);
}

// Watch filters for auto-update
watch(filters, applyFilters, { deep: true });

// Initialize map
onMounted(() => {
  nextTick(() => {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) {
      console.error("Map container not found");
      return;
    }

    const L = $L;

    mapRef.value = L.map(mapContainer).setView([39.5, -98.35], 4);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapRef.value);

    layerRef.value = L.featureGroup().addTo(mapRef.value);

    // Initial load
    filters.value.minSize = 1;
    applyFilters();
  });
});
</script>

<style scoped>
#map {
  height: 100%;
  width: 100%;
}
.leaflet-container {
  background: #fff;
}
</style>
