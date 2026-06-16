# Flaky Test Dashboard

React + TypeScript dashboard for Azure DevOps **test flakiness analytics**. It pulls a
day's test results from the Azure DevOps Analytics OData feed for up to **4 apps/pipelines**,
stores each day as a local JSON snapshot, shows the **20 most flaky tests** in a table plus
animated **Highcharts** graphs, and lets you **compare two days (before/after)** to see how
pass rate, flaky rate and individual tests improved.

> Runs in **MOCK MODE** out of the box (no PAT needed) so you can explore the whole UI
> immediately. Add a PAT to switch to live Azure DevOps data.

## Why there's a tiny backend

A browser can't safely store an Azure PAT, can't write JSON files to disk, and Azure's
Analytics endpoint refuses direct browser calls (CORS). So a small Node/TypeScript server
holds the PAT, calls Azure, and saves snapshots to `data/{app}/{date}.json`. The React app
only talks to that server.

```
server/   Express API — calls Azure DevOps OData, stores + compares snapshots
web/      React + TS + Highcharts UI (tabs, table, charts, compare view)
data/     created at runtime — one JSON file per app per day
```

## Quick start

```bash
npm install
cp .env.example .env      # optional: leave AZDO_PAT blank to stay in mock mode
npm run dev               # starts API (:3001) and the UI (:5173)
```

Open http://localhost:5173. Pick an app tab, choose a date, click **Fetch & store**.
Fetch a second day, switch to **Compare**, pick before/after, and **Compare**.

## Going live against Azure DevOps

1. Create a PAT with the **Analytics → Read** scope.
2. In `.env` set:

```
AZDO_PAT=xxxxxxxxxxxxxxxxxxxx
AZDO_ORG=your-org
AZDO_PROJECT=your-project
AZDO_WORKFLOW=Build          # or Release

APP_1=app-a|Checkout Service|Checkout-CI
APP_2=app-b|Payments API|Payments-CI
APP_3=app-c|Web Frontend|Frontend-CI
APP_4=app-d|Notifications|Notifications-CI
```

Each `APP_n` is `key|Display Name|PipelineName`. You can override org/project per app with
`key|Name|Pipeline|org|project`. Restart `npm run dev`. With a PAT present the MOCK pill
disappears and fetches hit Azure.

## The Azure query

For each app it calls the `TestResultsDaily` entity (the daily pre-aggregated rollup) for a
single day, grouped per test:

```
GET https://analytics.dev.azure.com/{org}/{project}/_odata/v4.0-preview/TestResultsDaily
  ?$apply=filter(Pipeline/PipelineName eq '{pipeline}' and DateSK eq {yyyymmdd} and Workflow eq 'Build')
   /groupby((TestSK, Test/TestName),
     aggregate(
       ResultCount with sum as TotalCount,
       ResultPassCount with sum as PassedCount,
       ResultFailCount with sum as FailedCount,
       ResultNotExecutedCount with sum as NotExecutedCount,
       ResultNotImpactedCount with sum as NotImpactedCount,
       ResultFlakyCount with sum as FlakyCount))
```

Auth is HTTP Basic with an empty username and the PAT as the password.

Derived metrics (matching Microsoft's sample reports):

- **Pass rate** = (Passed + NotImpacted) / (Total − NotExecuted) × 100
- **Flaky rate** = Flaky / Total × 100

## What you get

**Day view** — summary cards (pass rate, flaky rate, flaky tests, totals), an animated outcome
donut, an animated top-20 flaky bar chart, and the 20-most-flaky table.

**Compare view** — delta cards (pass-rate change in points, flaky-rate change, fixed / improved /
regressed counts), a before-vs-after column chart, a "biggest movers" chart, and a per-test
table showing each test's status (`fixed`, `improved`, `regressed`, `new`, `removed`).

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/apps` | configured apps + stored snapshot dates |
| POST | `/api/fetch/:app` `{ "date": "YYYY-MM-DD" }` | fetch from Azure (or mock) and store |
| GET | `/api/snapshots/:app` | list stored dates |
| GET | `/api/snapshots/:app/:date` | one stored snapshot |
| GET | `/api/compare/:app?before=DATE&after=DATE` | comparison of two snapshots |

## Notes

- The Analytics feed needs Analytics enabled on the project; OData is `v4.0-preview`.
- Flaky detection must be turned on in your pipeline for `ResultFlakyCount` to be populated.
- Snapshots are plain JSON in `data/` — commit them, diff them, or back them up as you like.
