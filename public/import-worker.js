// public/import-worker.js
import { openDB } from "https://cdn.jsdelivr.net/npm/idb@7/+esm";

const DB_NAME = "HailDB";
const STORE_NAME = "events";
const DB_VERSION = 1;

self.onmessage = async (e) => {
  const { csvUrl } = e.data;

  try {
    self.postMessage({ type: "progress", message: "Opening database..." });

    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("year", "year");
          store.createIndex("state", "state");
          store.createIndex("magnitude", "magnitude");
          store.createIndex("category", "category");
        }
      },
    });

    const response = await fetch(csvUrl);
    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let csvChunk = "";
    let totalBytes =
      parseInt(response.headers.get("content-length") || "0") || 10_000_000;
    let loadedBytes = 0;
    let parsed = 0;

    // Simple CSV parser
    const parseLine = (line) => {
      const values = [];
      let field = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') inQuotes = !inQuotes;
        else if (c === "," && !inQuotes) {
          values.push(field);
          field = "";
        } else field += c;
      }
      values.push(field);
      return values;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      loadedBytes += value.length;
      csvChunk += decoder.decode(value, { stream: true });

      const lines = csvChunk.split("\n");
      csvChunk = lines.pop() || ""; // last incomplete line

      if (parsed === 0 && lines[0]?.includes("om,yr,mo,da")) {
        lines.shift(); // skip header
      }

      const batch = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        const cols = parseLine(line);
        if (cols.length < 14) continue; // skip invalid rows
        const r = {
          id: cols[0],
          yr: +cols[1],
          mo: +cols[2] || 1,
          da: +cols[3] || 1,
          st: cols[4],
          mag: (+cols[5] || 0) / 100,
          inj: +cols[6] || 0,
          grok: +cols[7] || 0,
          loss: +cols[8] || 0,
          closs: +cols[9] || 0,
          slat: +cols[10] || 0,
          slon: +cols[11] || 0,
          elat: +cols[12] || 0,
          elon: +cols[13] || 0,
        };

        const loss = r.loss * 1000;
        const closs = r.closs * 1000;
        let category = "minor";
        if (loss > 100) category = "property";
        else if (closs > 50) category = "crop";
        else if (r.inj > 0 || r.grok > 0) category = "human";

        batch.push({
          id: r.id,
          year: r.yr,
          month: r.mo,
          day: r.da,
          state: r.st,
          magnitude: r.mag,
          injuries: r.inj,
          fatalities: r.grok,
          propertyLoss: loss,
          cropLoss: closs,
          lat: r.slat || r.elat || 0,
          lon: r.slon || r.elon || 0,
          sizeCat: r.mag < 1 ? "small" : r.mag < 1.75 ? "large" : "severe",
          category,
        });

        if (batch.length === 100000) {
          // FIXED: Loop over batch (put ONE record at a time)
          for (const item of batch) {
            await db.put(STORE_NAME, item);
          }
          parsed += batch.length;
          batch.length = 0;
          self.postMessage({
            type: "progress",
            loaded: loadedBytes,
            total: totalBytes,
            parsed,
            percent: Math.min(99, (loadedBytes / totalBytes) * 5000),
          });
        }
      }

      // FIXED: Loop over remaining batch
      if (batch.length) {
        for (const item of batch) {
          await db.put(STORE_NAME, item);
        }
        parsed += batch.length;
      }
    }

    await db.close();
    self.postMessage({ type: "done", count: parsed });
  } catch (err) {
    self.postMessage({ type: "error", message: err.message });
  }
};
