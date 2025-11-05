export default defineNuxtPlugin(() => {
  window.loadEsri = () =>
    new Promise((r) => {
      if (window.__esri) return r();
      const s = document.createElement("script");
      s.src = "https://js.arcgis.com/4.29/";
      s.onload = () => {
        window.__esri = (window as any).require;
        r();
      };
      document.head.appendChild(s);
    });

  window.loadModules = (m) =>
    new Promise((res) => window.__esri(m, (...mods) => res(mods)));
});
