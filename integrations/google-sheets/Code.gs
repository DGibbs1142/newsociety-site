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
// Newsletter signups get a welcome email the moment they join, so the first
// real issue isn't the first thing they hear from us.
const SEND_NEWSLETTER_WELCOME = true;
// Consumer Gmail allows about 100 recipients a day; stop short of that so a
// spike (or someone scripting the form) can't use up the whole quota.
const CONFIRMATION_QUOTA_FLOOR = 10;
// Addresses sendTestConfirmation() mails a sample confirmation to, for
// checking whether it lands in the inbox or spam. Keep empty when not testing.
const TEST_CONFIRMATION_TO = [];

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
      try { sendRsvpConfirmation_(sheet, sheet.getLastRow(), data); } catch (err) { console.error('confirmation email failed', err); }
    }

    if (body.form === 'newsletter' && SEND_NEWSLETTER_WELCOME) {
      // Same rule: a mail problem must never lose the signup.
      try { sendNewsletterWelcome_(sheet, sheet.getLastRow(), data); } catch (err) { console.error('welcome email failed', err); }
    }
  } finally {
    lock.releaseLock();
  }

  return reply_({ ok: true });
}

// Sends one confirmation per email address, and records it. The RSVPs tab has
// a "Confirmation sent" column that gets a timestamp only when an email really
// goes out; an address is skipped only if one of its rows already has one.
// Anyone can type any address into a public form, so: the address must look
// valid, sending stops near the daily quota, and visitor-supplied values are
// escaped before they go into the HTML. A skipped or failed send leaves the
// column blank, so that person can still be confirmed later.
const CONFIRMATION_HEADER = 'Confirmation sent';

function sendRsvpConfirmation_(sheet, row, data) {
  const email = String(data.email || '').trim();
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) return 'skipped: invalid address';
  const sentCol = confirmationColumn_(sheet);
  if (alreadyConfirmed_(sheet, sentCol, email)) return 'skipped: already confirmed';
  if (MailApp.getRemainingDailyQuota() <= CONFIRMATION_QUOTA_FLOOR) return 'skipped: quota floor';
  MailApp.sendEmail(confirmationMessage_(email, data));
  sheet.getRange(row, sentCol).setValue(new Date());
  return 'sent';
}

// One-time catch-up, run by hand from the editor: emails every RSVP address
// that has never been confirmed, using its most recent RSVP, and stamps that
// row. Safe to run again — already-confirmed addresses are skipped.
function sendMissingConfirmations() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(FORMS['launch-rsvp'].tab);
  if (!sheet || sheet.getLastRow() < 2) { console.log('No RSVPs yet.'); return { sent: 0 }; }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sentCol = confirmationColumn_(sheet);
    const lastRow = sheet.getLastRow();
    const header = sheet.getRange(1, 1, 1, sentCol).getValues()[0].map(String);
    const col = function (name) { return header.indexOf(name); };
    const values = sheet.getRange(2, 1, lastRow - 1, sentCol).getValues();

    // latest row per address, and whether any of its rows was confirmed
    const latest = {}, confirmed = {};
    values.forEach(function (v, i) {
      const key = cleanEmail_(v[col('Email')]);
      if (!key) return;
      if (v[sentCol - 1] !== '' && v[sentCol - 1] !== null) confirmed[key] = true;
      latest[key] = { row: i + 2, v: v };
    });

    const report = { sent: 0, skipped: [] };
    Object.keys(latest).forEach(function (key) {
      if (confirmed[key]) return;
      const v = latest[key].v;
      const data = {
        name: v[col('Name')], email: String(v[col('Email')]).replace(/^'/, ''),
        party_size: v[col('Party size')], vip_interest: v[col('VIP interest')]
      };
      const result = sendRsvpConfirmation_(sheet, latest[key].row, data);
      if (result === 'sent') report.sent++; else report.skipped.push(result);
    });
    console.log('Catch-up confirmations: ' + report.sent + ' sent' + (report.skipped.length ? ', skipped: ' + report.skipped.join('; ') : ''));
    return report;
  } finally {
    lock.releaseLock();
  }
}

// Run from the editor: sends the real confirmation email, filled with sample
// RSVP details, to each TEST_CONFIRMATION_TO address. Doesn't touch the Sheet.
function sendTestConfirmation() {
  if (!TEST_CONFIRMATION_TO.length) throw new Error('Add addresses to TEST_CONFIRMATION_TO first.');
  const sample = { name: 'Test Guest', party_size: '2', vip_interest: 'Yes' };
  TEST_CONFIRMATION_TO.forEach(function (to) {
    MailApp.sendEmail(confirmationMessage_(to, sample));
  });
  console.log('Test confirmations sent: ' + TEST_CONFIRMATION_TO.length);
}

