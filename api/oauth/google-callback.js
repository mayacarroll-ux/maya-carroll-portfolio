// GET /api/oauth/google-callback — exchanges the authorization code for
// tokens, identifies which Google account was just connected, and stores
// it (encrypted) for the event-fetching endpoint to use later.
const { readSession, readOAuthState, clearOAuthStateCookie } = require("../_session");
const { addAccount } = require("../_calendar-accounts");
const { baseUrl } = require("../_base-url");

module.exports = async (req, res) => {
  const session = readSession(req);
  const state = readOAuthState(req);
  clearOAuthStateCookie(req, res);

  if (!session) {
    res.status(302).setHeader("Location", "/login.html").end();
    return;
  }

  const redirectBack = (query) => {
    res.status(302).setHeader("Location", `/calendar.html${query}`).end();
  };

  if (req.query.error) {
    redirectBack(`?error=${encodeURIComponent(String(req.query.error))}`);
    return;
  }
  if (!state || state.provider !== "google" || state.nonce !== req.query.state) {
    redirectBack("?error=invalid_state");
    return;
  }

  const code = req.query.code;
  if (!code || typeof code !== "string") {
    redirectBack("?error=missing_code");
    return;
  }

  try {
    const redirectUri = `${baseUrl(req)}/api/oauth/google-callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange responded ${tokenRes.status}`);
    const tokens = await tokenRes.json();

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) throw new Error(`userinfo responded ${userRes.status}`);
    const userInfo = await userRes.json();

    if (!tokens.refresh_token) {
      // Happens if this Google account already granted this exact
      // consent before and Google skipped re-issuing a refresh token —
      // without one we can't fetch events after the access token expires.
      redirectBack("?error=no_refresh_token");
      return;
    }

    await addAccount({
      provider: "google",
      email: userInfo.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
    });

    redirectBack("?connected=google");
  } catch (e) {
    redirectBack("?error=connect_failed");
  }
};
