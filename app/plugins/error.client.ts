export default defineNuxtPlugin(() => {
  // Catch ALL unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    console.warn("Caught:", event.reason);
    event.preventDefault(); // ← Stops Vue warning
  });
});
