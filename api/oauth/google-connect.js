// GET /api/oauth/google-connect — starts the *full* OAuth Authorization
// Code flow to request Google Calendar read access. This is deliberately
// separate from the site's login (Google Identity Services token flow):
// login only proves who you are; this requests an actual API scope
// (calendar.readonly) plus offline access, which needs a client secret
// and a real redirect round trip that the lightweight login flow doesn't.
const crypto = require("crypto");
const { readSession, setOAuthStateCookie } = require("../_session");
const { baseUrl } = require("../_base-url");

module.exports = async (req, res) => {
  const session = readSession(req);
  if (!session) {
    res.status(302).setHeader("Location", "/login.html").end();
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    res.status(500).json({ error: "Google Calendar connect isn't configured yet." });
    return;
  }

  const state = crypto.randomUUID();
  setOAuthStateCookie(req, res, { provider: "google", nonce: state });

  const redirectUri = `${baseUrl(req)}/api/oauth/google-callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent select_account",
    state,
  });

  res
    .status(302)
    .setHeader("Location", `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
    .end();
};
