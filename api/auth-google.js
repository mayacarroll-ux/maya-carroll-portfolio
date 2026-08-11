// POST /api/auth-google  { credential: "<Google ID token>" }
//
// Verifies the ID token Google Identity Services hands back to the client,
// checks it's actually meant for this site (aud) and belongs to the single
// allowlisted owner account, then mints our own session cookie. No OAuth
// client secret or redirect flow is needed for this token-based sign-in.
const { setSessionCookie } = require("./_session");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!clientId || !ownerEmail || !process.env.SESSION_SECRET) {
    res.status(500).json({ ok: false, error: "Sign-in isn't configured yet." });
    return;
  }

  const credential = req.body && req.body.credential;
  if (!credential || typeof credential !== "string") {
    res.status(400).json({ ok: false, error: "Missing credential." });
    return;
  }

  let payload;
  try {
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!verifyRes.ok) throw new Error(`tokeninfo responded ${verifyRes.status}`);
    payload = await verifyRes.json();
  } catch (e) {
    res.status(401).json({ ok: false, error: "Could not verify Google sign-in." });
    return;
  }

  const emailVerified = payload.email_verified === "true" || payload.email_verified === true;
  const isCorrectAudience = payload.aud === clientId;
  const isOwner =
    typeof payload.email === "string" && payload.email.toLowerCase() === ownerEmail.toLowerCase();

  if (!isCorrectAudience || !emailVerified || !isOwner) {
    res.status(403).json({ ok: false, error: "This Google account isn't authorized for this site." });
    return;
  }

  setSessionCookie(req, res, payload.email);
  res.status(200).json({ ok: true });
};
