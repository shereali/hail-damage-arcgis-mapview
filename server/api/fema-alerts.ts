// server/api/fema-alerts.ts
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);

    // Build dynamic filters based on query parameters
    let apiUrl =
      "https://www.fema.gov/api/open/v1/IpawsArchivedAlerts?$inlinecount=allpages";

    // Add filters from query parameters
    const filterParams = [];

    // Date range filtering
    if (query.startDate && query.startDate !== "") {
      filterParams.push(`sent ge '${query.startDate}'`);
    }

    if (query.endDate && query.endDate !== "") {
      filterParams.push(`sent le '${query.endDate}'`);
    }

    // Single date filter (backward compatibility)
    if (query.sent && query.sent !== "" && !query.startDate && !query.endDate) {
      filterParams.push(`sent eq '${query.sent}'`);
    }

    // Other filters
    if (query.alertType && query.alertType !== "") {
      filterParams.push(`alertType eq '${query.alertType}'`);
    }

    if (query.event && query.event !== "") {
      filterParams.push(`event eq '${query.event}'`);
    }

    // Individual field filters
    if (query.state && query.state !== "") {
      const stateCode = query.state.toUpperCase();
      filterParams.push(
        `(contains(areaDesc,' ${stateCode} ') or contains(areaDesc,' ${stateCode},') or contains(areaDesc,'; ${stateCode}') or contains(areaDesc,', ${stateCode}'))`
      );
    }

    if (query.county && query.county !== "") {
      filterParams.push(`contains(areaDesc,'${query.county}')`);
    }

    if (query.city && query.city !== "") {
      filterParams.push(`contains(areaDesc,'${query.city}')`);
    }

    // Search filter for address only (more specific)
    if (query.search && query.search !== "") {
      const searchTerm = query.search as string;

      // More specific address pattern matching
      const addressPatterns = [
        `contains(areaDesc,'${searchTerm}')`, // Basic contains
      ];

      // If it looks like a street address (numbers and text)
      if (/\d+/.test(searchTerm) && /[A-Za-z]/.test(searchTerm)) {
        addressPatterns.push(`contains(areaDesc,'${searchTerm}')`);
      }

      // If it's a ZIP code (5 digits)
      if (/^\d{5}$/.test(searchTerm)) {
        addressPatterns.push(`contains(areaDesc,'${searchTerm}')`);
      }

      if (addressPatterns.length > 0) {
        filterParams.push(`(${addressPatterns.join(" or ")})`);
      }
    }

    if (filterParams.length > 0) {
      apiUrl += `&$filter=${filterParams.join(" and ")}`;
    }

    // Add top parameter for limiting results
    const top = Math.min(parseInt(query.top as string) || 100, 500);
    apiUrl += `&$top=${top}`;

    // Add order by sent date descending
    apiUrl += `&$orderby=sent desc`;

    console.log("Fetching FEMA data from:", apiUrl);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(
        `FEMA API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // Early return if no data
    if (!data.IpawsArchivedAlerts || data.IpawsArchivedAlerts.length === 0) {
      return {
        features: [],
        metadata: {
          count: 0,
          top,
          filters: query,
        },
      };
    }

    // Enhanced location parsing function
    const parseLocationInfo = (areaDesc: string) => {
      if (!areaDesc) {
        return {
          state: "",
          county: "",
          city: "",
          location: "Unknown Location",
        };
      }

      let state = "";
      let county = "";
      let city = "";
      let location = areaDesc;

      // Try to extract state code (2 uppercase letters)
      const stateMatch = areaDesc.match(/\b[A-Z]{2}\b/g);
      if (stateMatch && stateMatch.length > 0) {
        state = stateMatch[0];
      }

      // Try to extract county (common patterns)
      const countyMatches = [
        ...areaDesc.matchAll(/([A-Za-z\s]+ County)/g),
        ...areaDesc.matchAll(/([A-Za-z\s]+ Parish)/g),
        ...areaDesc.matchAll(/([A-Za-z\s]+ Borough)/g),
      ];
      if (countyMatches.length > 0) {
        county = countyMatches[0][1].trim();
      }

      // Try to extract city (before state code or in common patterns)
      const cityPatterns = [
        /^([^;]+?),\s*[A-Z]{2}/, // "City, ST"
        /([A-Za-z\s]+)(?=,?\s*(?:County|Parish|Borough))/i, // Before county
        /^([^;]+?)(?=;|$)/, // First segment before semicolon
      ];

      for (const pattern of cityPatterns) {
        const cityMatch = areaDesc.match(pattern);
        if (cityMatch && cityMatch[1]) {
          const potentialCity = cityMatch[1].trim();
          // Avoid capturing states or counties as cities
          if (
            !potentialCity.match(/(County|Parish|Borough|State)$/i) &&
            potentialCity.length > 2 &&
            potentialCity !== state
          ) {
            city = potentialCity;
            break;
          }
        }
      }

      // Create a better location display
      if (city && state) {
        location = `${city}, ${state}`;
      } else if (county && state) {
        location = `${county}, ${state}`;
      } else if (state) {
        location = areaDesc.split(";")[0]?.trim() || areaDesc;
      } else {
        location = areaDesc.split(";")[0]?.trim() || "Unknown Location";
      }

      // Clean up location string
      location = location
        .replace(/\s*;\s*/g, ", ")
        .replace(/\s+/g, " ")
        .trim();

      return { state, county, city, location };
    };

    // Transform FEMA data efficiently
    const features = data.IpawsArchivedAlerts.map(
      (alert: any, index: number) => {
        // Extract coordinates efficiently
        let lat = 39.5;
        let lng = -98.35;

        if (alert.polygon) {
          try {
            const firstCoord = alert.polygon.split(" ")[0];
            if (firstCoord) {
              const coords = firstCoord.split(",");
              if (coords.length >= 2) {
                lat = parseFloat(coords[1]);
                lng = parseFloat(coords[0]);
              }
            }
          } catch (e) {
            console.warn("Failed to parse polygon:", alert.polygon);
          }
        }

        // Parse location information using enhanced function
        const { state, county, city, location } = parseLocationInfo(
          alert.areaDesc
        );

        return {
          id: alert.id || `alert-${index}`,
          LOCATION: location,
          STATE: state,
          COUNTY: county,
          CITY: city,
          LAT: lat,
          LNG: lng,
          UTC_DATETIME: new Date(alert.sent).getTime(),
          HAIL_SIZE: 0,
          DAMAGE_PROPERTY: 0,
          DAMAGE_CROPS: 0,
          REMARKS:
            alert.headline ||
            alert.description ||
            alert.messageType ||
            "FEMA Alert",
          SOURCE: "FEMA IPAWS",
          ALERT_TYPE: alert.alertType,
          EVENT: alert.event,
          SENT: alert.sent,
          EXPIRES: alert.expires,
          SEVERITY: alert.severity,
          URGENCY: alert.urgency,
          CERTAINTY: alert.certainty,
          AREA_DESC: alert.areaDesc, // Keep original for reference
          _raw: alert,
        };
      }
    );

    return {
      features,
      metadata: {
        count: data.metadata?.count || features.length,
        top,
        filters: query,
      },
    };
  } catch (err: any) {
    console.error("FEMA API error:", err);
    return {
      error: err.message,
      features: [],
      metadata: { count: 0 },
    };
  }
});
