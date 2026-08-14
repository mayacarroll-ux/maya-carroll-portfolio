// POST /api/bookings — PUBLIC. A visitor submits { name, email, topic,
// slot: {start,end} } from booking.html. Re-validates the slot is still
// free server-side (never trusts the client's own view of availability),
// then atomically reserves it, then opportunistically creates a real
// calendar event if a connected account has write scope — otherwise the
// booking stays "pending" for the owner to handle from calendar.html.
const { loadAccountsWithTokens } = require("./_calendar-accounts");
const { dateInZone } = require("./_day-range");
const { computeBookableSlots, SLOT_MINUTES, HOME_TIMEZONE } = require("./_availability");
const { loadBookings, addBookingIfFree, updateBooking, newBookingId } = require("./_bookings");
const { attemptCreateCalendarEvent } = require("./_calendar-fetch");
const { sendEmail, OWNER_EMAIL } = require("./_email");
const { baseUrl } = require("./_base-url");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 3;

function formatSlotTime(iso, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

// Best-effort — a booking that succeeded shouldn't fail just because
// Resend isn't configured yet or a send fails, so every call site wraps
// this in try/catch and swallows errors.
async function sendBookingEmails(record, status, req) {
  const miamiTime = formatSlotTime(record.slot.start, HOME_TIMEZONE);
  const visitorZone = record.requesterTimeZone || HOME_TIMEZONE;
  const visitorTime = formatSlotTime(record.slot.start, visitorZone);
  const calendarUrl = `${baseUrl(req)}/calendar.html`;

  const statusLine =
    status === "confirmed"
      ? "This call is confirmed — a calendar invite has been sent separately with the full details."
      : "Maya will confirm this shortly.";

  await sendEmail({
    to: record.email,
    subject: status === "confirmed" ? "You're booked with Maya Carroll" : "Your call request with Maya Carroll",
    text:
      `Hi ${record.name},\n\n` +
      `Your call is set for ${visitorTime} (your time).\n\n${statusLine}\n\n` +
      (record.topic ? `Topic: ${record.topic}\n\n` : "") +
      `— Maya`,
    html:
      `<p>Hi ${escapeHtml(record.name)},</p>` +
      `<p>Your call is set for <strong>${escapeHtml(visitorTime)}</strong> (your time).</p>` +
      `<p>${escapeHtml(statusLine)}</p>` +
      (record.topic ? `<p><strong>Topic:</strong> ${escapeHtml(record.topic)}</p>` : "") +
      `<p>— Maya</p>`,
  });

  await sendEmail({
    to: OWNER_EMAIL,
    subject: `New booking ${status === "confirmed" ? "(confirmed)" : "request"} from ${record.name}`,
    text:
      `${record.name} <${record.email}> requested a call.\n\n` +
      `When: ${miamiTime} (Miami time)\n` +
      (record.topic ? `Topic: ${record.topic}\n` : "") +
      `Status: ${status}\n\n` +
      (status === "confirmed"
        ? "A calendar event was created automatically."
        : `Confirm or decline it here: ${calendarUrl}`),
    html:
      `<p><strong>${escapeHtml(record.name)}</strong> &lt;${escapeHtml(record.email)}&gt; requested a call.</p>` +
      `<p><strong>When:</strong> ${escapeHtml(miamiTime)} (Miami time)</p>` +
      (record.topic ? `<p><strong>Topic:</strong> ${escapeHtml(record.topic)}</p>` : "") +
      `<p><strong>Status:</strong> ${escapeHtml(status)}</p>` +
      (status === "confirmed"
        ? "<p>A calendar event was created automatically.</p>"
        : `<p><a href="${calendarUrl}">Confirm or decline it from calendar.html</a>.</p>`),
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : null;
}

function validateInput(body) {
  if (!body || typeof body !== "object") return "Missing request body.";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const slot = body.slot;

  if (!name || name.length > 200) return "Please enter your name.";
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) return "Please enter a valid email.";
  if (topic.length > 2000) return "Topic is too long.";
  if (!slot || typeof slot.start !== "string" || typeof slot.end !== "string") {
    return "Please pick a time.";
  }
  const startMs = Date.parse(slot.start);
  const endMs = Date.parse(slot.end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return "That time slot looks invalid.";
  }
  if (endMs - startMs !== SLOT_MINUTES * 60000) {
    return "That time slot looks invalid.";
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");

  const error = validateInput(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const name = req.body.name.trim();
  const email = req.body.email.trim();
  const topic = typeof req.body.topic === "string" ? req.body.topic.trim() : "";
  const slot = { start: req.body.slot.start, end: req.body.slot.end };
  const requesterTimeZone =
    typeof req.body.requesterTimeZone === "string" ? req.body.requesterTimeZone.slice(0, 100) : null;
  const ip = clientIp(req);

  let bookings;
  try {
    bookings = await loadBookings();
  } catch (e) {
    res.status(500).json({ error: "Could not check availability right now." });
    return;
  }

  const recentWindowStart = Date.now() - RATE_WINDOW_MS;
  const recentCount = bookings.filter(
    (b) => b.createdAt >= recentWindowStart && (b.ip === ip || b.email === email)
  ).length;
  if (recentCount >= RATE_LIMIT) {
    res.status(429).json({ error: "Too many requests — please try again later." });
    return;
  }

  let accounts;
  try {
    accounts = await loadAccountsWithTokens();
  } catch (e) {
    accounts = [];
  }

  const dateStr = dateInZone(new Date(slot.start), HOME_TIMEZONE);
  const { slots: freshSlots } = await computeBookableSlots({
    startDate: dateStr,
    days: 1,
    accounts,
    bookings,
    now: new Date(),
  });
  const stillFree = freshSlots.some((s) => s.start === slot.start && s.end === slot.end);
  if (!stillFree) {
    res.status(409).json({ error: "That time is no longer available." });
    return;
  }

  const record = {
    id: newBookingId(),
    name,
    email,
    topic,
    slot,
    requesterTimeZone,
    status: "pending",
    createdAt: Date.now(),
    calendarEvent: null,
    ip,
  };

  let inserted;
  try {
    inserted = await addBookingIfFree(record);
  } catch (e) {
    res.status(500).json({ error: "Could not save that booking — please try again." });
    return;
  }
  if (!inserted) {
    res.status(409).json({ error: "That time is no longer available." });
    return;
  }

  let finalStatus = "pending";
  try {
    const calendarEvent = await attemptCreateCalendarEvent(accounts, record);
    if (calendarEvent) {
      await updateBooking(record.id, { status: "confirmed", calendarEvent });
      finalStatus = "confirmed";
    }
  } catch (e) {
    // Booking is already saved as "pending" — surfaced on calendar.html
    // for manual handling either way.
  }

  try {
    await sendBookingEmails(record, finalStatus, req);
  } catch (e) {
    // Email is a best-effort side effect — the booking itself already
    // succeeded and is either on the calendar or in the pending list.
  }

  res.status(200).json({ ok: true, status: finalStatus, slot });
};
