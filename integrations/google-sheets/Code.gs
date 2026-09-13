/**
 * NewSociety Live — Google Sheets receiver
 *
 * Paste into Extensions → Apps Script on the Google Sheet that should
 * collect form submissions, then deploy as a web app. The Netlify
 * `submission-created` function POSTs every verified submission here.
 *
 * Set a Script Property named WEBHOOK_SECRET to the same value as the
 * SHEETS_WEBHOOK_SECRET environment variable in Netlify. Requests without
 * it are rejected, so the web app URL on its own can't write rows.
 */

// RSVP confirmation emails are sent from the account that owns this script
// (via MailApp). Leave false until the script has been re-authorized for
// sending mail and a new deployment version is live.
const SEND_RSVP_CONFIRMATIONS = true;
// Consumer Gmail allows about 100 recipients a day; stop short of that so a
// spike (or someone scripting the form) can't use up the whole quota.
const CONFIRMATION_QUOTA_FLOOR = 10;

const FORMS = {
  'launch-rsvp': {
    tab: 'RSVPs',
    columns: [
      ['Name', 'name'],
      ['Email', 'email'],
      ['Coming from', 'area'],
      ['Age range', 'age_range'],
      ['Sex / gender', 'gender'],
      ['Party size', 'party_size'],
      ['VIP interest', 'vip_interest'],
    ],
    headcount: true,
  },
  'production-inquiry': {
    tab: 'Production inquiries',
    columns: [
      ['Name', 'name'],
      ['Email', 'email'],
      ['Organization', 'organization'],
      ['Project type', 'project_type'],
      ['Timeline', 'timeline'],
      ['Details', 'message'],
    ],
    headcount: false,
  },
  'host-a-night': {
    tab: 'Venues',
    columns: [
      ['Name', 'name'],
      ['Email', 'email'],
      ['Venue', 'venue_name'],
      ['Phone', 'phone'],
      ['Venue type', 'venue_type'],
      ['Capacity', 'capacity'],
      ['Location', 'location'],
      ['Nights', 'nights'],
      ['Deal preference', 'deal_preference'],
      ['Notes', 'notes'],
    ],
    headcount: false,
  },
  'get-involved': {
    tab: 'Get Involved',
    columns: [
      ['Role', 'role'],
      ['Name', 'name'],
      ['Email', 'email'],
      ['Location', 'location'],
      ['Crew skills', 'crew_skills'],
      ['Crew experience', 'crew_experience'],
      ['Crew availability', 'crew_availability'],
      ['Crew portfolio', 'crew_portfolio'],
      ['Act', 'artist_act'],
      ['Act type', 'artist_type'],
      ['Genre', 'artist_genre'],
      ['Artist links', 'artist_links'],
      ['Company', 'sponsor_company'],
      ['Website', 'sponsor_website'],
      ['Sponsor interest', 'sponsor_interest'],
      ['Sponsor timing', 'sponsor_timeline'],
      ['Outlet', 'press_outlet'],
      ['Deadline', 'press_deadline'],
      ['Message', 'message'],
    ],
    headcount: false,
  },
  'newsletter': {
    tab: 'Newsletter',
    columns: [
      ['Email', 'email'],
    ],
    headcount: false,
  },
};

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_({ ok: false, error: 'bad json' });
  }

  const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!secret || body.secret !== secret) return reply_({ ok: false, error: 'unauthorized' });

  const form = FORMS[body.form];
  if (!form) return reply_({ ok: false, error: 'unknown form' });

  // Two submissions landing together shouldn't interleave their writes.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(form.tab) || ss.insertSheet(form.tab);

    const headers = ['Received'].concat(form.columns.map(function (c) { return c[0]; }));
    if (form.headcount) headers.push('Headcount');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }

    const data = body.data || {};
    const row = [body.created_at ? new Date(body.created_at) : new Date()]
      .concat(form.columns.map(function (c) { return cell_(data[c[1]]); }));
    // "1 — just me" → 1, "6+" → 6, so the Summary tab can add them up.
    if (form.headcount) row.push(parseInt(data.party_size, 10) || 1);
    sheet.appendRow(row);

    if (form.headcount) ensureSummary_(ss, sheet, headers.length);

    if (body.form === 'launch-rsvp' && SEND_RSVP_CONFIRMATIONS) {
      // Never let an email problem undo or block saving the RSVP.
      try { sendRsvpConfirmation_(sheet, data); } catch (err) { console.error('confirmation email failed', err); }
    }
  } finally {
    lock.releaseLock();
  }

  return reply_({ ok: true });
}

