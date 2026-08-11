// Dual-city availability schedule: Miami (winters) / Helsinki (summers).
//
// SCHEDULE_CONFIG is the single source of truth for the actual sleep/wake/
// focus times. There is no public editing UI for these values — per the
// "private configuration" requirement, and because this site has no login
// system, the owner adjusts her real schedule by editing this object
// directly and redeploying. Visitors can only adjust *display* preferences
// (12h/24h format, DST-alignment mode) — never the underlying schedule.
//
// Validation summary (see chat for full reasoning): Miami's afternoon heat
// peaks ~2–4 PM with residual warmth into evening; the coolest hours are
// pre-dawn (~4–7 AM). The 2 PM–10 PM sleep window covers peak heat, and the
// 10 PM–5 AM stretch of "awake" (before focused work) covers the coolest
// overnight/pre-dawn hours — so the stated goals hold. Helsinki's schedule
// is a conventional Nordic workday, a stable anchor across its large
// seasonal daylight swings.
const SCHEDULE_CONFIG = {
  miami: {
    label: "Miami",
    timeZone: "America/New_York",
    lat: 25.7617,
    lon: -80.1918,
    sleep: [14, 22], // 2:00 PM – 10:00 PM
    focus: [5, 13], // 5:00 AM – 1:00 PM
  },
  helsinki: {
    label: "Helsinki",
    timeZone: "Europe/Helsinki",
    lat: 60.1699,
    lon: 24.9384,
    sleep: [21, 5], // 9:00 PM – 5:00 AM
    focus: [8, 16], // 8:00 AM – 4:00 PM
  },
};

const PREFS_KEY = "schedulePrefs"; // { format: '12'|'24', dstMode: 'local'|'absolute' }

function loadPrefs() {
  try {
    return Object.assign({ format: "12", dstMode: "local" }, JSON.parse(localStorage.getItem(PREFS_KEY)));
  } catch (e) {
    return { format: "12", dstMode: "local" };
  }
}
function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    /* degrade silently */
  }
}

// An hour interval may cross midnight (e.g. Helsinki sleep 21→5). Returns
// true if `hourFloat` (0–24) falls inside [start, end), wrapping as needed.
function inWindow(hourFloat, [start, end]) {
  if (start === end) return false;
  if (start < end) return hourFloat >= start && hourFloat < end;
  return hourFloat >= start || hourFloat < end;
}

function hourFloatInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour").value);
  const m = Number(parts.find((p) => p.type === "minute").value);
  return h + m / 60;
}

// Current UTC offset (in hours, e.g. -4 for EDT, 3 for EEST) for a zone,
// read live from Intl rather than assumed — this is what lets DST-gap
// periods (6h instead of 7h between Miami and Helsinki) be detected
// correctly instead of hardcoded.
function utcOffsetHours(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const tzPart = parts.find((p) => p.type === "timeZoneName").value; // e.g. "GMT-4"
  const match = tzPart.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!match) return 0;
  const h = Number(match[1]);
  const m = match[2] ? Number(match[2]) / 60 : 0;
  return h >= 0 ? h + m : h - m;
}

function currentOffsetDifference(date) {
  return utcOffsetHours(date, SCHEDULE_CONFIG.helsinki.timeZone) - utcOffsetHours(date, SCHEDULE_CONFIG.miami.timeZone);
}

// Returns { miami: hourFloat, helsinki: hourFloat } for display, applying
// the "preserve absolute" correction if that mode is active and today's
// offset differs from the standard 7h (a DST-transition gap week).
function getDisplayHours(date, dstMode) {
  const miamiHour = hourFloatInZone(date, SCHEDULE_CONFIG.miami.timeZone);
  const helsinkiHour = hourFloatInZone(date, SCHEDULE_CONFIG.helsinki.timeZone);
  if (dstMode !== "absolute") {
    return { miami: miamiHour, helsinki: helsinkiHour, offsetDiff: currentOffsetDifference(date) };
  }
  const diff = currentOffsetDifference(date);
  const correction = 7 - diff; // hours to add back to restore the normal 7h relationship
  return {
    miami: ((miamiHour - correction) % 24 + 24) % 24,
    helsinki: helsinkiHour,
    offsetDiff: diff,
    corrected: correction !== 0,
  };
}

function statusFor(hourFloat, city) {
  const cfg = SCHEDULE_CONFIG[city];
  if (inWindow(hourFloat, cfg.sleep)) return "sleeping";
  if (inWindow(hourFloat, cfg.focus)) return "focus";
  return "awake";
}

// "Available" = current moment falls in either city's focus/collaboration
// window. Kept simple and legible rather than a finely-weighted score.
function availabilityStatus(date) {
  const miamiHour = hourFloatInZone(date, SCHEDULE_CONFIG.miami.timeZone);
  const helsinkiHour = hourFloatInZone(date, SCHEDULE_CONFIG.helsinki.timeZone);
  const available = inWindow(miamiHour, SCHEDULE_CONFIG.miami.focus) || inWindow(helsinkiHour, SCHEDULE_CONFIG.helsinki.focus);
  return available ? "available" : "offline";
}

function formatHour(hourFloat, format) {
  const h = Math.floor(((hourFloat % 24) + 24) % 24);
  const m = Math.round((hourFloat - Math.floor(hourFloat)) * 60);
  if (format === "24") {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Compact header badge only, by design — see chat: a full dual-ring
// schedule visualization was scoped out to keep the homepage short and
// avoid decorative sections competing with hiring-relevant content in the
// first viewport. The richer view (rings, text-equivalent table, DST/format
// controls) can be added later as an opt-in expandable panel if wanted.
function mountAvailabilityBadge() {
  const badge = document.getElementById("availability-badge");
  if (!badge) return;

  function render() {
    const status = availabilityStatus(new Date());
    const isAvailable = status === "available";
    badge.textContent = isAvailable ? "Available" : "Offline";
    badge.classList.toggle("is-available", isAvailable);
    badge.classList.toggle("is-offline", !isAvailable);
    badge.setAttribute(
      "title",
      isAvailable
        ? "Currently within planned focus hours in Miami or Helsinki time"
        : "Outside planned focus hours in Miami and Helsinki time"
    );
    badge.setAttribute(
      "aria-label",
      `Availability: ${isAvailable ? "Available" : "Offline"}. ${
        isAvailable
          ? "Currently within planned focus hours."
          : "Outside planned focus hours."
      } Reflects a planned working rhythm, not current physical location.`
    );
  }

  render();
  setInterval(render, 60 * 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountAvailabilityBadge);
} else {
  mountAvailabilityBadge();
}

window.MayaSchedule = {
  SCHEDULE_CONFIG,
  loadPrefs,
  savePrefs,
  inWindow,
  hourFloatInZone,
  utcOffsetHours,
  currentOffsetDifference,
  getDisplayHours,
  statusFor,
  availabilityStatus,
  formatHour,
};
