<!-- components/SizeWindMap.vue -->
<template>
  <client-only>
    <div class="min-h-screen flex flex-col md:flex-row">
      <!-- Sidebar -->
      <aside
        class="w-full md:w-96 bg-white/80 backdrop-blur-md border-r border-indigo-100 p-6 space-y-8 shadow-2xl overflow-y-auto"
      >
        <div class="text-center">
          <h1 class="text-xl font-extrabold text-indigo-900 tracking-tight">
            USA Size & Wind Speed Map
          </h1>
          <p class="text-sm text-gray-600">1955–2024 • NOAA Storm Events</p>
        </div>

        <!-- Search -->
        <section
          class="bg-gradient-to-br from-indigo-50 to-blue-100 rounded-2xl shadow-md p-5"
        >
          <label
            class="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3"
          >
            Search USA Address
          </label>
          <div class="space-y-3">
            <input
              v-model="address"
              @keyup.enter="searchAndFilter"
              placeholder="City, ZIP, or address"
              class="w-full px-4 py-1.5 border-2 border-indigo-200 rounded-md focus:ring-2 focus:ring-indigo-400 outline-none"
            />
            <button
              @click="searchAndFilter"
              :disabled="loading"
              class="w-full bg-indigo-600 text-white py-1.5 rounded-md font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {{ loading ? "Searching..." : "Search USA Data" }}
            </button>
          </div>
        </section>

        <!-- Filters -->
        <section
          class="bg-gradient-to-br from-white to-indigo-50 rounded-2xl shadow-md p-5 space-y-6"
        >
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
                <span class="w-12 text-center">{{ filters.minYear }}</span>
              </div>
              <div class="flex items-center gap-3">
                <input
                  type="range"
                  min="1955"
                  max="2024"
                  v-model.number="filters.maxYear"
                  class="flex-1 accent-indigo-600"
                />
                <span class="w-12 text-center">{{ filters.maxYear }}</span>
              </div>
            </div>
          </div>

          <div>
            <label class="block font-semibold text-gray-800 mb-2"
              >Min Size (inches)</label
            >
            <input
              v-model.number="filters.minSize"
              type="number"
              step="0.25"
              min="0"
              class="w-full border border-gray-300 rounded-md px-4 py-1.5"
            />
          </div>

          <div>
            <label class="block font-semibold text-gray-800 mb-2"
              >Min Wind Speed (kts)</label
            >
            <input
              v-model.number="filters.minWind"
              type="number"
              step="5"
              min="0"
              class="w-full border border-gray-300 rounded-md px-4 py-1.5"
            />
          </div>

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
              <span class="text-sm font-medium w-16 text-center"
                >{{ searchRadiusMiles }} mi</span
              >
            </div>
          </div>
        </section>

        <div class="flex flex-col sm:flex-row gap-3">
          <button
            @click="loadDataWithFilters"
            :disabled="loading"
            class="flex-1 bg-green-600 text-white py-1.5 rounded-md font-semibold"
          >
            Apply Filters & Load
          </button>
          <button
            @click="reset"
            class="flex-1 border-2 border-red-500 text-red-600 py-1.5 rounded-md font-semibold"
          >
            Reset
          </button>
        </div>

        <div
          v-if="features.length"
          class="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 text-center"
        >
          <p class="text-2xl font-bold text-indigo-900">
            {{ filtered.length.toLocaleString() }}
          </p>
          <p class="text-sm text-gray-700">events shown</p>
        </div>

        <button
          @click="toggleBasemap"
          class="w-full bg-indigo-500 text-white py-1.5 rounded-md font-medium"
        >
          {{ basemap === "satellite" ? "Terrain" : "Satellite" }} View
        </button>
      </aside>

      <!-- Map -->
      <main class="flex-1 relative">
        <div id="map" class="w-full h-screen"></div>

        <div
          v-if="searchResult"
          class="absolute top-4 left-4 bg-white/95 backdrop-blur-lg p-5 rounded-2xl shadow-2xl z-10 max-w-sm border-2 border-indigo-200"
        >
          <div class="flex items-center gap-2">
            <span class="text-red-500">Pin</span>
            <p class="font-bold text-indigo-900 text-lg">
              {{ searchResult.address }}
            </p>
          </div>
          <p class="text-sm text-green-600 mt-1">
            {{ filtered.length }} events within {{ searchRadiusMiles }} miles
          </p>
        </div>

        <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <button
            v-if="hasMore && !loading"
            @click="loadMore"
            class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-full font-bold shadow-2xl hover:scale-105 transition"
          >
            Load More ({{ total - loaded }} left)
          </button>
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
const searchRadiusMiles = ref(25);

