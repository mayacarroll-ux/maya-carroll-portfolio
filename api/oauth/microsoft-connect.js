// GET /api/oauth/microsoft-connect — same shape as google-connect.js, but
// against the Microsoft identity platform v2.0 endpoint (works for both
// personal outlook.com accounts and work/school Microsoft 365 accounts,
// via the "common" tenant).
//
// The scope string here must match the one hardcoded in the token exchange
// in microsoft-callback.js and the refresh request in _calendar-fetch.js —
// Microsoft's flows re-state scope explicitly at each step, unlike Google's.
const crypto = require("crypto");
const { readSession, setOAuthStateCookie } = require("../_session");
const { baseUrl } = require("../_base-url");

module.exports = async (req, res) => {
  const session = readSession(req);
  if (!session) {
    res.status(302).setHeader("Location", "/login.html").end();
    return;
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId || !process.env.MICROSOFT_CLIENT_SECRET) {
    res.status(500).json({ error: "Outlook Calendar connect isn't configured yet." });
    return;
  }

  const state = crypto.randomUUID();
  setOAuthStateCookie(req, res, { provider: "microsoft", nonce: state });

  const redirectUri = `${baseUrl(req)}/api/oauth/microsoft-callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: "offline_access User.Read Calendars.Read Calendars.ReadWrite",
    prompt: "select_account",
    state,
  });

  res
    .status(302)
    .setHeader(
      "Location",
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
    )
    .end();
};
