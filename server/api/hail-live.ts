// server/api/hail-live.ts
export default defineEventHandler(async () => {
  try {
    // ১. NOAA Warnings
    const res = await fetch("https://api.weather.gov/alerts/active?event=Hail");
    if (!res.ok) throw new Error("NOAA down");
    const noaa = await res.json();

    // ২. আজকের SPC Hail (ঠিক URL!)
    let todayHail: any[] = [];
    try {
      const csv = await $fetch(
        "https://www.spc.noaa.gov/climo/reports/today_hail.csv"
      );
      const lines = csv.trim().split("\n").slice(1); // হেডার স্কিপ
      todayHail = lines.map((l) => {
        const [time, size, location, county, state, lat, lon, remarks] =
          l.split(",");
        const hh = time.slice(0, 2);
        const mm = time.slice(2);
        const iso = `${new Date().toISOString().split("T")[0]}T${hh}:${mm}:00Z`;
        return {
          LOCATION: location?.trim() || "Unknown",
          STATE: state?.trim() || "",
          COUNTY: county?.trim() || "",
          LAT: +lat,
          LNG: +lon,
          UTC_DATETIME: new Date(iso).getTime(),
          HAIL_SIZE: +size,
          REMARKS: remarks?.trim() || "SPC Report",
          SOURCE: "SPC",
        };
      });
    } catch (e) {
      console.warn("SPC CSV not ready yet (normal before 12Z)");
    }

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
        _feature: f,
      };
    });

    return { features: [...warnings, ...todayHail], noaa };
  } catch (err: any) {
    return { error: err.message, features: [] };
  }
});
