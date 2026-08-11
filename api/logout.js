// POST /api/logout — clears the session cookie.
const { clearSessionCookie } = require("./_session");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  clearSessionCookie(req, res);
  res.status(200).json({ ok: true });
};
