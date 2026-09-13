// Netlify runs a function with this exact name for every verified form
// submission — anything the honeypot flags as spam never reaches it. It
// forwards the submission to a Google Apps Script web app that appends a
// row to the NewSociety Live sheet (see integrations/google-sheets/Code.gs).
//
// Only the fields each form actually asks for are forwarded, so Netlify's
// extra submission metadata (IP address, user agent) never lands in the
// sheet. Event-triggered functions can't be invoked over HTTP, and the
// Apps Script side also checks a shared secret, so the sheet can't be
// written to by anyone who merely learns the web app URL.
//
// Uses the v1 handler signature, which Netlify's event triggers support.

const FIELDS: Record<string, string[]> = {
  "launch-rsvp": ["name", "email", "area", "age_range", "gender", "party_size"],
  "production-inquiry": ["name", "email", "organization", "project_type", "timeline", "message"],
};

export const handler = async (event: { body: string | null }) => {
  const url = process.env.SHEETS_WEBHOOK_URL;
  const secret = process.env.SHEETS_WEBHOOK_SECRET;
  if (!url || !secret) {
    console.log("submission-created: SHEETS_WEBHOOK_URL / SHEETS_WEBHOOK_SECRET not set; skipping sheet sync");
    return { statusCode: 200 };
  }

  let payload: any;
  try {
    payload = JSON.parse(event.body || "{}").payload;
  } catch {
    console.error("submission-created: unparseable event body");
    return { statusCode: 400 };
  }

  const form = payload?.form_name;
  const fields = FIELDS[form];
  if (!fields) {
    console.log(`submission-created: no sheet mapping for form "${form}"; skipping`);
    return { statusCode: 200 };
  }

  const data: Record<string, string> = {};
  for (const key of fields) data[key] = String(payload.data?.[key] ?? "");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, form, created_at: payload.created_at, data }),
    });
    const text = await res.text();
    if (!res.ok || !text.includes('"ok":true')) {
      console.error(`submission-created: sheet sync failed (${res.status}): ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.error("submission-created: sheet sync error", err);
  }

  // Always 200: the submission is already stored in Netlify, and a sheet
  // hiccup shouldn't be reported as a failed submission.
  return { statusCode: 200 };
};
