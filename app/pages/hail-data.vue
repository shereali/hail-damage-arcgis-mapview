<script setup>
import {
  ref,
  onMounted,
  watch,
  nextTick,
  computed,
  onBeforeUnmount,
} from "vue";
import Papa from "papaparse";

// Tabs
const tabs = ["Hail", "Tornado", "Wind"];
const activeTab = ref("Hail");
const viewMode = ref("table"); // 'table' or 'map'

// Date selection - default to yesterday
const getYesterday = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
};
const selectedDate = ref(getYesterday());
const endDate = ref(getYesterday());
const useDateRange = ref(false);

// Data stores
const reports = ref({
  Hail: [],
  Tornado: [],
  Wind: [],
});
const loading = ref(true);
const error = ref(null);
const mapLoading = ref(false);

// Map references
const mapViewDiv = ref(null);
let mapView = null;
let graphicsLayer = null;
let mapModules = null;
let isMapInitialized = ref(false);

// Computed total reports
const totalReports = computed(() => {
  return (
    reports.value.Hail.length +
    reports.value.Tornado.length +
    reports.value.Wind.length
  );
});

// Load ArcGIS modules
async function loadArcGISModules() {
  if (mapModules) return mapModules;

  return new Promise((resolve, reject) => {
    // Load ArcGIS CSS
    if (!document.querySelector('link[href*="arcgis.com"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://js.arcgis.com/4.27/esri/themes/light/main.css";
      document.head.appendChild(link);
    }

    // Load ArcGIS JS
    if (!window.require) {
      const script = document.createElement("script");
      script.src = "https://js.arcgis.com/4.27/";
      script.onload = () => {
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
      };
      script.onerror = reject;
      document.head.appendChild(script);
    } else {
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
  });
}

// Format date for NOAA URL (YYMMDD)
const formatDateForURL = (dateStr) => {
  const date = new Date(dateStr);
  const yy = date.getFullYear().toString().slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
};

// Generate date range
const getDateRange = (start, end) => {
  const dates = [];
  const startDate = new Date(start);
  const endDate = new Date(end);

  // Ensure start is before end
  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

// Generate URLs based on selected date
const getURLs = (date) => {
  const formattedDate = formatDateForURL(date);
  return {
    Hail: `https://www.spc.noaa.gov/climo/reports/${formattedDate}_rpts_hail.csv`,
    Tornado: `https://www.spc.noaa.gov/climo/reports/${formattedDate}_rpts_torn.csv`,
    Wind: `https://www.spc.noaa.gov/climo/reports/${formattedDate}_rpts_wind.csv`,
  };
};

// Fetch & parse CSV with better error handling
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
          // Filter out invalid entries
          const validData = result.data.filter((row) => row.Lat && row.Lon);
          resolve(validData);
        },
      });
    });
  } catch (err) {
    console.error("Error fetching CSV:", err);
    return [];
  }
}

// Load all reports
async function loadReports() {
  loading.value = true;
  error.value = null;

  let datesToFetch = [];

  if (useDateRange.value) {
    datesToFetch = getDateRange(selectedDate.value, endDate.value);
  } else {
    datesToFetch = [selectedDate.value];
  }

  // Fetch data for all dates with larger batches for speed
  const allHailData = [];
  const allTornadoData = [];
  const allWindData = [];

  // Process dates in batches of 10 for faster loading
  const batchSize = 10;
  for (let i = 0; i < datesToFetch.length; i += batchSize) {
    const batch = datesToFetch.slice(i, i + batchSize);

    const batchPromises = batch.flatMap((date) => {
      const urls = getURLs(date);
      return [
        fetchCSV(urls.Hail).then((data) => ({ type: "Hail", data })),
        fetchCSV(urls.Tornado).then((data) => ({ type: "Tornado", data })),
        fetchCSV(urls.Wind).then((data) => ({ type: "Wind", data })),
      ];
    });

    const batchResults = await Promise.all(batchPromises);

    batchResults.forEach(({ type, data }) => {
      if (type === "Hail") allHailData.push(...data);
      else if (type === "Tornado") allTornadoData.push(...data);
      else if (type === "Wind") allWindData.push(...data);
    });
  }

  reports.value = {
    Hail: allHailData,
    Tornado: allTornadoData,
    Wind: allWindData,
  };

  // Check if all reports are empty
  if (totalReports.value === 0) {
    error.value = useDateRange.value
      ? "No storm reports found for this date range"
      : "No storm reports found for this date";
  }

  loading.value = false;

  // Update map if in map view and initialized
  if (viewMode.value === "map" && isMapInitialized.value) {
    await updateMapGraphics();
  }
}

