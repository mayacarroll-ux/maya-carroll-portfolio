// Both OAuth providers require the redirect_uri sent at the start of the
// flow to exactly match the one used to exchange the code — computed once
// here so connect/callback pairs can't drift apart.
function baseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || (isLocalHost(req.headers.host) ? "http" : "https");
  return `${proto}://${req.headers.host}`;
}

function isLocalHost(host) {
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host || "");
}

module.exports = { baseUrl };
