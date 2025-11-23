<script setup>
import { ref, onMounted, watch, nextTick, computed } from "vue";
import Papa from "papaparse";

// Tabs
const tabs = ["Size", "Speed"];
const activeTab = ref("Size");
const viewMode = ref("map"); // Always map in this component

// Date selection - default to yesterday
const getYesterday = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
};
const selectedDate = ref(getYesterday());
const endDate = ref(getYesterday());
const useDateRange = ref(false);

// Data & state
const reports = ref({
  Size: [],
  Speed: [],
});
const loading = ref(true);
const error = ref(null);
const mapLoading = ref(false);

// Map refs
const mapViewDiv = ref(null);
let mapView = null;
let graphicsLayer = null;
let mapModules = null;
let isMapInitialized = ref(false);

const totalReports = computed(() => {
  return reports.value.Size.length + reports.value.Speed.length;
});

// Load ArcGIS modules
async function loadArcGISModules() {
  if (mapModules) return mapModules;

  return new Promise((resolve, reject) => {
    // Load CSS
    if (!document.querySelector('link[href*="arcgis.com"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://js.arcgis.com/4.27/esri/themes/light/main.css";
      document.head.appendChild(link);
    }

    // Load JS
    if (!window.require) {
      const script = document.createElement("script");
      script.src = "https://js.arcgis.com/4.27/";
      script.onload = () => loadModules(resolve, reject);
      script.onerror = reject;
      document.head.appendChild(script);
    } else {
      loadModules(resolve, reject);
    }
  });

  function loadModules(resolve, reject) {
    window.require(
      [
        "esri/Map",
        "esri/views/MapView",
        "esri/layers/GraphicsLayer",
        "esri/Graphic",
        "esri/geometry/Point",
        "esri/symbols/SimpleMarkerSymbol",
        "esri/PopupTemplate",
      ],
      (
        Map,
        MapView,
        GraphicsLayer,
        Graphic,
        Point,
        SimpleMarkerSymbol,
        PopupTemplate
      ) => {
        mapModules = {
          Map,
          MapView,
          GraphicsLayer,
          Graphic,
          Point,
          SimpleMarkerSymbol,
          PopupTemplate,
        };
        resolve(mapModules);
      },
      reject
    );
  }
}

// Date helpers
const formatDateForURL = (dateStr) => {
  const date = new Date(dateStr);
  const yy = date.getFullYear().toString().slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
};

const getDateRange = (start, end) => {
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);
  if (current > endDate) [current, endDate] = [endDate, current];
  while (current <= endDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const getURLs = (date) => {
  const formatted = formatDateForURL(date);
  return {
    Size: `https://www.spc.noaa.gov/climo/reports/${formatted}_rpts_hail.csv`,
    Speed: `https://www.spc.noaa.gov/climo/reports/${formatted}_rpts_wind.csv`,
  };
};

// Fetch CSV
async function fetchCSV(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const text = await res.text();
    return new Promise((resolve) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (result) => {
          const valid = result.data.filter((row) => row.Lat && row.Lon);
          resolve(valid);
        },
      });
    });
  } catch (err) {
    console.error("CSV fetch error:", err);
    return [];
  }
}

// Load all reports
async function loadReports() {
  loading.value = true;
  error.value = null;

  const dates = useDateRange.value
    ? getDateRange(selectedDate.value, endDate.value)
    : [selectedDate.value];

  const allSize = [];
  const allSpeed = [];

  const batchSize = 10;
  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize);
    const promises = batch.flatMap((date) => {
      const urls = getURLs(date);
      return [
        fetchCSV(urls.Size).then((data) => ({ type: "Size", data })),
        fetchCSV(urls.Speed).then((data) => ({ type: "Speed", data })),
      ];
    });

    const results = await Promise.all(promises);
    results.forEach(({ type, data }) => {
      if (type === "Size") allSize.push(...data);
      if (type === "Speed") allSpeed.push(...data);
    });
  }

  reports.value = { Size: allSize, Speed: allSpeed };

  if (totalReports.value === 0) {
    error.value = useDateRange.value
      ? "No hail/wind reports found in this date range"
      : "No hail/wind reports found for this date";
  }

  loading.value = false;
}