const filters = ref({
  minYear: 1955,
  maxYear: 2024,
  minSize: 0,
  minWind: 0,
});

const basemap = ref<"terrain" | "satellite">("terrain");
const loading = ref(false);
const total = ref(0);
const loaded = ref(0);
const hasMore = ref(false);
const nextStart = ref(0);

let view: any = null;
let graphicsLayer: any = null;
let Point: any = null;
let Graphic: any = null;

const features = ref<any[]>([]);
const filtered = ref<any[]>([]);

// Fixed: added missing semicolon
const fetchData = async (
  lat: number | null = null,
  lon: number | null = null,
  start = 0,
  limit = 10000
) => {
  const params = new URLSearchParams({
    minYear: filters.value.minYear.toString(),
    maxYear: filters.value.maxYear.toString(),
    minSize: filters.value.minSize.toString(),
    minWind: filters.value.minWind.toString(),
    country: "US",
    start: start.toString(),
    limit: limit.toString(),
  });

  if (lat && lon) {
    params.append("lat", lat.toString());
    params.append("lon", lon.toString());
    params.append(
      "radius",
      Math.round(searchRadiusMiles.value * 1.60934).toString()
    );
  }

  const res = await fetch(`/api/sizewind?${params}`); // <-- semicolon added
  const json = await res.json();

  if (json.error) throw new Error(json.error);

  return {
    features: json.features || [],
    total: json.total || 0,
    hasMore: json.hasMore || false,
  };
};

const loadDataWithFilters = async () => {
  loading.value = true;
  features.value = [];
  filtered.value = [];
  loaded.value = 0;
  total.value = 0;
  hasMore.value = false;
  nextStart.value = 0;
  graphicsLayer?.removeAll();

  const {
    features: f,
    total: t,
    hasMore: m,
  } = await fetchData(
    searchLocation.value?.latitude || null,
    searchLocation.value?.longitude || null
  );

  features.value = f;
  filtered.value = f;
  total.value = t;
  loaded.value = f.length;
  hasMore.value = m;
  nextStart.value = loaded.value;

  renderMap();
  loading.value = false;
};

const loadMore = async () => {
  if (loading.value || !hasMore.value) return;
  loading.value = true;
  const { features: f, hasMore: m } = await fetchData(
    searchLocation.value?.latitude || null,
    searchLocation.value?.longitude || null,
    nextStart.value
  );
  features.value.push(...f);
  filtered.value = features.value;
  loaded.value += f.length;
  hasMore.value = m;
  nextStart.value = loaded.value;
  renderMap();
  loading.value = false;
};

