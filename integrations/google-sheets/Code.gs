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

// The newest archived issue, read from the site's RSS feed (feed.xml, built
// from newsletter.html), so a welcome email can hand new subscribers last
// Sunday's stories straight away. Cached for 6 hours so a burst of signups
// makes one request. Returns null if the feed can't be read, and the welcome
// then goes out without it rather than not at all.
// Uses UrlFetchApp: the first run after pasting this asks you to re-authorize
// the script, and the web app needs a new deployment version.
const FEED_URL = 'https://newsociety.netlify.app/feed.xml';

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function latestIssue_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('latest-issue');
  if (hit) return JSON.parse(hit);
  try {
    const res = UrlFetchApp.fetch(FEED_URL, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    const item = XmlService.parse(res.getContentText()).getRootElement()
      .getChild('channel').getChild('item');
    if (!item) return null;
    const desc = item.getChildText('description') || '';
    const heads = [];
    desc.replace(/<h3>([\s\S]*?)<\/h3>/g, function (_, h) {
      heads.push(h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim());
    });
    const issue = { title: item.getChildText('title'), link: item.getChildText('link'), heads: heads.slice(0, 5) };
    cache.put('latest-issue', JSON.stringify(issue), 6 * 60 * 60);
    return issue;
  } catch (err) {
    console.error('latestIssue_ failed', err);
    return null;
  }
}

