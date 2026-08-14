// GET /api/booking-slots?date=YYYY-MM-DD&days=N — PUBLIC. Returns real
// bookable slots (working hours minus busy calendar time minus existing
// bookings) for visitors picking a time on booking.html. Deliberately
// returns only { start, end } pairs — never event titles, attendees, or
// account identities — so this endpoint can't leak what's actually on
// Maya's calendar to an anonymous visitor.
const { loadAccountsWithTokens } = require("./_calendar-accounts");
const { todayInZone, addDays } = require("./_day-range");
const { computeBookableSlots, HOME_TIMEZONE } = require("./_availability");
const { loadBookings } = require("./_bookings");

const DEFAULT_DAYS = 14;
const MAX_DAYS = 60;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const date =
    typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : todayInZone(HOME_TIMEZONE);
  const daysParsed = parseInt(req.query.days, 10);
  const days = Number.isInteger(daysParsed) ? Math.min(Math.max(daysParsed, 1), MAX_DAYS) : DEFAULT_DAYS;

  // A public read endpoint should stay usable even if one piece fails —
  // degrade to an empty/degraded response instead of a hard 500.
  let accounts = [];
  let accountsFailed = false;
  try {
    accounts = await loadAccountsWithTokens();
  } catch (e) {
    accountsFailed = true;
  }

  let bookings = [];
  let bookingsFailed = false;
  try {
    bookings = await loadBookings();
  } catch (e) {
    bookingsFailed = true;
  }

  try {
    const { slots, degraded } = await computeBookableSlots({
      startDate: date,
      days,
      accounts,
      bookings,
      now: new Date(),
    });
    res.status(200).json({
      date,
      endDate: addDays(date, days - 1),
      days,
      timeZone: HOME_TIMEZONE,
      slots,
      degraded: degraded || accountsFailed || bookingsFailed,
    });
  } catch (e) {
    res.status(200).json({
      date,
      endDate: addDays(date, days - 1),
      days,
      timeZone: HOME_TIMEZONE,
      slots: [],
      degraded: true,
    });
  }
};