const renderMap = () => {
  if (!graphicsLayer || !view) return;
  graphicsLayer.removeAll();
  if (clickHandler) {
    clickHandler.remove();
    clickHandler = null;
  }

  if (searchLocation.value) {
    const pt = new Point({
      latitude: searchLocation.value.latitude,
      longitude: searchLocation.value.longitude,
    });
    graphicsLayer.add(
      new Graphic({
        geometry: pt,
        symbol: {
          type: "simple-marker",
          color: [255, 69, 58, 0.9],
          size: 16,
          outline: { color: [255, 255, 255], width: 3 },
        },
      })
    );

    const circle = new Graphic({
      geometry: {
        type: "polygon",
        rings: createCircleRing(
          searchLocation.value.longitude,
          searchLocation.value.latitude,
          searchRadiusMiles.value * 1609.34
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

  filtered.value.forEach((f) => {
    if (f.size != null && f.size >= filters.value.minSize) {
      graphicsLayer.add(
        new Graphic({
          geometry: new Point({ latitude: f.lat, longitude: f.lon }),
          symbol: {
            type: "simple-marker",
            style: "circle",
            color: [0, 128, 255, 0.9],
            size: Math.max(10, f.size * 6),
            outline: { color: [255, 255, 255, 0.9], width: 2 },
          },
          popupTemplate: {
            title: `Size ${f.size}"`,
            content: `Date: ${f.year}-${String(f.month).padStart(
              2,
              "0"
            )}-${String(f.day).padStart(2, "0")}`,
          },
        })
      );
    }
    if (f.wind != null && f.wind >= filters.value.minWind) {
      graphicsLayer.add(
        new Graphic({
          geometry: new Point({ latitude: f.lat, longitude: f.lon }),
          symbol: {
            type: "simple-marker",
            style: "triangle",
            color: [255, 140, 0, 0.9],
            size: Math.max(12, f.wind / 3),
            outline: { color: [255, 255, 255, 0.9], width: 2 },
          },
          popupTemplate: {
            title: `Wind ${f.wind} kts`,
            content: `Date: ${f.year}-${String(f.month).padStart(
              2,
              "0"
            )}-${String(f.day).padStart(2, "0")}`,
          },
        })
      );
    }
  });

  clickHandler = view.on("click", (e: any) => {
    view.hitTest(e).then((r: any) => {
      const hit = r.results.find((x: any) => x.graphic.layer === graphicsLayer);
      if (hit)
        view.popup.open({
          features: [hit.graphic],
          location: hit.graphic.geometry,
        });
      else view.popup.close();
    });
  });

  if (filtered.value.length && searchLocation.value) {
    view.goTo({
      target: filtered.value.map((f) => [f.lon, f.lat]),
      padding: 100,
    });
  }
};

const createCircleRing = (lon: number, lat: number, radiusM: number) => {
  const rings: number[][] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (((i * 360) / 64) * Math.PI) / 180;
    const dx = radiusM * Math.cos(a);
    const dy = radiusM * Math.sin(a);
    rings.push([
      lon + dx / (111111 * Math.cos((lat * Math.PI) / 180)),
      lat + dy / 111111,
    ]);
  }
  return [rings];
};

const searchAndFilter = async () => {
  if (!address.value.trim()) return;
  loading.value = true;
  searchLocation.value = null;
  searchResult.value = null;
  features.value = [];
  filtered.value = [];

  try {
    const [locator] = await (window as any).loadModules(["esri/rest/locator"]);
    const res = await locator.addressToLocations(
      "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer",
      {
        address: { SingleLine: address.value },
        countryCode: "USA",
        maxLocations: 1,
      }
    );
    if (res?.length) {
      const l = res[0].location;
      searchLocation.value = { latitude: l.y, longitude: l.x };
      searchResult.value = { address: res[0].address || address.value };
      await loadDataWithFilters();
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const reset = () => {
  address.value = "";
  searchResult.value = null;
  searchLocation.value = null;
  searchRadiusMiles.value = 25;
  filters.value = { minYear: 1955, maxYear: 2024, minSize: 0, minWind: 0 };
  features.value = [];
  filtered.value = [];
  graphicsLayer?.removeAll();
};

const toggleBasemap = () => {
  basemap.value = basemap.value === "satellite" ? "terrain" : "satellite";
  view.map.basemap = basemap.value;
};

watch(
  () => [
    filters.value.minYear,
    filters.value.maxYear,
    filters.value.minSize,
    filters.value.minWind,
  ],
  () => {
    if (features.value.length) {
      filtered.value = features.value.filter(
        (f) =>
          f.year >= filters.value.minYear &&
          f.year <= filters.value.maxYear &&
          (f.size ?? 0) >= filters.value.minSize &&
          (f.wind ?? 0) >= filters.value.minWind
      );
      renderMap();
    }
  }
);

watch(searchRadiusMiles, () => {
  if (searchLocation.value) loadDataWithFilters();
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

  Point = P;
  Graphic = G;

  const map = new Map({ basemap: "terrain" });
  view = new MapView({ container: "map", map, center: [-98.5, 39.5], zoom: 4 });
  graphicsLayer = new GraphicsLayer();
  map.add(graphicsLayer);

  await view.when();
  view.ui.remove("attribution");
  view.ui.remove("zoom");
});
</script>

<style scoped>
:deep(.esri-popup__main-container) {
  max-width: 340px !important;
  border-radius: 16px !important;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3) !important;
}
:deep(.esri-popup__header) {
  background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
  color: white !important;
}
</style>
