// POST /api/calendar-disconnect  { id: "<account id>" }
const { readSession } = require("./_session");
const { removeAccount } = require("./_calendar-accounts");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }

  const id = req.body && req.body.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Missing account id." });
    return;
  }

  try {
    await removeAccount(id);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Could not disconnect that account." });
  }
};
