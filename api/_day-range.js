// Computes [startOfDay, endOfDay) in UTC for a given "YYYY-MM-DD" calendar
// date in a given IANA timezone — Vercel's Node runtime runs in UTC, so
// "today" has to be resolved against a specific zone rather than the
// server's own clock. Defaults to America/New_York (Miami), matching the
// rest of the site's Miami-canonical rhythm config.
function offsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(
    date
  );
  const tzPart = parts.find((p) => p.type === "timeZoneName").value; // e.g. "GMT-4"
  const match = tzPart.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!match) return 0;
  const h = Number(match[1]);
  const m = match[2] ? Number(match[2]) : 0;
  return h >= 0 ? h * 60 + m : h * 60 - m;
}

// The "YYYY-MM-DD" calendar date a given instant falls on in `timeZone`.
function dateInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function todayInZone(timeZone) {
  return dateInZone(new Date(), timeZone);
}

// Doesn't perfectly handle the 23/25-hour DST-transition day itself (the
// offset is sampled once, at approximate midnight) — an acceptable
// approximation for a personal daily-agenda view, not a scheduling system
// of record.
function dayRangeUtc(dateStr, timeZone) {
  const approxMidnightUtc = new Date(`${dateStr}T00:00:00Z`);
  const offset = offsetMinutes(approxMidnightUtc, timeZone);
  const startUtcMs = approxMidnightUtc.getTime() - offset * 60000;
  const start = new Date(startUtcMs);
  const end = new Date(startUtcMs + 24 * 60 * 60 * 1000);
  return { start, end };
}

// Pure calendar-date arithmetic (no timezone involved) — dateStr is just a
// label like "2026-08-11", so plain UTC-based Date math is safe here even
// though the actual day boundaries it's later fed into (dayRangeUtc) are
// zone-aware.
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

module.exports = { dayRangeUtc, todayInZone, dateInZone, addDays };
