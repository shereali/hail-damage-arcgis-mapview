// plugins/arcgis.client.ts
export default defineNuxtPlugin(() => {
  window.loadModules = (modules: string[]) => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://js.arcgis.com/4.29/";
      script.onload = () => {
        // @ts-ignore
        window.require(modules, (...mods) => resolve(mods));
      };
      document.head.appendChild(script);
    });
  };
});
