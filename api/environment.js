// GET /api/environment?city=miami|helsinki
//
// Normalizes a handful of free, keyless public data sources into a single
// EnvironmentState shape the client's background animation consumes,
// instead of coupling animation code to any one provider's fields.
//
// Sources (none require credentials — nothing here is a secret):
//   - Open-Meteo: current weather (clouds, precip, wind, temp, humidity)
//   - Open-Meteo Marine: real wave/swell height & period for Miami, so the
//     ocean animation's motion actually reflects today's sea state instead
//     of only reacting to wind speed.
//   - api.weather.gov (NWS): active alerts, filtered to hurricane /
//     tropical storm / heat — the only trigger for those visuals.
//   - NOAA SWPC: planetary K-index, used with a latitude-based heuristic
//     for Helsinki aurora visibility (a simplification of the full
//     Ovation aurora grid — good enough for "reasonably plausible",
//     not a claim of precision).
//
// Cache-Control lets Vercel's edge cache the response across visitors,
// which is the real point of this endpoint: it's the only way to avoid
// every visitor's browser hitting these public APIs individually.

const CITIES = {
  miami: { lat: 25.7617, lon: -80.1918, tz: "America/New_York" },
  helsinki: { lat: 60.1699, lon: 24.9384, tz: "Europe/Helsinki", geomagLat: 57 },
};

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.json();
}

function solarAltitudeDeg(lat, lon, date) {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);
  const decDeg = 23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const solarTime = utcHours + lon / 15;
  const hourAngleDeg = 15 * (solarTime - 12);
  const altRad = Math.asin(
    Math.sin(lat * rad) * Math.sin(decDeg * rad) +
      Math.cos(lat * rad) * Math.cos(decDeg * rad) * Math.cos(hourAngleDeg * rad)
  );
  return altRad / rad;
}

function twilightPhase(altitudeDeg) {
  if (altitudeDeg > 0) return "day";
  if (altitudeDeg > -6) return "civil";
  if (altitudeDeg > -12) return "nautical";
  if (altitudeDeg > -18) return "astronomical";
  return "night";
}

function season(date) {
  const m = date.getUTCMonth() + 1;
  if (m === 12 || m <= 2) return "winter";
  if (m <= 5) return "spring";
  if (m <= 8) return "summer";
  return "autumn";
}

// WMO weather codes, as returned by Open-Meteo's `weather_code` field.
function mapWeatherCode(code) {
  const table = {
    0: ["clear", "none", "none"],
    1: ["partly-cloudy", "none", "none"],
    2: ["partly-cloudy", "none", "none"],
    3: ["cloudy", "none", "none"],
    45: ["fog", "none", "none"],
    48: ["fog", "none", "none"],
    51: ["rain", "rain", "light"],
    53: ["rain", "rain", "moderate"],
    55: ["rain", "rain", "moderate"],
    56: ["sleet", "sleet", "light"],
    57: ["sleet", "sleet", "moderate"],
    61: ["rain", "rain", "light"],
    63: ["rain", "rain", "moderate"],
    65: ["rain", "rain", "heavy"],
    66: ["sleet", "sleet", "light"],
    67: ["sleet", "sleet", "heavy"],
    71: ["snow", "snow", "light"],
    73: ["snow", "snow", "moderate"],
    75: ["snow", "snow", "heavy"],
    77: ["snow", "snow", "light"],
    80: ["rain", "rain", "light"],
    81: ["rain", "rain", "moderate"],
    82: ["rain", "rain", "heavy"],
    85: ["snow", "snow", "light"],
    86: ["snow", "snow", "heavy"],
    95: ["thunderstorm", "rain", "moderate"],
    96: ["thunderstorm", "rain", "heavy"],
    99: ["thunderstorm", "rain", "heavy"],
  };
  const [condition, precipitationType, precipitationIntensity] = table[code] || [
    "cloudy",
    "none",
    "none",
  ];
  return { condition, precipitationType, precipitationIntensity };
}

function cToF(c) {
  return (c * 9) / 5 + 32;
}

// Only ever returns hurricane/tropical-storm when an authoritative NWS
// alert says so — never inferred from wind or rain alone.
function findSevereAlert(alertProps) {
  const hurricane = alertProps.find((a) => /hurricane|tropical storm/i.test(a.event || ""));
  if (hurricane) {
    return {
      type: /hurricane/i.test(hurricane.event) ? "hurricane" : "tropical-storm",
      severity: hurricane.severity || "Unknown",
      headline: hurricane.headline || hurricane.event,
    };
  }
  const heat = alertProps.find((a) => /excessive heat|heat advisory/i.test(a.event || ""));
  if (heat) {
    return { type: "heat", severity: heat.severity || "Unknown", headline: heat.headline || heat.event };
  }
  return null;
}

