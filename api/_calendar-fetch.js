// Shared Google/Microsoft calendar access: token refresh, event fetching,
// and (new) event creation. Used by both the owner's private merged-events
// endpoint (calendar-events.js) and the public availability/booking
// endpoints — kept in one place so token-refresh logic never drifts between
// the two call sites.
const { updateAccountTokens } = require("./_calendar-accounts");

// Must match the scope requested in api/oauth/microsoft-connect.js and
// exchanged in api/oauth/microsoft-callback.js — Microsoft's refresh-token
// grant re-states the scope explicitly, unlike Google's.
const MICROSOFT_SCOPE = "offline_access User.Read Calendars.Read Calendars.ReadWrite";

const GOOGLE_WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const MICROSOFT_WRITE_SCOPE = "Calendars.ReadWrite";

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
      scope: MICROSOFT_SCOPE,
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

const REFRESH_BUFFER_MS = 60 * 1000;

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
    maxResults: "250",
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

// Fetches events across every connected account in parallel, tolerating
// individual account failures (a revoked grant shouldn't take down the
// whole merged view) — returns both the merged events and a per-account
// ok/error status so callers can surface which account needs reconnecting.
async function fetchAllEvents(accounts, start, end) {
  const results = await Promise.allSettled(
    accounts.map(async (account) => {
      const accessToken = await validAccessToken(account);
      const events =
        account.provider === "google"
          ? await fetchGoogleEvents(accessToken, start, end)
          : await fetchMicrosoftEvents(accessToken, start, end);
      return events.map((e) => ({
        ...e,
        accountId: account.id,
        accountEmail: account.email,
        provider: account.provider,
      }));
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

  return { events, accountStatus };
}

function hasWriteScope(account) {
  if (!account.scope || typeof account.scope !== "string") return false;
  const marker = account.provider === "google" ? GOOGLE_WRITE_SCOPE : MICROSOFT_WRITE_SCOPE;
  return account.scope.includes(marker);
}

// sendUpdates=all is required for Google to actually email the attendee an
// invite — omitting it silently creates the event with no notification.
async function createGoogleEvent(accessToken, record) {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `Call: ${record.name}`,
        description: record.topic || "",
        start: { dateTime: record.slot.start },
        end: { dateTime: record.slot.end },
        attendees: [{ email: record.email, displayName: record.name }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Google event create responded ${res.status}`);
  const data = await res.json();
  return data.id;
}

// Graph sends invite emails automatically to any attendees array on create,
// no extra parameter needed.
async function createMicrosoftEvent(accessToken, record) {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: `Call: ${record.name}`,
      body: { contentType: "text", content: record.topic || "" },
      start: { dateTime: record.slot.start, timeZone: "UTC" },
      end: { dateTime: record.slot.end, timeZone: "UTC" },
      attendees: [{ emailAddress: { address: record.email, name: record.name }, type: "required" }],
    }),
  });
  if (!res.ok) throw new Error(`Graph event create responded ${res.status}`);
  const data = await res.json();
  return data.id;
}

// Tries each connected account with write scope until one succeeds. Never
// throws — a booking should still succeed (as "pending") if calendar
// write access isn't available yet or a provider call fails.
async function attemptCreateCalendarEvent(accounts, record) {
  for (const account of accounts) {
    if (!hasWriteScope(account)) continue;
    try {
      const accessToken = await validAccessToken(account);
      const eventId =
        account.provider === "google"
          ? await createGoogleEvent(accessToken, record)
          : await createMicrosoftEvent(accessToken, record);
      return { accountId: account.id, provider: account.provider, eventId };
    } catch (e) {
      // Try the next write-capable account, if any.
      continue;
    }
  }
  return null;
}

module.exports = {
  validAccessToken,
  fetchAllEvents,
  attemptCreateCalendarEvent,
  hasWriteScope,
};