// Destroy map properly
function destroyMap() {
  if (mapView) {
    mapView.container = null;
    mapView.destroy();
    mapView = null;
  }
  graphicsLayer = null;
  isMapInitialized.value = false;
}

// Initialize ArcGIS Map
async function initializeMap() {
  try {
    mapLoading.value = true;

    // Destroy existing map completely
    destroyMap();

    // Wait for DOM to be ready
    await nextTick();

    if (!mapViewDiv.value) {
      throw new Error("Map container not found");
    }

    const modules = await loadArcGISModules();
    const { Map, MapView, GraphicsLayer } = modules;

    // Create graphics layer
    graphicsLayer = new GraphicsLayer();

    // Create map with lighter basemap
    const map = new Map({
      basemap: "streets-navigation-vector",
      layers: [graphicsLayer],
    });

    // Create map view
    mapView = new MapView({
      container: mapViewDiv.value,
      map: map,
      center: [-95, 37], // Center of US
      zoom: 4,
      popup: {
        dockEnabled: false,
        dockOptions: {
          buttonEnabled: false,
          breakpoint: false,
        },
        alignment: "top-center",
        collapseEnabled: false,
      },
      ui: {
        components: ["attribution", "zoom"],
      },
    });

    await mapView.when();
    isMapInitialized.value = true;
    mapLoading.value = false;

    // Load graphics after map is ready
    await updateMapGraphics();
  } catch (err) {
    console.error("Error initializing map:", err);
    error.value = "Failed to load map";
    mapLoading.value = false;
    isMapInitialized.value = false;
  }
}

