// GET /api/calendar-events?date=YYYY-MM-DD — merges today's (or the given
// day's) events across every connected Google/Outlook account into one
// sorted agenda. Refreshes any expired access token first.
const { readSession } = require("./_session");
const { loadAccountsWithTokens, updateAccountTokens } = require("./_calendar-accounts");
const { dayRangeUtc, todayInZone } = require("./_day-range");

const HOME_TIMEZONE = "America/New_York";
const REFRESH_BUFFER_MS = 60 * 1000;

async function refreshGoogleToken(account) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh responded ${res.status}`);
  const tokens = await res.json();
  const expiresAt = Date.now() + tokens.expires_in * 1000;
  await updateAccountTokens(account.id, { accessToken: tokens.access_token, expiresAt });
  return tokens.access_token;
}

async function refreshMicrosoftToken(account) {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
      scope: "offline_access User.Read Calendars.Read",
    }),
  });
  if (!res.ok) throw new Error(`Microsoft token refresh responded ${res.status}`);
  const tokens = await res.json();
  const expiresAt = Date.now() + tokens.expires_in * 1000;
  await updateAccountTokens(account.id, {
    accessToken: tokens.access_token,
    expiresAt,
    refreshToken: tokens.refresh_token, // Microsoft typically rotates this
  });
  return tokens.access_token;
}

async function validAccessToken(account) {
  if (account.expiresAt - REFRESH_BUFFER_MS > Date.now()) return account.accessToken;
  return account.provider === "google" ? refreshGoogleToken(account) : refreshMicrosoftToken(account);
}

async function fetchGoogleEvents(accessToken, start, end) {
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google events responded ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((item) => ({
    id: item.id,
    title: item.summary || "(untitled)",
    start: item.start.dateTime || item.start.date,
    end: item.end.dateTime || item.end.date,
    allDay: Boolean(item.start.date && !item.start.dateTime),
  }));
}

async function fetchMicrosoftEvents(accessToken, start, end) {
  const params = new URLSearchParams({
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    $orderby: "start/dateTime",
    $top: "50",
  });
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendarview?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
  });
  if (!res.ok) throw new Error(`Graph calendarview responded ${res.status}`);
  const data = await res.json();
  return (data.value || []).map((item) => ({
    id: item.id,
    title: item.subject || "(untitled)",
    start: item.start.dateTime + "Z",
    end: item.end.dateTime + "Z",
    allDay: Boolean(item.isAllDay),
  }));
}

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
  const { start, end } = dayRangeUtc(date, HOME_TIMEZONE);

  let accounts;
  try {
    accounts = await loadAccountsWithTokens();
  } catch (e) {
    res.status(500).json({ error: "Could not load connected accounts." });
    return;
  }

  const results = await Promise.allSettled(
    accounts.map(async (account) => {
      const accessToken = await validAccessToken(account);
      const events =
        account.provider === "google"
          ? await fetchGoogleEvents(accessToken, start, end)
          : await fetchMicrosoftEvents(accessToken, start, end);
      return events.map((e) => ({ ...e, accountId: account.id, accountEmail: account.email, provider: account.provider }));
    })
  );

  const events = [];
  const accountStatus = accounts.map((account, i) => {
    const result = results[i];
    if (result.status === "fulfilled") {
      events.push(...result.value);
      return { id: account.id, provider: account.provider, email: account.email, ok: true };
    }
    // A refresh failure almost always means the grant was revoked — the
    // owner needs to reconnect that account, not retry silently.
    return {
      id: account.id,
      provider: account.provider,
      email: account.email,
      ok: false,
      error: "Couldn't fetch events — try reconnecting this account.",
    };
  });

  events.sort((a, b) => new Date(a.start) - new Date(b.start));

  res.status(200).json({ date, timeZone: HOME_TIMEZONE, events, accounts: accountStatus });
};
