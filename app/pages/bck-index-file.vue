<template>
  <client-only>
    <div class="min-h-screen flex flex-col md:flex-row">
      <!-- Sidebar / Filters -->
      <aside class="w-full md:w-96 p-4 bg-white shadow-md space-y-4">
        <h2 class="text-xl font-semibold">Hail Map Filters</h2>
        <!-- Filters remain same as before -->
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
          <li
            v-for="(event, idx) in currentEvents"
            :key="idx"
            @click="showPropertyReport(event.LOCATION)"
            class="cursor-pointer hover:bg-gray-100 p-2 rounded border"
          >
            {{ event.LOCATION }}, {{ event.STATE }}
          </li>
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
              min="1955-01-01"
              :max="filters.endDate || today"
              class="w-1/2 border rounded px-2 py-1"
            />
            <input
              type="date"
              v-model="filters.endDate"
              :min="filters.startDate"
              max="2024-12-31"
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

        <!-- Sidebar List -->
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
const today = new Date().toISOString().split("T")[0];
const mapRef = ref<any>(null);
const layerRef = ref<any>(null);
const currentEvents = ref<any[]>([]);
const error = ref("");

const { data: apiData, error: apiError } = await useFetch("/api/hail-live");
const rawData = computed(() => apiData.value?.features || []);
const noaaData = computed(() => apiData.value?.noaa || { features: [] });

const { data: hist } = await useFetch("/api/hail-history");

const allData = computed(() => [
  ...(rawData.value || []),
  ...(hist.value?.features || []),
]);

error.value = apiError.value?.message || apiData.value?.error || "";

const filters = ref({
  state: "",
  county: "",
  minSize: 0,
  onlySevere: false,
  startDate: "",
  endDate: "",
  category: "",
});

// Sample JSON data

function filterData(data: any[]) {
  return data.filter((event) => {
    // State
    if (
      filters.value.state &&
      event.STATE !== filters.value.state.toUpperCase()
    )
      return false;

    // County
    if (
      filters.value.county &&
      !event.COUNTY?.toUpperCase().includes(filters.value.county.toUpperCase())
    )
      return false;

    // Size
    if (filters.value.minSize && event.HAIL_SIZE < filters.value.minSize)
      return false;
    if (filters.value.onlySevere && event.HAIL_SIZE < 1.75) return false;

    // Date Range
    const et = event.UTC_DATETIME;
    if (!et) return false;

    if (filters.value.startDate) {
      const start = new Date(filters.value.startDate);
      start.setHours(0, 0, 0, 0);
      if (et < start.getTime()) return false;
    }
    if (filters.value.endDate) {
      const end = new Date(filters.value.endDate);
      end.setHours(23, 59, 59, 999);
      if (et > end.getTime()) return false;
    }

    // Category (যদি চাও)
    if (filters.value.category === "property" && event.DAMAGE_PROPERTY === 0)
      return false;
    if (filters.value.category === "crop" && event.DAMAGE_CROPS === 0)
      return false;

    return true;
  });
}

function makePopupContent(event: any) {
  const dt = event.UTC_DATETIME
    ? new Date(event.UTC_DATETIME).toUTCString()
    : "N/A";
  const hail = event.HAIL_SIZE ?? "N/A";
  return `<div style="font-size:13px">
      <b>Location:</b> ${event.LOCATION || "N/A"} <br/>
      <b>State:</b> ${event.STATE || "N/A"} <br/>
      <b>County:</b> ${event.COUNTY || "N/A"} <br/>
      <b>Date (UTC):</b> ${dt} <br/>
      <b>Hail size:</b> ${hail} in <br/>
      <b>Property damage:</b> ${event.DAMAGE_PROPERTY || 0} <br/>
      <b>Crop damage:</b> ${event.DAMAGE_CROPS || 0} <br/>
      <b>Remarks:</b> ${event.REMARKS || "N/A"}
    </div>`;
}

function showPropertyReport(propertyId: string) {
  const event = currentEvents.value.find((e) => e.LOCATION === propertyId);
  if (event && event._marker) {
    // Center map on this marker
    mapRef.value.setView(event._marker.getLatLng(), 10);
    // Open the popup
    event._marker.openPopup();
  } else {
    console.warn("Property not found:", propertyId);
  }
}

function applyFilters() {
  const filtered = filterData(allData.value);
  currentEvents.value = filtered;

  if (!layerRef.value) return;
  layerRef.value.clearLayers();

  // মার্কার
  filtered.forEach((event) => {
    // মার্কার তৈরির জায়গায়:
    const isWarning = event.SOURCE === "NOAA Warning";
    const isHist = event.SOURCE === "SPC History";
    const color = isWarning ? "#dc2626" : isHist ? "#f97316" : "#2563eb";
    const fill = isWarning ? "#ef4444" : isHist ? "#fb923c" : "#3b82f6";

    const marker = $L
      .circleMarker([event.LAT, event.LNG], {
        radius: Math.min(30, 8 + event.HAIL_SIZE * 6),
        color,
        fillColor: fill,
        weight: isWarning ? 4 : isHist ? 2 : 2,
        opacity: 1,
        fillOpacity: 0.7,
      })
      .addTo(layerRef.value);

    marker.bindPopup(makePopupContent(event));
    event._marker = marker;
  });

  // NOAA Warning Polygon
  noaaData.value.features?.forEach((f: any) => {
    if (f.geometry) {
      $L.geoJSON(f.geometry, {
        style: {
          color: "#dc2626",
          weight: 4,
          fillOpacity: 0.15,
          dashArray: "10,10",
        },
      }).addTo(layerRef.value);
    }
  });

  // জুম
  if (filtered.length) {
    const group = $L.featureGroup(filtered.map((e) => e._marker));
    mapRef.value.fitBounds(group.getBounds().pad(0.3), { maxZoom: 10 });
  }
}

function highlightOnMap(event: any) {
  if (event._marker) {
    mapRef.value.setView(event._marker.getLatLng(), 8);
    event._marker.openPopup();
  }
}

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

function zoomToUs() {
  mapRef.value.setView([39.5, -98.35], 4);
}

watch([rawData, filters], applyFilters, { deep: true, immediate: true });

onMounted(() => {
  nextTick(() => {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) {
      console.error("Map container not found");
      return;
    }

    const L = $L;
    mapRef.value = L.map(mapContainer).setView([39.5, -98.35], 4);

    // ArcGIS basemap (World Topographic)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri &mdash; Esri, USGS, NOAA",
        maxZoom: 20,
      }
    ).addTo(mapRef.value);

    layerRef.value = L.featureGroup().addTo(mapRef.value);

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
