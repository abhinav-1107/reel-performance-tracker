/**
 * AI Reel Performance Tracker
 * Google Apps Script bound to a Google Sheet with two tabs: "Raw Data" and "Insights".
 *
 * Flow:
 *   1. collectSnapshot()  - every 2 days: Apify -> reel stats -> new rows in "Raw Data"
 *   2. writeWeeklyBrief() - every Monday:  recent rows -> Claude API -> brief in "Insights"
 *
 * Keys live in Project Settings -> Script properties (never in this file):
 *   APIFY_TOKEN, ANTHROPIC_API_KEY, IG_USERNAME
 */

const RAW_SHEET = 'Raw Data';
const INSIGHTS_SHEET = 'Insights';
const REELS_TO_FETCH = 20;          // latest reels to track on each run
const BRIEF_LOOKBACK_DAYS = 7;      // how much history the weekly brief looks at
const CLAUDE_MODEL = 'claude-sonnet-5-5';

const RAW_HEADERS = ['Snapshot Date', 'Shortcode', 'URL', 'Caption', 'Posted At',
                     'Views', 'Likes', 'Comments', 'Age (days)'];
const INSIGHT_HEADERS = ['Generated At', 'Snapshots Analysed', 'Brief'];

/* ------------------------------------------------------------------ */
/* Setup: run once by hand. Creates the tabs, headers and the timers.  */
/* ------------------------------------------------------------------ */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, RAW_SHEET, RAW_HEADERS);
  ensureSheet_(ss, INSIGHTS_SHEET, INSIGHT_HEADERS);

  // remove old triggers so we never schedule twice
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('collectSnapshot').timeBased().everyDays(2).atHour(9).create();
  ScriptApp.newTrigger('writeWeeklyBrief').timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
}

/** Custom menu so the tracker can be run by hand from the sheet. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('📊 Reel Tracker')
    .addItem('🔄 Collect reel stats now', 'collectSnapshot')
    .addItem('✨ Write AI brief now', 'writeWeeklyBrief')
    .addSeparator()
    .addItem('⚙️ Setup (tabs + timers)', 'setup')
    .addToUi();
}

/* ------------------------------------------------------------------ */
/* Step 1: collect reel stats from Instagram through Apify             */
/* ------------------------------------------------------------------ */
function collectSnapshot() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('APIFY_TOKEN');
  const username = props.getProperty('IG_USERNAME');
  if (!token || !username) throw new Error('Add APIFY_TOKEN and IG_USERNAME in Script properties.');

  // Runs the Apify Instagram Reel Scraper and waits for its results
  const url = 'https://api.apify.com/v2/acts/apify~instagram-reel-scraper/'
            + 'run-sync-get-dataset-items?token=' + encodeURIComponent(token);
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ username: [username], resultsLimit: REELS_TO_FETCH }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('Apify error ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  }

  const reels = JSON.parse(res.getContentText());
  const today = new Date();
  const rows = reels.map(r => {
    const posted = r.timestamp ? new Date(r.timestamp) : '';
    const ageDays = posted ? Math.floor((today - posted) / 86400000) : '';
    return [
      today,
      r.shortCode || '',
      r.url || ('https://www.instagram.com/p/' + r.shortCode + '/'),
      (r.caption || '').replace(/\s+/g, ' ').slice(0, 120),   // short caption keeps the sheet readable
      posted,
      r.videoPlayCount || r.videoViewCount || 0,
      r.likesCount || 0,
      r.commentsCount || 0,
      ageDays,
    ];
  });

  if (rows.length) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RAW_SHEET);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, RAW_HEADERS.length).setValues(rows);
  }
  console.log('Saved ' + rows.length + ' reel snapshots');
}

/* ------------------------------------------------------------------ */
/* Step 2: ask Claude for a weekly brief based on recent snapshots     */
/* ------------------------------------------------------------------ */
function writeWeeklyBrief() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Add ANTHROPIC_API_KEY in Script properties.');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = ss.getSheetByName(RAW_SHEET).getDataRange().getValues();
  const cutoff = new Date(Date.now() - BRIEF_LOOKBACK_DAYS * 86400000);

  // keep only snapshots from the last week, turned into simple CSV text
  const recent = data.slice(1).filter(r => r[0] instanceof Date && r[0] >= cutoff);
  if (!recent.length) { console.log('No recent snapshots, skipping brief'); return; }
  const csv = [RAW_HEADERS.join(',')].concat(recent.map(r =>
    [fmtDate_(r[0]), r[1], '', '"' + String(r[3]).replace(/"/g, "'") + '"',
     fmtDate_(r[4]), r[5], r[6], r[7], r[8]].join(','))).join('\n');

  const prompt =
    'You are a short-form video strategist. Below are snapshots of Instagram reel stats '
  + 'collected every 2 days for one creator. The same reel appears several times, so you '
  + 'can see how its numbers change.\n\n' + csv + '\n\n'
  + 'Write a short brief with exactly three sections:\n'
  + '1. TOP PERFORMERS: the top 3 reels by views, with views, likes and view-to-like ratio.\n'
  + '2. PATTERN: what the winning reels have in common (theme, hook, caption style) and what the weak ones lack.\n'
  + '3. VELOCITY: which reels are still gaining views between snapshots and which have stopped.\n'
  + 'Use real numbers from the data. Keep it under 250 words.';

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('Claude API error ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  }

  const brief = JSON.parse(res.getContentText()).content
    .filter(b => b.type === 'text').map(b => b.text).join('\n');
  ss.getSheetByName(INSIGHTS_SHEET).appendRow([new Date(), recent.length, brief]);
  console.log('Brief written from ' + recent.length + ' snapshots');
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function fmtDate_(d) {
  return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy') : d;
}
