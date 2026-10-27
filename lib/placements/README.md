# Placement analytics (main dashboard)

The "Dashboard" view (`components/dashboard/`) is computed from placement data in PostgreSQL. No KPI is stored.

## Data flow

1. `app/(portal)/page.tsx` and the UG/PG dashboard routes call `getPlacementRecords()` from `lib/placements/queries.ts`. That query requires a signed-in user and returns one row per explicit student-cycle participation at the requested degree level, including programme ID, nullable specialization, graduation year, cycle identity, optional cycle dates, registration status, and the offer for that same cycle (if any). Student names, roll numbers and any other student identifier are not sent to the browser; names are provided separately only to the ADMIN student editor.
2. `components/dashboard/PlacementAnalytics.tsx` keeps the cycle, offer and PG specialization filters in `useDashboardFilters`. Its primary and comparison cycle selectors use explicit cycle IDs returned by the server; no previous cycle is inferred. The top department navbar is the single branch selector, and its cookie changes the authorized server query scope. There is no graduating-batch filter. Client KPIs and charts derive from `lib/placements/analytics.ts`.
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

## Home highlights

Home shows a greeting, UG placement highlights, a team carousel with placeholder
years, and a cycle comparison. The carousel advances automatically and centers
the active year; it pauses on interaction and for reduced-motion settings.

Highlights and comparison use `lib/placements/home-cycle.ts`. Each summary counts only
`REGISTERED` participation; an offer means placed. The participation total
across cycles may count an enrollment more than once. Companies with offers are
distinct company names on final offers, not campus visits. Team names and
photographs remain placeholders until verified content is supplied.

The user selects a primary cycle and a different comparison cycle by stored ID.
The half donut shows placed ÷ registered for the primary cycle, or an undefined
state when no registered students exist. Company differences show names unique
to each selected cycle and shared by both; the detail dialog lists those names.

## Degree levels and PG specialization

The home page and UG dashboard use the default `UG` query scope. The PG dashboard passes
`PG` explicitly and supports all postgraduate degrees. The existing top department selector
includes the nine B.Tech departments and the PG-only departments added by migration 0007:
Energy and Environment, Computer Applications, Physics, Architecture and Planning,
Chemistry, Mathematics, Humanities and Social Sciences, and Management Studies. The
in-page PG programme/specialization selector uses the published names in `pg-catalog.ts`
plus recorded historical names. It follows the authorized department selected at the top
and includes `Not recorded` when recorded history contains a NULL value. The top selection
scopes the server query; specialization applies to every KPI, chart, cycle comparison,
time series and server-side demographic breakdown. The catalogue itself is display-only:
it does not create programmes, cohorts or placement records, and a programme without
records has undefined placement percentage.

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
