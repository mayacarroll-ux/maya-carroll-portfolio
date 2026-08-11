// Shared session-cookie helpers for the private dashboard's Google sign-in.
// Leading underscore keeps Vercel from exposing this file as its own route.
//
// Sessions are a stateless signed cookie (email + expiry, HMAC-SHA256'd with
// SESSION_SECRET) rather than a server-side session store — there's no
// database in this project, and a single-owner allowlist doesn't need one.
const crypto = require("crypto");

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function isLocalHost(req) {
  // Checked against the request itself, not VERCEL_ENV — `vercel dev` does
  // not reliably set VERCEL_ENV=development, and a Secure cookie set over
  // plain local http is silently dropped by the browser, which breaks the
  // sign-in redirect in a confusing way (looks like the session never took).
  const host = (req && req.headers && req.headers.host) || "";
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

function sign(payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token || typeof token !== "string" || !token.includes(".")) return null;

  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch (e) {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
  return payload;
}

function setSessionCookie(req, res, email) {
  const token = sign({ email, exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  const secureAttr = isLocalHost(req) ? "" : " Secure;";
  res.setHeader(
    "Set-Cookie",
    `session=${token}; HttpOnly;${secureAttr} SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}`
  );
}

function clearSessionCookie(req, res) {
  const secureAttr = isLocalHost(req) ? "" : " Secure;";
  res.setHeader("Set-Cookie", `session=; HttpOnly;${secureAttr} SameSite=Lax; Path=/; Max-Age=0`);
}

function readSession(req) {
  const token = req.cookies && req.cookies.session;
  return verify(token);
}

module.exports = { setSessionCookie, clearSessionCookie, readSession };
