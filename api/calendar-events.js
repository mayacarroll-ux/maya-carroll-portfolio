// GET /api/calendar-events?date=YYYY-MM-DD&days=N — merges events across
// every connected Google/Outlook account, for the N-day window starting at
// `date` (default: today, 1 day — a week view passes days=7), into one
// sorted list. Refreshes any expired access token first.
const { readSession } = require("./_session");
const { loadAccountsWithTokens } = require("./_calendar-accounts");
const { dayRangeUtc, todayInZone, addDays } = require("./_day-range");
const { fetchAllEvents } = require("./_calendar-fetch");

const MAX_DAYS = 31;
const HOME_TIMEZONE = "America/New_York";

module.exports = async (req, res) => {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  const date =
    typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : todayInZone(HOME_TIMEZONE);
  const daysParsed = parseInt(req.query.days, 10);
  const days = Number.isInteger(daysParsed) ? Math.min(Math.max(daysParsed, 1), MAX_DAYS) : 1;
  const endDate = addDays(date, days - 1);

  const { start } = dayRangeUtc(date, HOME_TIMEZONE);
  const { end } = dayRangeUtc(endDate, HOME_TIMEZONE);

  let accounts;
  try {
    accounts = await loadAccountsWithTokens();
  } catch (e) {
    res.status(500).json({ error: "Could not load connected accounts." });
    return;
  }

  const { events, accountStatus } = await fetchAllEvents(accounts, start, end);
  events.sort((a, b) => new Date(a.start) - new Date(b.start));

  res.status(200).json({
    date,
    startDate: date,
    endDate,
    timeZone: HOME_TIMEZONE,
    events,
    accounts: accountStatus,
  });
};
