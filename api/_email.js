// Transactional email via Resend (resend.com) — a dedicated email
// service rather than piggybacking on the calendar OAuth connections, so
// booking confirmations work the same regardless of which (if any)
// calendar provider is connected.
//
// Requires RESEND_API_KEY in Vercel's env vars. Sending to arbitrary
// visitor addresses (not just the account owner) requires verifying a
// sending domain in the Resend dashboard first — until that's done,
// Resend's sandbox mode only delivers to the account's own verified
// address, so the owner-notification email will work immediately but
// the visitor-facing one won't reach anyone else yet.
const FROM_ADDRESS = process.env.BOOKING_FROM_EMAIL || "Maya Carroll <hiring@mayacarroll.com>";
const OWNER_EMAIL = process.env.OWNER_NOTIFICATION_EMAIL || "hiring@mayacarroll.com";

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend responded ${res.status}: ${body}`);
  }
  return res.json();
}

module.exports = { sendEmail, OWNER_EMAIL };
