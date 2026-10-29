// Runs every 15 min (schedule in netlify.toml). Emails each invitee a reminder ~30 min before a meeting created by TaskFlow.
// Sent through Gmail as asma.g@natheelco.com. CommonJS, Node 18+.
const E = process.env, ORG = E.ORGANIZER_EMAIL || "asma.g@natheelco.com";
async function gToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: E.GOOGLE_CLIENT_ID, client_secret: E.GOOGLE_CLIENT_SECRET, refresh_token: E.GOOGLE_REFRESH_TOKEN, grant_type: "refresh_token" }) });
  const j = await r.json(); if (!j.access_token) throw new Error("Google sign-in failed"); return j.access_token;
}
const cal = (tok, path, opt = {}) => fetch("https://www.googleapis.com/calendar/v3" + path, { ...opt, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" } }).then(r => r.json());
async function send(tok, to, subject, body) {
  const raw = [`From: Natheelco TaskFlow <${ORG}>`, `To: ${to}`, `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`, "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(body).toString("base64")].join("\r\n");
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") }) });
  if (!r.ok) throw new Error("Gmail send failed: " + r.status);
}
exports.handler = async () => {
  if (!E.GOOGLE_REFRESH_TOKEN) return { statusCode: 200, body: "Google not connected" };
  const tok = await gToken(), now = Date.now(), sent = [];
  const q = new URLSearchParams({ timeMin: new Date(now).toISOString(), timeMax: new Date(now + 30 * 60000).toISOString(), singleEvents: "true", privateExtendedProperty: "app=taskflow" });
  const j = await cal(tok, "/calendars/primary/events?" + q);
  for (const e of j.items || []) {
    const p = (e.extendedProperties || {}).private || {};
    if (p.reminded || e.status === "cancelled") continue;
    const link = p.joinUrl || e.hangoutLink || "", when = new Date(e.start.dateTime).toLocaleString("en-GB", { timeZone: E.TIMEZONE || "Africa/Tunis", dateStyle: "full", timeStyle: "short" });
    for (const a of e.attendees || []) {
      if (a.self || a.organizer || a.responseStatus === "declined") continue;
      await send(tok, a.email, "Reminder: " + (e.summary || "Meeting") + " starts soon", `Hello,\n\nReminder: "${e.summary || "Meeting"}" starts at ${when}.\n\nJoin: ${link}\n\nOrganizer: ${ORG}`);
      sent.push(a.email);
    }
    await cal(tok, "/calendars/primary/events/" + encodeURIComponent(e.id) + "?sendUpdates=none", { method: "PATCH", body: JSON.stringify({ extendedProperties: { private: { ...p, reminded: "1" } } }) });
  }
  return { statusCode: 200, body: JSON.stringify({ reminded: sent }) };
};
