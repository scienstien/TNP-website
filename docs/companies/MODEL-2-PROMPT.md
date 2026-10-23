# Prompt for Model 2: company charts

You are Model 2, working on a separate laptop in the NIT Tiruchirappalli historical
TNP dashboard repository. Implement your assigned components in separate reviewed
steps. Execute Step 1 now, then stop and wait for my explicit instruction to
continue Step 2. Do not implement the entire assignment in one turn.

Read AGENTS.md, TASKS.md's Companies panel section, and
docs/companies/PARALLEL-PLAN.md before editing. The last document contains the
owner-approved lane boundaries and initial exact prop interfaces. Check the real
files and migration history; stale older module docs/task descriptions are not
proof of current runtime behavior.

Your tasks are COMPANIES-006 (history bars) and then COMPANIES-007 (distribution
donut). Model 1/Codex owns data, authorization, shared controls and integration.
Model 3 owns process/contact tables. Import the types you need with type-only
imports. Export the exact Props/row/option interfaces from your owned component
files as documented; do not create a different shared data model.

## Step 1: inspect, branch and report; stop before implementation

Inspect git status and existing ownership. If clean, fetch origin, fast-forward
local main from origin/main, then create `companies/charts`. Do not discard, stash
or move someone else's dirty work. If dirty, report it and use an isolated
checkout only when its purpose/paths are understood. Record the main base SHA.
If this published plan is absent from origin/main, wait for its publication.

Read the current company schema/types/queries, calendar and drive types, package
scripts and existing Recharts/style examples. Search before duplicating utilities.
Report the base SHA, your two tasks, exact files/exports, the agreed prop shapes,
available validation methods, and any contract mismatch. Write your start/checkpoint
to docs/handoffs/COMPANIES-CHARTS.md. Do not edit TASKS.md; Model 1 records ownership
and status centrally under the explicit exception in PARALLEL-PLAN.md. STOP.

## Step 2: history chart only, after I say continue Step 2

Implement CompanyOfferHistoryChart with Recharts. One integer-count bar per supplied
explicit placement cycle, all the selected company's drives combined. Data already
arrives in order and under authorized department/UG+PG scope. A stored final offer
counts; this is not an issued/revoked-offer ledger. NULL offer dates/drives do not
justify dropping an offer. Do not fetch data or calculate authorization here.

Keep the card width constrained and scroll its chart horizontally for long history.
Add an Expand control opening a larger overlay above other cards, with visible
Close, Escape, focus containment/restoration, background scroll control and retained
compact-chart scroll position. Use the same data in both sizes and check resize.
Handle no selection, loading, error/retry and genuine zero/no-data distinctly.
Do not let twenty years stretch the whole page or invent unrecorded zero years.

Validate with the available lint/type-check tools and meaningful focused checks,
including keyboard/overlay behavior and narrow layout when browser access exists.
Use fictional fixtures. Report browser checks you could not perform. Update your
handoff with exact exports/files/check results. Commit only this component, its
CSS module/coverage and your handoff. STOP for review before implementing the donut.

## Step 3: donut only, after I say continue Step 3

Implement CompanyOfferDistribution with the documented controlled props. The
company and page-selected cycle establish scope. Controls choose department,
gender or reservation category, and All roles or an exact supplied roleId. A job
role is separate from PPO/FTE offer_type. Distinguish same/NULL titles using drive
reference and ID. The process table's exact-drive selector does not control this
donut. Dimension and role callbacks go to Model 1's controller; no hidden fetches.

Use supplied aggregate counts and totalOffers. All roles includes missing-role/
drive offers. NULL demographics appear as Not recorded; do not remove that bucket
or fabricate source values. Percentages describe offer composition under the
current role filter, not selection/conversion rates. A department user may have
one department slice. Display centre total, readable legend/counts and an accessible
alternative to colour. Zero totals must not produce NaN or a full invented wheel.

Validate meaningful cases: all three dimensions, no/specific/duplicate/NULL-title
roles, unknown classifications, empty denominator and changed controlled props.
Update your handoff and make a second focused commit. Push companies/charts and
open/update a draft PR targeting main if tools/access permit. Never merge it.
If GitHub tooling is unavailable, return the branch/SHA and proposed PR body.
STOP; do not implement another task.

## Exclusive edit allowlist

- components/companies/CompanyOfferHistoryChart.tsx
- components/companies/CompanyOfferHistoryChart.module.css
- components/companies/CompanyOfferHistoryChart.test.* (only useful existing tooling)
- components/companies/CompanyOfferDistribution.tsx
- components/companies/CompanyOfferDistribution.module.css
- components/companies/CompanyOfferDistribution.test.* (same restriction)
- docs/handoffs/COMPANIES-CHARTS.md

Do not touch Companies.tsx, any app route/layout, CompanyContactsTable,
CompanyProcessTable, header/directory/controller components, companies.css,
global styles, components/ui, lib/**, db/**, drizzle/**, auth, calendar/drive
implementations, student/dashboard modules, package manifests/lockfiles,
TASKS.md, AGENTS.md or shared documentation. Read-only inspection is fine.
If a shared contract needs a change, record the exact proposal and stop the
dependent part; Model 1 coordinates it. Do not add another backend, fixture route,
dependency, schema, KPI or live recruiting feature.

Stage only owned named files; no git add ., force push or direct main push. Keep
component commits separate. Handoff must include base/current SHAs, tasks, changed
files, public exports, actual commands/results, limitations and integrator needs.
