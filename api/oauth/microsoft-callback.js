// GET /api/oauth/microsoft-callback — mirrors google-callback.js against
// Microsoft's v2.0 token endpoint and Graph API.
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
  if (!state || state.provider !== "microsoft" || state.nonce !== req.query.state) {
    redirectBack("?error=invalid_state");
    return;
  }

  const code = req.query.code;
  if (!code || typeof code !== "string") {
    redirectBack("?error=missing_code");
    return;
  }

  try {
    const redirectUri = `${baseUrl(req)}/api/oauth/microsoft-callback`;
    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        scope: "offline_access User.Read Calendars.Read Calendars.ReadWrite",
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange responded ${tokenRes.status}`);
    const tokens = await tokenRes.json();

    const userRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) throw new Error(`Graph /me responded ${userRes.status}`);
    const userInfo = await userRes.json();
    const email = userInfo.mail || userInfo.userPrincipalName;

    if (!tokens.refresh_token) {
      redirectBack("?error=no_refresh_token");
      return;
    }

    await addAccount({
      provider: "microsoft",
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
    });

    redirectBack("?connected=microsoft");
  } catch (e) {
    redirectBack("?error=connect_failed");
  }
};
