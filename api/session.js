// GET /api/session — tells a page whether the current visitor has a valid
// signed session, without exposing anything but the email on success.
const { readSession } = require("./_session");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const session = readSession(req);
  if (!session) {
    res.status(200).json({ signedIn: false });
    return;
  }
  res.status(200).json({ signedIn: true, email: session.email });
};
