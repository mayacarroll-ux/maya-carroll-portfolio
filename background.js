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
  // Bump this suffix whenever the cached EnvironmentState shape changes
  // (new fields, etc.) — otherwise a returning visitor's stale-but-not-yet-
  // expired cache silently hides new features for up to REFRESH_MS.
  const CACHE_KEY = "envCache_v2";

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  const PAUSE_KEY = "animationsPaused";
  function isExplicitlyPaused() {
    try {
      return localStorage.getItem(PAUSE_KEY) === "true";
    } catch (e) {
      return false;
    }
  }
  // Either the OS-level reduced-motion preference or the visitor's own
  // persistent pause toggle stops the animation loop — either is enough.
  function motionAllowed() {
    return !prefersReducedMotion() && !isExplicitlyPaused();
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
      // A true near-black silhouette — deliberately darker/more opaque than
      // any stop in the night sky gradient (darkest is #050712) so the
      // palms read as solid shapes against the sky/horizon-glow rather than
      // blending into it.
      palm: "rgba(2,3,6,0.94)",
      palmRim: "rgba(255,170,130,0.35)",
      alligator: "rgba(10,15,10,0.88)",
      alligatorRidge: "rgba(4,7,5,0.9)",
      alligatorEye: "rgba(244,199,107,0.9)",
    },
    helsinki: {
      day: ["#f2f7f6", "#e6eeec", "#d7e5e1", "#c8dcd6"],
      // Cooler, lower-saturation daylight for winter — same family, muted.
      winterDay: ["#e7edee", "#d6e0e2", "#bdccd0", "#a3b4b9"],
      twilight: ["#22415a", "#3f6c7c", "#c98a6a", "#e9b98f"],
      // Nordic white nights: pale blue easing into a warm, low horizon
      // glow — Helsinki's summer sky never actually goes black.
      summerNight: ["#3d5c78", "#6f8ea3", "#d9a874", "#e9c98f"],
      // Genuine winter/spring/autumn night — properly dark, gives the
      // aurora something to read against.
      night: ["#0c1a26", "#16293a", "#243f52", "#3a5468"],
      glow: "rgba(167,216,229,0.22)",
      cloud: "rgba(120,138,132,0.2)",
      snow: "rgba(255,255,255,0.9)",
      sparkle: "rgba(220,240,245,0.9)",
      treeline: "rgba(31,90,74,0.16)",
      snowCap: "rgba(255,255,255,0.35)",
      fog: "rgba(200,210,215,0.4)",
      mote: "rgba(255,255,255,0.6)",
      aurora: ["rgba(57,230,208,0.26)", "rgba(100,170,240,0.18)", "rgba(150,110,215,0.15)"],
      forest: "rgba(31,90,74,0.4)",
      lake: "rgba(150,200,210,0.35)",
      reindeer: "rgba(52,36,24,0.9)",
      reindeerAntler: "rgba(40,28,18,0.9)",
    },
  };

  function createScene(city, canvas) {
    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    // The footer is sticky and sits on top of this fixed-position canvas —
    // ground-level effects (ocean, treeline, heat shimmer) need to render
    // above it rather than at the true bottom edge, or it just covers them.
    let footerReserve = 0;
    let dpr = 1;
    let raf = null;
    let running = false;
    let envState = null;
    let lastFrame = 0;

    let clouds = [];
    let rain = [];
    let snowFar = [];
    let snowNear = [];
    let sparkles = [];
    let stars = [];
    let motes = [];
    let lightningAlpha = 0;
    let lightningTimer = randomLightningDelay();

    // Miami: alligator occasionally swims across the water. Helsinki:
    // reindeer occasionally walks across the treeline. Same
    // wait-then-cross-then-reset mechanic as the lightning flash above,
    // just with a duration instead of an instant flash.
    const ALLIGATOR_CROSSING_MS = 12000;
    const REINDEER_CROSSING_MS = 14000;
    let alligatorTimer = randomCrossingDelay();
    let alligatorElapsed = 0;
    let alligatorActive = false;
    let reindeerTimer = randomCrossingDelay();
    let reindeerElapsed = 0;
    let reindeerActive = false;

    function randomLightningDelay() {
      return 9000 + Math.random() * 11000;
    }

    function randomCrossingDelay() {
      return 25000 + Math.random() * 35000; // 25–60s between appearances
    }

    function measureFooterReserve() {
      const footerEl = document.getElementById("footer");
      return footerEl ? footerEl.offsetHeight : 0;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      footerReserve = measureFooterReserve();
      initParticles();
      if (!running) drawFrame(16, performance.now());
    }

    // The footer's height isn't only driven by window resize — it also
    // grows/shrinks asynchronously as weather, UV, and severe-weather data
    // stream into the ticker after load. Without this, footerReserve stays
    // pinned to the footer's pre-data height and the ground line ends up
    // rendered partly or fully behind the (now taller) footer. Deliberately
    // skips initParticles() so particles don't visibly jump every time a
    // badge nudges the footer's height by a few pixels.
    function syncFooterReserve() {
      const next = measureFooterReserve();
      if (next === footerReserve) return;
      footerReserve = next;
      if (!running) drawFrame(16, performance.now());
    }

    // Scale particle counts down on small viewports and on lower-core-count
    // devices, so the animation stays smooth rather than device-agnostic.
    function isLowPower() {
      return width < 640 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    }

    function initParticles() {
      const compact = isLowPower();
      clouds = Array.from({ length: compact ? 4 : 7 }, () => makeCloud());
      rain = Array.from({ length: compact ? 45 : 90 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        len: 12 + Math.random() * 16,
        speed: 7 + Math.random() * 6,
      }));
      // Two depth layers: a slower, smaller, denser backdrop and a faster,
      // larger, closer layer — reads as real depth rather than one flat
      // field of dots.
      snowFar = Array.from({ length: compact ? 35 : 70 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.6 + Math.random() * 1.2,
        speed: 0.4 + Math.random() * 0.5,
        drift: Math.random() * Math.PI * 2,
      }));
      snowNear = Array.from({ length: compact ? 20 : 45 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1.8 + Math.random() * 2.4,
        speed: 1.1 + Math.random() * 1.4,
        drift: Math.random() * Math.PI * 2,
      }));
      sparkles = Array.from({ length: compact ? 8 : 16 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height * 0.8,
        phase: Math.random() * Math.PI * 2,
        speed: 0.002 + Math.random() * 0.003,
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

    // Which Helsinki sky palette applies right now — driven by season,
    // daylight, and twilight phase so winter/summer/shoulder seasons each
    // read distinctly. Falls back to the calm default "day" palette when
    // data is unavailable, per the "stay attractive with no data" rule.
    function helsinkiSkyState() {
      if (!envState) return "day";
      const season = envState.season;
      const isDaylight = envState.isDaylight;
      const twilight = envState.twilightPhase;
      if (season === "summer" && !isDaylight) return "summerNight"; // white nights — never truly dark
      if (!isDaylight && twilight === "night") return "night";
      if (!isDaylight && (twilight === "civil" || twilight === "nautical" || twilight === "astronomical")) {
        return "twilight";
      }
      if (isDaylight && season === "winter") return "winterDay";
      return "day";
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
        const [a, b, c, d] = PALETTES.helsinki[helsinkiSkyState()];
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

    function drawSnowLayer(flakes, windLean, intensityScale, alpha) {
      ctx.save();
      ctx.fillStyle = PALETTES.helsinki.snow;
      ctx.shadowColor = "rgba(255,255,255,0.8)";
      ctx.shadowBlur = 2;
      ctx.globalAlpha = alpha;
      flakes.forEach((f) => {
        f.y += f.speed * intensityScale;
        f.x += Math.sin(f.drift + f.y * 0.01) * 0.5 + windLean;
        if (f.y > height) {
          f.y = -5;
          f.x = Math.random() * width;
        }
        if (f.x > width + 5) f.x = -5;
        if (f.x < -5) f.x = width + 5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // Gentle wind is applied as a steady horizontal lean, driven by real
    // wind direction/speed, on top of each flake's own sine wobble.
    function drawSnow(intensityScale, windDirection, windSpeed) {
      const windLean = Math.sin(((windDirection || 0) * Math.PI) / 180) * Math.min((windSpeed || 0) / 30, 1.2);
      drawSnowLayer(snowFar, windLean * 0.5, intensityScale * 0.8, 0.55);
      drawSnowLayer(snowNear, windLean, intensityScale, 0.9);
    }

    // Occasional bright twinkles on clear, cold days — reads as sunlight
    // catching ice/frost rather than a literal snow effect.
    function drawIceSparkle(t) {
      ctx.save();
      ctx.fillStyle = PALETTES.helsinki.sparkle;
      sparkles.forEach((s) => {
        const twinkle = Math.max(0, Math.sin(t * s.speed + s.phase));
        if (twinkle < 0.7) return;
        ctx.globalAlpha = (twinkle - 0.7) / 0.3;
        ctx.shadowColor = PALETTES.helsinki.sparkle;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // A soft, blurred pine treeline — deliberately low-contrast and blurred
    // (same technique as the cloud layer) rather than a sharp graphic, so
    // it reads as atmospheric depth, not clip art. Winter only.
    function drawWinterTreeline() {
      const bandH = height * 0.1;
      const baseY = height - footerReserve;
      const peaks = 9;
      ctx.save();
      ctx.filter = "blur(5px)";
      ctx.fillStyle = PALETTES.helsinki.treeline;
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (let i = 0; i <= peaks; i++) {
        const x = (i / peaks) * width;
        const peakH = bandH * (0.5 + 0.5 * Math.sin(i * 1.7));
        ctx.lineTo(x, baseY - peakH);
      }
      ctx.lineTo(width, baseY);
      ctx.closePath();
      ctx.fill();

      // Thin snow-cap highlight tracing the same ridge.
      ctx.filter = "blur(2px)";
      ctx.strokeStyle = PALETTES.helsinki.snowCap;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= peaks; i++) {
        const x = (i / peaks) * width;
        const peakH = bandH * (0.5 + 0.5 * Math.sin(i * 1.7));
        const y = baseY - peakH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.filter = "none";
      ctx.restore();
    }

    // A cluster of simple pine-tree silhouettes at the shoreline — drawn
    // unconditionally (a location fixture, not a depicted condition), same
    // philosophy as Miami's ocean/palms. In winter, drawWinterTreeline()
    // layers its own blurred ridge + snow-cap on top of this.
    function drawForest() {
      const groundY = height - footerReserve;
      ctx.save();
      ctx.fillStyle = PALETTES.helsinki.forest;
      const trees = [
        { x: width * 0.06, h: Math.min(height * 0.09, 60) },
        { x: width * 0.09, h: Math.min(height * 0.12, 78) },
        { x: width * 0.123, h: Math.min(height * 0.07, 46) },
      ];
      trees.forEach(({ x, h }) => {
        const w = h * 0.6;
        // Trunk.
        ctx.fillRect(x - w * 0.06, groundY - h * 0.12, w * 0.12, h * 0.12);
        // Three stacked triangle tiers, classic pine silhouette.
        for (let tier = 0; tier < 3; tier++) {
          const tierH = h * 0.42;
          const tierW = w * (1 - tier * 0.22);
          const tierBaseY = groundY - h * 0.1 - tier * h * 0.3;
          const tierTopY = tierBaseY - tierH;
          ctx.beginPath();
          ctx.moveTo(x - tierW / 2, tierBaseY);
          ctx.lineTo(x + tierW / 2, tierBaseY);
          ctx.lineTo(x, tierTopY);
          ctx.closePath();
          ctx.fill();
        }
      });
      ctx.restore();
    }

    // A calm lake band at the shoreline — Miami's ocean equivalent, but
    // still water rather than surf: one gentle ripple, no swells or foam.
    function drawLake(t) {
      const bandH = height * 0.1;
      const top = height - footerReserve - bandH;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 12) {
        const y = top + bandH * 0.35 + Math.sin(x * 0.01 + t / 2600) * bandH * 0.06;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = PALETTES.helsinki.lake;
      ctx.fill();
      ctx.restore();
    }

    // Walks left-to-right across the treeline every 25–60s, then rests.
    function maybeReindeer(dt, t) {
      if (reindeerActive) {
        reindeerElapsed += dt;
        if (reindeerElapsed >= REINDEER_CROSSING_MS) {
          reindeerActive = false;
          reindeerTimer = randomCrossingDelay();
          return;
        }
      } else {
        reindeerTimer -= dt;
        if (reindeerTimer <= 0) {
          reindeerActive = true;
          reindeerElapsed = 0;
        } else {
          return;
        }
      }

      const frac = reindeerElapsed / REINDEER_CROSSING_MS;
      const groundY = height - footerReserve;
      const x = -width * 0.08 + frac * width * 1.16;
      const h = Math.min(height * 0.13, 78);
      const strideCycle = t / 130;
      const strideOffset = Math.sin(strideCycle) * h * 0.06;

      ctx.save();
      ctx.translate(x, groundY - h * 0.42 + Math.abs(Math.sin(strideCycle)) * h * 0.03);
      ctx.strokeStyle = PALETTES.helsinki.reindeer;
      ctx.fillStyle = PALETTES.helsinki.reindeer;
      ctx.lineCap = "round";
      // Legs: alternating pairs for a walking gait.
      ctx.lineWidth = Math.max(2, h * 0.045);
      [
        { x: h * 0.28, phase: 0 },
        { x: -h * 0.28, phase: Math.PI },
      ].forEach(({ x: lx, phase }) => {
        const swing = Math.sin(strideCycle + phase) * h * 0.16;
        ctx.beginPath();
        ctx.moveTo(lx, h * 0.05);
        ctx.lineTo(lx + swing, h * 0.42);
        ctx.stroke();
      });
      // Body.
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.1, h * 0.42, h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Neck: a tapered quad connecting the body to the head, distinctly
      // thinner than the body so the two don't read as one blob.
      const neckBaseX = h * 0.32;
      const neckBaseY = -h * 0.16;
      const headX = h * 0.56;
      const headY = -h * 0.5;
      const headR = h * 0.15;
      ctx.beginPath();
      ctx.moveTo(neckBaseX - h * 0.04, neckBaseY + h * 0.08);
      ctx.lineTo(headX - headR * 0.7, headY + headR * 0.3);
      ctx.lineTo(headX + headR * 0.2, headY + headR * 0.6);
      ctx.lineTo(neckBaseX + h * 0.1, neckBaseY + h * 0.1);
      ctx.closePath();
      ctx.fill();
      // Head: a small rounded shape distinct from the neck.
      ctx.beginPath();
      ctx.ellipse(headX, headY, headR, headR * 0.82, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // Snout, facing the direction of travel.
      ctx.beginPath();
      ctx.moveTo(headX + headR * 0.6, headY - headR * 0.15);
      ctx.lineTo(headX + headR * 1.7, headY + headR * 0.15);
      ctx.lineTo(headX + headR * 0.55, headY + headR * 0.6);
      ctx.closePath();
      ctx.fill();
      // Ears: two small triangles behind the antlers — a detail that,
      // together with the branched rack below, is what actually reads as
      // "deer-like animal" rather than an ambiguous four-legged silhouette.
      ctx.beginPath();
      ctx.moveTo(headX - headR * 0.55, headY - headR * 0.55);
      ctx.lineTo(headX - headR * 1.1, headY - headR * 0.95);
      ctx.lineTo(headX - headR * 0.25, headY - headR * 0.75);
      ctx.closePath();
      ctx.fill();
      // Small tail near the rear of the body.
      ctx.beginPath();
      ctx.ellipse(-h * 0.42, -h * 0.14, h * 0.055, h * 0.04, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Antlers: a proper branching rack — a main beam curving forward off
      // the head, with two smaller tines forking off each side, instead of
      // the previous two bare strokes.
      const antlerBaseX = headX - headR * 0.1;
      const antlerBaseY = headY - headR * 0.8;
      ctx.lineWidth = Math.max(1.75, h * 0.032);
      [-1, 1].forEach((dir) => {
        const beamMidX = antlerBaseX + dir * h * 0.1;
        const beamMidY = antlerBaseY - h * 0.22;
        const beamTipX = antlerBaseX + dir * h * 0.22 + strideOffset * 0.15;
        const beamTipY = antlerBaseY - h * 0.38;
        // Main beam, gently curved forward.
        ctx.beginPath();
        ctx.moveTo(antlerBaseX, antlerBaseY);
        ctx.quadraticCurveTo(beamMidX, beamMidY, beamTipX, beamTipY);
        ctx.stroke();
        // Two tines forking off the beam.
        ctx.beginPath();
        ctx.moveTo(beamMidX, beamMidY + h * 0.03);
        ctx.lineTo(beamMidX + dir * h * 0.13, beamMidY - h * 0.06);
        ctx.moveTo(antlerBaseX + dir * h * 0.03, antlerBaseY - h * 0.08);
        ctx.lineTo(antlerBaseX + dir * h * 0.15, antlerBaseY - h * 0.14);
        ctx.stroke();
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
      const top = height - footerReserve - bandH;
      const windSpeed = (envState && envState.windSpeed) || 10;
      const sea = envState && envState.seaState;

      // Real sea state (Open-Meteo Marine, Miami only — see
      // api/environment.js) drives the two back layers (swell: the slow,
      // tall background roll) and the front layer (wind-chop: fast, small
      // surface texture) independently, since that's how they actually
      // behave in real water. 0.4m/4.5s and 0.15m/3s are typical calm-day
      // references for this coast; real readings scale the animation
      // relative to that baseline, clamped so a rough-weather day nudges
      // things rather than turning the ambient background chaotic.
      const swellHeightM = sea && typeof sea.swellHeight === "number" ? sea.swellHeight : null;
      const swellPeriodS = sea && sea.swellPeriod ? sea.swellPeriod : null;
      const windWaveHeightM = sea && sea.windWaveHeight ? sea.windWaveHeight : null;
      const windWavePeriodS = sea && sea.windWavePeriod ? sea.windWavePeriod : null;

      const swellScale = swellHeightM != null ? clamp(swellHeightM / 0.4, 0.6, 2.2) : 1;
      const swellSpeedScale = swellPeriodS ? clamp(4.5 / swellPeriodS, 0.7, 1.4) : 1;
      const chopScale =
        windWaveHeightM != null && windWaveHeightM > 0.02
          ? clamp(windWaveHeightM / 0.15, 0.6, 2.2)
          : 1 + Math.min(windSpeed / 40, 0.7); // no usable wind-wave reading — fall back to wind speed
      const chopSpeedScale = windWavePeriodS ? clamp(3 / windWavePeriodS, 0.7, 1.5) : 1;

      ctx.save();

      const base = ctx.createLinearGradient(0, top, 0, height);
      base.addColorStop(0, "rgba(8,14,30,0)");
      base.addColorStop(0.35, "rgba(7,12,26,0.85)");
      base.addColorStop(1, "rgba(4,8,18,0.96)");
      ctx.fillStyle = base;
      ctx.fillRect(0, top, width, bandH);

      // Each swell combines two sine components at different, deliberately
      // non-multiple frequencies/speeds (the second drifting the opposite
      // direction) so crests don't repeat identically down the line —
      // individual humps rise, flatten, and fall on their own rather than
      // the whole layer reading as one uniform traveling wave. The back two
      // layers are "swell", the front is "wind-chop" — each scaled off its
      // own real measurement above.
      const swells = [
        { amp: 5 * swellScale, freq: 0.012, speed: 0.0007 * swellSpeedScale, freq2: 0.027, speed2: -0.0013 * swellSpeedScale, phase2: 1.1, y: top + bandH * 0.18, color: "rgba(57,230,208,0.09)" },
        { amp: 8 * swellScale, freq: 0.009, speed: 0.0011 * swellSpeedScale, freq2: 0.021, speed2: -0.0017 * swellSpeedScale, phase2: 2.4, y: top + bandH * 0.48, color: "rgba(57,230,208,0.14)" },
        { amp: 6 * chopScale, freq: 0.018, speed: 0.0019 * chopSpeedScale, freq2: 0.035, speed2: -0.0009 * chopSpeedScale, phase2: 0.6, y: top + bandH * 0.8, color: "rgba(247,243,238,0.12)" },
      ];

      // A plain sine is symmetric; real ocean waves aren't — crests peak
      // and troughs flatten as the wave steepens. Adding a small second
      // harmonic at the *same* phase (a first-order Stokes-wave correction)
      // gives each crest that asymmetric shape instead of a uniform bump.
      function stokes(theta) {
        return Math.sin(theta) + 0.3 * Math.sin(2 * theta);
      }

      function waveY(x, s) {
        return (
          s.y +
          stokes(x * s.freq + t * s.speed) * s.amp * 0.65 +
          Math.sin(x * s.freq2 + t * s.speed2 + s.phase2) * s.amp * 0.35
        );
      }

      swells.forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 10) {
          ctx.lineTo(x, waveY(x, s));
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
        const y = waveY(x, front);
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

    // A couple of static palm silhouettes anchored to the shore — a
    // location fixture like the ocean itself, not a depicted condition.
    function drawPalmTrees() {
      const groundY = height - footerReserve;
      ctx.save();
      ctx.lineCap = "round";
      [
        { x: width * 0.07, h: Math.min(height * 0.18, 130), lean: 0.18 },
        { x: width * 0.125, h: Math.min(height * 0.13, 92), lean: -0.12 },
      ].forEach(({ x, h, lean }) => {
        const topX = x + lean * h;
        const topY = groundY - h;
        ctx.fillStyle = PALETTES.miami.palm;
        ctx.strokeStyle = PALETTES.miami.palm;
        // Trunk: a gently curved quad tapering toward the crown, with a
        // couple of faint growth-ring notches for texture.
        ctx.beginPath();
        ctx.moveTo(x - h * 0.05, groundY);
        ctx.quadraticCurveTo(x + lean * h * 0.55, groundY - h * 0.6, topX - h * 0.025, topY);
        ctx.lineTo(topX + h * 0.035, topY);
        ctx.quadraticCurveTo(x + lean * h * 0.55 + h * 0.06, groundY - h * 0.6, x + h * 0.035, groundY);
        ctx.closePath();
        ctx.fill();
        // Crown: a fuller fan of drooping fronds radiating from the top of
        // the trunk — more blades, wider spread, and a thicker base taper so
        // each frond reads as a distinct blade instead of a thin wisp.
        const frondCount = 8;
        for (let i = 0; i < frondCount; i++) {
          const angle = -Math.PI * 1.05 + (i / (frondCount - 1)) * Math.PI * 1.0;
          const len = h * 0.62;
          const endX = topX + Math.cos(angle) * len;
          const endY = topY + Math.sin(angle) * len + len * 0.32; // droop
          const midX = topX + Math.cos(angle) * len * 0.55;
          const midY = topY + Math.sin(angle) * len * 0.55 - len * 0.1;
          ctx.lineWidth = Math.max(3, h * 0.055);
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.quadraticCurveTo(midX, midY, endX, endY);
          ctx.stroke();
          // A slim rim-light pass along the same curve — reads as the warm
          // horizon glow catching the frond's upper edge, which both adds
          // realism and gives the silhouette a second, lighter tone so it
          // doesn't read as a flat blob even at a glance.
          ctx.save();
          ctx.strokeStyle = PALETTES.miami.palmRim;
          ctx.lineWidth = Math.max(1, h * 0.018);
          ctx.beginPath();
          ctx.moveTo(topX, topY - h * 0.01);
          ctx.quadraticCurveTo(midX, midY - h * 0.02, endX, endY - h * 0.03);
          ctx.stroke();
          ctx.restore();
        }
        // A small coconut cluster at the crown base — the detail that reads
        // "palm tree" at a glance rather than "generic frond fan".
        ctx.beginPath();
        ctx.ellipse(topX - h * 0.02, topY + h * 0.05, h * 0.045, h * 0.06, 0.3, 0, Math.PI * 2);
        ctx.ellipse(topX + h * 0.05, topY + h * 0.07, h * 0.04, h * 0.055, -0.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // Swims left-to-right across the water every 25–60s, then rests.
    function maybeAlligator(dt, t) {
      if (alligatorActive) {
        alligatorElapsed += dt;
        if (alligatorElapsed >= ALLIGATOR_CROSSING_MS) {
          alligatorActive = false;
          alligatorTimer = randomCrossingDelay();
          return;
        }
      } else {
        alligatorTimer -= dt;
        if (alligatorTimer <= 0) {
          alligatorActive = true;
          alligatorElapsed = 0;
        } else {
          return;
        }
      }

      const frac = alligatorElapsed / ALLIGATOR_CROSSING_MS;
      const bandH = height * 0.16;
      const waterY = height - footerReserve - bandH * 0.18;
      const x = -width * 0.08 + frac * width * 1.16;
      const bob = Math.sin(t / 260) * 2.5;
      // Larger and more elongated than before — real alligators read as a
      // long, low, flat line riding the surface, not a short oval.
      const bodyLen = Math.max(58, width * 0.058);
      const y = waterY + bob;

      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = PALETTES.miami.alligator;
      // Body: a long, flattened silhouette riding the waterline.
      ctx.beginPath();
      ctx.ellipse(0, 0, bodyLen * 0.56, bodyLen * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head + snout: broad at the eyes, tapering to a blunt (not pointed)
      // tip — the flat, rounded profile that actually distinguishes a
      // gator's head from a generic wedge.
      ctx.beginPath();
      ctx.moveTo(bodyLen * 0.4, -bodyLen * 0.09);
      ctx.lineTo(bodyLen * 0.68, -bodyLen * 0.04);
      ctx.lineTo(bodyLen * 0.78, 0);
      ctx.lineTo(bodyLen * 0.68, bodyLen * 0.05);
      ctx.lineTo(bodyLen * 0.4, bodyLen * 0.09);
      ctx.closePath();
      ctx.fill();
      // Dorsal ridge: a few small triangular scutes along the spine — the
      // single detail that most reads as "alligator" versus a plain blob.
      ctx.beginPath();
      [-0.16, -0.02, 0.12, 0.26].forEach((pos) => {
        const rx = bodyLen * pos;
        const rise = bodyLen * 0.09;
        ctx.moveTo(rx - bodyLen * 0.045, -bodyLen * 0.07);
        ctx.lineTo(rx, -bodyLen * 0.07 - rise);
        ctx.lineTo(rx + bodyLen * 0.045, -bodyLen * 0.07);
      });
      ctx.closePath();
      ctx.fill();
      // Tail, tapering behind with a visible S-curve sway as it swims.
      ctx.beginPath();
      ctx.moveTo(-bodyLen * 0.54, -bodyLen * 0.02);
      ctx.quadraticCurveTo(-bodyLen * 0.78, Math.sin(t / 240) * bodyLen * 0.1, -bodyLen * 0.98, Math.sin(t / 240 + 1) * bodyLen * 0.04);
      ctx.quadraticCurveTo(-bodyLen * 0.78, bodyLen * 0.05, -bodyLen * 0.54, bodyLen * 0.06);
      ctx.closePath();
      ctx.fill();
      // Two small eye bumps just above the waterline, set back from the
      // snout tip the way a real gator's eyes sit near the top of the head.
      ctx.fillStyle = PALETTES.miami.alligatorEye;
      ctx.beginPath();
      ctx.arc(bodyLen * 0.42, -bodyLen * 0.09, bodyLen * 0.028, 0, Math.PI * 2);
      ctx.arc(bodyLen * 0.33, -bodyLen * 0.08, bodyLen * 0.028, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawHeatShimmer(t) {
      const groundY = height - footerReserve;
      const bandH = height * 0.3;
      const top = groundY - bandH;
      ctx.save();
      ctx.globalAlpha = 0.1 + 0.05 * Math.sin(t / 1400);
      const g = ctx.createLinearGradient(0, top, 0, groundY);
      g.addColorStop(0, "rgba(255,150,90,0)");
      g.addColorStop(1, PALETTES.miami.heat);
      ctx.fillStyle = g;
      ctx.fillRect(0, top, width, bandH);
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
      // The surf, palms, lake, and forest are location fixtures, not
      // depicted weather conditions — they render regardless of data
      // availability, same as the horizon glow. The alligator/reindeer
      // crossings are timer-driven, independent of weather data too.
      if (city === "miami") {
        drawOcean(ts);
        drawPalmTrees();
        maybeAlligator(dt, ts);
      } else {
        drawLake(ts);
        drawForest();
        maybeReindeer(dt, ts);
      }
      if (!envState) return; // calm neutral: sky + motes (+ fixtures) only, no invented conditions

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
        if (envState.season === "winter") drawWinterTreeline();
        // Physical plausibility gate: only draw snow when it's actually
        // cold enough, even if a provider glitch reports snow at 15°C.
        const coldEnough = envState.temperature == null || envState.temperature <= 3;
        if (envState.precipitationType === "snow" && coldEnough) {
          drawSnow(intensityScale(), envState.windDirection, envState.windSpeed);
        }
        if (envState.precipitationType === "rain" || envState.precipitationType === "sleet") {
          drawRain(envState.windDirection, intensityScale() * 0.8);
        }
        if (envState.condition === "fog") drawFog(PALETTES.helsinki.fog, 0.6);
        const clearAndCold = envState.season === "winter" && envState.cloudCover < 35 && coldEnough;
        if (clearAndCold) drawIceSparkle(ts);
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
      if (!motionAllowed() || document.hidden) {
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

    const footerEl = document.getElementById("footer");
    if (footerEl) new ResizeObserver(syncFooterReserve).observe(footerEl);

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
      const active = activeCityForTheme();
      if (document.hidden) {
        scenes[active].stop();
      } else {
        refreshIfNeeded();
        scenes[active].start();
      }
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

    // Persistent, visitor-controlled pause — independent of the OS
    // reduced-motion setting, and remembered across visits.
    const pauseBtn = document.getElementById("motion-toggle");
    if (pauseBtn) {
      function syncPauseButton() {
        const paused = isExplicitlyPaused();
        pauseBtn.textContent = paused ? "▶" : "⏸";
        pauseBtn.setAttribute(
          "aria-label",
          paused ? "Resume background animation" : "Pause background animation"
        );
      }
      pauseBtn.addEventListener("click", () => {
        const next = !isExplicitlyPaused();
        try {
          localStorage.setItem(PAUSE_KEY, String(next));
        } catch (e) {}
        syncPauseButton();
        const active = activeCityForTheme();
        scenes[active].stop();
        scenes[active].start();
      });
      syncPauseButton();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