// Update map graphics based on active tab
async function updateMapGraphics() {
  if (!graphicsLayer || !mapView || !mapModules || !isMapInitialized.value) {
    return;
  }

  mapLoading.value = true;
  const { Graphic, Point, SimpleMarkerSymbol, PopupTemplate } = mapModules;

  // Clear existing graphics
  graphicsLayer.removeAll();

  const currentReports = reports.value[activeTab.value];

  // Symbol colors and sizes based on report type
  const symbolConfig = {
    Hail: {
      color: [33, 150, 243, 0.85],
      outline: { color: [255, 255, 255], width: 2 },
    },
    Tornado: {
      color: [244, 67, 54, 0.85],
      outline: { color: [255, 255, 255], width: 2 },
    },
    Wind: {
      color: [76, 175, 80, 0.85],
      outline: { color: [255, 255, 255], width: 2 },
    },
  };

  // Batch add graphics for better performance
  const graphics = [];

  currentReports.forEach((report) => {
    if (report.Lat && report.Lon) {
      const point = new Point({
        longitude: parseFloat(report.Lon),
        latitude: parseFloat(report.Lat),
      });

      // Dynamic sizing
      let size = 10;
      if (activeTab.value === "Hail" && report.Size) {
        size = Math.min(Math.max(8, report.Size * 4), 24);
      } else if (activeTab.value === "Tornado") {
        size = 14;
      }

      const symbol = new SimpleMarkerSymbol({
        color: symbolConfig[activeTab.value].color,
        size: size,
        outline: symbolConfig[activeTab.value].outline,
        style: "circle",
      });

      // Create popup content with better formatting
      let popupContent = `
        <div style="padding: 12px; min-width: 200px;">
          <div style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
            <div style="font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">
              ${activeTab.value} Report
            </div>
          </div>
          <div style="margin-bottom: 8px; display: flex; align-items: start;">
            <span style="font-weight: 600; color: #6b7280; min-width: 70px; font-size: 13px;">Time:</span>
            <span style="color: #1f2937; font-size: 13px;">${
              report.Time || "N/A"
            }</span>
          </div>
          <div style="margin-bottom: 8px; display: flex; align-items: start;">
            <span style="font-weight: 600; color: #6b7280; min-width: 70px; font-size: 13px;">Location:</span>
            <span style="color: #1f2937; font-size: 13px;">${
              report.Location || "N/A"
            }</span>
          </div>
          <div style="margin-bottom: 8px; display: flex; align-items: start;">
            <span style="font-weight: 600; color: #6b7280; min-width: 70px; font-size: 13px;">County:</span>
            <span style="color: #1f2937; font-size: 13px;">${
              report.County || "N/A"
            }, ${report.State || "N/A"}</span>
          </div>
      `;

      if (activeTab.value === "Hail" && report.Size) {
        popupContent += `
          <div style="margin-bottom: 8px; display: flex; align-items: start;">
            <span style="font-weight: 600; color: #6b7280; min-width: 70px; font-size: 13px;">Size:</span>
            <span style="color: #2563eb; font-weight: 600; font-size: 14px;">${report.Size} inches</span>
          </div>`;
      } else if (activeTab.value === "Wind" && report.Speed) {
        popupContent += `
          <div style="margin-bottom: 8px; display: flex; align-items: start;">
            <span style="font-weight: 600; color: #6b7280; min-width: 70px; font-size: 13px;">Speed:</span>
            <span style="color: #16a34a; font-weight: 600; font-size: 14px;">${report.Speed} mph</span>
          </div>`;
      } else if (activeTab.value === "Tornado" && report.F_Scale) {
        popupContent += `
          <div style="margin-bottom: 8px; display: flex; align-items: start;">
            <span style="font-weight: 600; color: #6b7280; min-width: 70px; font-size: 13px;">F-Scale:</span>
            <span style="color: #dc2626; font-weight: 600; font-size: 14px;">${report.F_Scale}</span>
          </div>`;
      }

      popupContent += `
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af;">
            Lat: ${report.Lat}, Lon: ${report.Lon}
          </div>
        </div>`;

      const popupTemplate = new PopupTemplate({
        title: null,
        content: popupContent,
        outFields: ["*"],
      });

      const graphic = new Graphic({
        geometry: point,
        symbol: symbol,
        attributes: report,
        popupTemplate: popupTemplate,
      });

      graphics.push(graphic);
    }
  });

  // Add all graphics at once for better performance
  if (graphics.length > 0) {
    graphicsLayer.addMany(graphics);

    // Zoom to graphics extent
    try {
      await mapView.goTo(graphics, {
        duration: 1000,
        easing: "ease-in-out",
      });
    } catch (e) {
      console.log("Zoom animation interrupted");
    }
  } else {
    // Reset to default view if no graphics
    mapView.goTo({ center: [-95, 37], zoom: 4 });
  }

  mapLoading.value = false;
}

// Format date for display
const formatDisplayDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Switch view mode
const switchViewMode = async (mode) => {
  viewMode.value = mode;
  if (mode === "map") {
    await nextTick();
    // Always reinitialize map when switching to map view
    await initializeMap();
  }
};

// Load reports on mount
onMounted(() => {
  loadReports();
});

// Cleanup on unmount
onBeforeUnmount(() => {
  destroyMap();
});

// Watch for date changes and reload
watch([selectedDate, endDate, useDateRange], async () => {
  await loadReports();
  // Reinitialize map if in map view
  if (viewMode.value === "map") {
    await initializeMap();
  }
});

// Watch for tab changes and update map
watch(activeTab, () => {
  if (viewMode.value === "map" && isMapInitialized.value) {
    updateMapGraphics();
  }
});
</script>

