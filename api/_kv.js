// Postgres-backed (Neon) key-value storage — a single JSONB column table,
// used only for the connected-calendar-accounts blob. Keeps the same
// kvGetJSON/kvSetJSON interface the rest of the calendar code expects, so
// swapping the backing store (Upstash Redis -> Neon Postgres, matching
// what's actually attached in Vercel Storage) didn't require touching
// _calendar-accounts.js at all.
//
// Neon's HTTP driver runs SQL over https (no persistent TCP connection),
// which is what makes it usable from a stateless serverless function
// without connection-pooling infrastructure.
const { neon } = require("@neondatabase/serverless");

let client = null;
function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured (connect a Neon database in Vercel's Storage tab)");
  }
  if (!client) client = neon(url);
  return client;
}

let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    const sql = getClient();
    tableReady = sql`
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
  }
  return tableReady;
}

async function kvGetJSON(key) {
  await ensureTable();
  const sql = getClient();
  const rows = await sql`SELECT value FROM kv_store WHERE key = ${key}`;
  return rows.length ? rows[0].value : null;
}

async function kvSetJSON(key, value) {
  await ensureTable();
  const sql = getClient();
  await sql`
    INSERT INTO kv_store (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

module.exports = { kvGetJSON, kvSetJSON, getClient, ensureTable };
