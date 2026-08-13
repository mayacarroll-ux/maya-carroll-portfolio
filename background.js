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
      // Near-black, same recipe as the palm silhouette: a navy-tinted
      // translucent skyline (tried first, twice) kept blending into the
      // night sky gradient at some viewport heights — variations on that
      // idea couldn't out-contrast every stop of that gradient. Only an
      // actually-dark color reliably can. The blur filter
      // drawMiamiSkyline() applies is what keeps this reading as
      // hazy/distant rather than as crisp as the palm trees in front.
      skyline: "rgba(3,4,9,0.93)",
      skylineWindow: "rgba(244,199,107,0.9)",
      // South Beach Art Deco neon — hot pink and cyan tube signage, the
      // two colors that dominate an Ocean Drive night shot, plus a
      // secondary violet for variety. Cyan intentionally matches
      // --color-accent so the skyline's lighting ties back into the
      // site's own palette rather than introducing an unrelated hue.
      neonPink: "rgba(255,55,150,0.95)",
      neonCyan: "rgba(80,240,220,0.95)",
      neonPurple: "rgba(180,110,255,0.9)",
      // A soft, wide bloom sitting low in the sky above the strip — the
      // colored haze neon signage casts on real overcast/humid Miami
      // nights, drawn once behind all the buildings rather than per-light.
      neonBloom: "rgba(255,70,170,0.1)",
      // Same near-black, high-opacity recipe as the palm/skyline — a bird
      // silhouette crosses through every part of the sky gradient during
      // its flight, so it needs to out-contrast all of it, not just
      // whichever stop it started against.
      pelican: "rgba(6,8,14,0.92)",
      pelicanRim: "rgba(255,190,150,0.4)",
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
      // A lighter warm tan for the chest/underbelly patch real reindeer
      // have — a single flat brown silhouette otherwise reads as "generic
      // four-legged animal" rather than specifically a reindeer.
      reindeerChest: "rgba(120,96,70,0.85)",
      // A small light catch-light dot reads far better as an eye against a
      // dark silhouette than a same-tone darker fleck would.
      reindeerEye: "rgba(230,214,190,0.9)",
      // The summer cottage/sauna are drawn in actual color rather than the
      // flat translucent silhouettes used elsewhere — a little "punainen
      // mökki" (red cottage) by the lake reads as charming precisely
      // because it's not just another dark shape.
      cottageWall: "rgba(122,45,38,0.92)",
      cottageTrim: "rgba(250,247,238,0.92)",
      cottageRoof: "rgba(38,28,24,0.92)",
      cottageChimney: "rgba(96,58,44,0.92)",
      cottageWindow: "rgba(248,206,120,0.85)",
      saunaWall: "rgba(94,68,46,0.9)",
      smoke: "rgba(235,233,228,1)",
      // Dark enough to contrast against both the pale day sky and the
      // dark night/winter sky — an owl crosses through whichever is active.
      owl: "rgba(42,32,24,0.92)",
      owlEye: "rgba(244,199,107,0.9)",
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

    // Same mechanic again, but through the sky rather than along the
    // ground/water — Miami's pelican, Helsinki's owl.
    const PELICAN_CROSSING_MS = 10000;
    const OWL_CROSSING_MS = 11000;
    let pelicanTimer = randomCrossingDelay();
    let pelicanElapsed = 0;
    let pelicanActive = false;
    let owlTimer = randomCrossingDelay();
    let owlElapsed = 0;
    let owlActive = false;

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

    // A few soft puffs rising and drifting from a chimney, looping
    // seamlessly (each puff's alpha fades in from and back out to zero
    // over its cycle, so there's no pop at the loop boundary). t drives
    // the motion the same way it drives waves/clouds elsewhere — no
    // per-puff state to track between frames.
    function drawChimneySmoke(x, topY, scale, t) {
      ctx.save();
      ctx.fillStyle = PALETTES.helsinki.smoke;
      const puffCount = 4;
      const cycleMs = 3400;
      const riseDistance = scale * 3.2;
      for (let i = 0; i < puffCount; i++) {
        const loopT = (t + (i * cycleMs) / puffCount) % cycleMs;
        const frac = loopT / cycleMs;
        const y = topY - frac * riseDistance;
        const drift = Math.sin(frac * Math.PI * 2.1 + i * 1.7) * scale * 0.55 * frac;
        const x2 = x + drift + frac * scale * 0.25; // gentle overall lean, like a light breeze
        const radius = scale * (0.16 + frac * 0.24);
        const alpha = Math.sin(frac * Math.PI) * 0.4;
        if (alpha <= 0.01) continue;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x2, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // A little lakeside summer cottage (mökki) with its own sauna, just
    // along the shore from the pine cluster — a location fixture like the
    // forest/lake, drawn unconditionally. Unlike the flat translucent
    // silhouettes used elsewhere, this one is drawn in actual color: a
    // small red-and-white cottage reads as "charming" in a way a dark
    // shape doesn't.
    function drawSummerCottage(t) {
      const groundY = height - footerReserve;
      ctx.save();

      // --- Main cottage ---
      const cx = width * 0.175;
      const cw = Math.min(height * 0.16, 92);
      const ch = cw * 0.62;
      const roofH = ch * 0.65;
      const wallTop = groundY - ch;

      ctx.fillStyle = PALETTES.helsinki.cottageWall;
      ctx.fillRect(cx - cw / 2, wallTop, cw, ch);
      // Corner trim.
      ctx.fillStyle = PALETTES.helsinki.cottageTrim;
      ctx.fillRect(cx - cw / 2, wallTop, cw * 0.05, ch);
      ctx.fillRect(cx + cw / 2 - cw * 0.05, wallTop, cw * 0.05, ch);
      // Roof.
      ctx.fillStyle = PALETTES.helsinki.cottageRoof;
      ctx.beginPath();
      ctx.moveTo(cx - cw * 0.62, wallTop);
      ctx.lineTo(cx, wallTop - roofH);
      ctx.lineTo(cx + cw * 0.62, wallTop);
      ctx.closePath();
      ctx.fill();
      // Chimney — its own color (not roof-colored, which made it
      // invisible) and tall enough to clearly clear the roof peak.
      ctx.fillStyle = PALETTES.helsinki.cottageChimney;
      const chimneyTop = wallTop - roofH * 1.18;
      ctx.fillRect(cx + cw * 0.14, chimneyTop, cw * 0.08, roofH * 0.75);
      drawChimneySmoke(cx + cw * 0.14 + cw * 0.04, chimneyTop, cw * 0.22, t);
      // Door.
      ctx.fillStyle = PALETTES.helsinki.cottageTrim;
      const doorW = cw * 0.16;
      const doorH = ch * 0.5;
      ctx.fillRect(cx - doorW / 2, groundY - doorH, doorW, doorH);
      // Windows, either side of the door — a warm glow for coziness.
      ctx.fillStyle = PALETTES.helsinki.cottageWindow;
      const winW = cw * 0.15;
      const winY = wallTop + ch * 0.22;
      [cx - cw * 0.32, cx + cw * 0.32].forEach((wx) => {
        ctx.fillRect(wx - winW / 2, winY, winW, winW);
      });
      // Window cross-bars.
      ctx.strokeStyle = PALETTES.helsinki.cottageWall;
      ctx.lineWidth = Math.max(1, winW * 0.09);
      [cx - cw * 0.32, cx + cw * 0.32].forEach((wx) => {
        ctx.beginPath();
        ctx.moveTo(wx, winY);
        ctx.lineTo(wx, winY + winW);
        ctx.moveTo(wx - winW / 2, winY + winW / 2);
        ctx.lineTo(wx + winW / 2, winY + winW / 2);
        ctx.stroke();
      });

      // --- Sauna: a smaller weathered-wood building beside it, the way
      // lakeside saunas actually sit apart from the main cottage. ---
      const sx = cx + cw * 1.05;
      const sw = cw * 0.58;
      const sh = sw * 0.62;
      const sRoofH = sh * 0.55;
      const sWallTop = groundY - sh;
      ctx.fillStyle = PALETTES.helsinki.saunaWall;
      ctx.fillRect(sx - sw / 2, sWallTop, sw, sh);
      // Roof — a distinct darker color from the walls, same as the cottage.
      ctx.fillStyle = PALETTES.helsinki.cottageRoof;
      ctx.beginPath();
      ctx.moveTo(sx - sw * 0.58, sWallTop);
      ctx.lineTo(sx, sWallTop - sRoofH);
      ctx.lineTo(sx + sw * 0.58, sWallTop);
      ctx.closePath();
      ctx.fill();
      // Stovepipe — tall enough to clear the roof peak, same chimney color
      // as the cottage.
      ctx.fillStyle = PALETTES.helsinki.cottageChimney;
      ctx.fillRect(sx - sw * 0.22, sWallTop - sRoofH * 1.2, sw * 0.07, sRoofH * 0.75);
      // Small window, same warm glow as the cottage.
      ctx.fillStyle = PALETTES.helsinki.cottageWindow;
      ctx.fillRect(sx - sw * 0.11, sWallTop + sh * 0.32, sw * 0.22, sw * 0.22);

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
      // A gradient that darkens/deepens toward the bottom, same idea as
      // the ocean's base — a single flat 0.35-alpha fill (tried first)
      // washed out into an indistinct gray smear against warm dusk/day
      // skies instead of reading as water, the same low-contrast mistake
      // the palm trees and skyline originally had.
      const base = ctx.createLinearGradient(0, top, 0, height);
      base.addColorStop(0, "rgba(120,178,195,0.4)");
      base.addColorStop(0.4, "rgba(88,150,175,0.68)");
      base.addColorStop(1, "rgba(55,112,142,0.88)");
      ctx.fillStyle = base;
      ctx.fill();
      // A bright ripple line tracing the water's leading edge — the same
      // "give the surface a visible highlight" technique as the ocean's
      // foam line, so the lake reads as a body of water rather than a
      // flat color block.
      ctx.beginPath();
      for (let x = 0; x <= width; x += 12) {
        const y = top + bandH * 0.35 + Math.sin(x * 0.01 + t / 2600) * bandH * 0.06;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.25;
      ctx.stroke();
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
        const footX = lx + swing;
        const footY = h * 0.42;
        ctx.beginPath();
        ctx.moveTo(lx, h * 0.05);
        ctx.lineTo(footX, footY);
        ctx.stroke();
        // A small hoof tick at the base of each leg — a flat little
        // perpendicular cap instead of the leg just ending in a line.
        ctx.save();
        ctx.lineWidth = Math.max(2.5, h * 0.05);
        ctx.beginPath();
        ctx.moveTo(footX - h * 0.035, footY);
        ctx.lineTo(footX + h * 0.035, footY);
        ctx.stroke();
        ctx.restore();
      });
      // Body.
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.1, h * 0.42, h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Chest/underbelly patch: a lighter tan area on the lower-front of
      // the body, the two-tone marking that reads as "reindeer" rather
      // than a generic dark quadruped silhouette.
      ctx.save();
      ctx.fillStyle = PALETTES.helsinki.reindeerChest;
      ctx.beginPath();
      ctx.ellipse(h * 0.16, -h * 0.02, h * 0.16, h * 0.1, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
      // Eye: a small catch-light near the front of the head — without it
      // the head reads as a featureless rounded end rather than a face.
      ctx.save();
      ctx.fillStyle = PALETTES.helsinki.reindeerEye;
      ctx.beginPath();
      ctx.arc(headX + headR * 0.35, headY - headR * 0.05, headR * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = PALETTES.helsinki.reindeer;
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
        // Brow tine: a short spur pointing forward (toward the snout,
        // regardless of which side this antler is drawn on) near the base
        // of the beam — real reindeer racks branch low as well as at the
        // top, which the beam-plus-two-tines shape above doesn't capture.
        ctx.beginPath();
        ctx.moveTo(antlerBaseX + dir * h * 0.02, antlerBaseY + h * 0.03);
        ctx.lineTo(antlerBaseX + dir * h * 0.02 + h * 0.11, antlerBaseY + h * 0.1);
        ctx.stroke();
      });
      ctx.restore();
    }

    // Flies left-to-right across the sky every 25–60s, then rests — same
    // mechanic as the reindeer's ground crossing, just airborne.
    function maybeOwl(dt, t) {
      if (owlActive) {
        owlElapsed += dt;
        if (owlElapsed >= OWL_CROSSING_MS) {
          owlActive = false;
          owlTimer = randomCrossingDelay();
          return;
        }
      } else {
        owlTimer -= dt;
        if (owlTimer <= 0) {
          owlActive = true;
          owlElapsed = 0;
        } else {
          return;
        }
      }

      const frac = owlElapsed / OWL_CROSSING_MS;
      const x = -width * 0.08 + frac * width * 1.16;
      const flightY = height * 0.26 + Math.sin(frac * Math.PI * 2.2) * height * 0.02;
      const s = Math.min(height * 0.1, 42);
      // Slower, broader wingbeat than the pelican's, with a distinct pause
      // at the top of each stroke — owls fly with a few slow flaps and a
      // long glide, not a continuous even oscillation. Raising a sine to
      // an odd power keeps its range and sign but flattens it near the
      // extremes and steepens it through the middle, giving that
      // flap-flap-glide rhythm instead of a metronome swing.
      const raw = Math.sin(t / 320);
      const flap = Math.sign(raw) * Math.pow(Math.abs(raw), 0.6);
      // Extra fold at the wrist on the upstroke, same idea as the
      // pelican's — a rigid paddle sweeping symmetrically doesn't read as
      // a real wingbeat.
      const wristBend = Math.max(0, flap) * 0.7;

      ctx.save();
      ctx.translate(x, flightY);

      // A broad, rounded wing in two hinged segments, with a softly
      // fringed trailing edge — the comb-like serration on a real owl's
      // flight feathers that gives it silent flight, and a good visual
      // cue distinguishing it from the pelican's smoother, pointed wing.
      function owlWing(shoulderAngle) {
        ctx.save();
        ctx.rotate(shoulderAngle);
        ctx.fillStyle = PALETTES.helsinki.owl;
        // Inner wing (arm) — broad and rounded.
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.12);
        ctx.quadraticCurveTo(-s * 0.28, -s * 0.32, -s * 0.5, -s * 0.1);
        ctx.lineTo(-s * 0.5, s * 0.14);
        ctx.quadraticCurveTo(-s * 0.24, s * 0.22, 0, s * 0.14);
        ctx.closePath();
        ctx.fill();
        // Outer wing (hand), hinged at the wrist, rounded at the tip with
        // a fringed trailing edge.
        ctx.translate(-s * 0.5, 0);
        ctx.rotate(wristBend);
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.1);
        ctx.quadraticCurveTo(-s * 0.3, -s * 0.16, -s * 0.5, -s * 0.02);
        ctx.quadraticCurveTo(-s * 0.56, s * 0.04, -s * 0.46, s * 0.08);
        // Fringe: a few small comb-teeth along the trailing edge.
        ctx.lineTo(-s * 0.36, s * 0.05);
        ctx.lineTo(-s * 0.28, s * 0.1);
        ctx.lineTo(-s * 0.19, s * 0.06);
        ctx.lineTo(-s * 0.11, s * 0.1);
        ctx.lineTo(0, s * 0.07);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Far wing.
      ctx.save();
      ctx.translate(-s * 0.02, -s * 0.06);
      owlWing(-0.3 - flap * 0.55);
      ctx.restore();

      // Body — rounder than the pelican's.
      ctx.fillStyle = PALETTES.helsinki.owl;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.38, s * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();

      // Round head with two small ear tufts.
      const headX = s * 0.26;
      const headY = -s * 0.16;
      ctx.beginPath();
      ctx.arc(headX, headY, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(headX - s * 0.14, headY - s * 0.18);
      ctx.lineTo(headX - s * 0.2, headY - s * 0.32);
      ctx.lineTo(headX - s * 0.04, headY - s * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(headX + s * 0.1, headY - s * 0.2);
      ctx.lineTo(headX + s * 0.17, headY - s * 0.33);
      ctx.lineTo(headX + s * 0.21, headY - s * 0.18);
      ctx.closePath();
      ctx.fill();
      // Eyes — small warm catch-lights, same trick used for the reindeer.
      ctx.fillStyle = PALETTES.helsinki.owlEye;
      ctx.beginPath();
      ctx.arc(headX - s * 0.07, headY - s * 0.02, s * 0.045, 0, Math.PI * 2);
      ctx.arc(headX + s * 0.08, headY - s * 0.02, s * 0.045, 0, Math.PI * 2);
      ctx.fill();

      // Near wing, broad and rounded, flapping.
      ctx.save();
      ctx.translate(-s * 0.02, s * 0.04);
      owlWing(0.25 + flap * 0.6);
      ctx.restore();

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

    // A dim, softened mirror of the aurora on the lake's surface — the
    // reflection calm-water aurora photos are known for. Same color array
    // and horizontal sway as drawAurora() (so the reflection visibly
    // tracks its source) but clipped to the lake band, brightest right at
    // the shoreline and fading with distance, and at a lower alpha
    // throughout since a reflection is always a fainter echo of the sky.
    function drawAuroraReflection(probability, t) {
      if (!probability) return;
      const bandH = height * 0.1;
      const lakeTop = height - footerReserve - bandH;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, lakeTop, width, height - lakeTop);
      ctx.clip();
      ctx.globalAlpha = Math.min(probability / 100, 0.6) * 0.55;
      PALETTES.helsinki.aurora.forEach((color, i) => {
        const g = ctx.createLinearGradient(0, lakeTop, 0, height);
        g.addColorStop(0, color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        const sway = Math.sin(t / 2200 + i * 2) * 50;
        ctx.save();
        ctx.translate(width * 0.25 * i + sway, 0);
        ctx.fillRect(0, lakeTop, width * 0.7, height - lakeTop);
        ctx.restore();
      });
      ctx.restore();
    }

    // Downtown Miami's skyline, hazy across the water — a location fixture
    // like the ocean/palms, drawn unconditionally. Sits behind the ocean
    // (drawn next, in drawFrame) so its translucent water bands wash over
    // the buildings' feet, and it's deliberately lower-contrast/blurred
    // than the palm trees in front so it reads as background depth rather
    // than a second foreground shape competing with them.
    function drawMiamiSkyline() {
      // Anchored just above the ocean's own top edge (bandH matches
      // drawOcean's) so only the buildings' feet sit in the water — flush
      // against groundY (tried first) put the whole skyline inside the
      // ocean band's vertical span, i.e. fully submerged under its
      // translucent wash instead of rising above the waterline.
      const groundY = height - footerReserve;
      const bandH = height * 0.16;
      const baseY = groundY - bandH * 0.8;
      // Heights/widths are hand-picked (not procedural) for a silhouette
      // that reads as a real, slightly irregular skyline rather than a
      // repeating pattern — same approach as the palm/forest clusters.
      const buildings = [
        { x: 0.17, w: 0.016, h: 0.07 },
        { x: 0.193, w: 0.012, h: 0.045 },
        { x: 0.212, w: 0.018, h: 0.095 },
        { x: 0.238, w: 0.014, h: 0.06 },
        { x: 0.258, w: 0.02, h: 0.13, deco: true }, // tallest — stepped art-deco crown
        { x: 0.286, w: 0.013, h: 0.05 },
        { x: 0.305, w: 0.016, h: 0.08 },
        { x: 0.328, w: 0.011, h: 0.04 },
        { x: 0.344, w: 0.017, h: 0.1 },
        { x: 0.368, w: 0.013, h: 0.055 },
        { x: 0.388, w: 0.015, h: 0.07 },
      ];
      const neonColors = [PALETTES.miami.neonPink, PALETTES.miami.neonCyan, PALETTES.miami.neonPurple];

      ctx.save();

      // Soft ambient bloom low in the sky above the strip — drawn once,
      // behind every building, rather than glow-per-light, so it reads as
      // one atmospheric wash instead of eleven overlapping haloes.
      const bloom = ctx.createRadialGradient(
        width * 0.28,
        baseY,
        0,
        width * 0.28,
        baseY,
        width * 0.22
      );
      bloom.addColorStop(0, PALETTES.miami.neonBloom);
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, baseY - height * 0.22, width, height * 0.24);

      ctx.filter = "blur(1.3px)";
      buildings.forEach((b, i) => {
        const x = width * b.x;
        const w = Math.max(3, width * b.w);
        // Capped in px (not just a height fraction) so buildings stay a
        // sensible size on tall/narrow mobile viewports instead of
        // scaling up with the full page height.
        const h = Math.min(height * b.h, 140 * (b.h / 0.13));
        const top = baseY - h;
        ctx.fillStyle = PALETTES.miami.skyline;
        if (b.deco) {
          // A simple stepped crown — a small nod to Miami's actual Art
          // Deco skyline character instead of every tower being a plain box.
          ctx.beginPath();
          ctx.moveTo(x, baseY);
          ctx.lineTo(x, top + h * 0.22);
          ctx.lineTo(x + w * 0.22, top + h * 0.22);
          ctx.lineTo(x + w * 0.22, top);
          ctx.lineTo(x + w * 0.78, top);
          ctx.lineTo(x + w * 0.78, top + h * 0.22);
          ctx.lineTo(x + w, top + h * 0.22);
          ctx.lineTo(x + w, baseY);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(x, top, w, h);
        }
        // A handful of deterministic (index-seeded, not random) lit
        // windows, so downtown reads as inhabited without flickering a
        // new random pattern every frame.
        ctx.fillStyle = PALETTES.miami.skylineWindow;
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 2; col++) {
            if (Math.sin(i * 3.1 + row * 1.7 + col * 2.3) > 0.5) {
              const wx = x + w * (0.25 + col * 0.45);
              const wy = top + h * (0.18 + row * 0.2);
              const wSize = Math.max(1, w * 0.14);
              ctx.fillRect(wx, wy, wSize, wSize);
            }
          }
        }

        // Neon Art Deco trim: a glowing vertical tube along one edge of
        // the facade, the signature South Beach look (Ocean Drive hotels
        // are lit with exactly this — a single bright stripe up the
        // corner of the building, not floodlighting). Color cycles
        // deterministically through pink/cyan/violet by building index.
        const neonColor = neonColors[i % neonColors.length];
        ctx.save();
        ctx.strokeStyle = neonColor;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = Math.max(3, w * 0.6);
        ctx.lineWidth = Math.max(1, w * 0.09);
        ctx.beginPath();
        ctx.moveTo(x + w * 0.14, baseY - h * 0.05);
        ctx.lineTo(x + w * 0.14, top + h * 0.08);
        ctx.stroke();
        // On alternating buildings, a second, shorter horizontal band
        // near the base — a marquee/awning sign, in a different neon
        // color than the vertical stripe for variety.
        if (i % 2 === 0) {
          const marqueeColor = neonColors[(i + 1) % neonColors.length];
          ctx.strokeStyle = marqueeColor;
          ctx.shadowColor = marqueeColor;
          ctx.lineWidth = Math.max(1, h * 0.045);
          ctx.beginPath();
          ctx.moveTo(x + w * 0.1, baseY - h * 0.22);
          ctx.lineTo(x + w * 0.85, baseY - h * 0.22);
          ctx.stroke();
        }
        // The tallest tower's stepped crown gets its outline traced in
        // neon too, echoing how Deco hotels light their roofline.
        if (b.deco) {
          ctx.strokeStyle = neonColors[(i + 2) % neonColors.length];
          ctx.shadowColor = ctx.strokeStyle;
          ctx.lineWidth = Math.max(1, w * 0.05);
          ctx.beginPath();
          ctx.moveTo(x + w * 0.22, top + h * 0.22);
          ctx.lineTo(x + w * 0.22, top);
          ctx.lineTo(x + w * 0.78, top);
          ctx.lineTo(x + w * 0.78, top + h * 0.22);
          ctx.stroke();
        }
        ctx.restore();
      });
      ctx.filter = "none";
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
        // Trunk: a gently curved quad tapering toward the crown.
        ctx.beginPath();
        ctx.moveTo(x - h * 0.05, groundY);
        ctx.quadraticCurveTo(x + lean * h * 0.55, groundY - h * 0.6, topX - h * 0.025, topY);
        ctx.lineTo(topX + h * 0.035, topY);
        ctx.quadraticCurveTo(x + lean * h * 0.55 + h * 0.06, groundY - h * 0.6, x + h * 0.035, groundY);
        ctx.closePath();
        ctx.fill();
        // Bark rings: a handful of short notches climbing the trunk — real
        // palm trunks are visibly segmented, not a smooth taper.
        ctx.save();
        ctx.strokeStyle = PALETTES.miami.palmRim;
        ctx.lineWidth = Math.max(1, h * 0.012);
        for (let r = 1; r <= 5; r++) {
          const ringFrac = r / 6;
          const ringY = groundY - h * ringFrac * 0.85;
          const ringX = x + lean * h * ringFrac * 0.75;
          const ringW = h * (0.055 - ringFrac * 0.015);
          ctx.beginPath();
          ctx.moveTo(ringX - ringW, ringY + h * 0.015);
          ctx.quadraticCurveTo(ringX, ringY - h * 0.01, ringX + ringW, ringY + h * 0.015);
          ctx.stroke();
        }
        ctx.restore();
        // Crown: a fuller fan of drooping fronds radiating from the top of
        // the trunk — more blades, wider spread, and a thicker base taper so
        // each frond reads as a distinct blade instead of a thin wisp. Each
        // frond's droop/length is nudged by a deterministic (index-seeded,
        // not random) offset so the crown reads as organic instead of a
        // perfectly uniform fan — using Math.random() here would make it
        // flicker into a new shape every frame instead of holding still.
        const frondCount = 8;
        for (let i = 0; i < frondCount; i++) {
          const wobble = Math.sin(i * 2.7 + h) * 0.12;
          const angle = -Math.PI * 1.05 + (i / (frondCount - 1)) * Math.PI * 1.0;
          const len = h * (0.58 + wobble * 0.35);
          const droop = 0.32 + wobble * 0.18;
          const endX = topX + Math.cos(angle) * len;
          const endY = topY + Math.sin(angle) * len + len * droop;
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
          // Leaflet ticks: a few short strokes off the frond's spine —
          // palm fronds are pinnate (many small leaflets off a central
          // rib), not a single smooth blade, and this is what actually
          // reads as "leaf" rather than "wire" at a glance.
          ctx.save();
          ctx.lineWidth = Math.max(0.75, h * 0.01);
          for (let s = 0.25; s <= 0.85; s += 0.2) {
            const sx = topX + (midX - topX) * s + (endX - midX) * Math.max(0, s - 0.55) * 2.2;
            const sy = topY + (midY - topY) * s + (endY - midY) * Math.max(0, s - 0.55) * 2.2;
            const normalAngle = angle + Math.PI / 2;
            const tickLen = h * 0.05 * (1 - s * 0.4);
            ctx.beginPath();
            ctx.moveTo(sx - Math.cos(normalAngle) * tickLen, sy - Math.sin(normalAngle) * tickLen);
            ctx.lineTo(sx + Math.cos(normalAngle) * tickLen, sy + Math.sin(normalAngle) * tickLen);
            ctx.stroke();
          }
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
      const tailMidY = Math.sin(t / 240) * bodyLen * 0.1;
      const tailTipY = Math.sin(t / 240 + 1) * bodyLen * 0.04;
      ctx.beginPath();
      ctx.moveTo(-bodyLen * 0.54, -bodyLen * 0.02);
      ctx.quadraticCurveTo(-bodyLen * 0.78, tailMidY, -bodyLen * 0.98, tailTipY);
      ctx.quadraticCurveTo(-bodyLen * 0.78, bodyLen * 0.05, -bodyLen * 0.54, bodyLen * 0.06);
      ctx.closePath();
      ctx.fill();
      // The dorsal ridge continues onto the tail as two smaller scutes,
      // following the same sway — a real gator's tail crest doesn't stop
      // where the body ends.
      ctx.beginPath();
      [0.62, 0.82].forEach((pos, i) => {
        const rx = -bodyLen * pos;
        const ry = (i === 0 ? tailMidY : tailTipY) * 0.6 - bodyLen * 0.03;
        const rise = bodyLen * 0.06;
        ctx.moveTo(rx - bodyLen * 0.035, ry);
        ctx.lineTo(rx, ry - rise);
        ctx.lineTo(rx + bodyLen * 0.035, ry);
      });
      ctx.closePath();
      ctx.fill();
      // A faint wake trailing the tail — two short ripple lines fading
      // back from the body, the give-away of something moving through
      // still water rather than a shape just sitting on top of it.
      ctx.save();
      ctx.strokeStyle = PALETTES.miami.alligator;
      ctx.lineWidth = 1;
      [0.85, 1.15].forEach((pos, i) => {
        ctx.globalAlpha = 0.35 - i * 0.12;
        const wy = Math.sin(t / 240 + i) * bodyLen * 0.05;
        ctx.beginPath();
        ctx.moveTo(-bodyLen * pos, wy - bodyLen * 0.06);
        ctx.quadraticCurveTo(-bodyLen * (pos + 0.12), wy, -bodyLen * (pos + 0.24), wy - bodyLen * 0.06);
        ctx.stroke();
      });
      ctx.restore();
      // Two small eye bumps just above the waterline, set back from the
      // snout tip the way a real gator's eyes sit near the top of the head.
      ctx.fillStyle = PALETTES.miami.alligatorEye;
      ctx.beginPath();
      ctx.arc(bodyLen * 0.42, -bodyLen * 0.09, bodyLen * 0.028, 0, Math.PI * 2);
      ctx.arc(bodyLen * 0.33, -bodyLen * 0.08, bodyLen * 0.028, 0, Math.PI * 2);
      ctx.fill();
      // Nostril bumps right at the snout tip — the other feature (besides
      // the eyes) that stays visible above the waterline while swimming.
      ctx.fillStyle = PALETTES.miami.alligatorRidge;
      ctx.beginPath();
      ctx.arc(bodyLen * 0.74, -bodyLen * 0.015, bodyLen * 0.014, 0, Math.PI * 2);
      ctx.arc(bodyLen * 0.7, -bodyLen * 0.025, bodyLen * 0.014, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Flies left-to-right across the sky every 25–60s, then rests — same
    // wait-then-cross-then-reset mechanic as the alligator, just airborne.
    function maybePelican(dt, t) {
      if (pelicanActive) {
        pelicanElapsed += dt;
        if (pelicanElapsed >= PELICAN_CROSSING_MS) {
          pelicanActive = false;
          pelicanTimer = randomCrossingDelay();
          return;
        }
      } else {
        pelicanTimer -= dt;
        if (pelicanTimer <= 0) {
          pelicanActive = true;
          pelicanElapsed = 0;
        } else {
          return;
        }
      }

      const frac = pelicanElapsed / PELICAN_CROSSING_MS;
      const x = -width * 0.08 + frac * width * 1.16;
      // Low, coastal flight, close over the water — and, just as
      // importantly, inside the warmer/lighter lower portion of the sky
      // gradient near the horizon glow. Flying it up in the darker upper
      // sky (tried first) put a near-black silhouette against near-black
      // sky, the same low-contrast mistake the palm trees originally had.
      const flightY = height * 0.52 + Math.sin(frac * Math.PI * 2.5) * height * 0.02;
      const s = Math.min(height * 0.12, 50);
      // A slower, more deliberate beat than a small songbird's — pelicans
      // alternate a few unhurried flaps with long glides.
      const flapCycle = t / 260;
      const flap = Math.sin(flapCycle);
      // Extra bend at the "wrist" partway along the wing, biased toward
      // the upstroke (flap > 0 here) — real flapping isn't a rigid paddle
      // sweeping symmetrically; the outer wing folds more on the way up
      // than it does on the way down.
      const wristBend = Math.max(0, flap) * 0.8;

      ctx.save();
      ctx.translate(x, flightY);

      // A wing, drawn in two hinged segments (shoulder→wrist, then
      // wrist→tip) so the flap has a visible bend instead of swinging as
      // one stiff paddle, with a couple of notches at the tip suggesting
      // primary feathers.
      function pelicanWing(shoulderAngle) {
        ctx.save();
        ctx.rotate(shoulderAngle);
        ctx.fillStyle = PALETTES.miami.pelican;
        // Inner wing (arm).
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.08);
        ctx.quadraticCurveTo(-s * 0.28, -s * 0.22, -s * 0.52, -s * 0.06);
        ctx.lineTo(-s * 0.52, s * 0.1);
        ctx.quadraticCurveTo(-s * 0.26, s * 0.16, 0, s * 0.1);
        ctx.closePath();
        ctx.fill();
        // Rim-light along the leading edge, catching the horizon glow —
        // the same trick that made the palm fronds read as distinct
        // blades instead of a flat silhouette.
        ctx.save();
        ctx.strokeStyle = PALETTES.miami.pelicanRim;
        ctx.lineWidth = Math.max(1, s * 0.02);
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.07);
        ctx.quadraticCurveTo(-s * 0.28, -s * 0.2, -s * 0.5, -s * 0.05);
        ctx.stroke();
        ctx.restore();
        // Outer wing (hand/primaries), hinged at the wrist.
        ctx.translate(-s * 0.52, 0);
        ctx.rotate(wristBend);
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.07);
        ctx.quadraticCurveTo(-s * 0.32, -s * 0.1, -s * 0.55, 0);
        ctx.lineTo(-s * 0.4, s * 0.05);
        ctx.lineTo(-s * 0.26, s * 0.02);
        ctx.lineTo(-s * 0.12, s * 0.08);
        ctx.lineTo(0, s * 0.06);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Far wing first, so the body/near wing paint over it.
      ctx.save();
      ctx.translate(-s * 0.04, -s * 0.04);
      pelicanWing(-0.35 - flap * 0.4);
      ctx.restore();

      // Body.
      ctx.fillStyle = PALETTES.miami.pelican;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.5, s * 0.2, -0.05, 0, Math.PI * 2);
      ctx.fill();

      // Head, long beak, and the droopy throat pouch — the single detail
      // that makes this read as "pelican" instead of "generic bird".
      const headX = s * 0.55;
      const headY = -s * 0.02;
      ctx.beginPath();
      ctx.ellipse(headX, headY, s * 0.14, s * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(headX + s * 0.1, headY - s * 0.02);
      ctx.lineTo(headX + s * 0.62, headY + s * 0.04);
      ctx.lineTo(headX + s * 0.1, headY + s * 0.13);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(headX + s * 0.15, headY + s * 0.08);
      ctx.quadraticCurveTo(headX + s * 0.32, headY + s * 0.27, headX + s * 0.5, headY + s * 0.09);
      ctx.quadraticCurveTo(headX + s * 0.34, headY + s * 0.16, headX + s * 0.15, headY + s * 0.08);
      ctx.closePath();
      ctx.fill();

      // Near wing, on top, flapping.
      ctx.save();
      ctx.translate(-s * 0.01, s * 0.03);
      pelicanWing(0.3 + flap * 0.55);
      ctx.restore();

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
        // Skyline first, so the ocean's translucent water bands (drawn
        // next) wash over its base — it needs to sit visually behind the
        // water, not float in front of it.
        drawMiamiSkyline();
        drawOcean(ts);
        drawPalmTrees();
        maybeAlligator(dt, ts);
        maybePelican(dt, ts);
      } else {
        drawLake(ts);
        drawForest();
        drawSummerCottage(ts);
        maybeReindeer(dt, ts);
        maybeOwl(dt, ts);
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
        drawAuroraReflection(envState.auroraProbability, ts);
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
