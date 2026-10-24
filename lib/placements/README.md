# Placement analytics (main dashboard)

The "Dashboard" view (`components/dashboard/`) is computed from placement data in PostgreSQL. No KPI is stored.

## Data flow

1. `app/(portal)/page.tsx` and the UG/PG dashboard routes call `getPlacementRecords()` from `lib/placements/queries.ts`. That query requires a signed-in user and returns one row per explicit student-cycle participation at the requested degree level, including programme ID, nullable specialization, graduation year, cycle identity, optional cycle dates, registration status, and the offer for that same cycle (if any). Student names, roll numbers and any other student identifier are not sent to the browser; names are provided separately only to the ADMIN student editor.
2. `components/dashboard/PlacementAnalytics.tsx` keeps one shared filter state (`useDashboardFilters`). Its primary and comparison cycle selectors use explicit cycle IDs returned by the server; no previous cycle is inferred. PG also filters the population by branch and specialization; there is no graduating-batch filter. It derives every KPI and chart dataset through `lib/placements/analytics.ts`.
2a. `components/dashboard/PlacementBreakdown.tsx` shows placed ÷ registered per department, gender or reservation category. Gender and category are never sent with the records: `breakdown-queries.ts` aggregates on the server (scoped by `resolveDepartment()`), and `breakdown-actions.ts` is the Server Action the card calls. It follows the selected cycle only, not the offer filters. The Department view's "Share of institute placed" divides by the institute-wide placed count, which the server returns as one number to every role (no other department's rows); Gender and Category divide by the placed count of the current selection. Groups are not suppressed when small (open owner decision).
3. Each chart (`components/dashboard/charts/*`) is an independent component. It receives prepared data and a selection callback, and contains no filtering logic.

## Definitions (`lib/placements/analytics.ts`)

| Term | Meaning |
| --- | --- |
| Population | `REGISTERED` participation records in the selected explicit placement cycle (every cycle when cleared). `UNREGISTERED` participation is excluded. |
| Placed | A registered participation has an offer. Registered without an offer is unplaced. |
| Offer filters | Company, role domain, offer type and CTC range. They narrow the *matching offers*; the population and the unplaced count never change. |
| Placement % | Placed ÷ registered participation in the same filtered cycle. An empty registered denominator is undefined, not 0%. |
| CTC stats | Matching offers with a recorded `package_lpa` only. Missing packages are excluded and the count is shown. |
| Mode CTC | The most frequent exact package (2 decimals). On a tie, the lowest tied value is shown and flagged. If no package repeats, there is no mode. |
| CTC buckets | 0–5, 5–10, 10–15, 15–20, 20–30, 30–40 and 40+ LPA (`DEFAULT_CTC_BUCKETS`). They are the same for every cycle so cycles can be compared. |
| vs comparison cycle | Shown only after the user selects two different cycles. Both cycle populations use the same offer filters. |

## Role domain instead of stream

The domain-wise chart and the domain filter use the domain of the offer's role (`drive_roles.domain`, e.g. Software or Production). Offers without a role, or whose role has no domain, appear as "Not recorded". `companies.domain` is only a company description and is not used in analytics. Unplaced students have no offer, so they belong to no domain; they are reported in the chart's footnote.

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

## Degree levels and PG specialization

The home page and UG dashboard use the default `UG` query scope. The PG dashboard passes
`PG` explicitly and supports all postgraduate degrees. Its branch and specialization
selectors include the institute's published PG programmes from `pg-catalog.ts`, including
Energy and Environment, Computer Applications, Physics, Architecture and Planning,
Chemistry, Mathematics, Humanities and Social Sciences, and Management Studies. Recorded
historical names are also retained. Options are limited to the authorized department when
one is selected; a super admin viewing all departments sees the full catalogue. The
specialization list follows the selected branch and includes `Not recorded` when recorded
history contains a NULL value. The selected branch and specialization apply to every KPI,
chart, cycle comparison, time series and server-side demographic breakdown. The catalogue
is for display only: it does not create departments, programmes, cohorts or placement
records, and a programme without records has undefined placement percentage.

## Departments

Records come from the institute-wide schema (see `db/README.md`): one row per explicit student-cycle participation, with programme ID, nullable specialization, graduation year and `department` the lower-case department code. The record also exposes the placement cycle and `REGISTERED`/`UNREGISTERED` status. An offer is joined only when both its enrollment and cycle match the participation. A department user receives only their own department; a super admin receives the department chosen in the department navbar, or every department. Dashboard analytics exclude `UNREGISTERED` participation before deriving placed, unplaced, compensation, company, sector, and offer-type results.

## Local data

`npm run db:seed:departments` loads a **fictional** four-department, twenty-batch (2008–2027) dataset (DEMO companies, roll numbers starting with 9). It refuses to run over real enrollments or non-DEMO companies. Never run it against a production database.

## Students placed over time

The dashboard's bottom section counts final offers by `placement_offers.offer_date` (not by
admission, which has only a year). Pure aggregation in `time-series.ts`, aggregated once per data
change so the Year | Month | Week | Day toggle only picks a series. Registered participation
only; the dashboard's cycle and offer filters do not apply (a trend cut to one cycle says
nothing), but the department scope does. Zero-filled, with ISO weeks (Monday start):

| View | Chart | Window | Extras |
| --- | --- | --- | --- |
| Year | columns, current year highlighted | first dated year to now | data labels |
| Month | two lines: this year solid, last year dashed | Jan–Dec | the current year stops at today |
| Week | weekly line + 4-week average | last 52 ISO weeks | |
| Day | daily line + 7-day average | last 30 days | the average uses the 6 days before the window |

KPIs follow the toggle: placed this period (so far), % change vs the previous period (undefined
when that was 0) and the peak. Offers with no valid date, and offers dated after today, are
reported in a footnote rather than placed on the chart.
