// Animated, weather-responsive background: dark theme -> Miami at night,
// light theme -> Helsinki. Two full-viewport scenes are kept mounted at all
// times so switching themes is an instant cross-fade rather than a reload;
// only the currently-visible scene's animation loop actually runs.
//
// Data comes from /api/environment?city=miami|helsinki (see api/environment.js),
// which already normalizes everything into an EnvironmentState. This file
// never talks to a weather provider directly.
(function () {
  const CITIES = ["miami", "helsinki"];
  const REFRESH_MS = 12 * 60 * 1000; // matches the API's own cache window
  const CACHE_KEY = "envCache";

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  const scenes = {};

  function activeCityForTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "miami" : "helsinki";
  }

  function syncActiveScene() {
    const active = activeCityForTheme();
    CITIES.forEach((city) => {
      const layer = document.getElementById(`bg-${city}`);
      if (!layer) return;
      const isActive = city === active;
      layer.style.opacity = isActive ? "1" : "0";
      if (isActive) scenes[city].start();
      else scenes[city].stop();
    });
  }

  function renderFromCache(city) {
    const entry = cache[city];
    const scene = scenes[city];
    if (!scene) return;
    if (!entry) {
      scene.setState(null);
      return;
    }
    scene.setState(entry.state);
  }

  async function fetchEnvironment(city) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`/api/environment?city=${city}`, { signal: controller.signal });
      if (!res.ok) throw new Error("bad status");
      const data = await res.json();
      if (data.dataFreshness === "unavailable") throw new Error("unavailable");
      cache[city] = { state: data, updatedAt: Date.now() };
      saveCache(cache);
    } catch (e) {
      // Keep whatever was last cached (rendered as-is); if nothing was ever
      // cached, renderFromCache() below shows the calm-neutral base scene.
    } finally {
      clearTimeout(timeout);
      renderFromCache(city);
    }
  }

  function isStale(city) {
    const entry = cache[city];
    if (!entry) return true;
    return Date.now() - entry.updatedAt > REFRESH_MS;
  }

  function refreshIfNeeded() {
    if (document.hidden) return;
    CITIES.forEach((city) => {
      if (isStale(city)) fetchEnvironment(city);
    });
  }

  // ---------- Scene rendering ----------

  const PALETTES = {
    miami: {
      night: ["#050712", "#0a0f24", "#0f1638", "#1a1f42"],
      glow: "rgba(255,140,110,0.16)",
      cloud: "rgba(180,190,215,0.22)",
      rain: "rgba(57,230,208,0.4)",
      star: "#F7F3EE",
      mote: "rgba(244,199,107,0.55)",
      lightning: "rgba(247,243,238,0.85)",
      heat: "rgba(255,92,122,0.16)",
    },
    helsinki: {
      day: ["#f2f7f6", "#e6eeec", "#d7e5e1", "#c8dcd6"],
      twilight: ["#22415a", "#3f6c7c", "#c98a6a", "#e9b98f"],
      glow: "rgba(167,216,229,0.22)",
      cloud: "rgba(120,138,132,0.2)",
      snow: "rgba(255,255,255,0.9)",
      fog: "rgba(200,210,215,0.4)",
      mote: "rgba(255,255,255,0.6)",
      aurora: ["rgba(57,230,208,0.28)", "rgba(31,90,74,0.22)"],
    },
  };

  function createScene(city, canvas) {
    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = null;
    let running = false;
    let envState = null;
    let lastFrame = 0;

    let clouds = [];
    let rain = [];
    let snow = [];
    let stars = [];
    let motes = [];
    let lightningAlpha = 0;
    let lightningTimer = randomLightningDelay();

    function randomLightningDelay() {
      return 9000 + Math.random() * 11000;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
      if (!running) drawFrame(16, performance.now());
    }

    function initParticles() {
      const compact = width < 640;
      clouds = Array.from({ length: compact ? 4 : 7 }, () => makeCloud());
      rain = Array.from({ length: compact ? 45 : 90 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        len: 12 + Math.random() * 16,
        speed: 7 + Math.random() * 6,
      }));
      snow = Array.from({ length: compact ? 45 : 100 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1 + Math.random() * 2.6,
        speed: 0.7 + Math.random() * 1.3,
        drift: Math.random() * Math.PI * 2,
      }));
      stars = Array.from({ length: compact ? 40 : 70 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height * 0.6,
        r: 0.5 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
      }));
      // Always-present slow-drifting motes — the one element that keeps the
      // scene visibly alive even under calm/clear/no-data conditions.
      motes = Array.from({ length: compact ? 10 : 18 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.8 + Math.random() * 1.8,
        vy: -(0.08 + Math.random() * 0.14),
        vx: (Math.random() - 0.5) * 0.06,
        phase: Math.random() * Math.PI * 2,
      }));
    }

    function makeCloud() {
      const w = 160 + Math.random() * 220;
      return {
        x: Math.random() * width,
        y: height * 0.06 + Math.random() * height * 0.32,
        w,
        h: w * (0.22 + Math.random() * 0.1),
        speed: 0.35 + Math.random() * 0.5,
        puffs: Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({
          dx: (Math.random() - 0.5) * 0.7,
          dy: (Math.random() - 0.5) * 0.5,
          scale: 0.5 + Math.random() * 0.6,
        })),
      };
    }

    function skyGradient() {
      const g = ctx.createLinearGradient(0, 0, 0, height);
      if (city === "miami") {
        const [a, b, c, d] = PALETTES.miami.night;
        g.addColorStop(0, a);
        g.addColorStop(0.45, b);
        g.addColorStop(0.75, c);
        g.addColorStop(1, d);
      } else {
        const evening = envState && (envState.twilightPhase === "civil" || envState.twilightPhase === "nautical");
        const [a, b, c, d] = evening ? PALETTES.helsinki.twilight : PALETTES.helsinki.day;
        g.addColorStop(0, a);
        g.addColorStop(0.45, b);
        g.addColorStop(0.75, c);
        g.addColorStop(1, d);
      }
      return g;
    }

    function drawSky(t) {
      ctx.fillStyle = skyGradient();
      ctx.fillRect(0, 0, width, height);

      // Soft horizon glow — a gentle abstract stand-in for "distant city
      // glow" / low winter light, breathing very slowly.
      const breathe = 0.85 + 0.15 * Math.sin(t / 4000);
      const glow = ctx.createRadialGradient(
        width / 2,
        height * 1.05,
        0,
        width / 2,
        height * 1.05,
        width * 0.65
      );
      glow.addColorStop(0, (city === "miami" ? PALETTES.miami.glow : PALETTES.helsinki.glow).replace(
        /[\d.]+\)$/,
        `${0.5 * breathe})`
      ));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    }

    function drawClouds(dt, intensity, coverPct) {
      // Fade proportionally to actual cloud cover so a clear (0%) sky
      // shows no clouds at all, rather than a fixed decorative amount.
      const alpha = Math.min(coverPct / 65, 1);
      if (alpha <= 0.03) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.filter = "blur(6px)";
      ctx.fillStyle = city === "miami" ? PALETTES.miami.cloud : PALETTES.helsinki.cloud;
      clouds.forEach((c) => {
        c.x += c.speed * dt * 0.06 * (1 + intensity);
        if (c.x - c.w > width) c.x = -c.w;
        c.puffs.forEach((p) => {
          ctx.beginPath();
          ctx.ellipse(
            c.x + c.w * p.dx,
            c.y + c.h * p.dy,
            (c.w / 2) * p.scale,
            (c.h / 2) * p.scale,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        });
      });
      ctx.filter = "none";
      ctx.restore();
    }

    function drawMotes(dt, alphaScale) {
      ctx.save();
      ctx.fillStyle = city === "miami" ? PALETTES.miami.mote : PALETTES.helsinki.mote;
      motes.forEach((m) => {
        m.x += m.vx * dt * 0.06;
        m.y += m.vy * dt * 0.06;
        m.phase += 0.0006 * dt;
        if (m.y < -5) m.y = height + 5;
        if (m.x < -5) m.x = width + 5;
        if (m.x > width + 5) m.x = -5;
        const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(m.phase));
        ctx.globalAlpha = twinkle * alphaScale;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    function drawStars(alpha) {
      ctx.save();
      ctx.fillStyle = PALETTES.miami.star;
      stars.forEach((s) => {
        const twinkle = 0.5 + 0.5 * Math.sin(s.phase);
        ctx.globalAlpha = alpha * twinkle;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        s.phase += 0.01;
      });
      ctx.restore();
    }

    function drawRain(windDir, intensityScale) {
      const lean = ((windDir || 90) - 90) * (Math.PI / 180) * 0.35;
      ctx.save();
      ctx.strokeStyle = PALETTES.miami.rain;
      ctx.shadowColor = PALETTES.miami.rain;
      ctx.shadowBlur = 3;
      ctx.lineWidth = 1;
      rain.forEach((d) => {
        d.y += d.speed * intensityScale;
        d.x += Math.sin(lean) * d.speed * 0.6;
        if (d.y > height) {
          d.y = -10;
          d.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + Math.sin(lean) * d.len, d.y + d.len);
        ctx.stroke();
      });
      ctx.restore();
    }

    function drawSnow(intensityScale) {
      ctx.save();
      ctx.fillStyle = PALETTES.helsinki.snow;
      ctx.shadowColor = "rgba(255,255,255,0.8)";
      ctx.shadowBlur = 2;
      ctx.globalAlpha = 0.85;
      snow.forEach((f) => {
        f.y += f.speed * intensityScale;
        f.x += Math.sin(f.drift + f.y * 0.01) * 0.5;
        if (f.y > height) {
          f.y = -5;
          f.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    function drawFog(color, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(0, height * 0.45, 0, height);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, color);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    function drawAurora(probability, t) {
      if (!probability) return;
      ctx.save();
      ctx.globalAlpha = Math.min(probability / 100, 0.6);
      PALETTES.helsinki.aurora.forEach((color, i) => {
        const g = ctx.createLinearGradient(0, 0, 0, height * 0.6);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(0.5, color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        const sway = Math.sin(t / 2200 + i * 2) * 50;
        ctx.save();
        ctx.translate(width * 0.25 * i + sway, 0);
        ctx.fillRect(0, 0, width * 0.7, height * 0.6);
        ctx.restore();
      });
      ctx.restore();
    }

    function drawOcean(t) {
      const bandH = height * 0.16;
      const top = height - bandH;
      const windSpeed = (envState && envState.windSpeed) || 10;
      const activity = 1 + Math.min(windSpeed / 40, 0.7);

      ctx.save();

      const base = ctx.createLinearGradient(0, top, 0, height);
      base.addColorStop(0, "rgba(8,14,30,0)");
      base.addColorStop(0.35, "rgba(7,12,26,0.85)");
      base.addColorStop(1, "rgba(4,8,18,0.96)");
      ctx.fillStyle = base;
      ctx.fillRect(0, top, width, bandH);

      // A soft reflected column of the horizon glow, gently swaying.
      const reflX = width / 2 + Math.sin(t / 3200) * width * 0.05;
      const refl = ctx.createLinearGradient(0, top, 0, height);
      refl.addColorStop(0, "rgba(255,150,120,0.14)");
      refl.addColorStop(1, "rgba(255,150,120,0)");
      ctx.globalAlpha = 0.7 + 0.2 * Math.sin(t / 1600);
      ctx.fillStyle = refl;
      ctx.fillRect(reflX - width * 0.05, top, width * 0.1, bandH);
      ctx.globalAlpha = 1;

      const swells = [
        { amp: 5 * activity, freq: 0.012, speed: 0.0007, y: top + bandH * 0.18, color: "rgba(57,230,208,0.09)" },
        { amp: 8 * activity, freq: 0.009, speed: 0.0011, y: top + bandH * 0.48, color: "rgba(57,230,208,0.14)" },
        { amp: 6 * activity, freq: 0.018, speed: 0.0019, y: top + bandH * 0.8, color: "rgba(247,243,238,0.12)" },
      ];

      swells.forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 10) {
          ctx.lineTo(x, s.y + Math.sin(x * s.freq + t * s.speed) * s.amp);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
      });

      // Foam line riding the frontmost swell, catching a little glow.
      const front = swells[swells.length - 1];
      ctx.beginPath();
      for (let x = 0; x <= width; x += 10) {
        const y = front.y + Math.sin(x * front.freq + t * front.speed) * front.amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(247,243,238,0.45)";
      ctx.shadowColor = "rgba(57,230,208,0.55)";
      ctx.shadowBlur = 7;
      ctx.lineWidth = 1.25;
      ctx.stroke();

      ctx.restore();
    }

    function drawHeatShimmer(t) {
      ctx.save();
      ctx.globalAlpha = 0.1 + 0.05 * Math.sin(t / 1400);
      const g = ctx.createLinearGradient(0, height * 0.7, 0, height);
      g.addColorStop(0, "rgba(255,150,90,0)");
      g.addColorStop(1, PALETTES.miami.heat);
      ctx.fillStyle = g;
      ctx.fillRect(0, height * 0.7, width, height * 0.3);
      ctx.restore();
    }

    function maybeLightning(dt) {
      if (!envState || envState.condition !== "thunderstorm") {
        lightningAlpha = 0;
        return;
      }
      lightningTimer -= dt;
      if (lightningTimer <= 0 && lightningAlpha <= 0) {
        lightningAlpha = 1;
        lightningTimer = randomLightningDelay();
      }
      if (lightningAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = lightningAlpha * 0.45;
        ctx.fillStyle = PALETTES.miami.lightning;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        lightningAlpha -= (0.05 * dt) / 16;
        if (lightningAlpha < 0) lightningAlpha = 0;
      }
    }

    function intensityScale() {
      if (!envState) return 1;
      const map = { none: 0, light: 0.6, moderate: 1, heavy: 1.6 };
      return map[envState.precipitationIntensity] != null ? map[envState.precipitationIntensity] : 1;
    }

    function isHurricaneMode() {
      return !!(
        envState &&
        envState.severeWeatherAlert &&
        /hurricane|tropical-storm/.test(envState.severeWeatherAlert.type)
      );
    }

    function drawFrame(dt, ts) {
      drawSky(ts);
      // Ambient motes drift regardless of data — pure atmosphere, not a
      // depicted condition — so the scene never reads as a frozen slide
      // even with no data, and stay proportionally faint in daylight.
      const moteAlpha = envState && envState.isDaylight ? 0.35 : 1;
      drawMotes(dt, moteAlpha);
      // The surf is a location fixture, not a depicted weather condition —
      // Miami has an ocean regardless of data availability — so it renders
      // even in the calm-neutral state, same as the horizon glow.
      if (city === "miami") drawOcean(ts);
      if (!envState) return; // calm neutral: sky + motes (+ surf) only, no invented conditions

      const hurricane = isHurricaneMode();
      const cloudCoverPct = envState.cloudCover || 0;
      const cloudIntensity = Math.min(cloudCoverPct / 100, 1) + (hurricane ? 0.6 : 0);
      drawClouds(dt, cloudIntensity, hurricane ? Math.max(cloudCoverPct, 70) : cloudCoverPct);

      if (city === "miami") {
        if (envState.condition === "clear" && !envState.isDaylight) drawStars(0.85);
        if (envState.precipitationType === "rain" || hurricane) {
          drawRain(hurricane ? 55 : envState.windDirection, intensityScale() * (hurricane ? 1.8 : 1));
        }
        if (envState.condition === "fog") drawFog(PALETTES.miami.cloud, 0.5);
        maybeLightning(dt);
        if (envState.severeWeatherAlert && envState.severeWeatherAlert.type === "heat") drawHeatShimmer(ts);
      } else {
        if (envState.precipitationType === "snow") drawSnow(intensityScale());
        if (envState.precipitationType === "rain" || envState.precipitationType === "sleet") {
          drawRain(envState.windDirection, intensityScale() * 0.8);
        }
        if (envState.condition === "fog") drawFog(PALETTES.helsinki.fog, 0.6);
        drawAurora(envState.auroraProbability, ts);
      }
    }

    function frame(ts) {
      if (!running) return;
      const dt = lastFrame ? ts - lastFrame : 16;
      lastFrame = ts;
      drawFrame(dt, ts);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      if (prefersReducedMotion()) {
        drawFrame(16, performance.now());
        return;
      }
      running = true;
      lastFrame = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    function setState(state) {
      envState = state;
      if (!running) drawFrame(16, performance.now());
    }

    window.addEventListener("resize", resize);
    resize();

    return { start, stop, resize, setState };
  }

  function init() {
    CITIES.forEach((city) => {
      const canvas = document.getElementById(`bg-canvas-${city}`);
      if (canvas) scenes[city] = createScene(city, canvas);
    });

    CITIES.forEach(renderFromCache);
    syncActiveScene();
    refreshIfNeeded();

    setInterval(refreshIfNeeded, REFRESH_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshIfNeeded();
    });

    const themeObserver = new MutationObserver(syncActiveScene);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    if (window.matchMedia) {
      window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => {
        const active = activeCityForTheme();
        scenes[active].stop();
        scenes[active].start();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