// ---- Launch party announcement ----
// Once the date and venue are locked: fill in LAUNCH_DETAILS and save, run
// previewLaunchAnnouncement() (emails one sample to the script owner and logs
// how many guests would get it), then run sendLaunchAnnouncement(). Each guest
// is emailed once, at their latest RSVP; running it again only reaches guests
// who RSVP'd after the last send.
const LAUNCH_DETAILS = {
  date: '',     // e.g. 'Saturday, October 17'
  time: '',     // e.g. '9 PM – 2 AM'
  venue: '',    // e.g. 'The Loft'
  address: '',  // e.g. '123 Main St, Newark, NJ'
  note: ''      // optional extra line, e.g. 'Bring a photo ID. 21+.'
};
const ANNOUNCEMENT_HEADER = 'Announcement sent';

function previewLaunchAnnouncement() {
  requireLaunchDetails_();
  return previewToOwner_(ANNOUNCEMENT_HEADER, announcementMessage_, 'sendLaunchAnnouncement()');
}

function sendLaunchAnnouncement() {
  requireLaunchDetails_();
  return sendToPendingGuests_(ANNOUNCEMENT_HEADER, announcementMessage_, 'Launch announcement');
}

function requireLaunchDetails_() {
  const missing = ['date', 'time', 'venue', 'address'].filter(function (k) {
    return !String(LAUNCH_DETAILS[k] || '').trim();
  });
  if (missing.length) throw new Error('Fill in LAUNCH_DETAILS first (missing: ' + missing.join(', ') + ').');
}

// Emails one sample of a guest email to the script owner and reports how many
// guests the real send would reach. Doesn't touch the Sheet.
function previewToOwner_(header, messageFn, sendFnName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORMS['launch-rsvp'].tab);
  const wouldSend = sheet ? pendingGuests_(sheet, header).length : 0;
  const me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(messageFn(me, { name: 'Preview', party_size: '2' }));
  console.log('Preview sent to ' + me + '. ' + sendFnName + ' would email ' + wouldSend + ' guest(s).');
  return { preview: me, wouldSend: wouldSend };
}

// Emails each guest who has no stamp in `header` once, at their latest RSVP,
// and stamps that row. Stops near the daily quota; the rest go out next run.
function sendToPendingGuests_(header, messageFn, label) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORMS['launch-rsvp'].tab);
  if (!sheet || sheet.getLastRow() < 2) { console.log('No RSVPs yet.'); return { sent: 0, skipped: 0 }; }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sentCol = stampColumn_(sheet, header);
    const report = { sent: 0, skipped: 0 };
    pendingGuests_(sheet, header).forEach(function (guest) {
      if (MailApp.getRemainingDailyQuota() <= CONFIRMATION_QUOTA_FLOOR) { report.skipped++; return; }
      MailApp.sendEmail(messageFn(guest.data.email, guest.data));
      sheet.getRange(guest.row, sentCol).setValue(new Date());
      report.sent++;
    });
    console.log(label + ': ' + report.sent + ' sent' +
      (report.skipped ? ', ' + report.skipped + ' held back by the daily email limit (run again tomorrow)' : ''));
    return report;
  } finally {
    lock.releaseLock();
  }
}

// Latest RSVP row for each valid address that has no stamp in `header` on any
// of its rows.
function pendingGuests_(sheet, header) {
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  if (lastRow < 2) return [];
  const head = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const at = function (name) { return head.indexOf(name); };
  const stampAt = at(header);
  const latest = {}, done = {};
  sheet.getRange(2, 1, lastRow - 1, lastCol).getValues().forEach(function (v, i) {
    const key = cleanEmail_(v[at('Email')]);
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(key)) return;
    if (stampAt >= 0 && v[stampAt] !== '' && v[stampAt] !== null) done[key] = true;
    latest[key] = {
      row: i + 2,
      data: {
        name: v[at('Name')],
        email: String(v[at('Email')]).replace(/^'/, '').trim(),
        party_size: v[at('Party size')]
      }
    };
  });
  return Object.keys(latest)
    .filter(function (key) { return !done[key]; })
    .map(function (key) { return latest[key]; });
}

