// server/api/hail-live.ts
export default defineEventHandler(async () => {
  try {
    // ১. NOAA Warnings
    const res = await fetch("https://api.weather.gov/alerts/active?event=Hail");
    if (!res.ok) throw new Error("NOAA API down");
    const noaa = await res.json();

    // ২. SPC Today Hail
    const csv = await $fetch(
      "https://www.spc.noaa.gov/wcm/data/today_hail.csv"
    );
    const lines = csv.trim().split("\n").slice(2);
    const today = new Date().toISOString().split("T")[0];

    const todayHail = lines.map((l) => {
      const [time, size, lat, lon, city, county, state] = l.split(",");
      const hh = time.slice(0, 2);
      const mm = time.slice(2);
      const iso = `${today}T${hh}:${mm}:00Z`;
      return {
        LOCATION: city.trim(),
        STATE: state.trim(),
        COUNTY: county.trim(),
        LAT: +lat,
        LNG: +lon,
        UTC_DATETIME: new Date(iso).getTime(),
        HAIL_SIZE: +size,
        DAMAGE_PROPERTY: 0,
        DAMAGE_CROPS: 0,
        REMARKS: "SPC Storm Report",
        SOURCE: "SPC",
        _raw: l,
      };
    });

    // ৩. NOAA Warnings
    const warnings = (noaa.features || []).map((f: any) => {
      const coords = f.geometry?.coordinates?.[0]?.[0] || [[-98, 39]];
      const [lng, lat] = coords[0] || coords;
      return {
        LOCATION: (f.properties.areaDesc.split(";")[0] || "").trim(),
        STATE: "",
        COUNTY: f.properties.areaDesc,
        LAT: lat,
        LNG: lng,
        UTC_DATETIME: new Date(f.properties.sent).getTime(),
        HAIL_SIZE: 2.0,
        REMARKS: f.properties.headline,
        SOURCE: "NOAA Warning",
        _feature: f, // ← পলিগনের জন্য রাখলাম
      };
    });

    return { features: [...warnings, ...todayHail], noaa };
  } catch (err: any) {
    return { error: err.message, features: [] };
  }
});
