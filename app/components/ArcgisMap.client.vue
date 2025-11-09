<template>
  <div id="spcMap" class="w-full h-[90vh]"></div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";

onMounted(async () => {
  // ⛔ Important: disable Vue reactivity wrapping by using dynamic import outside any reactive ref
  const [Map, MapView, Graphic, GraphicsLayer] = await Promise.all([
    import("@arcgis/core/Map"),
    import("@arcgis/core/views/MapView"),
    import("@arcgis/core/Graphic"),
    import("@arcgis/core/layers/GraphicsLayer"),
  ]);

  // ✅ Access .default explicitly and keep all inside this function
  const map = new Map.default({ basemap: "streets-navigation-vector" });

  const view = new MapView.default({
    container: "spcMap",
    map,
    center: [-98.35, 39.5],
    zoom: 4,
  });

  const layer = new GraphicsLayer.default();
  map.add(layer);

  // Sample data (no reactive refs!)
  const reports = [
    { lat: 35.5, lon: -97.5, desc: "Hail 1.75 inches, Oklahoma City OK" },
    { lat: 38.5, lon: -90.2, desc: "Hail 2.0 inches, St. Louis MO" },
  ];

  reports.forEach((r) => {
    const graphic = new Graphic.default({
      geometry: {
        type: "point",
        longitude: r.lon,
        latitude: r.lat,
      },
      symbol: {
        type: "simple-marker",
        color: "orange",
        outline: { color: "white", width: 1 },
      },
      popupTemplate: { title: "Hail Report", content: r.desc },
    });
    layer.add(graphic);
  });
});
</script>

<style scoped>
#spcMap {
  height: 100%;
  width: 100%;
}
</style>
