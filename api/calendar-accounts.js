// GET /api/calendar-accounts — list connected calendar accounts for the
// signed-in owner. Never returns tokens, just enough to render a list with
// a disconnect button.
const { readSession } = require("./_session");
const { loadAccounts, toPublic } = require("./_calendar-accounts");

module.exports = async (req, res) => {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  try {
    const accounts = await loadAccounts();
    res.status(200).json({ accounts: accounts.map(toPublic) });
  } catch (e) {
    res.status(500).json({ error: "Could not load connected accounts." });
  }
};