function announcementMessage_(email, data) {
  const d = LAUNCH_DETAILS;
  const firstName = String(data.name || '').trim().split(/\s+/)[0] || 'there';
  const party = String(data.party_size || '').trim();
  const site = 'https://newsociety.netlify.app';
  const when = d.date + ', ' + d.time;

  const lines = [
    "It's official: the NewSociety Live launch party is locked in.",
    '',
    'When: ' + when,
    'Where: ' + d.venue + ', ' + d.address,
    party ? 'Your RSVP: ' + party : '',
    '',
    d.note || '',
    '',
    'Plans changed? Just reply to this email and let us know.',
    '',
    '— NewSociety Live',
    '',
    "You're getting this because this address was used to RSVP at " + site + '/live.html.'
  ].filter(function (l, i, a) { return !(l === '' && a[i - 1] === ''); });

  const esc = function (v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  const p = function (text, extra) {
    return '<p style="font-size:15px;line-height:1.6;color:#c9c9cf;margin:0 0 14px;' + (extra || '') + '">' + text + '</p>';
  };
  const row = function (label, value) {
    return '<tr><td style="padding:6px 18px 6px 0;font:12px/1.4 Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8470ff;vertical-align:top;">' + label + '</td>' +
      '<td style="padding:6px 0;font-size:16px;line-height:1.45;color:#f4f3ef;">' + value + '</td></tr>';
  };
  const html =
    '<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0a0a0c;color:#f4f3ef;">' +
    '<p style="font:12px/1.4 Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#8470ff;margin:0 0 16px;">NewSociety Live</p>' +
    '<h1 style="font-size:28px;line-height:1.1;text-transform:uppercase;margin:0 0 20px;">It\'s official, ' + esc(firstName) + '.</h1>' +
    p('The NewSociety Live launch party is locked in. Here are the details.') +
    '<table role="presentation" style="border-collapse:collapse;margin:0 0 22px;">' +
    row('When', esc(when)) +
    row('Where', esc(d.venue) + '<br>' + esc(d.address)) +
    (party ? row('Your RSVP', esc(party)) : '') +
    '</table>' +
    (d.note ? p(esc(d.note)) : '') +
    p('Plans changed? Just reply to this email and let us know.', 'margin-bottom:24px;') +
    '<p style="margin:0 0 28px;"><a href="' + site + '/live.html" style="display:inline-block;background:#6e56ff;color:#fff;text-decoration:none;font:13px Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;padding:13px 22px;border-radius:2px;">NewSociety Live →</a></p>' +
    '<p style="font-size:12px;line-height:1.5;color:#808088;margin:0;">You\'re getting this because this address was used to RSVP at newsociety.netlify.app.</p>' +
    '</div>';

  return {
    to: email,
    subject: "It's official: NewSociety Live launch party, " + d.date,
    body: lines.join('\n'),
    htmlBody: html,
    name: 'NewSociety Live'
  };
}

// ---- "Follow us" email ----
// Asks everyone on the launch party list to follow the NewSociety socials
// while the date and venue are still being locked. Run previewFollowEmail()
// first (one sample to the script owner, plus a count of who'd get it), then
// sendFollowEmail(). Each guest gets it once; running it again only reaches
// guests who RSVP'd after the last send.
const FOLLOW_HEADER = 'Follow email sent';
const SOCIALS = [
  ['Instagram', '@newsociety1142', 'https://www.instagram.com/newsociety1142/'],
  ['TikTok', '@newsociety22', 'https://www.tiktok.com/@newsociety22'],
  ['X', '@NewSociety1142', 'https://x.com/NewSociety1142']
];

function previewFollowEmail() {
  return previewToOwner_(FOLLOW_HEADER, followMessage_, 'sendFollowEmail()');
}

function sendFollowEmail() {
  return sendToPendingGuests_(FOLLOW_HEADER, followMessage_, 'Follow email');
}

function followMessage_(email, data) {
  const firstName = String(data.name || '').trim().split(/\s+/)[0] || 'there';
  const site = 'https://newsociety.netlify.app';

  const lines = [
    "You're on the list for the NewSociety launch party.",
    '',
    "The date and venue are almost locked. You'll get them by email before they go public, and our socials are where you'll see everything around it: first looks at the venue, and what we're into every day.",
    '',
    'Follow along:',
    SOCIALS.map(function (s) { return s[0] + ' ' + s[1] + ': ' + s[2]; }).join('\n'),
    '',
    "Every day we cover what everyone's about to be talking about: sports, music, anime, pop culture and fashion, fast and with an actual opinion.",
    '',
    'Bringing someone? Send them to ' + site + "/live.html so they're on the list too.",
    '',
    'See you soon,',
    'Daniel and NewSociety',
    '',
    "You're getting this because this address was used to RSVP at " + site + '/live.html.'
  ].filter(function (l, i, a) { return !(l === '' && a[i - 1] === ''); });

  const esc = function (v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  const p = function (text, extra) {
    return '<p style="font-size:15px;line-height:1.6;color:#c9c9cf;margin:0 0 14px;' + (extra || '') + '">' + text + '</p>';
  };
  const social = function (s) {
    return '<tr><td style="padding:8px 18px 8px 0;font:12px/1.4 Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8470ff;vertical-align:middle;">' + s[0] + '</td>' +
      '<td style="padding:8px 0;font-size:17px;line-height:1.4;"><a href="' + s[2] + '" style="color:#f4f3ef;text-decoration:none;font-weight:bold;">' + s[1] + ' →</a></td></tr>';
  };
  const html =
    '<div style="display:none;max-height:0;overflow:hidden;">Follow NewSociety so you don\'t miss a thing.</div>' +
    '<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0a0a0c;color:#f4f3ef;">' +
    '<p style="font:12px/1.4 Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#8470ff;margin:0 0 16px;">NewSociety Live</p>' +
    '<h1 style="font-size:28px;line-height:1.1;text-transform:uppercase;margin:0 0 20px;">You\'re on the list, ' + esc(firstName) + '.</h1>' +
    p('Thanks for signing up for the NewSociety launch party. The date and venue are almost locked. You\'ll get them by email before they go public, and our socials are where you\'ll see everything around it: first looks at the venue, and what we\'re into every day.') +
    p('<strong style="color:#f4f3ef;">Follow along so you don\'t miss it:</strong>', 'margin-bottom:6px;') +
    '<table role="presentation" style="border-collapse:collapse;margin:0 0 22px;">' + SOCIALS.map(social).join('') + '</table>' +
    p('Every day we cover what everyone\'s about to be talking about: sports, music, anime, pop culture and fashion, fast and with an actual opinion.') +
    p('<strong style="color:#f4f3ef;">Bringing someone?</strong> Send them to <a href="' + site + '/live.html" style="color:#8470ff;">newsociety.netlify.app/live.html</a> so they\'re on the list too.', 'margin-bottom:24px;') +
    p('See you soon,<br><strong style="color:#f4f3ef;">Daniel and NewSociety</strong>', 'margin-bottom:28px;') +
    '<p style="font-size:12px;line-height:1.5;color:#808088;margin:0;">You\'re getting this because this address was used to RSVP at newsociety.netlify.app.</p>' +
    '</div>';

  return {
    to: email,
    subject: 'Before we announce the launch party…',
    body: lines.join('\n'),
    htmlBody: html,
    name: 'NewSociety Live'
  };
}

// ---- Newsletter welcome ----
// One email per address, the first time it subscribes, stamped in a
// "Welcome sent" column on the Newsletter tab. Anyone can type any address
// into a public form, so the same guards as the RSVP confirmation apply:
// the address must look valid, sending stops near the daily quota, and a
// failure leaves the stamp blank so the person can still be welcomed later.
const WELCOME_HEADER = 'Welcome sent';

function sendNewsletterWelcome_(sheet, row, data) {
  const email = String(data.email || '').trim();
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) return 'skipped: invalid address';
  const sentCol = stampColumn_(sheet, WELCOME_HEADER);
  if (alreadyConfirmed_(sheet, sentCol, email)) return 'skipped: already welcomed';
  if (MailApp.getRemainingDailyQuota() <= CONFIRMATION_QUOTA_FLOOR) return 'skipped: quota floor';
  MailApp.sendEmail(welcomeMessage_(email));
  sheet.getRange(row, sentCol).setValue(new Date());
  return 'sent';
}

// One-time catch-up for addresses that subscribed before this email existed.
function sendMissingWelcomes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(FORMS['newsletter'].tab);
  if (!sheet || sheet.getLastRow() < 2) { console.log('No subscribers yet.'); return { sent: 0 }; }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sentCol = stampColumn_(sheet, WELCOME_HEADER);
    const lastRow = sheet.getLastRow();
    const header = sheet.getRange(1, 1, 1, sentCol).getValues()[0].map(String);
    const emailAt = header.indexOf('Email');
    const rows = sheet.getRange(2, 1, lastRow - 1, sentCol).getValues();
    const latest = {}, done = {};
    rows.forEach(function (v, i) {
      const key = cleanEmail_(v[emailAt]);
      if (!key) return;
      if (v[sentCol - 1] !== '' && v[sentCol - 1] !== null) done[key] = true;
      latest[key] = { row: i + 2, email: String(v[emailAt]).replace(/^'/, '').trim() };
    });
    const report = { sent: 0, skipped: [] };
    Object.keys(latest).forEach(function (key) {
      if (done[key]) return;
      const result = sendNewsletterWelcome_(sheet, latest[key].row, { email: latest[key].email });
      if (result === 'sent') report.sent++; else report.skipped.push(result);
    });
    console.log('Catch-up welcomes: ' + report.sent + ' sent' +
      (report.skipped.length ? ', skipped: ' + report.skipped.join('; ') : ''));
    return report;
  } finally {
    lock.releaseLock();
  }
}

function welcomeMessage_(email) {
  const site = 'https://newsociety.netlify.app';
  const lines = [
    "You're on the list.",
    '',
    'Once a week we send the culture that actually mattered: sports, music, anime, pop culture, fashion and the news cycle, with an actual opinion. No filler, no daily inbox spam.',
    '',
    'Follow along in between:',
    SOCIALS.map(function (s) { return s[0] + ' ' + s[1] + ': ' + s[2]; }).join('\n'),
    '',
    'The feed never stops: ' + site,
    '',
    '— NewSociety',
    '',
    "You're getting this because this address was used to sign up at " + site + ". Reply to this email to be taken off the list."
  ].filter(function (l, i, a) { return !(l === '' && a[i - 1] === ''); });

  const p = function (text, extra) {
    return '<p style="font-size:15px;line-height:1.6;color:#c9c9cf;margin:0 0 14px;' + (extra || '') + '">' + text + '</p>';
  };
  const social = function (s) {
    return '<tr><td style="padding:7px 18px 7px 0;font:12px/1.4 Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8470ff;vertical-align:middle;">' + s[0] + '</td>' +
      '<td style="padding:7px 0;font-size:16px;line-height:1.4;"><a href="' + s[2] + '" style="color:#f4f3ef;text-decoration:none;font-weight:bold;">' + s[1] + ' →</a></td></tr>';
  };
  const html =
    '<div style="display:none;max-height:0;overflow:hidden;">One email a week, and nothing else.</div>' +
    '<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0a0a0c;color:#f4f3ef;">' +
    '<p style="font:12px/1.4 Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#8470ff;margin:0 0 16px;">NewSociety</p>' +
    '<h1 style="font-size:28px;line-height:1.1;text-transform:uppercase;margin:0 0 20px;">You\'re on the list.</h1>' +
    p('Once a week we send the culture that actually mattered: sports, music, anime, pop culture, fashion and the news cycle, with an actual opinion. No filler, no daily inbox spam.') +
    p('<strong style="color:#f4f3ef;">Follow along in between:</strong>', 'margin-bottom:6px;') +
    '<table role="presentation" style="border-collapse:collapse;margin:0 0 22px;">' + SOCIALS.map(social).join('') + '</table>' +
    '<p style="margin:0 0 28px;"><a href="' + site + '" style="display:inline-block;background:#6e56ff;color:#fff;text-decoration:none;font:13px Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;padding:13px 22px;border-radius:2px;">Watch the Feed →</a></p>' +
    '<p style="font-size:12px;line-height:1.5;color:#808088;margin:0;">You\'re getting this because this address was used to sign up at newsociety.netlify.app. Reply to this email to be taken off the list.</p>' +
    '</div>';

  return {
    to: email,
    subject: "You're on the list — NewSociety",
    body: lines.join('\n'),
    htmlBody: html,
    name: 'NewSociety'
  };
}

// Column number of "Confirmation sent", adding the header to the first empty
// column if this RSVPs tab was created before the column existed.
function stampColumn_(sheet, label) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const at = header.indexOf(label);
  if (at !== -1) return at + 1;
  sheet.getRange(1, lastCol + 1).setValue(label).setFontWeight('bold');
  return lastCol + 1;
}

function confirmationColumn_(sheet) {
  return stampColumn_(sheet, CONFIRMATION_HEADER);
}

function alreadyConfirmed_(sheet, sentCol, email) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const header = sheet.getRange(1, 1, 1, sentCol).getValues()[0].map(String);
  const emailCol = header.indexOf('Email') + 1;
  const rows = sheet.getRange(2, 1, lastRow - 1, sentCol).getValues();
  const target = email.toLowerCase();
  return rows.some(function (v) {
    return cleanEmail_(v[emailCol - 1]) === target && v[sentCol - 1] !== '' && v[sentCol - 1] !== null;
  });
}

function cleanEmail_(value) {
  return String(value == null ? '' : value).trim().replace(/^'/, '').toLowerCase();
}

function confirmationMessage_(email, data) {
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

  return {
    to: email,
    subject: "You're on the list — NewSociety Live launch party",
    body: lines.join('\n'),
    htmlBody: html,
    name: 'NewSociety Live'
  };
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
