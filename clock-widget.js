// Homepage body-clock widget: one glanceable analog + 24h activity-ring
// clock. Reads the rhythm/time logic from schedule.js (window.MayaRhythm) —
// this file only renders and handles the minute-tick + city-label tap.
(function () {
  const R = window.MayaRhythm;
  if (!R) return;

  const CX = 120;
  const CY = 120;
  const R_RING_OUT = 112;
  const R_RING_IN = 100;
  const R_TICK_OUT = 98;
  const R_TICK_IN = 93;
  const R_LABEL = 84;
  const R_ICON = 106;
  const R_MARKER = 106;
  const R_HOUR_HAND = 44;
  const R_MINUTE_HAND = 62;
  const R_CENTER = 36;

  const svg = document.getElementById("clock-svg");
  const remainingEl = document.getElementById("clock-remaining");
  const nextEl = document.getElementById("clock-next");
  const srSummary = document.getElementById("clock-sr-summary");
  const timeEls = {
    miami: document.getElementById("clock-time-miami"),
    helsinki: document.getElementById("clock-time-helsinki"),
  };
  const cityBtns = {
    miami: document.getElementById("clock-city-miami"),
    helsinki: document.getElementById("clock-city-helsinki"),
  };
  if (!svg) return;

  let emphasizedCity = "miami";
  let lastAnnouncedState = null;

  function loadFormatPref() {
    try {
      return localStorage.getItem("clockFormat") === "24" ? "24" : "12";
    } catch (e) {
      return "12";
    }
  }
  const format = loadFormatPref();

  function polarToXY(r, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
  }
  function hourToAngle(h) {
    return (h / 24) * 360 - 90;
  }

  function ringSegmentPath(rInner, rOuter, startAngle, endAngle) {
    const [x1o, y1o] = polarToXY(rOuter, startAngle);
    const [x2o, y2o] = polarToXY(rOuter, endAngle);
    const [x2i, y2i] = polarToXY(rInner, endAngle);
    const [x1i, y1i] = polarToXY(rInner, startAngle);
    const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
    return [
      `M ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)}`,
      `L ${x2i.toFixed(2)} ${y2i.toFixed(2)}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
      "Z",
    ].join(" ");
  }

  // Small, deliberately simple vector icons — not emoji/text glyphs — so
  // each state reads distinctly even without color (accessibility: "do not
  // rely on color alone").
  function iconMarkup(state, cx, cy, size, color) {
    const s = size;
    switch (state) {
      case "rest": // crescent moon
        return `<path d="M ${cx + s * 0.4} ${cy - s} a ${s} ${s} 0 1 0 0 ${s * 2} a ${s * 0.75} ${s * 0.75} 0 1 1 0 -${s * 2} Z" fill="${color}" />`;
      case "awake": // open circle
        return `<circle cx="${cx}" cy="${cy}" r="${s * 0.8}" fill="none" stroke="${color}" stroke-width="${s * 0.35}" />`;
      case "focus": // diamond
        return `<rect x="${cx - s * 0.7}" y="${cy - s * 0.7}" width="${s * 1.4}" height="${s * 1.4}" fill="${color}" transform="rotate(45 ${cx} ${cy})" />`;
      case "move": // motion chevron
        return `<path d="M ${cx - s * 0.7} ${cy - s} L ${cx + s * 0.6} ${cy} L ${cx - s * 0.7} ${cy + s}" fill="none" stroke="${color}" stroke-width="${s * 0.35}" stroke-linecap="round" stroke-linejoin="round" />`;
      case "meal": // plate: ring + center dot
        return `<circle cx="${cx}" cy="${cy}" r="${s * 0.85}" fill="none" stroke="${color}" stroke-width="${s * 0.28}" /><circle cx="${cx}" cy="${cy}" r="${s * 0.3}" fill="${color}" />`;
      default:
        return "";
    }
  }

  function buildRing(now, currentSeg) {
    const miamiHour = R.hourFloatInZone(now, R.CITY_ZONES.miami.timeZone);
    let out = "";
    R.RHYTHM_CONFIG.forEach((seg) => {
      const startAngle = hourToAngle(seg.start);
      const sweep = R.segmentDuration(seg);
      const endAngle = hourToAngle(seg.start + sweep);
      const isCurrent = seg.state === currentSeg.state && seg.start === currentSeg.startHour;
      const midHour = (seg.start + sweep / 2) % 24;
      const offset = R.hourOffsetFromNow(midHour, miamiHour);
      const isPast = offset < 0 && !isCurrent;
      const opacity = isCurrent ? 1 : isPast ? 0.32 : 0.68;
      const color = `var(--state-${seg.state})`;
      const path = ringSegmentPath(R_RING_IN, R_RING_OUT, startAngle + 1, endAngle - 1);
      out += `<path class="clock-ring-seg" d="${path}" fill="${color}" opacity="${opacity}" style="${isCurrent ? "filter:var(--clock-glow)" : ""}">
        <title>${R.STATES[seg.state].label}: ${R.formatHour(seg.start, format)}–${R.formatHour(seg.start + sweep, format)}</title>
      </path>`;
      const midAngle = hourToAngle(midHour);
      const [ix, iy] = polarToXY(R_ICON, midAngle);
      out += iconMarkup(seg.state, ix, iy, 5, "var(--color-bg)");
    });
    return out;
  }

  function buildTicks() {
    let out = "";
    for (let h = 0; h < 24; h++) {
      const angle = hourToAngle(h);
      const isCardinal = h % 6 === 0;
      const [x1, y1] = polarToXY(isCardinal ? R_TICK_IN - 3 : R_TICK_IN, angle);
      const [x2, y2] = polarToXY(R_TICK_OUT, angle);
      out += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="var(--color-border)" stroke-width="${isCardinal ? 1.5 : 0.75}" />`;
      if (isCardinal) {
        const label = h === 0 ? "12A" : h === 6 ? "6A" : h === 12 ? "12P" : "6P";
        const [lx, ly] = polarToXY(R_LABEL, angle);
        out += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="var(--color-text-secondary)">${label}</text>`;
      }
    }
    return out;
  }

  function buildHandsAndMarker(now, miamiHour) {
    const hour12 = miamiHour % 12;
    const hourAngle = (hour12 / 12) * 360 - 90;
    const minuteOfHour = (miamiHour - Math.floor(miamiHour)) * 60;
    const minuteAngle = (minuteOfHour / 60) * 360 - 90;
    const [hx, hy] = polarToXY(R_HOUR_HAND, hourAngle);
    const [mx, my] = polarToXY(R_MINUTE_HAND, minuteAngle);
    const markerAngle = hourToAngle(miamiHour);
    const [mkx, mky] = polarToXY(R_MARKER, markerAngle);

    return `
      <line class="clock-hand is-hour" x1="${CX}" y1="${CY}" x2="${hx.toFixed(2)}" y2="${hy.toFixed(2)}" stroke="var(--color-text)" stroke-width="4" />
      <line class="clock-hand is-minute" x1="${CX}" y1="${CY}" x2="${mx.toFixed(2)}" y2="${my.toFixed(2)}" stroke="var(--color-text)" stroke-width="2.5" />
      <circle cx="${mkx.toFixed(2)}" cy="${mky.toFixed(2)}" r="3" fill="var(--color-accent-2)" stroke="var(--color-bg)" stroke-width="1" />
    `;
  }

  function buildCenter(currentSeg) {
    const color = `var(--state-${currentSeg.state})`;
    return `
      <circle cx="${CX}" cy="${CY}" r="${R_CENTER}" fill="var(--color-surface)" stroke="var(--color-border)" stroke-width="1" />
      ${iconMarkup(currentSeg.state, CX, CY - 10, 7, color)}
      <text x="${CX}" y="${CY + 14}" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="0.04em" fill="var(--color-text)">${currentSeg.label.toUpperCase()}</text>
    `;
  }

  function render() {
    const now = new Date();
    const currentSeg = R.getCurrentSegment(now);
    const nextSeg = R.getNextSegment(now);
    const miamiHour = R.hourFloatInZone(now, R.CITY_ZONES.miami.timeZone);

    svg.innerHTML =
      buildRing(now, currentSeg) +
      buildTicks() +
      buildHandsAndMarker(now, miamiHour) +
      buildCenter(currentSeg);

    const untilLabel = R.formatHour(currentSeg.endHour, format);
    remainingEl.textContent = `Now · until ${untilLabel} · ${R.formatRemaining(currentSeg.remainingMinutes)}`;
    nextEl.textContent = `Next: ${nextSeg.label} at ${R.formatHour(nextSeg.startHour, format)}`;

    Object.keys(R.CITY_ZONES).forEach((city) => {
      const hour = R.hourFloatInZone(now, R.CITY_ZONES[city].timeZone);
      timeEls[city].textContent = R.formatHour(hour, format);
    });

    // The visible text updates every minute (fine for sighted users), but
    // the aria-live region only gets rewritten — and so only announced —
    // when the activity actually changes, not on every countdown tick.
    if (currentSeg.state !== lastAnnouncedState) {
      lastAnnouncedState = currentSeg.state;
      srSummary.textContent = `${currentSeg.label} now, until ${untilLabel}. Next: ${nextSeg.label} at ${R.formatHour(
        nextSeg.startHour,
        format
      )}. Miami time ${R.formatHour(
        R.hourFloatInZone(now, R.CITY_ZONES.miami.timeZone),
        format
      )}, Helsinki time ${R.formatHour(R.hourFloatInZone(now, R.CITY_ZONES.helsinki.timeZone), format)}.`;
    }
  }

  // Tapping a city label only changes which time is visually emphasized —
  // the dial, hands, and active state never change, since both cities
  // represent the same instant.
  function setEmphasis(city) {
    emphasizedCity = city;
    Object.keys(cityBtns).forEach((c) => {
      cityBtns[c].setAttribute("aria-pressed", String(c === city));
    });
  }
  cityBtns.miami.addEventListener("click", () => setEmphasis("miami"));
  cityBtns.helsinki.addEventListener("click", () => setEmphasis("helsinki"));

  render();
  setInterval(render, 60 * 1000);
})();
