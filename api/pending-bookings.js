// GET /api/pending-bookings — owner-only list of booking requests, sorted
// by slot start, for calendar.html's "Pending bookings" section. Mirrors
// calendar-accounts.js's session-check pattern exactly.
const { readSession } = require("./_session");
const { loadBookings } = require("./_bookings");

module.exports = async (req, res) => {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  try {
    const bookings = await loadBookings();
    bookings.sort((a, b) => new Date(a.slot.start) - new Date(b.slot.start));
    res.status(200).json({ bookings });
  } catch (e) {
    res.status(500).json({ error: "Could not load bookings." });
  }
};
