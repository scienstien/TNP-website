# Placement analytics (main dashboard)

The "Dashboard" view (`components/dashboard/`) is computed from placement data in PostgreSQL. No KPI is stored.

## Data flow

1. `app/(portal)/page.tsx` and `app/(portal)/dashboard/page.tsx` call `getPlacementRecords()` from `lib/placements/queries.ts`. That query requires a signed-in user and returns one row per explicit undergraduate student-cycle participation, including the cycle identity, optional cycle dates, registration status, integer roll number, the offer for that same cycle (if any), and the company's sector. Student names are excluded from analytics; they are provided separately only to the ADMIN student editor.
2. `components/dashboard/PlacementAnalytics.tsx` keeps one shared filter state (`useDashboardFilters`). Its primary and comparison cycle selectors use explicit cycle IDs returned by the server; no previous cycle is inferred. Cycle and batch remain independent filters. It derives every KPI and chart dataset through `lib/placements/analytics.ts`.
3. Each chart (`components/dashboard/charts/*`) is an independent component. It receives prepared data and a selection callback, and contains no filtering logic.

## Definitions (`lib/placements/analytics.ts`)

| Term | Meaning |
| --- | --- |
| Population | `REGISTERED` participation records in the selected explicit placement cycle and graduating batch (or all values when cleared). `UNREGISTERED` participation is excluded. |
| Placed | A registered participation has an offer. Registered without an offer is unplaced. |
| Offer filters | Company, sector, offer type and CTC range. They narrow the *matching offers*; the population and the unplaced count never change. |
| Placement % | Placed ÷ registered participation in the same filtered cycle and batch. An empty registered denominator is undefined, not 0%. |
| CTC stats | Matching offers with a recorded `package_lpa` only. Missing packages are excluded and the count is shown. |
| Mode CTC | The most frequent exact package (2 decimals). On a tie, the lowest tied value is shown and flagged. If no package repeats, there is no mode. |
| CTC buckets | 0–5, 5–10, 10–15, 15–20, 20–30, 30–40 and 40+ LPA (`DEFAULT_CTC_BUCKETS`). They are the same for every batch so batches can be compared. |
| vs comparison cycle | Shown only after the user selects two different cycles. Both cycle populations use the same optional batch and offer filters. |

## Sector instead of stream

The schema has no academic stream, so the stream chart uses the offering company's sector (`companies.domain`). Unplaced students have no company, so they belong to no sector. They are reported in that chart's footnote instead of being stacked into a sector.

## Home comparison

Home uses `components/home/PlacedSoFar.tsx` with full-cycle summaries prepared by
`lib/placements/home-cycle.ts`. The user explicitly selects a primary cycle and a
different comparison cycle by their stored IDs/codes; neither selection is
inferred from dates, cycle codes, or graduating batches.

Each summary counts only `REGISTERED` participation. An offer means placed;
registered without an offer means unplaced. The placement wheel shows placed ÷
registered for the primary cycle. The comparison shows the difference in placed
students between the two selected cycles.

Company figures are explicitly labelled "companies with offers" because they are
derived from final offers, not drive events or campus visits. The old batch/date
picker and last-20-batches view are no longer part of the home page.

## Departments

Records come from the institute-wide schema (see `db/README.md`): one row per explicit undergraduate (B.Tech) student-cycle participation, with `batchYear` taken from the cohort's graduation year and `department` the lower-case department code. The record also exposes the placement cycle and `REGISTERED`/`UNREGISTERED` status. An offer is joined only when both its enrollment and cycle match the participation. A department user receives only their own department; a super admin receives the department chosen in the department navbar, or every department. M.Tech cohorts exist in the schema but are not included. Dashboard analytics exclude `UNREGISTERED` participation before deriving placed, unplaced, compensation, company, sector, and offer-type results.

## Local data

`npm run db:seed:departments` loads a **fictional** four-department, twenty-batch (2008–2027) dataset (DEMO companies, roll numbers starting with 9). It refuses to run over real enrollments or non-DEMO companies. Never run it against a production database.
