// Dual-city schedule model: Miami (winters) / Helsinki (summers).
//
// Blocks are stored in Miami-local time (America/New_York) and recur daily;
// Helsinki times are always *derived* live via utcOffsetHours()/
// currentOffsetDifference() below, so DST-transition weeks correctly show
// the temporary 6h difference instead of a frozen 7h. Persistence is
// localStorage only, per-device — no account, no shared backend — so a
// visitor customizing their view only ever affects their own browser. That
// also means the homepage's Available/Offline badge and the full planner
// page read from the same block store: editing in the planner is expected
// to change what the badge shows.
const SCHEDULE_CITIES = {
  miami: { label: "Miami", timeZone: "America/New_York", lat: 25.7617, lon: -80.1918 },
  helsinki: { label: "Helsinki", timeZone: "Europe/Helsinki", lat: 60.1699, lon: 24.9384 },
};

const BLOCK_TYPES = {
  sleep: { label: "Sleep", icon: "☾" },
  focus: { label: "Focused work", icon: "◆" },
  meetings: { label: "Meetings", icon: "◎" },
  personal: { label: "Personal time", icon: "○" },
};

// Validated against Miami's climate pattern (afternoon heat peaks ~2–4 PM,
// coolest hours are pre-dawn) and a conventional Nordic workday for
// Helsinki — see chat history for the full reasoning.
const DEFAULT_BLOCKS = [
  { id: "sleep", name: "Sleep", type: "sleep", startHour: 14, endHour: 22, color: "#6b6f8a", enabled: true },
  { id: "focus", name: "Focused work", type: "focus", startHour: 5, endHour: 10, color: "#ff5c7a", enabled: true },
  { id: "meetings", name: "Meetings", type: "meetings", startHour: 10, endHour: 13, color: "#39c6e6", enabled: true },
  { id: "personal", name: "Personal time", type: "personal", startHour: 22, endHour: 5, color: "#f4b860", enabled: true },
];

const BLOCKS_KEY = "scheduleBlocks";
const PREFS_KEY = "schedulePrefs"; // { format: '12'|'24', dstMode: 'local'|'absolute', cityOrder: 'miami'|'helsinki' }

function loadPrefs() {
  try {
    return Object.assign(
      { format: "12", dstMode: "local", cityOrder: "miami" },
      JSON.parse(localStorage.getItem(PREFS_KEY))
    );
  } catch (e) {
    return { format: "12", dstMode: "local", cityOrder: "miami" };
  }
}
function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    /* degrade silently */
  }
}

function cloneBlocks(blocks) {
  return blocks.map((b) => Object.assign({}, b));
}

function loadBlocks() {
  try {
    const raw = JSON.parse(localStorage.getItem(BLOCKS_KEY));
    if (!Array.isArray(raw) || raw.length === 0) return cloneBlocks(DEFAULT_BLOCKS);
    return raw;
  } catch (e) {
    return cloneBlocks(DEFAULT_BLOCKS);
  }
}
function saveBlocks(blocks) {
  try {
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(blocks));
  } catch (e) {
    /* degrade silently */
  }
}

function makeId() {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function addBlock(blocks, block) {
  return blocks.concat([Object.assign({}, block, { id: makeId() })]);
}
function updateBlock(blocks, id, patch) {
  return blocks.map((b) => (b.id === id ? Object.assign({}, b, patch) : b));
}
function deleteBlock(blocks, id) {
  return blocks.filter((b) => b.id !== id);
}
function duplicateBlock(blocks, id) {
  const source = blocks.find((b) => b.id === id);
  if (!source) return blocks;
  return blocks.concat([Object.assign({}, source, { id: makeId(), name: `${source.name} copy` })]);
}
function toggleBlock(blocks, id) {
  return blocks.map((b) => (b.id === id ? Object.assign({}, b, { enabled: !b.enabled }) : b));
}
function restoreDefaultBlocks() {
  return cloneBlocks(DEFAULT_BLOCKS);
}

function validateBlock(block) {
  const errors = [];
  if (!block.name || !block.name.trim()) errors.push("Name is required.");
  if (!BLOCK_TYPES[block.type]) errors.push("Type is invalid.");
  const s = Number(block.startHour);
  const e = Number(block.endHour);
  if (!(s >= 0 && s < 24)) errors.push("Start time must be within the day.");
  if (!(e >= 0 && e < 24)) errors.push("End time must be within the day.");
  if (s === e) errors.push("Start and end time can't be the same.");
  return { valid: errors.length === 0, errors };
}

// An hour interval may cross midnight (e.g. 22 → 5). True if `hourFloat`
// (0–24) falls inside [start, end), wrapping as needed.
function inWindow(hourFloat, start, end) {
  if (start === end) return false;
  if (start < end) return hourFloat >= start && hourFloat < end;
  return hourFloat >= start || hourFloat < end;
}

function blockDurationHours(block) {
  const d = block.endHour - block.startHour;
  return d > 0 ? d : 24 + d;
}

// Non-blocking pairwise overlap detection — the brief calls for handling
// overlaps intentionally (stacked lanes, a warning), not forbidding them.
function findOverlaps(blocks) {
  const enabled = blocks.filter((b) => b.enabled);
  const pairs = [];
  for (let i = 0; i < enabled.length; i++) {
    for (let j = i + 1; j < enabled.length; j++) {
      if (blocksOverlap(enabled[i], enabled[j])) pairs.push([enabled[i].id, enabled[j].id]);
    }
  }
  return pairs;
}
function blocksOverlap(a, b) {
  // Sample at a coarse resolution (every 15 min) — simple and correct for
  // wrap-around intervals without separately special-casing every case.
  for (let h = 0; h < 24; h += 0.25) {
    if (inWindow(h, a.startHour, a.endHour) && inWindow(h, b.startHour, b.endHour)) return true;
  }
  return false;
}

// Greedy lane assignment so overlapping blocks render side-by-side instead
// of hiding each other. Returns a Map(blockId -> laneIndex) and lane count.
function assignLanes(blocks) {
  const sorted = blocks.slice().sort((a, b) => a.startHour - b.startHour);
  const laneEnds = []; // last endHour (as a running "occupied until") per lane
  const laneOf = new Map();
  sorted.forEach((block) => {
    let lane = laneEnds.findIndex((endsAt) => !blocksOverlap(block, { startHour: endsAt.startHour, endHour: endsAt.endHour }));
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push({ startHour: block.startHour, endHour: block.endHour });
    } else {
      laneEnds[lane] = { startHour: block.startHour, endHour: block.endHour };
    }
    laneOf.set(block.id, lane);
  });
  return { laneOf, laneCount: Math.max(1, laneEnds.length) };
}