function welcomeMessage_(email) {
  const site = 'https://newsociety.netlify.app';
  const latest = latestIssue_();
  const lines = [
    "You're on the list.",
    '',
    'Once a week we send the culture that actually mattered: sports, music, anime, pop culture, fashion and the news cycle, with an actual opinion. No filler, no daily inbox spam.',
    '',
    latest ? 'Start with the latest issue, ' + latest.title + ':' : '',
    latest ? latest.heads.map(function (h) { return '- ' + h; }).join('\n') : '',
    latest ? 'Read it: ' + latest.link : '',
    latest ? '' : '',
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
    (latest ?
      '<div style="border-left:3px solid #6e56ff;background:#131316;padding:16px 18px;margin:6px 0 22px;">' +
      '<p style="font:12px/1.4 Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8470ff;margin:0 0 8px;">Start with the latest issue</p>' +
      '<p style="font-size:17px;line-height:1.35;font-weight:bold;color:#f4f3ef;margin:0 0 10px;">' + esc_(latest.title) + '</p>' +
      '<ul style="margin:0 0 12px;padding-left:18px;color:#c9c9cf;font-size:14.5px;line-height:1.55;">' +
      latest.heads.map(function (h) { return '<li style="margin:0 0 4px;">' + esc_(h) + '</li>'; }).join('') + '</ul>' +
      '<a href="' + latest.link + '" style="color:#8470ff;font:13px Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;">Read the issue →</a>' +
      '</div>' : '') +
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

// ---- Weekly newsletter ----
// Edit NEWSLETTER_ISSUE, run previewNewsletter() to send yourself a copy and
// see how many subscribers would get it, then run sendNewsletter(). Each
// issue stamps its own column on the Newsletter tab ("Issue 01 sent"), so a
// second run only reaches people who joined since, and nobody is sent the
// same issue twice.
const NEWSLETTER_ISSUE = {
  number: 9,
  dateline: 'Sunday, November 29, 2026',
  subject: 'The Week in Culture — Haymitch’s $120 million weekend, Ella Langley’s six CMAs, and the Bears steal Thanksgiving',
  intro: 'We missed a couple of Sundays, so this one catches you up: the biggest weekend of the year at the movies, the biggest night of the year in country, and a Thanksgiving comeback in Detroit.',
  blocks: [
    {
      tag: 'Pop culture', page: 'pop-culture.html', color: '#e3a34b',
      head: 'Haymitch’s Games opened to $120 million.',
      body: 'The Hunger Games: Sunrise on the Reaping, with Joseph Zada as a teenage Haymitch Abernathy, made about $120 million in the U.S. and Canada and $225 million worldwide in its first weekend, after $21 million in Thursday previews alone. It was still leading on Thanksgiving eve, ahead of two newcomers: Disney’s original Hexed, which opened to $7.6 million and an A- CinemaScore, and Universal’s Focker In-Law at $5.3 million.'
    },
    {
      tag: 'Music', page: 'music.html', color: '#5aa0e8',
      head: 'Ella Langley won six CMAs, and Christmas still can’t knock her off No. 1.',
      body: 'At the CMA Awards, Langley won her first Entertainer of the Year and left with six awards: Entertainer, Female Vocalist, Album of the Year for “Dandelion”, and Single, Song and Music Video for “Choosin’ Texas”. A week later the Christmas songs arrived on the Hot 100, Wham!’s “Last Christmas” straight into the top five, and “Choosin’ Texas” held No. 1 anyway, for a 29th week. Mariah Carey, whose record it broke, usually climbs all December. The rematch is coming.'
    },
    {
      tag: 'Sports', page: 'sports.html', color: '#4fb3a9',
      head: 'The Bears stole Thanksgiving in Detroit.',
      body: 'Down 11 in the fourth quarter at Ford Field, Chicago came back to win 39-35. Caleb Williams hit Rome Odunze for a long touchdown to get close, then drove 13 plays in the final 2:14 and found Odunze again from six yards out with three seconds left. Jahmyr Gibbs ran for three touchdowns and still lost. The Bears are 9-2 and alone in first in the NFC North, and they took it from the team that was chasing them.'
    },
    {
      tag: 'Anime', page: 'anime.html', color: '#e0679a',
      head: 'Witch on the Holy Night made it to the big screen, and a sequel is already coming.',
      body: 'The film of TYPE-MOON’s visual novel, animated by ufotable, the studio behind Demon Slayer’s anime, opened in Japan on November 20. Days later a post-credits scene confirmed a second film, and the official account says it is in production, with no date yet. TYPE-MOON also made Fate, so this is a fan-favourite studio adapting a fan-favourite story. The U.S. and Canada get the first film on January 29.'
    },
    {
      tag: 'Fashion', page: 'fashion.html', color: '#b58cff',
      head: 'The Fashion Awards are Monday in London.',
      body: 'The British Fashion Council’s Fashion Awards take over the Royal Albert Hall on Monday, November 30, with Ncuti Gatwa hosting. The night doubles as the big fundraiser for the BFC Foundation. It closes an autumn of designer moves, including Martine Rose becoming the first woman to lead Balenciaga, so expect the speeches to be about what comes next. The winners land after this does.'
    }
  ],
  live: 'Launch party incoming. The date and venue are almost locked, and this list hears first.',
  liveRsvp: 'You’re on the launch party list. The date and venue are almost locked, and you’ll hear first.',
  closer: 'What do you want more of? Hit reply. We read every one.'
};

function newsletterHeader_() {
  const n = String(NEWSLETTER_ISSUE.number);
  return 'Issue ' + (n.length < 2 ? '0' + n : n) + ' sent';
}

function previewNewsletter() {
  requireIssue_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORMS['newsletter'].tab);
  const wouldSend = sheet ? newsletterRecipients_(sheet, newsletterHeader_()).length : 0;
  const wouldSendRsvps = rsvpNewsletterRecipients_().length;
  const me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(newsletterMessage_(me));
  MailApp.sendEmail(newsletterMessage_(me, 'rsvp'));
  console.log('Preview sent to ' + me + ' (a subscriber copy and an RSVP-guest copy). sendNewsletter() would email ' +
    wouldSend + ' subscriber(s); sendNewsletterToRsvps() would email ' + wouldSendRsvps + ' RSVP guest(s).');
  return { preview: me, wouldSend: wouldSend, wouldSendRsvps: wouldSendRsvps };
}

function sendNewsletter() {
  requireIssue_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORMS['newsletter'].tab);
  if (!sheet || sheet.getLastRow() < 2) { console.log('No subscribers yet.'); return { sent: 0, skipped: 0 }; }
  const header = newsletterHeader_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sentCol = stampColumn_(sheet, header);
    const report = { sent: 0, skipped: 0 };
    newsletterRecipients_(sheet, header).forEach(function (sub) {
      if (MailApp.getRemainingDailyQuota() <= CONFIRMATION_QUOTA_FLOOR) { report.skipped++; return; }
      MailApp.sendEmail(newsletterMessage_(sub.email));
      sheet.getRange(sub.row, sentCol).setValue(new Date());
      report.sent++;
    });
    console.log(header + ': ' + report.sent + ' sent' +
      (report.skipped ? ', ' + report.skipped + ' held back by the daily email limit (run again tomorrow)' : ''));
    return report;
  } finally {
    lock.releaseLock();
  }
}