<template>
  <section
    class="p-4 md:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen"
  >
    <div class="max-w-7xl mx-auto">
      <!-- Inline Header -->
      <div
        class="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6 border border-gray-200"
      >
        <div
          class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        >
          <!-- Title Section -->
          <div class="flex-shrink-0">
            <h1
              class="text-2xl md:text-3xl font-bold text-indigo-900 flex items-center gap-2"
            >
              <span class="text-3xl">🌪️</span>
              <span>NOAA Storm Reports</span>
            </h1>
            <p class="text-sm text-gray-600 mt-1">
              Real-time severe weather visualization
            </p>
          </div>

          <!-- Controls Section -->
          <div
            class="flex flex-col sm:flex-row gap-3 lg:gap-4 items-stretch sm:items-center"
          >
            <!-- Date Range Toggle -->
            <div
              class="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
            >
              <input
                type="checkbox"
                id="dateRangeToggle"
                v-model="useDateRange"
                class="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <label
                for="dateRangeToggle"
                class="text-sm font-medium text-gray-700 cursor-pointer select-none"
              >
                Date Range
              </label>
            </div>

            <!-- Date Picker(s) -->
            <div class="flex gap-2 items-center">
              <input
                type="date"
                v-model="selectedDate"
                :max="
                  useDateRange
                    ? endDate
                    : new Date().toISOString().split('T')[0]
                "
                class="flex-1 sm:w-auto px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm font-medium"
                :placeholder="useDateRange ? 'Start Date' : 'Date'"
              />
              <template v-if="useDateRange">
                <span class="text-gray-500 font-medium">to</span>
                <input
                  type="date"
                  v-model="endDate"
                  :min="selectedDate"
                  :max="new Date().toISOString().split('T')[0]"
                  class="flex-1 sm:w-auto px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm font-medium"
                  placeholder="End Date"
                />
              </template>
            </div>

            <!-- View Mode Toggle -->
            <div class="bg-gray-100 rounded-lg p-1 inline-flex flex-shrink-0">
              <button
                @click="switchViewMode('table')"
                class="px-4 py-2 rounded-md font-medium text-sm transition-all duration-200"
                :class="
                  viewMode === 'table'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                "
              >
                📊 Table
              </button>
              <button
                @click="switchViewMode('map')"
                class="px-4 py-2 rounded-md font-medium text-sm transition-all duration-200"
                :class="
                  viewMode === 'map'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                "
              >
                🗺️ Map
              </button>
            </div>

            <!-- Tabs -->
            <div class="bg-gray-100 rounded-lg p-1 inline-flex flex-shrink-0">
              <button
                v-for="tab in tabs"
                :key="tab"
                @click="activeTab = tab"
                class="px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 whitespace-nowrap"
                :class="
                  activeTab === tab
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                "
              >
                {{ tab }}
              </button>
            </div>
          </div>
        </div>

        <!-- Stats Bar -->
        <div class="mt-4 pt-4 border-t border-gray-200">
          <div class="flex flex-wrap items-center gap-4 md:gap-6">
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-600">
                {{ useDateRange ? "Date Range:" : "Selected Date:" }}
              </span>
              <span class="text-sm font-semibold text-gray-900">
                {{ formatDisplayDate(selectedDate) }}
                <template v-if="useDateRange">
                  - {{ formatDisplayDate(endDate) }}
                </template>
              </span>
            </div>
            <div class="h-4 w-px bg-gray-300 hidden sm:block"></div>
            <div class="flex items-center gap-2">
              <div
                class="w-3 h-3 rounded-full"
                :class="{
                  'bg-blue-500': activeTab === 'Hail',
                  'bg-red-500': activeTab === 'Tornado',
                  'bg-green-500': activeTab === 'Wind',
                }"
              ></div>
              <span class="text-sm text-gray-600"
                >{{ activeTab }} Reports:</span
              >
              <span
                class="text-lg font-bold"
                :class="{
                  'text-blue-600': activeTab === 'Hail',
                  'text-red-600': activeTab === 'Tornado',
                  'text-green-600': activeTab === 'Wind',
                }"
              >
                {{ reports[activeTab].length }}
              </span>
            </div>
            <div class="h-4 w-px bg-gray-300 hidden sm:block"></div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-600">Total Reports:</span>
              <span class="text-lg font-bold text-indigo-900">{{
                totalReports
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading/Error -->
      <div v-if="loading" class="text-center py-12">
        <div
          class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"
        ></div>
        <p class="mt-4 text-gray-600 font-medium">Loading storm data...</p>
      </div>

      <div
        v-else-if="error"
        class="text-center bg-amber-50 border border-amber-200 text-amber-700 py-6 px-8 rounded-xl max-w-md mx-auto"
      >
        <div class="text-4xl mb-2">⚠️</div>
        {{ error }}
      </div>

      <!-- Map View -->
      <div
        v-if="viewMode === 'map' && !loading && !error"
        class="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200"
      >
        <div class="relative">
          <div ref="mapViewDiv" style="height: 650px; width: 100%"></div>
          <div
            v-if="mapLoading"
            class="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10"
          >
            <div class="text-center">
              <div
                class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"
              ></div>
              <p class="mt-4 text-gray-600 font-medium">Updating map...</p>
            </div>
          </div>
        </div>
        <div
          class="p-5 bg-gradient-to-r from-indigo-50 to-blue-50 border-t border-gray-200"
        >
          <div
            class="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div>
              <p class="font-semibold text-gray-800 mb-2">🎨 Legend</p>
              <div class="flex flex-wrap gap-3">
                <div
                  v-if="activeTab === 'Hail'"
                  class="flex items-center bg-white rounded-lg px-3 py-2 shadow-sm"
                >
                  <div class="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                  <span class="text-sm text-gray-700">Hail (size varies)</span>
                </div>
                <div
                  v-if="activeTab === 'Tornado'"
                  class="flex items-center bg-white rounded-lg px-3 py-2 shadow-sm"
                >
                  <div class="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                  <span class="text-sm text-gray-700">Tornado</span>
                </div>
                <div
                  v-if="activeTab === 'Wind'"
                  class="flex items-center bg-white rounded-lg px-3 py-2 shadow-sm"
                >
                  <div class="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                  <span class="text-sm text-gray-700">Wind</span>
                </div>
              </div>
            </div>
            <p class="text-xs text-gray-500">💡 Click markers for details</p>
          </div>
        </div>
      </div>

      <!-- Table View -->
      <div
        v-if="
          viewMode === 'table' &&
          !loading &&
          !error &&
          reports[activeTab].length > 0
        "
        class="overflow-hidden rounded-2xl shadow-xl border border-gray-200"
      >
        <div class="overflow-x-auto">
          <table class="min-w-full bg-white">
            <thead
              class="bg-gradient-to-r from-indigo-600 to-blue-600 text-white"
            >
              <tr>
                <th class="p-4 text-left font-semibold text-sm">Time (UTC)</th>
                <th
                  v-if="activeTab === 'Hail'"
                  class="p-4 text-left font-semibold text-sm"
                >
                  Size (in)
                </th>
                <th
                  v-if="activeTab === 'Wind'"
                  class="p-4 text-left font-semibold text-sm"
                >
                  Speed (mph)
                </th>
                <th
                  v-if="activeTab === 'Tornado'"
                  class="p-4 text-left font-semibold text-sm"
                >
                  F-Scale
                </th>
                <th class="p-4 text-left font-semibold text-sm">Location</th>
                <th class="p-4 text-left font-semibold text-sm">County</th>
                <th class="p-4 text-left font-semibold text-sm">State</th>
                <th class="p-4 text-left font-semibold text-sm">Lat</th>
                <th class="p-4 text-left font-semibold text-sm">Lon</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in reports[activeTab]"
                :key="i"
                class="border-b border-gray-200 hover:bg-indigo-50 transition-colors"
              >
                <td class="p-3 text-sm">{{ r.Time }}</td>
                <td
                  v-if="activeTab === 'Hail'"
                  class="p-3 text-sm font-semibold text-blue-600"
                >
                  {{ r.Size }}
                </td>
                <td
                  v-if="activeTab === 'Wind'"
                  class="p-3 text-sm font-semibold text-green-600"
                >
                  {{ r.Speed }}
                </td>
                <td
                  v-if="activeTab === 'Tornado'"
                  class="p-3 text-sm font-semibold text-red-600"
                >
                  {{ r.F_Scale }}
                </td>
                <td class="p-3 text-sm">{{ r.Location }}</td>
                <td class="p-3 text-sm">{{ r.County }}</td>
                <td class="p-3 text-sm">{{ r.State }}</td>
                <td class="p-3 text-sm text-gray-500">{{ r.Lat }}</td>
                <td class="p-3 text-sm text-gray-500">{{ r.Lon }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>