// Map lifecycle
// function destroyMap() {
//   if (mapView) {
//     mapView.destroy();
//     mapView = null;
//   }
//   graphicsLayer = null;
//   isMapInitialized.value = false; // This is critical!
// }

// async function initializeMap() {
//   if (isMapInitialized.value) return;

//   try {
//     mapLoading.value = true;
//     destroyMap();
//     await nextTick();

//     // Critical: Ensure container exists and has dimensions
//     if (
//       !mapViewDiv.value ||
//       mapViewDiv.value.offsetWidth === 0 ||
//       mapViewDiv.value.offsetHeight === 0
//     ) {
//       console.warn("Map container not ready yet");
//       return;
//     }

//     const modules = await loadArcGISModules();
//     const { Map, MapView, GraphicsLayer } = modules;

//     graphicsLayer = new GraphicsLayer();

//     const map = new Map({
//       basemap: "streets-navigation-vector",
//       layers: [graphicsLayer],
//     });

//     mapView = new MapView({
//       container: mapViewDiv.value,
//       map,
//       center: [-95, 37],
//       zoom: 4,
//       ui: { components: ["attribution", "zoom"] },
//     });

//     await mapView.when();
//     isMapInitialized.value = true;
//     await updateMapGraphics();
//   } catch (err) {
//     console.error("Map initialization failed:", err);
//     error.value = "Failed to initialize map";
//   } finally {
//     mapLoading.value = false;
//   }
// }

async function updateMapGraphics() {
  if (!graphicsLayer || !mapView || !mapModules || !isMapInitialized.value)
    return;

  mapLoading.value = true;
  const { Graphic, Point, SimpleMarkerSymbol, PopupTemplate } = mapModules;
  graphicsLayer.removeAll();

  const data = reports.value[activeTab.value];
  const isSize = activeTab.value === "Size";

  const graphics = data
    .filter((r) => r.Lat && r.Lon)
    .map((report) => {
      const point = new Point({
        longitude: parseFloat(report.Lon),
        latitude: parseFloat(report.Lat),
      });

      let value = isSize ? report.Size : report.Speed;
      if (value === undefined || value === null) return null;

      const size = isSize
        ? Math.min(Math.max(8, value * 5), 40) // Hail: 1" → 13px, 5" → 40px
        : Math.min(Math.max(8, value * 0.4), 36); // Wind: 50mph → 20px, 90mph → 36px

      const color = isSize
        ? [33, 150, 243, 0.9] // Blue
        : [34, 197, 94, 0.9]; // Green

      const symbol = new SimpleMarkerSymbol({
        style: "circle",
        size,
        color,
        outline: { color: [255, 255, 255, 0.9], width: 2.5 },
      });

      const popupContent = `
        <div style="padding:12px; min-width:220px; font-family:system-ui;">
          <div style="font-size:16px; font-weight:700; margin-bottom:8px; color:#1f2937;">
            ${isSize ? "Hail Size Report" : "Damaging Wind Report"}
          </div>
          <div style="font-size:13px; color:#4b5563; line-height:1.5;">
            <div><strong>Time (UTC):</strong> ${report.Time || "N/A"}</div>
            <div><strong>Location:</strong> ${report.Location || "N/A"}</div>
            <div><strong>County/State:</strong> ${report.County || ""} ${
        report.State || ""
      }</div>
            <div style="margin-top:8px; padding:8px; background:#f3f4f6; border-radius:6px; font-size:15px;">
              <strong style="color:${isSize ? "#2563eb" : "#16a34a"};">
                ${value} ${isSize ? "in hail" : "mph gust"}
              </strong>
            </div>
            <div style="margin-top:8px; font-size:11px; color:#9ca3af;">
              Lat: ${report.Lat.toFixed(4)}, Lon: ${report.Lon.toFixed(4)}
            </div>
          </div>
        </div>
      `;

      return new Graphic({
        geometry: point,
        symbol,
        attributes: report,
        popupTemplate: new PopupTemplate({ content: popupContent }),
      });
    })
    .filter(Boolean);

  if (graphics.length > 0) {
    graphicsLayer.addMany(graphics);
    mapView.goTo(graphics, { duration: 1200 });
  } else {
    mapView.goTo({ center: [-95, 37], zoom: 4 });
  }

  mapLoading.value = false;
}

