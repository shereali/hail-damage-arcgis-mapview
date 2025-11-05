// server/api/hail-history.ts
export default defineEventHandler(async () => {
  try {
    const zipUrl = "https://www.spc.noaa.gov/wcm/data/1955-2024_hail.csv.zip";
    const zipResp = await fetch(zipUrl);
    if (!zipResp.ok) throw new Error(`ZIP download failed: ${zipResp.status}`);

    const arrayBuffer = await zipResp.arrayBuffer();
    const zip = await (await import("jszip")).default.loadAsync(arrayBuffer);
    const file = zip.file("1955-2024_hail.csv");
    if (!file) throw new Error("CSV not found inside ZIP");

    const csv = await file.async("text");
    const lines = csv.trim().split("\n").slice(2);

    const history = lines
      .map((l) => {
        const parts = l.split(",");
        if (parts.length < 8) return null;
        const [date, time, size, lat, lon, city, county, state] = parts;
        const [yy, mm, dd] = date.split("-");
        const yyNum = parseInt(yy);
        const fullYear = yyNum >= 55 ? `19${yy}` : `20${yy}`;
        const iso = `${fullYear}-${mm}-${dd}T${time
          .padStart(4, "0")
          .replace(/^(\d{2})(\d{2})$/, "$1:$2")}:00Z`;
        const dt = new Date(iso);
        if (isNaN(dt.getTime())) return null;

        return {
          LOCATION: (city || "Unknown").trim(),
          STATE: (state || "").trim(),
          COUNTY: (county || "").trim(),
          LAT: +lat,
          LNG: +lon,
          UTC_DATETIME: dt.getTime(),
          HAIL_SIZE: +size,
          REMARKS: "1955–2024 Hail",
          SOURCE: "SPC History",
        };
      })
      .filter(Boolean);

    return { features: history };
  } catch (err: any) {
    console.error("Hail History Error:", err.message);
    return { error: err.message, features: [] };
  }
});