// Rough, widely-cited Kp → geomagnetic-latitude visibility thresholds,
// scaled down by cloud cover. Not a substitute for the full Ovation grid,
// but reasonable for "plausible visibility", which is all this needs.
function auroraVisibility(kp, isDaylight, cloudCover) {
  if (isDaylight || kp == null || cloudCover == null) return 0;
  if (cloudCover > 60) return 0;
  let base = 0;
  if (kp >= 6) base = 80;
  else if (kp >= 5) base = 55;
  else if (kp >= 4) base = 25;
  else return 0;
  const cloudPenalty = 1 - cloudCover / 100;
  return Math.round(base * cloudPenalty);
}

module.exports = async (req, res) => {
  const city = String(req.query.city || "").toLowerCase();
  const meta = CITIES[city];
  if (!meta) {
    res.status(400).json({ error: 'city must be "miami" or "helsinki"' });
    return;
  }

  const now = new Date();
  let weather = null;
  let alertProps = [];
  let kp = null;
  let marine = null;

  try {
    weather = await fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${meta.lat}&longitude=${meta.lon}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m` +
        `&daily=sunrise,sunset&timezone=auto`
    );
  } catch (e) {
    weather = null;
  }

  if (city === "miami") {
    try {
      const alertData = await fetchJson(
        `https://api.weather.gov/alerts/active?point=${meta.lat},${meta.lon}`,
        {
          headers: {
            "User-Agent": "maya-carroll-portfolio (hiring@mayacarroll.com)",
            Accept: "application/geo+json",
          },
        }
      );
      alertProps = (alertData.features || []).map((f) => f.properties);
    } catch (e) {
      alertProps = [];
    }

    try {
      const marineData = await fetchJson(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${meta.lat}&longitude=${meta.lon}` +
          `&current=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,wind_wave_height,wind_wave_period&timezone=auto`
      );
      marine = marineData.current || null;
    } catch (e) {
      marine = null;
    }
  }

  if (city === "helsinki") {
    try {
      const kpData = await fetchJson("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json");
      const lastRow = Array.isArray(kpData) ? kpData[kpData.length - 1] : null;
      kp = lastRow ? parseFloat(lastRow[1]) : null;
      if (Number.isNaN(kp)) kp = null;
    } catch (e) {
      kp = null;
    }
  }

  if (!weather || !weather.current) {
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).json({
      location: city,
      observedAt: null,
      fetchedAt: now.toISOString(),
      dataFreshness: "unavailable",
    });
    return;
  }

  const altitude = solarAltitudeDeg(meta.lat, meta.lon, now);
  const isDaylight = altitude > 0;
  const cloudCover = weather.current.cloud_cover;
  const mapped = mapWeatherCode(weather.current.weather_code);
  const apparentTemperature = weather.current.apparent_temperature;
  const humidity = weather.current.relative_humidity_2m;

  const severeAlert =
    findSevereAlert(alertProps) ||
    (apparentTemperature != null &&
    humidity != null &&
    cToF(apparentTemperature) >= 105 &&
    humidity >= 40
      ? {
          type: "heat",
          severity: "Moderate",
          headline: "Elevated heat index (derived from temperature + humidity; no active NWS alert)",
        }
      : null);

  const auroraProbability = city === "helsinki" ? auroraVisibility(kp, isDaylight, cloudCover) : null;

  // Real sea state for the Miami ocean animation — swell (the slow, tall
  // background rollers) and wind-wave (the fast, choppy foreground surface)
  // genuinely move differently in real water, so keeping them separate
  // lets the animation reflect that instead of one blended number.
  const seaState =
    marine && typeof marine.swell_wave_height === "number"
      ? {
          swellHeight: marine.swell_wave_height,
          swellPeriod: marine.swell_wave_period,
          windWaveHeight: marine.wind_wave_height,
          windWavePeriod: marine.wind_wave_period,
          waveDirection: marine.wave_direction,
        }
      : null;

  const state = {
    location: city,
    observedAt: weather.current.time || null,
    fetchedAt: now.toISOString(),
    localTime: new Intl.DateTimeFormat("en-US", {
      timeZone: meta.tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now),
    isDaylight,
    twilightPhase: twilightPhase(altitude),
    season: season(now),
    condition: mapped.condition,
    precipitationType: mapped.precipitationType,
    precipitationIntensity: mapped.precipitationIntensity,
    cloudCover,
    visibility: null,
    temperature: weather.current.temperature_2m,
    apparentTemperature,
    humidity,
    windSpeed: weather.current.wind_speed_10m,
    windDirection: weather.current.wind_direction_10m,
    severeWeatherAlert: severeAlert,
    auroraProbability,
    seaState,
    dataFreshness: "live",
  };

  res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=1800");
  res.status(200).json(state);
};
