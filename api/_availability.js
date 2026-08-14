// Computes real bookable slots = the "focus" hours from schedule.js's
// RHYTHM_CONFIG, minus busy time from connected calendars, minus existing
// (non-cancelled) bookings, minus a lead-time buffer before "now". Shared
// by the public GET /api/booking-slots (full window) and the POST
// /api/bookings handler (single-day re-check before accepting a booking).
const MayaRhythm = require("../schedule.js");
const { dayRangeUtc, addDays } = require("./_day-range");
const { fetchAllEvents } = require("./_calendar-fetch");

const SLOT_MINUTES = 30;
const LEAD_MINUTES = 120;
const HOME_TIMEZONE = "America/New_York";

const { RHYTHM_CONFIG } = MayaRhythm;
const FOCUS_SEGMENTS = RHYTHM_CONFIG.filter((s) => s.state === "focus");

// Slices [startMs, endMs) into contiguous slotMinutes-wide candidates,
// dropping a trailing partial slot shorter than slotMinutes.
function sliceIntoSlots(startMs, endMs, slotMs) {
  const slots = [];
  for (let s = startMs; s + slotMs <= endMs; s += slotMs) {
    slots.push({ start: s, end: s + slotMs });
  }
  return slots;
}

// dateStr is a plain "YYYY-MM-DD" calendar-date label (the same convention
// _day-range.js's addDays uses) — parsing it at noon UTC keeps the weekday
// read stable regardless of the reader's own local zone.
function isWeekendDate(dateStr) {
  const day = new Date(dateStr + "T12:00:00Z").getUTCDay();
  return day === 0 || day === 6;
}

// Builds every candidate slot for one calendar date, handling a focus
// segment that wraps past midnight (end <= start) by splitting it into
// tonight's [start, 24) and tomorrow's [0, end) — not exercised by the
// current RHYTHM_CONFIG (its focus segments are same-day), but the rhythm
// config is hand-edited and could change.
function candidatesForDate(dateStr, timeZone, slotMs) {
  const { start: dayStartUtc } = dayRangeUtc(dateStr, timeZone);
  const dayStartMs = dayStartUtc.getTime();
  const candidates = [];

  for (const seg of FOCUS_SEGMENTS) {
    if (seg.end > seg.start) {
      candidates.push(...sliceIntoSlots(dayStartMs + seg.start * 3600000, dayStartMs + seg.end * 3600000, slotMs));
    } else {
      const midnightMs = dayStartMs + 24 * 3600000;
      candidates.push(...sliceIntoSlots(dayStartMs + seg.start * 3600000, midnightMs, slotMs));
      const nextDate = addDays(dateStr, 1);
      const { start: nextDayStartUtc } = dayRangeUtc(nextDate, timeZone);
      candidates.push(...sliceIntoSlots(nextDayStartUtc.getTime(), nextDayStartUtc.getTime() + seg.end * 3600000, slotMs));
    }
  }
  return candidates;
}

// Sorts and merges overlapping/touching [start,end) intervals so the
// overlap check below is a simple linear scan.
function mergeIntervals(intervals) {
  const sorted = intervals.slice().sort((a, b) => a.start - b.start);
  const merged = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ start: cur.start, end: cur.end });
    }
  }
  return merged;
}

function overlapsAny(slot, mergedBusy) {
  // mergedBusy is sorted, but the list is small (a couple weeks of a
  // part-time working-hours window) — linear scan is simpler than a
  // binary search and fast enough here.
  return mergedBusy.some((b) => slot.start < b.end && slot.end > b.start);
}

async function computeBookableSlots({
  startDate,
  days,
  accounts,
  bookings,
  now,
  slotMinutes = SLOT_MINUTES,
  leadMinutes = LEAD_MINUTES,
  timeZone = HOME_TIMEZONE,
}) {
  const slotMs = slotMinutes * 60000;
  let candidates = [];
  for (let i = 0; i < days; i++) {
    const dateStr = addDays(startDate, i);
    if (isWeekendDate(dateStr)) continue;
    candidates = candidates.concat(candidatesForDate(dateStr, timeZone, slotMs));
  }

  if (candidates.length === 0) {
    return { slots: [], degraded: false };
  }

  const rangeStart = new Date(Math.min(...candidates.map((c) => c.start)));
  const rangeEnd = new Date(Math.max(...candidates.map((c) => c.end)));

  const { events, accountStatus } = await fetchAllEvents(accounts, rangeStart, rangeEnd);
  const degraded = accountStatus.some((a) => !a.ok);

  const busyFromEvents = events.map((e) => {
    if (e.allDay) {
      // All-day events carry a date-only start/end from the provider —
      // block the full local calendar date(s) they span.
      const { start } = dayRangeUtc(String(e.start).slice(0, 10), timeZone);
      const { start: endDayStart } = dayRangeUtc(String(e.end).slice(0, 10), timeZone);
      return { start: start.getTime(), end: endDayStart.getTime() };
    }
    return { start: new Date(e.start).getTime(), end: new Date(e.end).getTime() };
  });

  const busyFromBookings = (bookings || [])
    .filter((b) => b.status !== "cancelled")
    .map((b) => ({ start: new Date(b.slot.start).getTime(), end: new Date(b.slot.end).getTime() }));

  const mergedBusy = mergeIntervals(busyFromEvents.concat(busyFromBookings));

  const leadCutoffMs = now.getTime() + leadMinutes * 60000;

  const slots = candidates
    .filter((c) => c.start >= leadCutoffMs)
    .filter((c) => !overlapsAny(c, mergedBusy))
    .sort((a, b) => a.start - b.start)
    .map((c) => ({ start: new Date(c.start).toISOString(), end: new Date(c.end).toISOString() }));

  return { slots, degraded };
}

module.exports = { computeBookableSlots, SLOT_MINUTES, LEAD_MINUTES, HOME_TIMEZONE };