// Same issue, for launch-party RSVPs who aren't already on the Newsletter tab
// (those people get it through sendNewsletter). RSVP guests only agreed to hear
// about the party, so they get their own footer saying why they're receiving it.
// Stamped in the same "Issue 01 sent" column on the RSVPs tab, so it can't go
// to anyone twice.
function sendNewsletterToRsvps() {
  requireIssue_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORMS['launch-rsvp'].tab);
  if (!sheet || sheet.getLastRow() < 2) { console.log('No RSVPs yet.'); return { sent: 0, skipped: 0 }; }
  const header = newsletterHeader_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sentCol = stampColumn_(sheet, header);
    const report = { sent: 0, skipped: 0 };
    rsvpNewsletterRecipients_().forEach(function (guest) {
      if (MailApp.getRemainingDailyQuota() <= CONFIRMATION_QUOTA_FLOOR) { report.skipped++; return; }
      MailApp.sendEmail(newsletterMessage_(guest.data.email, 'rsvp'));
      sheet.getRange(guest.row, sentCol).setValue(new Date());
      report.sent++;
    });
    console.log(header + ' (RSVP guests): ' + report.sent + ' sent' +
      (report.skipped ? ', ' + report.skipped + ' held back by the daily email limit (run again tomorrow)' : ''));
    return report;
  } finally {
    lock.releaseLock();
  }
}

// RSVP guests with no "Issue NN sent" stamp, minus anyone on the Newsletter tab.
function rsvpNewsletterRecipients_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rsvps = ss.getSheetByName(FORMS['launch-rsvp'].tab);
  if (!rsvps) return [];
  const subs = ss.getSheetByName(FORMS['newsletter'].tab);
  const onList = {};
  if (subs && subs.getLastRow() > 1) {
    const head = subs.getRange(1, 1, 1, Math.max(subs.getLastColumn(), 1)).getValues()[0].map(String);
    const emailAt = head.indexOf('Email');
    if (emailAt >= 0) {
      subs.getRange(2, emailAt + 1, subs.getLastRow() - 1, 1).getValues().forEach(function (v) {
        onList[cleanEmail_(v[0])] = true;
      });
    }
  }
  return pendingGuests_(rsvps, newsletterHeader_()).filter(function (guest) {
    return !onList[cleanEmail_(guest.data.email)];
  });
}

function requireIssue_() {
  const i = NEWSLETTER_ISSUE;
  if (!i.number || !String(i.subject || '').trim() || !(i.blocks || []).length) {
    throw new Error('Fill in NEWSLETTER_ISSUE first (number, subject, and at least one block).');
  }
}

