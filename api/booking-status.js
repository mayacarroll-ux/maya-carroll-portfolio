// POST /api/booking-status  { id, status: "confirmed"|"declined"|"cancelled" }
// Owner-only. Lets Maya confirm or decline a pending booking from
// calendar.html (the manual fallback path for accounts without calendar
// write scope yet, or any booking she wants to override).
const { readSession } = require("./_session");
const { updateBooking } = require("./_bookings");

const ALLOWED_STATUSES = new Set(["confirmed", "declined", "cancelled"]);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }

  const id = req.body && req.body.id;
  const status = req.body && req.body.status;
  if (!id || typeof id !== "string" || !ALLOWED_STATUSES.has(status)) {
    res.status(400).json({ error: "Invalid request." });
    return;
  }

  try {
    const booking = await updateBooking(id, { status });
    if (!booking) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }
    res.status(200).json({ ok: true, booking });
  } catch (e) {
    res.status(500).json({ error: "Could not update that booking." });
  }
};
