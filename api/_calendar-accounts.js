// Connected-calendar-account storage. Single owner, so one KV key holds a
// JSON array of every connected account rather than needing a real schema.
// Access/refresh tokens are encrypted at rest; everything else (email,
// provider, id, timestamps) is stored in the clear since it's only ever
// returned to the owner's own authenticated requests.
const crypto = require("crypto");
const { kvGetJSON, kvSetJSON } = require("./_kv");
const { encrypt, decrypt } = require("./_crypto");

const KEY = "calendar:accounts";

async function loadAccounts() {
  const accounts = await kvGetJSON(KEY);
  return Array.isArray(accounts) ? accounts : [];
}

async function saveAccounts(accounts) {
  await kvSetJSON(KEY, accounts);
}

// Returns accounts with tokens decrypted — for internal use only (event
// fetching), never sent to the client as-is.
async function loadAccountsWithTokens() {
  const accounts = await loadAccounts();
  return accounts.map((a) => ({
    ...a,
    accessToken: a.accessToken ? decrypt(a.accessToken) : null,
    refreshToken: a.refreshToken ? decrypt(a.refreshToken) : null,
  }));
}

// Safe to send to the client: no tokens.
function toPublic(account) {
  return {
    id: account.id,
    provider: account.provider,
    email: account.email,
    connectedAt: account.connectedAt,
  };
}

async function addAccount({ provider, email, accessToken, refreshToken, expiresAt, scope }) {
  const accounts = await loadAccounts();
  // Reconnecting the same provider+email replaces the old tokens rather
  // than creating a duplicate entry.
  const existing = accounts.find((a) => a.provider === provider && a.email === email);
  const record = {
    id: existing ? existing.id : crypto.randomUUID(),
    provider,
    email,
    accessToken: encrypt(accessToken),
    refreshToken: refreshToken ? encrypt(refreshToken) : existing ? existing.refreshToken : null,
    expiresAt,
    // Plaintext, not sensitive — lets attemptCreateCalendarEvent (in
    // _calendar-fetch.js) know whether this account was ever granted
    // calendar-write access without an extra API round trip.
    scope: scope || (existing ? existing.scope : null),
    connectedAt: existing ? existing.connectedAt : Date.now(),
  };
  const next = existing
    ? accounts.map((a) => (a.id === existing.id ? record : a))
    : accounts.concat(record);
  await saveAccounts(next);
  return record;
}

async function updateAccountTokens(id, { accessToken, expiresAt, refreshToken }) {
  const accounts = await loadAccounts();
  const next = accounts.map((a) => {
    if (a.id !== id) return a;
    return {
      ...a,
      accessToken: encrypt(accessToken),
      expiresAt,
      refreshToken: refreshToken ? encrypt(refreshToken) : a.refreshToken,
    };
  });
  await saveAccounts(next);
}

async function removeAccount(id) {
  const accounts = await loadAccounts();
  await saveAccounts(accounts.filter((a) => a.id !== id));
}

module.exports = {
  loadAccounts,
  loadAccountsWithTokens,
  saveAccounts,
  addAccount,
  updateAccountTokens,
  removeAccount,
  toPublic,
};