// One row per valid address that has no stamp for this issue, newest row per
// address (someone can sign up twice; they still only get one copy).
function newsletterRecipients_(sheet, header) {
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  if (lastRow < 2) return [];
  const head = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const emailAt = head.indexOf('Email');
  const stampAt = head.indexOf(header);
  if (emailAt < 0) return [];
  const latest = {}, done = {};
  sheet.getRange(2, 1, lastRow - 1, lastCol).getValues().forEach(function (v, i) {
    const key = cleanEmail_(v[emailAt]);
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(key)) return;
    if (stampAt >= 0 && v[stampAt] !== '' && v[stampAt] !== null) done[key] = true;
    latest[key] = { row: i + 2, email: String(v[emailAt]).replace(/^'/, '').trim() };
  });
  return Object.keys(latest)
    .filter(function (key) { return !done[key]; })
    .map(function (key) { return latest[key]; });
}

function newsletterMessage_(email, audience) {
  const issue = NEWSLETTER_ISSUE;
  const site = 'https://newsociety.netlify.app';
  const num = String(issue.number).length < 2 ? '0' + issue.number : String(issue.number);
  const rsvp = audience === 'rsvp';
  const liveText = rsvp && issue.liveRsvp ? issue.liveRsvp : issue.live;
  const liveButton = rsvp ? 'Launch party details →' : 'Get on the list →';
  const why = rsvp ? "You’re getting this because you RSVP’d to the NewSociety launch party."
                   : 'You signed up at newsociety.netlify.app.';
  // Each block's "page" is the pillar page that carries its story.
  const linkFor = function (b) { return b.page ? site + '/' + b.page : site; };

  const lines = ['NewSociety · The Week in Culture', 'Issue ' + num + ' · ' + issue.dateline, '', issue.intro, ''];
  issue.blocks.forEach(function (b) {
    lines.push(b.tag.toUpperCase(), b.head, b.body, 'Read it: ' + linkFor(b), '');
  });
  lines.push('NewSociety Live', liveText, site + '/live.html', '', issue.closer, '',
    'Instagram ' + SOCIALS[0][2], 'TikTok ' + SOCIALS[1][2], 'X ' + SOCIALS[2][2], '',
    why + ' Reply to this email to be taken off the list.');

  const esc = function (v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  // Black canvas, white text. Coloured accents stay on the pillar labels,
  // "Read more" links and buttons only.
  const BG = '#000000', TEXT = '#ffffff', LINE = '#2a2a2e';
  const blockHtml = function (b) {
    const href = linkFor(b);
    return '<tr><td style="padding:0 0 28px;background:' + BG + ';">' +
      '<p style="margin:0 0 8px;font:12px/1.4 Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:' + b.color + ';">' +
      '<a href="' + href + '" style="color:' + b.color + ';text-decoration:none;">' + esc(b.tag) + '</a></p>' +
      '<h2 style="margin:0 0 8px;font-size:21px;line-height:1.25;color:' + TEXT + ';font-weight:bold;">' +
      '<a href="' + href + '" style="color:' + TEXT + ';text-decoration:none;">' + esc(b.head) + '</a></h2>' +
      '<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:' + TEXT + ';">' + esc(b.body) + '</p>' +
      '<p style="margin:0;font:12px/1.4 Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;">' +
      '<a href="' + href + '" style="color:' + b.color + ';text-decoration:underline;">Read more →</a></p></td></tr>';
  };
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>' +
    '<body bgcolor="' + BG + '" style="margin:0;padding:0;background:' + BG + ';color:' + TEXT + ';">' +
    '<table role="presentation" width="100%" bgcolor="' + BG + '" style="border-collapse:collapse;background:' + BG + ';"><tr><td align="center" bgcolor="' + BG + '" style="background:' + BG + ';">' +
    '<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:34px 26px 30px;text-align:left;background:' + BG + ';color:' + TEXT + ';">' +
    '<table role="presentation" width="100%" bgcolor="' + BG + '" style="border-collapse:collapse;background:' + BG + ';">' +
    '<tr><td style="padding:0 0 6px;"><p style="margin:0;font:12px/1.4 Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:' + TEXT + ';">NewSociety · The Week in Culture</p></td></tr>' +
    '<tr><td style="padding:0 0 20px;border-bottom:1px solid ' + LINE + ';"><p style="margin:0;font:11px/1.4 Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:' + TEXT + ';">Issue ' + num + ' · ' + esc(issue.dateline) + '</p></td></tr>' +
    '<tr><td style="padding:22px 0 24px;"><p style="margin:0;font-size:16px;line-height:1.6;color:' + TEXT + ';">' + esc(issue.intro) + '</p></td></tr>' +
    issue.blocks.map(blockHtml).join('') +
    '<tr><td style="padding:4px 0 24px;border-top:1px solid ' + LINE + ';">' +
    '<p style="margin:18px 0 12px;font:12px/1.4 Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#8470ff;">NewSociety Live</p>' +
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:' + TEXT + ';">' + esc(liveText) + '</p>' +
    '<a href="' + site + '/live.html" style="display:inline-block;background:#6e56ff;color:#ffffff;text-decoration:none;font:13px Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;padding:13px 22px;">' + esc(liveButton) + '</a></td></tr>' +
    '<tr><td style="padding:0 0 26px;"><p style="margin:0;font-size:15px;line-height:1.6;color:' + TEXT + ';">' + esc(issue.closer) + '</p></td></tr>' +
    '<tr><td style="padding:18px 0 0;border-top:1px solid ' + LINE + ';">' +
    '<p style="margin:0 0 10px;font:12px/1.6 Menlo,monospace;color:' + TEXT + ';">' +
    '<a href="' + SOCIALS[0][2] + '" style="color:' + TEXT + ';text-decoration:underline;">Instagram</a> · ' +
    '<a href="' + SOCIALS[1][2] + '" style="color:' + TEXT + ';text-decoration:underline;">TikTok</a> · ' +
    '<a href="' + SOCIALS[2][2] + '" style="color:' + TEXT + ';text-decoration:underline;">X</a> · ' +
    '<a href="' + site + '" style="color:' + TEXT + ';text-decoration:underline;">newsociety.netlify.app</a></p>' +
    '<p style="margin:0;font-size:12px;line-height:1.5;color:' + TEXT + ';">' + esc(why) + ' Reply to this email to be taken off the list.</p>' +
    '</td></tr></table></div></td></tr></table></body></html>';

  return {
    to: email,
    subject: issue.subject,
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