// Format date for display
const formatDisplayDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

onMounted(() => {
  loadReports();
});

// WATCHERS — This is the key fix
watch(
  () => ({
    mode: viewMode.value,
    loading: loading.value,
    error: error.value,
    hasContainer: mapViewDiv.value?.offsetWidth > 0,
    totalReports: totalReports.value, // Add this to trigger on data changes
  }),
  async (current, previous) => {
    // Only initialize map when all conditions are met
    if (
      current.mode === "map" &&
      !current.loading &&
      !current.error &&
      current.hasContainer &&
      (!isMapInitialized.value || !previous?.hasContainer)
    ) {
      await nextTick();
      await initializeMap();
    }
  },
  { immediate: true, deep: true }
);

watch(loading, async (nowLoading, previousLoading) => {
  // Only trigger when transitioning from loading to not loading
  if (
    previousLoading &&
    !nowLoading &&
    !error.value &&
    viewMode.value === "map"
  ) {
    // If map exists, update it; otherwise initialize it
    if (isMapInitialized.value) {
      await updateMapGraphics();
    } else {
      await nextTick();
      await initializeMap();
    }
  }
});

// Add this new watcher for data changes when map is already initialized
watch(totalReports, async (newTotal, oldTotal) => {
  if (newTotal !== oldTotal && isMapInitialized.value && !loading.value) {
    await updateMapGraphics();
  }
});

watch([selectedDate, endDate, useDateRange], () => {
  loadReports();
});

watch(activeTab, () => {
  if (isMapInitialized.value) {
    updateMapGraphics();
  }
});

// Also improve the destroyMap function to be more thorough
function destroyMap() {
  if (mapView) {
    mapView.container = null;
    mapView.destroy();
    mapView = null;
  }
  graphicsLayer = null;
  isMapInitialized.value = false;
}

// And modify the initializeMap function to handle reinitialization better
async function initializeMap() {
  // If already initializing, wait for it to complete
  if (mapLoading.value) return;

  try {
    mapLoading.value = true;

    // Only destroy if truly initialized
    if (isMapInitialized.value && mapView) {
      destroyMap();
      await nextTick();
    }

    // Critical: Ensure container exists and has dimensions
    if (
      !mapViewDiv.value ||
      mapViewDiv.value.offsetWidth === 0 ||
      mapViewDiv.value.offsetHeight === 0
    ) {
      console.warn("Map container not ready yet");
      // Retry after a short delay
      setTimeout(() => {
        if (!isMapInitialized.value) initializeMap();
      }, 100);
      return;
    }

    const modules = await loadArcGISModules();
    const { Map, MapView, GraphicsLayer } = modules;

    graphicsLayer = new GraphicsLayer();

    const map = new Map({
      basemap: "streets-navigation-vector",
      layers: [graphicsLayer],
    });

    mapView = new MapView({
      container: mapViewDiv.value,
      map,
      center: [-95, 37],
      zoom: 4,
      ui: { components: ["attribution", "zoom"] },
    });

    // Add error handling for map view
    mapView
      .when(() => {
        isMapInitialized.value = true;
        updateMapGraphics();
      })
      .catch((err) => {
        console.error("Map view failed to initialize:", err);
        error.value = "Map failed to load";
        isMapInitialized.value = false;
      });
  } catch (err) {
    console.error("Map initialization failed:", err);
    error.value = "Failed to initialize map";
    isMapInitialized.value = false;
  } finally {
    mapLoading.value = false;
  }
}
</script>

