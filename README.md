# AI Reel Performance Tracker

Automatically tracks how Instagram reels perform and writes a weekly AI report on what is working, all inside Google Sheets.

Built for **Agyaat Aadarsh**, a Hindi poetry and short-film creator (80K+ followers). It has been running on its own since **4 September 2026**.

---

## What it does

| Step | What happens | When |
|---|---|---|
| 1. Collect | Apify fetches every reel's views, likes and comments from Instagram | Every 2 days |
| 2. Store | Apps Script adds one row per reel to the **Raw Data** tab, with the date | Every 2 days |
| 3. Analyse | Apps Script sends recent rows to the Claude API | Every Monday, 9:17 AM |
| 4. Report | Claude writes a brief (top reels, patterns, which reels are still growing) into the **Insights** tab | Every Monday |

```
Instagram ──► Apify scraper ──► Google Apps Script ──► Google Sheet (Raw Data)
                                         │
                                         ▼
                                    Claude API ──► Google Sheet (Insights: weekly AI brief)
```

No server, no hosting cost. Everything runs on Google's free time-based triggers.

---

## Results (Sep – Nov 2026)

- **437 snapshots** logged automatically over 12 weeks, with no manual entry
- **11 weekly AI reports** generated
- **Main finding:** reels with a direct share hook ("Send this to your APSARA") or a bold theme ("मैं दिनकर बनने वाला हूँ") reached **1–2.5M views**. Quiet, reflective captions stayed **under 25K**. This was used to plan the next reels.

---

## The sheet

**Raw Data tab:** one row per reel per snapshot

| Snapshot Date | Shortcode | URL | Caption | Posted At | Views | Likes | Comments | Age (days) |
|---|---|---|---|---|---|---|---|---|

**Insights tab:** one row per weekly report

| Generated At | Snapshots Analysed | Brief |
|---|---|---|

Each brief has three parts:
1. **Top performers:** top 3 reels by views, with like rate
2. **Pattern:** what the winning reels have in common
3. **Velocity:** which reels are still gaining views and which have stopped

Screenshots are in [`screenshots/`](screenshots/).

---

## Tech used

- **Google Apps Script** (JavaScript): runs the whole workflow, scheduled with time-based triggers
- **Apify** (Instagram Reel Scraper): fetches public reel stats
- **Claude API (Anthropic)**: writes the weekly brief
- **Google Sheets**: storage and output

---

## Run it yourself

1. Create a new Google Sheet with two tabs: `Raw Data` and `Insights`.
2. Open **Extensions → Apps Script** and paste the code from [`Code.gs`](Code.gs).
3. Go to **Project Settings → Script properties** and add:
   - `APIFY_TOKEN`: your Apify API token
   - `ANTHROPIC_API_KEY`: your Anthropic API key
   - `IG_USERNAME`: the Instagram account to track
4. Run the setup function once and allow the permissions Google asks for. This creates the triggers.
5. Done. Data comes in every 2 days, and a report appears every Monday.

API keys are kept in Script Properties, never in the code.

---

See [HOW_IT_WORKS.md](HOW_IT_WORKS.md) for a step-by-step explanation of the code.
