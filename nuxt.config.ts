// nuxt.config.ts
import { defineNuxtConfig } from "nuxt/config";
import { resolve } from "path";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  // -------------------------------------------------
  // 1. Modules
  // -------------------------------------------------
  modules: ["@nuxtjs/tailwindcss"],

  // -------------------------------------------------
  // 2. CSS – ONLY the Calcite CSS (loaded from CDN)
  // -------------------------------------------------
  css: [], // we **do not** import ArcGIS CSS here

  // -------------------------------------------------
  // 3. <head> – Calcite components CSS (CDN)
  // -------------------------------------------------
  app: {
    head: {
      link: [
        {
          rel: "stylesheet",
          href: "https://js.arcgis.com/calcite-components/2.11.0/calcite.css",
        },
      ],
    },
  },

  // -------------------------------------------------
  // 4. Vite – alias + SSR handling
  // -------------------------------------------------
  vite: {
    ssr: {
      // Let Nuxt handle the package on the server
      noExternal: ["@arcgis/core"],
    },
    resolve: {
      alias: {
        // Make "@arcgis/core/assets" point to the real folder
        "@arcgis/core/assets": resolve(
          __dirname,
          "node_modules/@arcgis/core/assets"
        ),
      },
    },
    // Optional: speed up dev server
    optimizeDeps: {
      include: ["@arcgis/core"],
    },
  },

  // -------------------------------------------------
  // 5. Nitro (server) – transpile ArcGIS
  // -------------------------------------------------
  nitro: {
    esbuild: {
      options: {
        target: "es2020",
      },
    },
  },

  // -------------------------------------------------
  // 6. Build – transpile the ES modules
  // -------------------------------------------------
  build: {
    transpile: ["@arcgis/core"],
  },

  // -------------------------------------------------
  // 7. (Optional) Public runtime config
  // -------------------------------------------------
  runtimeConfig: {
    public: {
      arcgisJsApiVersion: "4.29", // change when you upgrade
    },
  },

  // plugins: [{ src: "~/plugins/arcgis.client.ts", mode: "client" }],
});
