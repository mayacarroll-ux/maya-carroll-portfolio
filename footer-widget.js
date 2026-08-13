// Shared Miami/Helsinki time + weather + currency ticker for the footer,
// used on every page except index.html (which has its own inline copy —
// this file exists so about/dashboard/calendar don't duplicate ~250 lines
// of logic and drift out of sync with it). Expects the footer markup with
// #time-miami, #weather-miami, #severe-miami, #time-helsinki,
// #weather-helsinki, #severe-helsinki, #currency-rate, #currency-status to
// already be present; no-ops if it isn't.
//
// Deliberately decoupled from each host page's own i18n system: it reads
// document.documentElement.lang directly and re-renders on the shared
// "app:languagechange" event (which every page's setLanguage() dispatches),
// rather than depending on any page-specific translate()/translations.
(function () {
  const CITIES = {
    miami: { label: "Miami", timeZone: "America/New_York", lat: 25.7617, lon: -80.1918 },
    helsinki: { label: "Helsinki", timeZone: "Europe/Helsinki", lat: 60.1699, lon: 24.9384 },
  };
  const WEATHER_REFRESH_MS = 12 * 60 * 1000;
  const CACHE_KEY = "weatherCache_v2";

  const timeEls = {
    miami: document.getElementById("time-miami"),
    helsinki: document.getElementById("time-helsinki"),
  };
  const weatherEls = {
    miami: document.getElementById("weather-miami"),
    helsinki: document.getElementById("weather-helsinki"),
  };
  const severeEls = {
    miami: document.getElementById("severe-miami"),
    helsinki: document.getElementById("severe-helsinki"),
  };
  const currencyRateEl = document.getElementById("currency-rate");
  const currencyStatusEl = document.getElementById("currency-status");

  if (!timeEls.miami || !timeEls.helsinki) return;

  const TRANSLATIONS = {
    en: {
      weather_loading: "loading",
      weather_unavailable: "Weather unavailable",
      weather_feels: "feels",
      weather_feels_like: "feels like",
      weather_updated: "Updated",
      currency_aria:
        "1 US dollar equals {rate} euros; 1 euro equals {inverse} US dollars. {stronger} is currently the stronger currency.",
      condition_clear: "Clear",
      condition_partlyCloudy: "Partly cloudy",
      condition_cloudy: "Cloudy",
      condition_fog: "Foggy",
      condition_drizzle: "Drizzle",
      condition_rain: "Rain",
      condition_snow: "Snow",
      condition_thunderstorm: "Thunderstorm",
      uv_low: "Low",
      uv_moderate: "Moderate",
      uv_high: "High",
      uv_veryhigh: "Very High",
      uv_extreme: "Extreme",
      severe_hurricane_alert: "Hurricane alert",
      severe_tropical_storm_alert: "Tropical storm alert",
      severe_opens_nhc: "Opens the National Hurricane Center.",
      severe_snow_watch: "Snow: {cm}cm expected",
      severe_snow_watch_aria: "Snow watch: about {cm} centimeters expected today.",
      severe_wind_watch: "Wind: {kmh} km/h gusts",
      severe_wind_watch_aria: "Wind watch: gusts up to {kmh} kilometers per hour expected today.",
      severe_cold_snap: "Cold snap: feels {temp}",
      severe_cold_snap_aria: "Cold snap warning: feels like {temp} today — frostbite risk.",
    },
    es: {
      weather_loading: "cargando",
      weather_unavailable: "Clima no disponible",
      weather_feels: "sensación",
      weather_feels_like: "sensación térmica de",
      weather_updated: "Actualizado",
      currency_aria:
        "1 dólar estadounidense equivale a {rate} euros; 1 euro equivale a {inverse} dólares estadounidenses. Actualmente {stronger} es la moneda más fuerte.",
      condition_clear: "Despejado",
      condition_partlyCloudy: "Parcialmente nublado",
      condition_cloudy: "Nublado",
      condition_fog: "Neblina",
      condition_drizzle: "Llovizna",
      condition_rain: "Lluvia",
      condition_snow: "Nieve",
      condition_thunderstorm: "Tormenta eléctrica",
      uv_low: "Bajo",
      uv_moderate: "Moderado",
      uv_high: "Alto",
      uv_veryhigh: "Muy alto",
      uv_extreme: "Extremo",
      severe_hurricane_alert: "Alerta de huracán",
      severe_tropical_storm_alert: "Alerta de tormenta tropical",
      severe_opens_nhc: "Abre el Centro Nacional de Huracanes.",
      severe_snow_watch: "Nieve: se esperan {cm}cm",
      severe_snow_watch_aria: "Aviso de nieve: se esperan unos {cm} centímetros hoy.",
      severe_wind_watch: "Viento: ráfagas de {kmh} km/h",
      severe_wind_watch_aria: "Aviso de viento: ráfagas de hasta {kmh} kilómetros por hora previstas hoy.",
      severe_cold_snap: "Ola de frío: sensación {temp}",
      severe_cold_snap_aria: "Aviso de ola de frío: sensación térmica de {temp} hoy — riesgo de congelación.",
    },
    fi: {
      weather_loading: "ladataan",
      weather_unavailable: "Sää ei saatavilla",
      weather_feels: "tuntuu",
      weather_feels_like: "tuntuu kuin",
      weather_updated: "Päivitetty",
      currency_aria:
        "1 Yhdysvaltain dollari vastaa {rate} euroa; 1 euro vastaa {inverse} Yhdysvaltain dollaria. {stronger} on tällä hetkellä vahvempi valuutta.",
      condition_clear: "Selkeää",
      condition_partlyCloudy: "Osittain pilvistä",
      condition_cloudy: "Pilvistä",
      condition_fog: "Sumuista",
      condition_drizzle: "Tihkusadetta",
      condition_rain: "Sadetta",
      condition_snow: "Lunta",
      condition_thunderstorm: "Ukkosmyrsky",
      uv_low: "Matala",
      uv_moderate: "Kohtalainen",
      uv_high: "Korkea",
      uv_veryhigh: "Erittäin korkea",
      uv_extreme: "Äärimmäinen",
      severe_hurricane_alert: "Hurrikaanivaroitus",
      severe_tropical_storm_alert: "Trooppisen myrskyn varoitus",
      severe_opens_nhc: "Avaa National Hurricane Centerin sivun.",
      severe_snow_watch: "Lunta: odotettavissa {cm}cm",
      severe_snow_watch_aria: "Lumivaroitus: tänään odotettavissa noin {cm} senttimetriä lunta.",
      severe_wind_watch: "Tuulta: puuskat {kmh} km/h",
      severe_wind_watch_aria: "Tuulivaroitus: tänään odotettavissa jopa {kmh} kilometrin tuntinopeuden puuskia.",
      severe_cold_snap: "Pakkasjakso: tuntuu {temp}",
      severe_cold_snap_aria: "Pakkasvaroitus: tänään tuntuu {temp} — paleltumisvaara.",
    },
  };

  function currentLang() {
    const l = (document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    return TRANSLATIONS[l] ? l : "en";
  }
  function t(key, vars) {
    const dict = TRANSLATIONS[currentLang()];
    let str = dict[key] != null ? dict[key] : TRANSLATIONS.en[key] != null ? TRANSLATIONS.en[key] : key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.replace(`{${k}}`, vars[k]);
      });
    }
    return str;
  }

  const timeFormatters = {};
  function formatTime(city) {
    if (!timeFormatters[city]) {
      timeFormatters[city] = new Intl.DateTimeFormat(undefined, {
        timeZone: CITIES[city].timeZone,
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return timeFormatters[city].format(new Date());
  }

  function tickClocks() {
    Object.keys(CITIES).forEach((city) => {
      timeEls[city].textContent = formatTime(city);
    });
  }
  tickClocks();
  setInterval(tickClocks, 30 * 1000);

  function celsiusToFahrenheit(c) {
    return (c * 9) / 5 + 32;
  }

  const WEATHER_ICONS = {
    clear: { day: "☀️", night: "🌙", labelKey: "condition_clear" },
    partlyCloudy: { day: "⛅", night: "☁️", labelKey: "condition_partlyCloudy" },
    cloudy: { day: "☁️", night: "☁️", labelKey: "condition_cloudy" },
    fog: { day: "🌫️", night: "🌫️", labelKey: "condition_fog" },
    drizzle: { day: "🌦️", night: "🌦️", labelKey: "condition_drizzle" },
    rain: { day: "🌧️", night: "🌧️", labelKey: "condition_rain" },
    snow: { day: "🌨️", night: "🌨️", labelKey: "condition_snow" },
    thunderstorm: { day: "⛈️", night: "⛈️", labelKey: "condition_thunderstorm" },
  };
  function weatherIconFor(code, isDay) {
    const group =
      code === 0
        ? "clear"
        : code === 1 || code === 2
        ? "partlyCloudy"
        : code === 3
        ? "cloudy"
        : code === 45 || code === 48
        ? "fog"
        : [51, 53, 55, 56, 57].includes(code)
        ? "drizzle"
        : [61, 63, 65, 66, 67, 80, 81, 82].includes(code)
        ? "rain"
        : [71, 73, 75, 77, 85, 86].includes(code)
        ? "snow"
        : [95, 96, 99].includes(code)
        ? "thunderstorm"
        : "cloudy";
    const entry = WEATHER_ICONS[group];
    return { icon: isDay ? entry.day : entry.night, label: t(entry.labelKey) };
  }

  function formatTemp(tempC) {
    return `${Math.round(celsiusToFahrenheit(tempC))}°F`;
  }

  function uvCategory(uv) {
    if (uv >= 11) return { labelKey: "uv_extreme", level: "extreme", elevated: true };
    if (uv >= 8) return { labelKey: "uv_veryhigh", level: "veryhigh", elevated: true };
    if (uv >= 6) return { labelKey: "uv_high", level: "high", elevated: true };
    if (uv >= 3) return { labelKey: "uv_moderate", level: "moderate", elevated: false };
    return { labelKey: "uv_low", level: "low", elevated: false };
  }

  function loadCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function saveCache(cache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      /* storage unavailable — degrade silently */
    }
  }

  let cache = loadCache();

  function renderWeather(city) {
    const el = weatherEls[city];
    const entry = cache[city];

    if (!entry) {
      el.textContent = "…";
      el.classList.remove("is-stale");
      el.classList.remove("is-unavailable");
      el.removeAttribute("title");
      el.setAttribute("aria-label", `${CITIES[city].label}: ${t("weather_loading")}`);
      return;
    }

    if (entry.tempC == null) {
      el.textContent = t("weather_unavailable");
      el.classList.add("is-unavailable");
      el.classList.remove("is-stale");
      el.removeAttribute("title");
      el.setAttribute("aria-label", t("weather_unavailable"));
      return;
    }

    const isStale = Date.now() - entry.updatedAt > WEATHER_REFRESH_MS * 2;
    const tempText = formatTemp(entry.tempC);
    let iconHTML = "";
    let conditionLabel = "";
    if (entry.weatherCode != null) {
      const { icon, label } = weatherIconFor(entry.weatherCode, entry.isDay !== false);
      iconHTML = `<span class="weather-icon" aria-hidden="true">${icon}</span> `;
      conditionLabel = `${label}, `;
    }
    let feelsLikeHTML = "";
    let feelsLikeSpoken = "";
    if (entry.feelsLikeC != null && Math.abs(entry.feelsLikeC - entry.tempC) >= 2) {
      const feelsLikeText = formatTemp(entry.feelsLikeC);
      feelsLikeHTML = ` <span class="feels-like">${t("weather_feels")} ${feelsLikeText}</span>`;
      feelsLikeSpoken = `, ${t("weather_feels_like")} ${feelsLikeText}`;
    }
    let uvHTML = "";
    let uvSpoken = "";
    const roundedUv = entry.uvIndex != null ? Math.round(entry.uvIndex) : null;
    if (roundedUv != null && roundedUv >= 3) {
      const rounded = roundedUv;
      const { labelKey, level, elevated } = uvCategory(rounded);
      const label = t(labelKey);
      uvHTML = ` <span class="uv uv-${level}${elevated ? " uv-elevated" : ""}"><span class="uv-dot" aria-hidden="true"></span>UV ${rounded} ${label}</span>`;
      uvSpoken = `, UV ${rounded} (${label})`;
    }
    el.innerHTML = `${iconHTML}${tempText}${feelsLikeHTML}${uvHTML}`;
    el.classList.toggle("is-stale", isStale);
    el.classList.remove("is-unavailable");
    const updatedLabel = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(entry.updatedAt));
    el.title = `${t("weather_updated")} ${updatedLabel}`;
    el.setAttribute(
      "aria-label",
      `${CITIES[city].label}: ${conditionLabel}${tempText}${feelsLikeSpoken}${uvSpoken}, ${t("weather_updated").toLowerCase()} ${updatedLabel}`
    );
  }

  function renderAll() {
    Object.keys(CITIES).forEach(renderWeather);
  }

  async function fetchWeather(city) {
    const { lat, lon } = CITIES[city];
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,is_day,uv_index` +
      `&daily=snowfall_sum,wind_gusts_10m_max&timezone=auto&forecast_days=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error("Weather request failed");
      const data = await res.json();
      const tempC =
        data && data.current && typeof data.current.temperature_2m === "number" ? data.current.temperature_2m : null;
      if (tempC == null) throw new Error("Malformed weather response");
      const feelsLikeC =
        data && data.current && typeof data.current.apparent_temperature === "number"
          ? data.current.apparent_temperature
          : null;
      const weatherCode = data.current.weather_code;
      const isDay = data.current.is_day !== 0;
      const uvIndex = typeof data.current.uv_index === "number" ? data.current.uv_index : null;
      const daily = data.daily || {};
      const snowfallSum =
        Array.isArray(daily.snowfall_sum) && typeof daily.snowfall_sum[0] === "number" ? daily.snowfall_sum[0] : null;
      const windGustsMax =
        Array.isArray(daily.wind_gusts_10m_max) && typeof daily.wind_gusts_10m_max[0] === "number"
          ? daily.wind_gusts_10m_max[0]
          : null;
      cache[city] = { tempC, feelsLikeC, weatherCode, isDay, uvIndex, snowfallSum, windGustsMax, updatedAt: Date.now() };
      saveCache(cache);
    } catch (e) {
      if (!cache[city]) {
        cache[city] = { tempC: null, updatedAt: Date.now() };
      }
    } finally {
      clearTimeout(timeout);
      renderWeather(city);
      renderSevere(city);
    }
  }

  function isStaleEnough(city) {
    const entry = cache[city];
    if (!entry || entry.tempC == null) return true;
    return Date.now() - entry.updatedAt > WEATHER_REFRESH_MS;
  }

  function refreshWeatherIfNeeded() {
    if (document.hidden) return;
    Object.keys(CITIES).forEach((city) => {
      if (isStaleEnough(city)) fetchWeather(city);
    });
  }

  const SEVERE_REFRESH_MS = 15 * 60 * 1000;
  const ENV_ALERT_CACHE_KEY = "envAlertCache";
  const SNOW_WATCH_CM = 5;
  const WIND_WATCH_KMH = 60;
  const COLD_SNAP_FEELS_LIKE_C = -20;

  function loadEnvAlertCache() {
    try {
      return JSON.parse(localStorage.getItem(ENV_ALERT_CACHE_KEY)) || null;
    } catch (e) {
      return null;
    }
  }
  function saveEnvAlertCache(data) {
    try {
      localStorage.setItem(ENV_ALERT_CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      /* storage unavailable — degrade silently */
    }
  }
  let envAlertCache = loadEnvAlertCache();

  function renderMiamiSevere() {
    const el = severeEls.miami;
    if (!el) return;
    const alert = envAlertCache && envAlertCache.alert;
    if (!alert || !/hurricane|tropical-storm/.test(alert.type)) {
      el.innerHTML = "";
      el.removeAttribute("aria-label");
      return;
    }
    const shortLabel = t(alert.type === "hurricane" ? "severe_hurricane_alert" : "severe_tropical_storm_alert");
    el.innerHTML = `🌀 <a href="https://www.nhc.noaa.gov/" target="_blank" rel="noopener" title="${alert.headline.replace(
      /"/g,
      "&quot;"
    )}">${shortLabel}</a>`;
    el.setAttribute("aria-label", `${alert.headline}. ${t("severe_opens_nhc")}`);
  }

  function renderHelsinkiSevere() {
    const el = severeEls.helsinki;
    if (!el) return;
    const entry = cache.helsinki;
    if (!entry) {
      el.innerHTML = "";
      return;
    }
    const feelsLike = entry.feelsLikeC;
    const snow = entry.snowfallSum;
    const gusts = entry.windGustsMax;
    if (feelsLike != null && feelsLike <= COLD_SNAP_FEELS_LIKE_C) {
      const temp = formatTemp(feelsLike);
      el.innerHTML = `🥶 ${t("severe_cold_snap", { temp })}`;
      el.setAttribute("aria-label", t("severe_cold_snap_aria", { temp }));
    } else if (snow != null && snow >= SNOW_WATCH_CM) {
      const cm = Math.round(snow);
      el.innerHTML = `❄️ ${t("severe_snow_watch", { cm })}`;
      el.setAttribute("aria-label", t("severe_snow_watch_aria", { cm }));
    } else if (gusts != null && gusts >= WIND_WATCH_KMH) {
      const kmh = Math.round(gusts);
      el.innerHTML = `💨 ${t("severe_wind_watch", { kmh })}`;
      el.setAttribute("aria-label", t("severe_wind_watch_aria", { kmh }));
    } else {
      el.innerHTML = "";
      el.removeAttribute("aria-label");
    }
  }

  function renderSevere(city) {
    if (city === "miami") renderMiamiSevere();
    else if (city === "helsinki") renderHelsinkiSevere();
  }

  async function fetchMiamiAlert() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch("/api/environment?city=miami", { signal: controller.signal });
      if (!res.ok) throw new Error("Environment request failed");
      const data = await res.json();
      envAlertCache = { alert: data.severeWeatherAlert || null, updatedAt: Date.now() };
      saveEnvAlertCache(envAlertCache);
    } catch (e) {
      // Leave the last known state in place.
    } finally {
      clearTimeout(timeout);
      renderMiamiSevere();
    }
  }

  function refreshSevereIfNeeded() {
    if (document.hidden) return;
    if (!envAlertCache || Date.now() - envAlertCache.updatedAt > SEVERE_REFRESH_MS) fetchMiamiAlert();
  }

  const CURRENCY_REFRESH_MS = 60 * 60 * 1000;
  const CURRENCY_CACHE_KEY = "currencyCache_v1";

  function loadCurrencyCache() {
    try {
      return JSON.parse(localStorage.getItem(CURRENCY_CACHE_KEY)) || null;
    } catch (e) {
      return null;
    }
  }
  function saveCurrencyCache(data) {
    try {
      localStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      /* storage unavailable — degrade silently */
    }
  }
  let currencyCache = loadCurrencyCache();

  function renderCurrency() {
    if (!currencyRateEl) return;
    if (!currencyCache || currencyCache.rate == null) {
      currencyRateEl.textContent = "…";
      currencyStatusEl.removeAttribute("title");
      currencyStatusEl.removeAttribute("aria-label");
      return;
    }
    const rate = currencyCache.rate;
    const inverse = 1 / rate;
    const usdStronger = rate > 1;
    currencyRateEl.innerHTML = usdStronger
      ? `<strong>$1</strong> = €${rate.toFixed(2)} &middot; €1 = <strong>$${inverse.toFixed(2)}</strong>`
      : `$1 = <strong>€${rate.toFixed(2)}</strong> &middot; <strong>€1</strong> = $${inverse.toFixed(2)}`;
    const updatedLabel = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(currencyCache.updatedAt));
    currencyStatusEl.title = `${t("weather_updated")} ${updatedLabel}`;
    currencyStatusEl.setAttribute(
      "aria-label",
      t("currency_aria", {
        rate: rate.toFixed(2),
        inverse: inverse.toFixed(2),
        stronger: usdStronger ? "USD" : "EUR",
      })
    );
  }

  async function fetchCurrency() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR", {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Currency request failed");
      const data = await res.json();
      const rate = data && data.rates && typeof data.rates.EUR === "number" ? data.rates.EUR : null;
      if (rate == null) throw new Error("Malformed currency response");
      currencyCache = { rate, updatedAt: Date.now() };
      saveCurrencyCache(currencyCache);
    } catch (e) {
      // Keep the last known rate.
    } finally {
      clearTimeout(timeout);
      renderCurrency();
    }
  }

  function refreshCurrencyIfNeeded() {
    if (document.hidden) return;
    if (!currencyCache || Date.now() - currencyCache.updatedAt > CURRENCY_REFRESH_MS) fetchCurrency();
  }

  renderAll();
  renderSevere("miami");
  renderSevere("helsinki");
  renderCurrency();
  refreshWeatherIfNeeded();
  refreshSevereIfNeeded();
  refreshCurrencyIfNeeded();

  setInterval(() => {
    refreshWeatherIfNeeded();
    refreshSevereIfNeeded();
    refreshCurrencyIfNeeded();
  }, WEATHER_REFRESH_MS);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshWeatherIfNeeded();
      refreshSevereIfNeeded();
      refreshCurrencyIfNeeded();
    }
  });

  document.addEventListener("app:languagechange", () => {
    renderAll();
    renderSevere("miami");
    renderSevere("helsinki");
    renderCurrency();
  });

  // ---- Footer clearance ----
  // The footer is position:sticky, so on any page short enough that it
  // rests at the viewport bottom without scrolling, main's fixed
  // padding-bottom has to be at least the footer's real rendered height
  // or the footer sits on top of (and hides) the last bit of content.
  // A fixed guess breaks the moment the footer wraps differently — a
  // longer translated tagline, a taller mobile ticker slide, a narrower
  // viewport — so this measures it instead.
  const footerEl = document.getElementById("footer");
  const mainEl = document.querySelector("main");
  function adjustFooterClearance() {
    if (!footerEl || !mainEl) return;
    mainEl.style.paddingBottom = footerEl.offsetHeight + 24 + "px";
  }
  adjustFooterClearance();
  window.addEventListener("resize", adjustFooterClearance);

  // ---- Mobile ticker rotation ----
  // Below 600px (see each host page's #city-strip CSS) only one of the
  // three direct children — Miami, Helsinki, currency — is shown at a
  // time, cycling in that order on a slow loop instead of cramming all
  // three into a wrapped grid. Harmless at wider viewports since the CSS
  // that makes .is-active visually meaningful only applies under 600px.
  const cityStripEl = document.getElementById("city-strip");
  if (cityStripEl) {
    const slides = Array.prototype.slice.call(cityStripEl.children);
    let slideIndex = 0;
    function showSlide(i) {
      slides.forEach((el, idx) => el.classList.toggle("is-active", idx === i));
      // Different slides can wrap to different heights (a severe-weather
      // badge, a longer translated string), so re-measure after each swap.
      adjustFooterClearance();
    }
    showSlide(0);
    setInterval(() => {
      slideIndex = (slideIndex + 1) % slides.length;
      showSlide(slideIndex);
    }, 4500);
  }
})();