// Sends one confirmation per email address. Anyone can type any address into
// a public form, so: the address must look valid, a repeat RSVP from the same
// address doesn't email again, sending stops near the daily quota, and every
// visitor-supplied value is escaped before it goes into the HTML.
function sendRsvpConfirmation_(sheet, data) {
  const email = String(data.email || '').trim();
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) return 'skipped: invalid address';

  // Column C is Email (Received, Name, Email, ...). The row just appended is
  // the last one, so an earlier match means this address already RSVPed.
  const lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    const earlier = sheet.getRange(2, 3, lastRow - 2, 1).getValues()
      .map(function (r) { return String(r[0]).trim().toLowerCase().replace(/^'/, ''); });
    if (earlier.indexOf(email.toLowerCase()) !== -1) return 'skipped: already confirmed';
  }
  if (MailApp.getRemainingDailyQuota() <= CONFIRMATION_QUOTA_FLOOR) return 'skipped: quota floor';

  const firstName = String(data.name || '').trim().split(/\s+/)[0] || 'there';
  const party = String(data.party_size || '').trim();
  const vip = String(data.vip_interest || '') === 'Yes';
  const site = 'https://newsociety.netlify.app';

  const lines = [
    "You're on the list for the NewSociety Live launch party.",
    '',
    party ? 'Your RSVP: ' + party + (vip ? ' (and you flagged interest in VIP)' : '') : '',
    "The date and venue haven't been announced yet — you'll hear them here first, before they go public.",
    '',
    'Until then, the feed never stops: ' + site,
    '',
    '— NewSociety Live',
    '',
    "You're getting this because this address was used to RSVP at " + site + '/live.html. If that wasn\'t you, you can ignore this email — you won\'t get another one.'
  ].filter(function (l, i, a) { return !(l === '' && a[i - 1] === ''); });

  const esc = function (v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  const html =
    '<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0a0a0c;color:#f4f3ef;">' +
    '<p style="font:12px/1.4 Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#8470ff;margin:0 0 16px;">NewSociety Live</p>' +
    '<h1 style="font-size:28px;line-height:1.1;text-transform:uppercase;margin:0 0 20px;">You\'re on the list, ' + esc(firstName) + '.</h1>' +
    '<p style="font-size:15px;line-height:1.6;color:#c9c9cf;margin:0 0 14px;">Thanks for RSVPing to the NewSociety Live launch party.</p>' +
    (party ? '<p style="font-size:15px;line-height:1.6;color:#c9c9cf;margin:0 0 14px;">Your RSVP: <strong style="color:#f4f3ef;">' + esc(party) + '</strong>' + (vip ? ' — and you flagged interest in VIP.' : '') + '</p>' : '') +
    '<p style="font-size:15px;line-height:1.6;color:#c9c9cf;margin:0 0 24px;">The date and venue haven\'t been announced yet. You\'ll hear them here first, before they go public.</p>' +
    '<p style="margin:0 0 28px;"><a href="' + site + '" style="display:inline-block;background:#6e56ff;color:#fff;text-decoration:none;font:13px Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;padding:13px 22px;border-radius:2px;">Watch the Feed →</a></p>' +
    '<p style="font-size:12px;line-height:1.5;color:#808088;margin:0;">You\'re getting this because this address was used to RSVP at newsociety.netlify.app. If that wasn\'t you, ignore this email — you won\'t get another.</p>' +
    '</div>';

  MailApp.sendEmail({
    to: email,
    subject: "You're on the list — NewSociety Live launch party",
    body: lines.join('\n'),
    htmlBody: html,
    name: 'NewSociety Live'
  });
  return 'sent';
}

// Text a visitor types that starts with = + - or @ would otherwise be run
// by Sheets as a formula; a leading apostrophe keeps it plain text.
function cell_(value) {
  const s = value == null ? '' : String(value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function ensureSummary_(ss, rsvpSheet, headcountCol) {
  if (ss.getSheetByName('Summary')) return;
  const summary = ss.insertSheet('Summary', 0);
  const ref = "'" + rsvpSheet.getName() + "'!";
  const col = columnLetter_(headcountCol);
  summary.getRange('A1').setValue('Launch party').setFontWeight('bold');
  summary.getRange('A2').setValue('RSVPs');
  summary.getRange('B2').setFormula('=COUNTA(' + ref + 'A2:A)');
  summary.getRange('A3').setValue('Total people attending');
  summary.getRange('B3').setFormula('=SUM(' + ref + col + '2:' + col + ')');
}

function columnLetter_(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
