// Body-clock rhythm logic shared by the homepage clock widget.
//
// Times are Miami-local (America/New_York) and recur daily — the single
// source of truth. Helsinki times are always *derived* live via the DST-safe
// offset helpers below. This is intentionally a fixed, typed configuration,
// not a publicly editable data model — there is no "edit my schedule" UI on
// the public site. The owner adjusts the rhythm by editing RHYTHM_CONFIG
// directly and redeploying.
const CITY_ZONES = {
  miami: { label: "Miami", timeZone: "America/New_York" },
  helsinki: { label: "Helsinki", timeZone: "Europe/Helsinki" },
};

const STATES = {
  rest: { label: "Rest" },
  awake: { label: "Awake" },
  focus: { label: "Focus" },
  move: { label: "Move" },
  meal: { label: "Meal" },
};

// Ordered, contiguous, Miami-local. Each entry's `end` may be numerically
// less than `start` to represent a segment that crosses midnight (e.g.
// 23 → 4). Together they must cover the full 24-hour cycle with no gaps —
// validated at load time below.
const RHYTHM_CONFIG = [
  { start: 22, end: 22.5, state: "awake" },
  { start: 22.5, end: 23, state: "meal" },
  { start: 23, end: 4, state: "awake" },
  { start: 4, end: 5, state: "move" },
  { start: 5, end: 5.5, state: "meal" },
  { start: 5.5, end: 9.5, state: "focus" },
  { start: 9.5, end: 10, state: "meal" },
  { start: 10, end: 13, state: "focus" },
  { start: 13, end: 14, state: "awake" },
  { start: 14, end: 22, state: "rest" },
];

function segmentDuration(seg) {
  const d = seg.end - seg.start;
  return d > 0 ? d : 24 + d;
}

// Defensive sanity check — if the config were ever edited into an invalid
// shape (gap, unknown state, bad hour), fall back to treating the whole day
// as "awake" rather than rendering something broken.
function validateRhythm(config) {
  if (!Array.isArray(config) || config.length === 0) return false;
  let totalHours = 0;
  for (const seg of config) {
    if (typeof seg.start !== "number" || typeof seg.end !== "number") return false;
    if (seg.start < 0 || seg.start >= 24 || seg.end < 0 || seg.end > 24) return false;
    if (!STATES[seg.state]) return false;
    totalHours += segmentDuration(seg);
  }
  return Math.abs(totalHours - 24) < 0.01;
}
const RHYTHM_VALID = validateRhythm(RHYTHM_CONFIG);
const FALLBACK_RHYTHM = [{ start: 0, end: 24, state: "awake" }];
function activeRhythm() {
  return RHYTHM_VALID ? RHYTHM_CONFIG : FALLBACK_RHYTHM;
}

// An hour interval may cross midnight. True if `hourFloat` (0–24) falls
// inside [start, end), wrapping as needed. A minute landing exactly on a
// boundary belongs to the segment that *starts* there, unambiguously.
function inWindow(hourFloat, start, end) {
  if (start === end) return true; // a 24h span
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

// Current UTC offset (hours, e.g. -4 for EDT, 3 for EEST) for a zone, read
// live from Intl rather than assumed — this is what lets DST-gap periods
// (6h instead of 7h between Miami and Helsinki) be detected correctly.
function utcOffsetHours(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(date);
  const tzPart = parts.find((p) => p.type === "timeZoneName").value; // e.g. "GMT-4"
  const match = tzPart.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!match) return 0;
  const h = Number(match[1]);
  const m = match[2] ? Number(match[2]) / 60 : 0;
  return h >= 0 ? h + m : h - m;
}

function currentOffsetDifference(date) {
  return utcOffsetHours(date, CITY_ZONES.helsinki.timeZone) - utcOffsetHours(date, CITY_ZONES.miami.timeZone);
}

function miamiHourToHelsinki(miamiHour, date) {
  const diff = currentOffsetDifference(date);
  return ((miamiHour + diff) % 24 + 24) % 24;
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

function formatRemaining(totalMinutes) {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m remaining`;
  if (mm === 0) return `${h}h remaining`;
  return `${h}h ${mm}m remaining`;
}

// The segment containing `date`'s current Miami hour, plus how many
// minutes remain in it.
function getCurrentSegment(date) {
  const rhythm = activeRhythm();
  const hour = hourFloatInZone(date, CITY_ZONES.miami.timeZone);
  const seg = rhythm.find((s) => inWindow(hour, s.start, s.end)) || rhythm[0];
  const hoursUntilEnd = ((seg.end - hour + 24) % 24) || segmentDuration(seg);
  return {
    state: seg.state,
    label: STATES[seg.state].label,
    startHour: seg.start,
    endHour: seg.end,
    remainingMinutes: hoursUntilEnd * 60,
  };
}

// The segment chronologically following the current one (wraps to the
// first segment of the cycle).
function getNextSegment(date) {
  const rhythm = activeRhythm();
  const hour = hourFloatInZone(date, CITY_ZONES.miami.timeZone);
  const idx = rhythm.findIndex((s) => inWindow(hour, s.start, s.end));
  const nextIdx = idx === -1 ? 0 : (idx + 1) % rhythm.length;
  const seg = rhythm[nextIdx];
  return { state: seg.state, label: STATES[seg.state].label, startHour: seg.start };
}

// hourOffsetFromNow: signed distance in hours from `now` to `h`, in
// [-12, 12) — negative means "earlier today" (past), non-negative means
// "later today" (current/upcoming). Used to dim past ring segments.
function hourOffsetFromNow(h, now) {
  let d = h - now;
  d = (((d + 12) % 24) + 24) % 24 - 12;
  return d;
}

window.MayaRhythm = {
  CITY_ZONES,
  STATES,
  RHYTHM_CONFIG: activeRhythm(),
  segmentDuration,
  inWindow,
  hourFloatInZone,
  utcOffsetHours,
  currentOffsetDifference,
  miamiHourToHelsinki,
  formatHour,
  formatRemaining,
  getCurrentSegment,
  getNextSegment,
  hourOffsetFromNow,
};