function exportBlocksJSON(blocks) {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), blocks }, null, 2);
}

// Returns { ok: true, blocks } or { ok: false, error }. Never mutates
// existing storage on failure.
function importBlocksJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  const blocks = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.blocks) ? parsed.blocks : null;
  if (!blocks) return { ok: false, error: "Expected a list of schedule blocks." };
  for (const b of blocks) {
    if (typeof b !== "object" || b === null) return { ok: false, error: "Each block must be an object." };
    const { valid, errors } = validateBlock(b);
    if (!valid) return { ok: false, error: `Invalid block "${b.name || "?"}": ${errors.join(" ")}` };
  }
  const normalized = blocks.map((b) => ({
    id: b.id && typeof b.id === "string" ? b.id : makeId(),
    name: String(b.name),
    type: BLOCK_TYPES[b.type] ? b.type : "personal",
    startHour: Number(b.startHour),
    endHour: Number(b.endHour),
    color: typeof b.color === "string" ? b.color : "#888888",
    enabled: b.enabled !== false,
  }));
  return { ok: true, blocks: normalized };
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
  return utcOffsetHours(date, SCHEDULE_CITIES.helsinki.timeZone) - utcOffsetHours(date, SCHEDULE_CITIES.miami.timeZone);
}

// Miami-local hour -> Helsinki-local hour, via the live offset (correct
// through DST-gap weeks, unlike a fixed +7).
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

function totalHoursByType(blocks, type) {
  return blocks
    .filter((b) => b.enabled && b.type === type)
    .reduce((sum, b) => sum + blockDurationHours(b), 0);
}

// Overlap (in hours) between this city's conventional 9–17 business day and
// the visitor's own "meetings" blocks, in that city's local time.
function businessHoursOverlap(blocks, city, date) {
  const meetings = blocks.filter((b) => b.enabled && b.type === "meetings");
  let hours = 0;
  for (let h = 0; h < 24; h += 0.25) {
    const miamiHour = h;
    const localHour = city === "miami" ? miamiHour : miamiHourToHelsinki(miamiHour, date);
    const inBusinessHours = localHour >= 9 && localHour < 17;
    const inMeeting = meetings.some((b) => inWindow(miamiHour, b.startHour, b.endHour));
    if (inBusinessHours && inMeeting) hours += 0.25;
  }
  return hours;
}

function summarize(blocks, date) {
  return {
    sleepHours: totalHoursByType(blocks, "sleep"),
    focusHours: totalHoursByType(blocks, "focus"),
    meetingHours: totalHoursByType(blocks, "meetings"),
    miamiBusinessOverlap: businessHoursOverlap(blocks, "miami", date),
    helsinkiBusinessOverlap: businessHoursOverlap(blocks, "helsinki", date),
    offsetDiff: currentOffsetDifference(date),
    isDstGap: currentOffsetDifference(date) !== 7,
  };
}

// "Available" = current moment falls inside an enabled focus/meetings
// block, evaluated in Miami-local time (the blocks' canonical timezone).
function availabilityStatus(date) {
  const blocks = loadBlocks();
  const miamiHour = hourFloatInZone(date, SCHEDULE_CITIES.miami.timeZone);
  const available = blocks.some(
    (b) => b.enabled && (b.type === "focus" || b.type === "meetings") && inWindow(miamiHour, b.startHour, b.endHour)
  );
  return available ? "available" : "offline";
}

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
        ? "Currently within planned focus or meeting hours"
        : "Outside planned focus or meeting hours"
    );
    badge.setAttribute(
      "aria-label",
      `Availability: ${isAvailable ? "Available" : "Offline"}. ${
        isAvailable ? "Currently within planned focus or meeting hours." : "Outside planned focus or meeting hours."
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
  SCHEDULE_CITIES,
  BLOCK_TYPES,
  DEFAULT_BLOCKS,
  loadPrefs,
  savePrefs,
  loadBlocks,
  saveBlocks,
  addBlock,
  updateBlock,
  deleteBlock,
  duplicateBlock,
  toggleBlock,
  restoreDefaultBlocks,
  validateBlock,
  inWindow,
  blockDurationHours,
  findOverlaps,
  blocksOverlap,
  assignLanes,
  exportBlocksJSON,
  importBlocksJSON,
  hourFloatInZone,
  utcOffsetHours,
  currentOffsetDifference,
  miamiHourToHelsinki,
  formatHour,
  summarize,
  availabilityStatus,
};
