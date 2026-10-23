# Companies Model 1 integration — 2026-10-24

Branch: companies/model1-complete, based on local main 80111ed.

## Implemented

- Companies.tsx composes a header and dedicated state/loading controller.
- Directory preserves existing add/edit behavior and supports explicit company selection.
- All cycles shows every master; explicit cycle shows companies with retained drives.
- ADMIN/SUPERADMIN protected reads resolve the department on the server; a missing
  department on a department account is rejected. Aggregate population is REGISTERED
  UG and PG enrollment participation, not distinct people or every issued offer.
- Offer history includes explicit drive cycles with zero authorized offers and scoped
  offer-only cycles. It does not infer cycle identity from dates.
- Demographic donut retains department/gender/reservationCategory and exact-role
  controls. Shared drive reader supplies repeated/untitled/zero-offer roles. Unknown
  demographic values retain a Not recorded slice. Independent count reconciles total.
- Process reads shared PostgreSQL calendar events for the validated exact drive,
  including undated events and dates outside cycle boundaries. Refresh reloads
  metadata and events. Existing month/event-ID calendar callers are preserved.
- Contacts remain global company data; editing uses the existing concurrency check.
- Separate role-package card shows aggregate offer and known counts, SQL median/range
  for annual INR LPA and monthly INR separately; NULL is excluded and zero retained.
- Separate offer-type card has its own role control and explicit Not recorded type.
- Keyed independent loaders clear stale display on scope/company/cycle/role/dimension
  changes, ignore cancelled requests, support retry and reject stale process drive IDs.
- Existing chart numeric tooltip typing and duplicate role labels were corrected.

## Files/contracts

Components: CompanyPageHeader, CompanyDirectory (extracted editor), CompanyPanelController,
use-company-panel, CompanyRolePackages, CompanyOfferTypes, local styles.
Server: panel-scope, panel-read-guards, panel-queries, panel-actions, offer-history,
offer-distribution, offer-summaries; directory-condition/queries and company route.
Calendar reader adds { companyId, cycleId, driveId } while preserving existing filters.
No schema, migrations, dependencies, auth configuration or live recruitment workflow changes.

## Validation and limits

Lint and TypeScript passed. All 52 focused tests passed. Production build passed after allowing Google Font
downloads outside the network sandbox. The focused suite covers real component
markup plus actual query/read functions with scripted connections and auth contexts:
zero-offer roles, missing metadata, selected scope, registration predicates,
independent totals, invalid drive selection and complete drive event predicates.
No private records are test fixtures; no migration, seed or database writes ran.

Scripted connections verify query construction and result handling, not PostgreSQL
aggregate execution or database authorization under real sessions. Rendered markup
tests do not verify browser effects, focus trapping or scroll measurements.
Real PostgreSQL fixtures and two authenticated browser sessions remain required for
full integration acceptance. The initial global HR and future cancellation/schema
work retain their existing boundaries. Nothing has been pushed or merged remotely.
