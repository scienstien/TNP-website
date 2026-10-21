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

## Home comparison

Home uses `components/home/PlacedSoFar.tsx`, adapted from the supplied handoff, with the existing authenticated placement records and server-computed institute date. The ignored handoff folder is not a runtime dependency.

`lib/placements/year-to-date.ts` compares offers dated from the most recent 1 July through the selected date (inclusive) with the same period one year earlier, across all graduating batches. January–June dates start on 1 July of the preceding calendar year; cross-year labels show both years. Unplaced students are excluded; offers without dates are excluded and reported separately. February 29 compares with February 28 in the previous year. An earlier July–June period without any dated offers is shown as missing, not zero; a zero baseline never produces a percentage change. This is a dated-offer comparison, not a batch placement rate, and does not introduce a stored placement-cycle field.

Admins (and only admins) get a Batch selector listing every batch that has recorded students; the cutoff date moves into that batch's July–June season, and a second selector picks which batch to compare against (default: the batch before it), cut off at the same day and month of its own season. Professors always see today's batch against the one before.

The admin-only "Last 20 batches" pop-up (`batchTrend`) applies the same day and month cutoff to the 20 batches ending at the selected one and shows students placed and companies that came for each; a batch without dated offers shows "—", not 0.

Each side also reports "companies came": the distinct companies (names are listed in one comparison pop-up: green when they came only to the current batch, red when only to the previous one) with a dated offer to that batch through the cutoff. A company that visited but made no offer, or whose offers have no date, is not counted, because a company has only one `visit_date` and it is not tied to a batch.

## Departments

Records come from the institute-wide schema (see `db/README.md`): one row per undergraduate (B.Tech) enrollment, with `batchYear` taken from the cohort's graduation year and `department` the lower-case department code. A department user receives only their own department; a super admin receives the department chosen in the department navbar, or every department. M.Tech cohorts exist in the schema but are not included. The placement percentage still divides by all recorded students; `AGENTS.md` describes the registered-student denominator the new schema allows, which is not applied yet.

## Local data

`npm run db:seed:departments` loads a **fictional** four-department, twenty-batch (2008–2027) dataset (DEMO companies, roll numbers starting with 9). It refuses to run over real enrollments or non-DEMO companies. Never run it against a production database.
