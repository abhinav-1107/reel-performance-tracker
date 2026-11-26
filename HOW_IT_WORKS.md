# How It Works: step by step

This explains every part of `Code.gs` in simple language.

---

## The idea in one line

A Google Sheet that fills itself with Instagram reel stats every 2 days, and once a week asks AI: *"What's working and what isn't?"*

---

## The pieces

| Piece | What it is | Its job here |
|---|---|---|
| **Google Sheet** | The spreadsheet | Stores the data (Raw Data tab) and the AI reports (Insights tab) |
| **Apps Script** | JavaScript that lives inside the Sheet | Runs everything: calls the APIs and writes to the Sheet |
| **Triggers** | Google's built-in timers | Run the script automatically, with no laptop needed |
| **Apify** | A web-scraping service | Gets public reel stats (views, likes, comments) from Instagram |
| **Claude API** | Anthropic's AI model | Reads the numbers and writes the weekly brief |

---

## Step 0: `setup()`, run once

- Creates the `Raw Data` and `Insights` tabs with bold, frozen headers.
- Deletes old timers so nothing runs twice.
- Creates two timers:
  - `collectSnapshot` every 2 days at 9 AM
  - `writeWeeklyBrief` every Monday at 9 AM

`onOpen()` also adds a **📊 Reel Tracker** menu to the sheet, so both steps can be run by hand during a demo.

---

## Step 1: `collectSnapshot()`, every 2 days

1. Reads the Apify token and Instagram username from **Script properties**. Keys are never written in the code, so the code is safe to share.
2. Calls Apify's **Instagram Reel Scraper** with `UrlFetchApp.fetch()`. Apify returns a JSON list of the latest 20 reels.
3. For each reel it builds one row:
   `Snapshot Date | Shortcode | URL | Caption | Posted At | Views | Likes | Comments | Age (days)`
   - The caption is cut to 120 characters to keep the sheet readable.
   - **Age (days)** = today − posted date, so you can compare a 5-day-old reel with a 500-day-old one fairly.
4. Writes all rows in **one call** (`setValues`) instead of one by one, which is much faster.

**Why snapshots instead of overwriting?** The same reel is saved again every 2 days, so the sheet keeps a history. That history is what lets the AI see **velocity**, meaning which reels are still growing.

---

## Step 2: `writeWeeklyBrief()`, every Monday

1. Reads all rows from `Raw Data` and keeps only the **last 7 days**.
2. Turns them into simple CSV text (comma-separated).
3. Sends a **prompt** to the Claude API that asks for exactly three sections:
   - **Top performers:** top 3 by views, with view-to-like ratio
   - **Pattern:** what winners have in common vs. weak reels
   - **Velocity:** which reels are still gaining views
4. Saves the answer as a new row in `Insights`: `Generated At | Snapshots Analysed | Brief`.

**Why tell the AI the exact format?** So every week's report looks the same and can be compared week to week.

---

## Error handling

- If a key is missing, the script stops with a clear message.
- `muteHttpExceptions: true` lets the script read the API's error message and show it, instead of failing silently.
- If there's no recent data, the brief is skipped instead of asking the AI about nothing.

---

## Results so far (Sep – Nov 2026)

- 437 snapshots collected automatically
- 11 weekly AI briefs
- Finding: reels with direct share hooks or bold themes reached 1–2.5M views; quiet reflective captions stayed under 25K.

---

## Interview Q&A

**Why Google Sheets and not a database?**
The creator's team already uses Sheets, there's nothing to install, and it's free. Anyone can open it and read it.

**Why Apify instead of the Instagram API?**
The official API only gives full stats for accounts you own and needs app review. Apify reads public reel data without that setup.

**What does the AI add that a chart doesn't?**
A chart shows *which* reel won. The AI explains *why* (hook, theme, caption style) and turns it into advice for the next reel.

**What would you improve?**
Add a dashboard tab with charts, send the brief by email or WhatsApp, and track more creators to compare.