<template>
  <section
    class="p-4 md:p-6 bg-gradient-to-br from-slate-50 to-emerald-50 min-h-screen"
  >
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div
        class="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-200"
      >
        <div class="flex flex-col lg:flex-row lg:justify-between gap-6">
          <div>
            <h1
              class="text-3xl font-bold text-emerald-900 flex items-center gap-3"
            >
              <span class="text-4xl">Hail & Wind Intensity Map</span>
            </h1>
            <p class="text-gray-600 mt-1">
              Size-scaled hail and wind speed reports from NOAA SPC
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-4">
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                id="range"
                v-model="useDateRange"
                class="w-5 h-5 text-emerald-600 rounded"
              />
              <label for="range" class="font-medium text-gray-700"
                >Date Range</label
              >
            </div>

            <div class="flex items-center gap-3">
              <input
                type="date"
                v-model="selectedDate"
                :max="
                  useDateRange
                    ? endDate
                    : new Date().toISOString().split('T')[0]
                "
                class="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
              <span v-if="useDateRange" class="text-gray-600 font-medium"
                >to</span
              >
              <input
                v-if="useDateRange"
                type="date"
                v-model="endDate"
                :min="selectedDate"
                class="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div class="bg-gray-100 rounded-lg p-1 flex">
              <button
                @click="activeTab = 'Size'"
                :class="
                  activeTab === 'Size'
                    ? 'bg-white text-emerald-700 shadow'
                    : 'text-gray-600'
                "
                class="px-5 py-2.5 rounded-md font-semibold text-sm transition"
              >
                Hail Size
              </button>
              <button
                @click="activeTab = 'Speed'"
                :class="
                  activeTab === 'Speed'
                    ? 'bg-white text-emerald-700 shadow'
                    : 'text-gray-600'
                "
                class="px-5 py-2.5 rounded-md font-semibold text-sm transition"
              >
                Wind Speed
              </button>
            </div>
          </div>
        </div>

        <div
          class="mt-5 pt-5 border-t border-gray-200 flex flex-wrap items-center gap-6 text-sm"
        >
          <div>
            <span class="text-gray-600">Period:</span>
            <span class="font-bold text-gray-900 ml-2">
              {{ formatDisplayDate(selectedDate) }}
              <template v-if="useDateRange">
                – {{ formatDisplayDate(endDate) }}</template
              >
            </span>
          </div>
          <div class="flex items-center gap-6">
            <div class="flex items-center gap-2">
              <div class="w-4 h-4 rounded-full bg-blue-500"></div>
              <span
                >Hail Reports:
                <strong class="text-blue-700">{{
                  reports.Size.length
                }}</strong></span
              >
            </div>
            <div class="flex items-center gap-2">
              <div class="w-4 h-4 rounded-full bg-green-500"></div>
              <span
                >Wind Reports:
                <strong class="text-green-700">{{
                  reports.Speed.length
                }}</strong></span
              >
            </div>
            <div>
              <strong>Total: {{ totalReports }}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading / Error -->
      <div v-if="loading" class="text-center py-20">
        <div
          class="inline-block animate-spin rounded-full h-14 w-14 border-b-4 border-emerald-600"
        ></div>
        <p class="mt-4 text-lg text-gray-700">Loading storm reports...</p>
      </div>

      <div
        v-else-if="error"
        class="text-center py-12 bg-amber-50 border border-amber-300 rounded-xl text-amber-800"
      >
        <div class="text-5xl mb-3">Warning</div>
        <p class="text-lg">{{ error }}</p>
      </div>

      <!-- Map -->
      <div
        v-else
        class="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 relative"
      >
        <div ref="mapViewDiv" style="height: 720px; width: 100%"></div>

        <div
          v-if="mapLoading"
          class="absolute inset-0 bg-white/90 flex items-center justify-center z-10"
        >
          <div class="text-center">
            <div
              class="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-600"
            ></div>
            <p class="mt-4 text-gray-700 font-medium">Updating markers...</p>
          </div>
        </div>

        <!-- Legend -->
        <div
          class="p-5 bg-gradient-to-r from-emerald-50 to-blue-50 border-t border-gray-200"
        >
          <div
            class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          >
            <div>
              <p class="font-bold text-gray-800 mb-2">
                Legend – Marker Size = Intensity
              </p>
              <div class="flex flex-wrap gap-6 text-sm">
                <div
                  class="flex items-center gap-3 bg-white px-4 py-2 rounded-lg shadow-sm"
                >
                  <div class="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>Hail Size (inches)</span>
                  <span class="text-gray-500 ml-2">• larger = bigger hail</span>
                </div>
                <div
                  class="flex items-center gap-3 bg-white px-4 py-2 rounded-lg shadow-sm"
                >
                  <div class="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Wind Gust (mph)</span>
                  <span class="text-gray-500 ml-2"
                    >• larger = stronger wind</span
                  >
                </div>
              </div>
            </div>
            <p class="text-xs text-gray-600">
              Click any marker for full details
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
