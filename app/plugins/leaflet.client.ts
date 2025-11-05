// plugins/leaflet.client.ts
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default defineNuxtPlugin(() => {
  return {
    provide: {
      L,
    },
  };
});
