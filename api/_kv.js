// Minimal Upstash Redis REST client — plain `fetch`, no npm dependency.
// This project has no package.json/build step, so a real Redis client
// library isn't an option; Upstash's REST API (a Vercel KV integration
// injects these two env vars) is a good fit for that constraint.
async function kvRequest(command) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("KV is not configured (KV_REST_API_URL/TOKEN missing)");

  // POST with the command as a JSON body array (Upstash's documented
  // "pipeline"-free command format) — avoids URL-encoding/length pitfalls
  // that the path-segment style has for arbitrary JSON string values.
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`KV request failed: ${res.status}`);
  const data = await res.json();
  return data.result;
}

async function kvGetJSON(key) {
  const raw = await kvRequest(["GET", key]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function kvSetJSON(key, value) {
  await kvRequest(["SET", key, JSON.stringify(value)]);
}

module.exports = { kvGetJSON, kvSetJSON };
