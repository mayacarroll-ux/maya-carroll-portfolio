// Public booking-request storage. Single-owner site, so — like
// _calendar-accounts.js — one KV key holds a JSON array of every booking
// rather than needing a real schema.
//
// Record shape:
// {
//   id, name, email, topic,
//   slot: { start: isoString, end: isoString },   // UTC instants, source of truth
//   requesterTimeZone,                              // display-only, never used for validation
//   status: "pending" | "confirmed" | "cancelled" | "declined",
//   createdAt, calendarEvent: null | { accountId, provider, eventId }, ip,
// }
const crypto = require("crypto");
const { kvGetJSON, kvSetJSON, getClient, ensureTable } = require("./_kv");

const KEY = "bookings";

async function loadBookings() {
  const bookings = await kvGetJSON(KEY);
  return Array.isArray(bookings) ? bookings : [];
}

function newBookingId() {
  return crypto.randomUUID();
}

// Atomically appends `record` only if no existing non-cancelled booking
// overlaps its slot — a plain read-then-write (kvGetJSON + kvSetJSON)
// isn't safe against two visitors submitting the same slot at once, so
// this does the conflict check and the append in one SQL statement
// against the same kv_store table _kv.js already provisions.
async function addBookingIfFree(record) {
  await ensureTable();
  const sql = getClient();
  await sql`
    INSERT INTO kv_store (key, value)
    VALUES (${KEY}, '[]'::jsonb)
    ON CONFLICT (key) DO NOTHING
  `;
  const rows = await sql`
    UPDATE kv_store
    SET value = value || jsonb_build_array(${JSON.stringify(record)}::jsonb), updated_at = now()
    WHERE key = ${KEY}
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(value) AS b
        WHERE b->>'status' != 'cancelled'
          AND (b->'slot'->>'start')::timestamptz < ${record.slot.end}::timestamptz
          AND (b->'slot'->>'end')::timestamptz   > ${record.slot.start}::timestamptz
      )
    RETURNING value
  `;
  return rows.length > 0;
}

// Read-modify-write on the whole list — fine for how this is actually
// used (an owner confirming/declining one booking at a time, or the
// booking-creation request setting its own just-inserted record's status
// right after addBookingIfFree succeeds). A true concurrent write to a
// *different* record at the exact same instant could theoretically be
// clobbered, but that's an acceptable risk at this site's traffic level —
// the double-booking guard above is the case that actually matters.
async function updateBooking(id, patch) {
  const bookings = await loadBookings();
  const next = bookings.map((b) => (b.id === id ? { ...b, ...patch } : b));
  await kvSetJSON(KEY, next);
  return next.find((b) => b.id === id) || null;
}

module.exports = { loadBookings, addBookingIfFree, updateBooking, newBookingId, KEY };
