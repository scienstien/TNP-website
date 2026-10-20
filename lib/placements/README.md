# Placement analytics (main dashboard)

The "Dashboard" view (`components/dashboard/`) is computed from placement data in PostgreSQL. No KPI is stored.

## Data flow

1. `app/page.tsx` (server) calls `getPlacementRecords()` from `lib/placements/queries.ts`. That query requires a signed-in user and returns one row per recorded student, with an integer roll number, the offer (if any) and the company's sector. Student names are excluded from analytics; they are provided separately only to the ADMIN student editor.
2. `components/dashboard/PlacementAnalytics.tsx` keeps one shared filter state (`useDashboardFilters`). It derives every KPI and chart dataset through `lib/placements/analytics.ts`.
3. Each chart (`components/dashboard/charts/*`) is an independent component. It receives prepared data and a selection callback, and contains no filtering logic.

## Definitions (`lib/placements/analytics.ts`)

| Term | Meaning |
| --- | --- |
| Population | Recorded students of the selected batch (or all batches), counted by roll number. |
| Placed | The student has an offer. With one offer per student, offers = placed students. |
| Offer filters | Company, sector, offer type and CTC range. They narrow the *matching offers*; the population and the unplaced count never change. |
| Placement % | Placed ÷ recorded students. Labelled "assumes the batch roster is complete" until roster completeness is recorded. |
| CTC stats | Matching offers with a recorded `package_lpa` only. Missing packages are excluded and the count is shown. |
| Mode CTC | The most frequent exact package (2 decimals). On a tie, the lowest tied value is shown and flagged. If no package repeats, there is no mode. |
| CTC buckets | 0–5, 5–10, 10–15, 15–20, 20–30, 30–40 and 40+ LPA (`DEFAULT_CTC_BUCKETS`). They are the same for every batch so batches can be compared. |
| vs previous batch | Shown only when a batch is selected and an earlier batch exists. It uses the same offer filters. |

## Sector instead of stream

The schema has no academic stream, so the stream chart uses the offering company's sector (`companies.domain`). Unplaced students have no company, so they belong to no sector. They are reported in that chart's footnote instead of being stacked into a sector.

## Local data

`npm run db:seed:dashboard` loads a **fictional** five-batch dataset with DEMO company names and fixed nine-digit 9xx student rolls. Never run it against a production database or real records in that roll range.
