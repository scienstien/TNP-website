# Shared implementation queue

This file is the repository-level task board for work that must be coordinated
across agents and computers. Read `AGENTS.md` first; it remains the source of
project scope, architecture, data rules, security requirements, and engineering
standards. This file records only explicitly requested implementation work and
its execution order.

## Task-entry policy

- Add a task only when the project owner explicitly requests that specific task.
- Do not infer, invent, expand, or pre-populate work from code review findings,
  comments, warnings, or the remaining-work sections of other documents.
- Agents may update the owner, status, validation, and handoff notes of an
  existing task while working on it.
- If an existing task needs materially broader scope, record the proposed change
  in its notes and wait for the project owner's decision.
- Keep task IDs stable after they have been assigned.

## Execution order

Work is selected in this order unless the project owner explicitly overrides it:

1. **P0 — Blocking:** Prevents the application, another approved task, shared
   integration, or required validation from proceeding.
2. **P1 — Important, non-blocking:** Required product or engineering work that
   should follow ready P0 work but does not stop unrelated work.
3. **P2 — Optimization:** Performance, maintainability, cleanup, or polish that
   can safely wait until the required behavior is working and validated.

Within one priority, complete dependency-ready tasks before tasks whose
dependencies are unresolved. Do not begin a task already owned by another agent
without coordinating ownership first.

## Status values

| Status | Meaning |
| --- | --- |
| `READY` | Scope and dependencies are clear; implementation may begin. |
| `IN_PROGRESS` | An identified owner is actively implementing it. |
| `BLOCKED` | Work cannot continue until the recorded blocker is resolved. |
| `VALIDATION` | Implementation is complete and required checks are running or awaiting review. |
| `DONE` | Acceptance criteria and validation are complete, with handoff recorded. |
| `PAUSED` | The project owner explicitly paused the task. |

Priority and status are different: a P0 task can be `READY`, while a P1 task can
have a `BLOCKED` status.

## P0 — Blocking

See MIG-001, MIG-002 and MIG-003 in the migration audit below. These block safe
use of the affected writes with full institute data, not application startup.

## P1 — Important, non-blocking

### [PLACEMENTS-001] Expand placement analytics data contract

- Status: DONE
- Owner: Codex
- Requested by: Project owner
- Dependencies: Migration 0005 target schema
- Blocks: Cycle-aware dashboard filtering and registered-student analytics
- Scope/files: `lib/placements/types.ts`, `lib/placements/queries.ts`, and relevant documentation

#### Context

The target schema records explicit placement-cycle participation in
`student_cycles`, but the dashboard contract still represents one row per
enrollment and omits cycle and registration fields.

#### Required outcome

Return one placement analytics record per undergraduate student-cycle, including
the explicit cycle identity, optional cycle dates, and registration status. Join
an offer only to the student-cycle to which that offer belongs.

#### In scope

- Expand the shared `PlacementRecord` contract.
- Rebase `getPlacementRecords()` on explicit student-cycle participation.
- Preserve department authorization and the existing offer payload.
- Update placement-module documentation for the changed contract.

#### Out of scope

- Changing KPI denominators or labels.
- Adding a placement-cycle dashboard filter.
- Changing chart components or home-page calculations.
- Migrating legacy data or changing the database schema.

#### Acceptance criteria

- Every returned record identifies one explicit student-cycle participation.
- Registration status and cycle metadata are present in every record.
- An offer is returned only when both its enrollment and cycle match the record.
- Existing department and undergraduate scoping remains enforced.
- Lint and TypeScript validation pass.

#### Validation

- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

#### Handoff notes

- Files changed: `lib/placements/types.ts`, `lib/placements/queries.ts`,
  `lib/placements/README.md`, `AGENTS.md`, `TASKS.md`.
- Contracts changed: `PlacementRecord` is now one explicit undergraduate
  student-cycle participation and includes `cycleId`, `cycleCode`, optional cycle
  dates, and `registrationStatus`. Its offer belongs to that same enrollment and
  cycle.
- Validation results: lint passed; TypeScript passed; production build passed.
- Known limitations: existing analytics and home components do not yet filter by
  cycle or exclude `UNREGISTERED` participation from their denominator.
- Follow-up required: implement the separately approved cycle filtering and
  registered-student analytics work when requested.

### [PLACEMENTS-002] Add placement-cycle dashboard filter

- Status: DONE
- Owner: Codex
- Requested by: Project owner
- Dependencies: PLACEMENTS-001
- Blocks: None
- Scope/files: Dashboard analytics filter state, filter UI, tests, and documentation

#### Context

Placement records now identify their explicit placement cycle, but the dashboard
cannot yet scope KPIs and charts to a selected cycle.

#### Required outcome

Add a placement-cycle selector to the shared dashboard filters and apply it to
the client-side analytics population. Keep batch comparison within the selected
cycle.

#### In scope

- Add cycle identity to dashboard filter state.
- Build filter options from the returned placement records.
- Add a cycle dropdown and active-filter chip.
- Scope KPIs and charts by the selected cycle.
- Add focused analytics tests and update documentation.

#### Out of scope

- Server-side cycle filtering.
- Registered-student KPI denominator changes.
- Database schema or migration changes.

#### Acceptance criteria

- Selecting a cycle limits all KPIs and chart inputs to that cycle.
- Clearing the cycle restores the all-cycle view.
- Comparison behavior remains within the selected cycle context (later replaced
  by explicit two-cycle comparison in PLACEMENTS-006).
- Existing batch and offer filters continue to work.
- Relevant validation passes.

#### Validation

- `node -e "process.geteuid=()=>0; require('tsx/cjs/api').register(); require('./lib/placements/analytics.test.ts')"`
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

#### Handoff notes

- Files changed: `lib/placements/analytics.ts`,
  `lib/placements/analytics.test.ts`,
  `components/dashboard/PlacementAnalytics.tsx`,
  `components/dashboard/DashboardFilters.tsx`, `lib/placements/README.md`,
  `AGENTS.md`, and `TASKS.md`.
- Contracts changed: `DashboardFilterState` gained nullable `cycleId`;
  dashboard filter options gained explicit cycle ID/code pairs.
- Validation results: 4 focused tests passed; lint passed; TypeScript passed;
  production build passed.
- Known limitations: the normal `tsx` CLI fails before test execution under the local
  Node 24 Windows environment (`uv_os_get_passwd` ENOMEM), so validation used the
  same tsx loader after supplying the missing Windows process identity hook.
- Follow-up required: PLACEMENTS-003 records the requested server-side cycle
  filtering optimization. PLACEMENTS-004 completed registered-student analytics.

### [PLACEMENTS-004] Use registered participation for dashboard analytics

- Status: DONE
- Owner: Codex
- Requested by: Project owner
- Dependencies: PLACEMENTS-001, PLACEMENTS-002
- Blocks: None
- Scope/files: Dashboard analytics population, KPI labels, tests, and documentation

#### Context

The dashboard can scope participation by explicit cycle and graduating batch, but
its KPI population still includes `UNREGISTERED` participation.

#### Required outcome

Calculate dashboard placement statistics from `REGISTERED` participation only.
Derive placed and unplaced status from offer presence within that registered
population, with an undefined percentage when no registered records exist.

#### In scope

- Exclude `UNREGISTERED` records from the shared dashboard analytics population.
- Update KPI labels and explanatory text to name the registered denominator.
- Add focused regression tests and update documentation.

#### Out of scope

- Adding or editing registration status in the student editor.
- Changing home-page calculations.
- Server-side cycle filtering.
- Database schema, migration, or query changes.

#### Acceptance criteria

- Registered with an offer is placed.
- Registered without an offer is unplaced.
- Unregistered participation is excluded from all dashboard KPI/chart inputs.
- An empty registered population produces a null placement percentage.
- Offer filters do not change the registered denominator.
- Relevant validation passes.

#### Validation

- Focused analytics tests
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

#### Handoff notes

- Files changed: `lib/placements/analytics.ts`,
  `lib/placements/analytics.test.ts`, `components/dashboard/KPICards.tsx`,
  `lib/placements/README.md`, `AGENTS.md`, and `TASKS.md`.
- Contracts changed: the shared dashboard `Scope.population` now contains only
  `REGISTERED` participation after cycle and batch scoping; `Kpis.total` therefore
  means registered participation.
- Validation results: 7 focused analytics tests passed; lint passed; TypeScript
  passed; production build passed.
- Known limitations: home-page placement calculations remain a separate view;
  PLACEMENTS-005 now applies the same registered-participation rule to them.
- Follow-up required: the student editor still needs an explicit cycle-aware
  registration field and server mutation rules; that work must reject changing a
  participation with an offer to `UNREGISTERED` rather than silently deleting the
  offer.

### [PLACEMENTS-005] Use registered participation on the home page

- Status: DONE
- Owner: Codex
- Requested by: Project owner
- Dependencies: PLACEMENTS-001, PLACEMENTS-004
- Blocks: None
- Scope/files: Home placement progress calculations, shared registration helper,
  tests, and documentation

#### Context

The dashboard uses registered participation for placement analytics, but the home
page still builds its placement totals and dated-offer comparison from every
returned participation record.

#### Required outcome

Feed the home placement wheel and dated-offer comparison from `REGISTERED`
participation only, without changing the existing batch-comparison policy.

#### In scope

- Share the registered-participation predicate with dashboard analytics.
- Exclude `UNREGISTERED` participation from home placed/unplaced totals and offers.
- Correct home accessibility/documentation wording for the registered population.
- Add focused regression coverage.

#### Out of scope

- Changing how the home page chooses or compares batches and cycles.
- Changing the “companies came” definition.
- Adding a cycle selector to the home page.
- Student-editor registration controls.

#### Acceptance criteria

- Unregistered participation does not affect the home placement wheel.
- Offers attached to unregistered participation do not enter home comparisons.
- Existing batch/date comparison behavior remains unchanged.
- Relevant validation passes.

#### Validation

- Focused analytics tests
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

#### Handoff notes

- Files changed: `lib/placements/analytics.ts`,
  `lib/placements/analytics.test.ts`, `components/home/PlacementProgress.tsx`,
  `components/home/PlacedSoFar.tsx`, `lib/placements/README.md`, `AGENTS.md`, and
  `TASKS.md`.
- Contracts changed: `isRegisteredParticipation()` is the shared dashboard/home
  predicate; home `batches` now contains registered placed/unplaced totals.
- Validation results: 8 focused analytics tests passed; lint passed; TypeScript
  passed; production build passed.
- Known limitations: home still aggregates and compares by graduating batch and
  July–June date windows; it has no explicit placement-cycle selector. The
  “companies came” figure still derives from dated offers, not drive events.
- Follow-up required: PLACEMENTS-006 implements the approved explicit two-cycle
  dashboard comparison. PLACEMENTS-007 implements the home cycle comparison.

### [PLACEMENTS-006] Compare two user-selected placement cycles

- Status: DONE
- Owner: Codex
- Requested by: Project owner
- Dependencies: PLACEMENTS-002, PLACEMENTS-004
- Blocks: None
- Scope/files: Dashboard filter state/UI, comparison analytics, KPI labels,
  tests, and documentation

#### Context

Dashboard KPI deltas automatically compare against an earlier graduating batch.
Cycle dates may be missing or overlap, so the application must not infer a
previous placement cycle.

#### Required outcome

Let the user explicitly select a primary placement cycle and a different
comparison cycle. Apply the same optional batch and offer filters to both cycle
populations and label KPI deltas with the comparison cycle code.

#### In scope

- Add an explicit comparison-cycle filter.
- Replace automatic previous-batch KPI comparison with selected-cycle comparison.
- Prevent comparing a cycle with itself and clear comparison when the primary
  cycle is cleared.
- Add focused tests and update documentation.

#### Out of scope

- Inferring or automatically selecting a previous cycle.
- Changing the home page's separate July–June batch comparison.
- Server-side cycle filtering.
- Database schema or migration changes.

#### Acceptance criteria

- Comparison KPIs appear only after two different cycles are selected.
- Both sides use the same batch and offer filters.
- Both sides exclude UNREGISTERED participation.
- Clearing/changing the primary cycle cannot leave a self-comparison.
- Relevant validation passes.

#### Validation

- Focused analytics tests
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

#### Handoff notes

- Files changed: `lib/placements/analytics.ts`,
  `lib/placements/analytics.test.ts`,
  `components/dashboard/useDashboardFilters.ts`,
  `components/dashboard/DashboardFilters.tsx`,
  `components/dashboard/PlacementAnalytics.tsx`,
  `components/dashboard/KPICards.tsx`, `lib/placements/README.md`, `AGENTS.md`,
  and `TASKS.md`.
- Contracts changed: `DashboardFilterState` gained nullable
  `comparisonCycleId`; `comparisonCycleKpis()` returns the explicitly selected
  comparison cycle's code and KPIs. Automatic previous-batch KPI comparison was
  removed.
- Validation results: 11 focused analytics tests passed; lint passed; TypeScript
  passed; production build passed.
- Known limitations: the home page retains its independent user-selectable batch
  and July–June date comparison. Dashboard cycle filtering remains client-side
  until the P2 server-filtering task is implemented.
- Follow-up required: none for the approved dashboard comparison scope.
- Resolution: PLACEMENTS-007 replaces the separate home batch/date comparison
  with explicit user-selected placement cycles.

### [PLACEMENTS-007] Replace home batch comparison with explicit cycle comparison

- Status: DONE
- Owner: Codex
- Requested by: Project owner
- Dependencies: PLACEMENTS-001, PLACEMENTS-005, PLACEMENTS-006
- Blocks: None
- Scope/files: Home placement-cycle summaries, comparison UI, tests, and documentation

#### Context

The dashboard compares two explicit cycles, but the home card still displays
graduating batches and infers July–June comparison windows.

#### Required outcome

Replace the home batch/date comparison with user-selected primary and comparison
cycles, identified by their stored cycle codes. Compare full registered-cycle
results without inferring cycle identity or boundaries from dates.

#### In scope

- Build registered placement summaries per explicit cycle.
- Require user selection of a primary cycle and a different comparison cycle.
- Use cycle codes in headings, cards, change text, and company comparison.
- Remove home batch/date and last-20-batches controls.
- Rename offer-derived company counts accurately.
- Add tests and update documentation.

#### Out of scope

- Drive-event-based company visit metrics.
- Server-side cycle filtering.
- Database schema or migration changes.

#### Acceptance criteria

- Home displays cycle selectors instead of batch selectors.
- No primary or comparison cycle is inferred automatically.
- Both cycle totals use registered participation only.
- A cycle cannot be compared with itself.
- Company counts are labelled as companies with offers, not companies that came.
- Relevant validation passes.

#### Validation

- Focused home-cycle tests
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

#### Handoff notes

- Files changed: `app/(portal)/page.tsx`, `components/home/HomeView.tsx`,
  `components/home/PlacementProgress.tsx`, `components/home/PlacedSoFar.tsx`,
  `components/home/PlacedSoFar.css`, `lib/placements/home-cycle.ts`,
  `lib/placements/home-cycle.test.ts`, `lib/placements/README.md`, `AGENTS.md`,
  and `TASKS.md`.
- Contracts changed: the home comparison now receives explicit cycle summaries
  (`cycleId`, `cycleCode`, registered placed/unplaced totals, and distinct
  offer-company names) instead of batch/date-window data. Both cycle selections
  start empty and must be made by the user.
- Validation results: 13 focused placement tests passed; lint passed; TypeScript
  passed; production build passed; `git diff --check` passed.
- Known limitations: company counts describe companies attached to final offers,
  not company visits or persisted calendar events. The old year-to-date utility
  remains available but is no longer used by the home comparison.
- Follow-up required: PLACEMENTS-003 must preserve an all-allowed-cycles options
  query for both the dashboard and home selectors when record filtering moves to
  the server.

### [PLACEMENTS-008] Add placement analytics regression tests

- Status: DONE
- Owner: Codex
- Requested by: Project owner
- Dependencies: PLACEMENTS-001, PLACEMENTS-004, PLACEMENTS-006
- Blocks: None
- Scope/files: Placement analytics and query-condition tests

#### Context

The registered-participation and explicit-cycle behavior is implemented, but its
critical rules need direct, individually named regression coverage.

#### Required outcome

Test placed/unplaced derivation, the registered denominator, empty populations,
repeated enrollment participation, cycle-owned offers, department and batch
scoping, and offer-filter denominator stability.

#### In scope

- Add direct analytics tests for every requested KPI and participation case.
- Verify the backend department predicate and enrollment-plus-cycle offer join.
- Refactor query conditions into testable helpers without changing behavior.

#### Out of scope

- Frontend behavior changes.
- KPI or filter-definition changes.
- Database schema, migrations, seed data, or live database mutation.

#### Acceptance criteria

- Registered with an offer is placed; registered without one is unplaced.
- Unregistered participation is excluded from the denominator.
- Empty registered participation returns a null percentage.
- One enrollment can produce two cycle participation records.
- An offer attaches only to its enrollment's matching cycle.
- Department query scoping and batch analytics scoping remain covered.
- Offer filters do not alter the registered denominator.
- Relevant validation passes.

#### Validation

- Focused placement analytics and query-condition tests
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

#### Handoff notes

- Files changed: `lib/placements/analytics.test.ts`,
  `lib/placements/query-conditions.ts`, `lib/placements/query-conditions.test.ts`,
  `lib/placements/queries.ts`, and `TASKS.md`.
- Contracts changed: no public data or UI contract changed. The existing UG/
  department query predicate and enrollment-plus-cycle offer join are now named
  internal helpers so their generated SQL can be tested directly.
- Validation results: 21 focused placement tests passed; lint passed; TypeScript
  passed; production build passed; `git diff --check` passed.
- Known limitations: query-condition tests validate generated SQL predicates
  without requiring or mutating a live PostgreSQL database.
- Follow-up required: none for this regression-test scope.

## P2 — Optimization

### [PLACEMENTS-003] Move placement-cycle filtering to the server

- Status: READY
- Owner: Unassigned
- Requested by: Project owner
- Dependencies: PLACEMENTS-002
- Blocks: None
- Scope/files: Placement analytics query API and dashboard route integration

#### Context

The dashboard currently fetches every authorized placement-cycle record and
applies its cycle selection in the client analytics layer. This is correct but
can transfer unnecessary records as the historical dataset grows.

#### Required outcome

Allow the selected explicit primary and optional comparison cycle IDs to scope
`getPlacementRecords()` on the server while preserving department authorization
and a usable cycle-options query. Do not derive cycle membership from batch years
or dates.

#### In scope

- Define server-safe primary/comparison cycle inputs and validation paths.
- Apply `student_cycles.cycle_id` filtering for both requested cycles in the
  authorized server query.
- Preserve access to the allowed cycle options needed by the dashboard.
- Preserve access to all allowed cycle options needed by the home comparison.
- Update route integration, tests, and documentation.

#### Out of scope

- Database schema changes.
- KPI-definition changes.
- Inferring a cycle from graduation year, offer date, or event date.

#### Acceptance criteria

- The server returns placement records only for the requested allowed primary
  cycle and optional comparison cycle.
- Department authorization remains server-enforced.
- Invalid or unavailable cycle IDs are rejected or safely produce no records.
- The dashboard can still render its cycle selector.
- The home page can still render both explicit cycle selectors.
- Relevant validation passes.

#### Validation

- To be recorded by the implementing owner.

#### Handoff notes

- Files changed:
- Contracts changed:
- Validation results:
- Known limitations:
- Follow-up required:

## Migration compatibility audit - 2026-10-22

Requested by: project owner (second migration review and cross-computer task plan).
This section records implementation work; this review changes documentation only.
Evidence is the current working tree on `main`, based on `d789d6b`, including
uncommitted PLACEMENTS-004 through PLACEMENTS-008 work. It is not a fresh check of
the deployed database's migration journal or contents. Do not equate checked-in
schema with verified deployment on another laptop.

### Findings already resolved or deliberately limited

- PLACEMENTS-001/004/006/007 cover explicit participation, registered denominators,
  and user-selected cycle comparisons. Do not reimplement the pasted review's
  old dashboard/home batch comparison findings.
- Home now says companies with offers and compares full explicit cycles. A true
  PPT/visit metric is a separate integration item (MIG-010), not a label bug.
- Calendar local storage is an acknowledged incomplete integration, not a new
  SQL runtime regression. Dormant actions still need auditing before reuse.
- PG exclusion is an acknowledged product limit. Queries check `level = UG`,
  not specifically `code = B.Tech`; do not describe these as equivalent when
  multiple UG degrees are imported. MIG-011 records this decision gate.
- Outreach remains independent; no additional migration mismatch was established
  in this review for its model. Layout/authentication are not wholesale rewrite tasks.
- Existing analytics tests cover pure records and generated predicates, not a
  real multi-cycle SQL join or concurrent database writes. MIG-012 closes that gap.

### Two-computer ownership and integration protocol

Lane names reserve file boundaries; they do NOT claim that an agent is running.
Actual owner, branch, base commit and handoff commit must be recorded when claimed.
Two offline models cannot guarantee conflict-free integration without sharing a
committed baseline and synchronizing ownership through Git.

1. Integrator first commits/reviews the current analytics/home/test baseline and
   this task board, then publishes the agreed base commit. Neither worker starts
   from an older checkout or discards the existing uncommitted work.
2. Assign one actual worker to A and one to B. Work on separate branches from that
   same base. The integrator alone edits `TASKS.md`, `AGENTS.md`, `db/README.md`,
   `db/schema.ts`, `drizzle/**`, package/lock files, root layout, global styles,
   shared auth, and `lib/placements/types.ts`. No concurrent migration generation.
3. A owns `lib/students/**`, `components/students/**`, and
   `app/(portal)/students/page.tsx`. B owns `lib/companies/**`, `lib/calendar/**`,
   `components/companies/**`, `components/calendar/**`, their portal page files,
   and any new `lib/drives/**` / `components/drives/**` files agreed at checkpoint.
   `lib/students/company-validation.ts` is A-owned but frozen while B consumes it.
4. B owns existing `lib/placements/cycle.ts` and `cycles.ts` cleanup, but cannot
   remove/change their exports until A's student callers are ported and merged.
   `visitDatesByCompany(connection, cycleId)` stays compatible while A consumes it.
   Keep legacy adapters temporarily if required; do not silently alter their meaning.
5. Each worker writes a unique handoff file `docs/handoffs/<TASK-ID>.md` with its
   branch/base, files, exported contracts, tests/results, decisions and commit SHA.
   Workers update their module README only. The integrator serially incorporates
   status/handoff into this board and reconciles shared documentation. This avoids
   both workers editing the same task-board lines on different computers.
6. Merge completed tasks serially. The second worker incorporates the merged base
   before integration; never resolve conflicts by taking an entire side or reverting
   another task. Run consumers' tests plus type/lint/build after contract integration.
7. A task needing another owner's file stops at that interface, records the needed
   change in its handoff, and waits for a committed contract/checkpoint. Do not copy
   another module's persistence logic or add a second implementation.

| Execution phase | Lane A | Lane B | Integration gate |
| --- | --- | --- | --- |
| First, parallel | MIG-001 student safety | MIG-002 event safety | Disjoint files; no API removals |
| Safety follow-up | MIG-003 seed safety (temporary ownership of that file only) | MIG-006 company identity/cycle projection | Preserve shared dependencies |
| Contract checkpoint | Agree student ID/cycle payloads | Agree drive/role options and event payloads | Integrator records exact exports before consuming them |
| Core implementation | MIG-004 then MIG-005 | MIG-007 then MIG-008 | MIG-005 consumes merged MIG-007 contracts |
| Later integration | MIG-009 reviewed legacy import | MIG-010 visit metric | Source/permission gates; no overlapping files |
| Serial follow-up | MIG-011 decisions and MIG-012 integration tests | PLACEMENTS-003 optimization later | Assign analytics/schema files to only one worker |

All new tasks below: Requested by project owner; actual Owner unassigned;
implementation validation not yet run. READY means scope is actionable once
listed dependencies are merged, not permission to skip dependencies or decisions.
BLOCKED means a specific business/source decision is needed. P0 precedes P1;
PLACEMENTS tasks above retain their existing IDs/status.

### [MIG-001] Stop destructive or ambiguous student mutations

- Priority: P0; Status: READY; Lane: A; Dependencies: agreed baseline.
- Blocks: safe editing of imported multi-cycle/shared-person records; MIG-004.
- Files: `lib/students/store.ts`, `read.ts`, `types.ts`, `validation.ts`,
  `actions.ts`, student component and tests within A's boundary.

Evidence: `moveBatch()` deletes every `student_cycles` row, deletes/reinserts the
offer in a year-inferred cycle and drops drive/role context. `mutateStudent()`
chooses `.limit(1)` participation and assumes REGISTERED on create/move.
`upsertOffer()` does not check registration and updates by enrollment only. Imported
UNREGISTERED rows can therefore acquire offers; the schema FK checks participation
existence, not its registration status. With multiple cycles, date checks and new
role links may use a different cycle than the existing offer; FK rejection is one
possible outcome, not a guarantee that every edit corrupts data.

Additional findings: a valid enrollment without participation is listed by
`readStudents()` but cannot even have its name edited or be deleted because the
mutation demands a cycle first. Name edits update the shared `students` row after
locking only one enrollment. Another enrollment (possibly another department) can
share that person; the existing department check does not isolate the name change.

Required outcome and acceptance:

- Reject ambiguous participation/offer writes until an explicit target is supplied;
  require REGISTERED for offer writes in that target and serialize registration and
  offer edits. Decision recorded 2026-10-22: an UNREGISTERED candidate cannot have
  an offer. Reject both an offer creation/update for UNREGISTERED participation and
  any transition to UNREGISTERED while its offer exists. Never remove an offer to
  make an unregistration succeed silently.
- Block destructive cohort moves pending a preservation-safe implementation in
  MIG-004; delayed-graduation history is still outside scope. Do not invent it.
- Enrollment-only operations must not require an unrelated placement registration.
- Detect shared-person edits and reject unsafe cross-department changes pending an
  explicit ownership policy; do not split/merge people or broaden permissions.
- Preserve all untouched cycle rows, offer IDs, nullable fields and drive/role links.
- Tests: two participations/one offer, unregistered offer rejection, enrollment with
  zero participation, shared-person edits, stale saves, professor/foreign-department
  denial, and transaction rollback with unchanged pre/post row snapshots.

### [MIG-002] Prevent company edits from rewriting multiple drive events

- Priority: P0; Status: READY; Lane: B; Dependencies: agreed baseline.
- Blocks: safe directory writes with repeated drives; MIG-006/008.
- Files: `lib/companies/visit.ts`, `actions.ts`, relevant validation/UI/tests;
  `lib/calendar/actions.ts` for the dormant writers calling the same helper.

Evidence: `setVisitDate()` updates every PPT event of every company drive in a
cycle. `updateCompany()` calls it even on a normal contact save, passing the
displayed minimum date back as the new date for all PPTs. Clearing that date clears
all PPT dates. If no PPT exists, it chooses `.limit(1)` drive or invents a drive.
Thus two real visits can collapse into one date just by saving contact details.
Even null calls invoke `ensureCycleId()` and can create an unrelated inferred cycle.

Required outcome and acceptance:

- Separate global contact edits from event writes. A contact-only save must leave
  drives, cycles and events byte-for-byte unchanged.
- Until explicit event editing is available, make the earliest-date projection
  read-only and reject ambiguous writes server-side; hiding the field alone is
  insufficient. Preserve compatibility for A's read-only visit helper.
- Dormant `saveVisit`/`deleteVisit` must not retain a bypass to the old broad writer.
  They currently check role but not `resolveDepartment()` and allow the all-scope
  superadmin case. Align with current all-scope read-only rules before reuse.
- Tests: two drives and repeated/undated PPTs, contact edit, clear-date attempt,
  missing cycle, and all-scope/professor rejection. No drive/event is fabricated.

### [MIG-003] Make demo seeding safe around migrated historical data

- Priority: P0; Status: READY; Lane: A after MIG-001; Dependencies: agreed baseline.
- Files: `db/seed-departments-demo.ts` and a dedicated seed-safety test;
  integrator owns package/db documentation updates if needed.
- Blocks: running demo seed against any historical/shared dataset.

Evidence: the seed accepts all enrollment rolls >= 900000000 as demo and companies
starting `DEMO ` as demo, then deletes every target placement/academic row. Those
patterns are not provenance: schema-valid real rolls can start with 9, and standalone
students/cohorts/cycles can exist without offers. It also deletes a username-matched
admin and moves other users from retired departments to the first demo department.
This changes access scope, not just fictional placement data.

Required outcome: restrict reset to an explicitly disposable test/demo database,
with an enforceable isolation check; refuse mixed/unknown datasets. Never reassign
real users or infer fictional ownership solely from names/rolls. Keep target/legacy
data and department memberships intact. Tests use disposable fixtures with a valid
9-prefixed non-demo enrollment, standalone person, empty-company data, and existing
department users; each unsafe invocation must refuse before any write. Do not run
the current seed to validate this task on a shared/local historical database.

### [MIG-004] Add explicit programme, cycle and registration editing

- Priority: P1; Status: READY; Lane: A; Dependencies: MIG-001 and contract checkpoint.
- Files: `lib/students/**`, `components/students/**`, students route.
- Blocks: safe full-model student editor and MIG-005/009.

Evidence: `ensureCohort()` takes the first UG programme; `ensureCycleId()` derives a
cycle from graduation year. Student reads omit programme/cohort/cycle/registration,
and stale snapshots therefore cannot detect changes to those identities/statuses.
`admissionYear: batchYear - 4` fabricates historical data. Creation always inserts a
new person and cannot represent an explicitly confirmed existing-person enrollment.

Decision recorded 2026-10-22: remove the graduation-year arithmetic. The editor must
present a manually editable, nullable admission **year** because PG and five-year
programmes do not share a four-year duration. Do not rename it to an admission date:
the schema has only `admission_year`. Current application code uses this value only
when creating an enrollment; it does not drive analytics, authorization, filters,
cycle membership, offers or any other application behavior. The demo seed derives
fictional values separately and is covered by MIG-003.

Required contract: represent stable student/enrollment/programme/cohort IDs,
graduation year, and explicit participation keyed by (enrollmentId, cycleId).
Either nested participations or a selected participation view is acceptable only
after the checkpoint; record the exact choice before changing consumers. Company
options must gain IDs without depending on B editing student files. The server
validates programme department, cohort association and required registration;
never auto-select a cycle from its code/date or synthesize registration.

Acceptance: multiple UG programmes and cycles are selectable without collisions;
new/edited participation leaves other participation intact; zero-participation
enrollments stay editable; admission year is manually entered, validated as a
four-digit year, editable, and stays null when unknown. Stale protection covers new
IDs/statuses and any data being overwritten. Confirmed reuse of a person must not
use name matching; shared-person permissions need an explicit policy.
Cohort moves may remain safely rejected (nonblocking feature) until history can be
preserved transactionally. Tests include conflicting final offers across cycles,
forged IDs, concurrency, null dates and all previously supported draft/error flows.

Decision confirmed by the project owner after Lane A merged: an administrator's
explicit first registration for a cohort/cycle pair may create the missing
`cycle_cohorts` association. This does not register the cohort as a group. Every
enrollment still needs its own explicit `student_cycles` status; only REGISTERED
enrollments enter placed/unplaced statistics, while confirmed non-participants are
recorded as UNREGISTERED and cannot receive an offer.

### [MIG-005] Select exact drive/role IDs in the student editor

- Priority: P1; Status: READY; Lane: A; Dependencies: MIG-004, merged MIG-007 options.
- Files: student types/read/store/validation/actions/editor and tests only.

Evidence: `linkRole()` takes the first company drive and first matching title;
titles can repeat. `StudentOffer` exposes neither drive/role/company IDs. The editor
also omits monthly stipend and other optional fields; those UI additions are deferred
under MIG-013. Existing stipends survive unrelated updates today; missing editor
support is not proof they are already erased. `offerDateProblem()` and the editor's
date minimum reject PPOs before the earliest company PPT even when the offer has no
drive association.

Acceptance: use B's explicit drive/role IDs, validate company/cycle/parent agreement,
allow unknown drive/role, and never create a drive just to hold free-text role data.
Preserve omitted values; explicit clear differs from omission. Remove the unsupported
company-wide PPT date ordering rule (including UI minimum) while retaining valid
ISO-date checks. Test PPO before PPT, unknown dates, repeated titles/drives,
unrelated field edits and stale submissions. No company module edits in this task.

### [MIG-006] Make the company directory use stable IDs and explicit cycles

- Priority: P1; Status: READY; Lane: B; Dependencies: MIG-002.
- Files: `lib/companies/**`, company components/route and B-owned cycle helpers
  (exports remain compatible until A ports its callers).

Evidence: company actions and `CompanyRecord` still use names as identity; the
schema now uses company UUIDs. `getCompanies(batchYear)` selects offers by cohort
year without an offer-cycle predicate, whereas visits come from a year-derived
cycle. A cohort participating in another cycle mixes two different populations.
The SQL comment says undergraduate but that offer subquery has no degree filter.
Unknown PVR defaults to No in create validation and the company form, losing the
unknown distinction. `updateCompany()` also rejects PPTs after any company offer in
the cycle, including unrelated drives/PPOs.

Acceptance: an explicit cycle controls the directory's cycle-specific projection;
cohort/batch filters, if retained, are separate and consistently applied. Preserve
global contact identity using IDs and expose the global nature of contact edits.
No invented department ownership of drives. Unknown PVR remains unknown unless the
user explicitly chooses No; no new PVR semantics. Remove unsupported cross-drive
offer-date restrictions. Earliest PPT may remain a labelled read-only projection.
Tests: one cohort in two cycles, multiple companies with/without offers, renamed
company identity, null PVR, PPO before PPT, and repeated/undated events.

### [MIG-007] Provide explicit historical drive/role selection and management

- Priority: P1; Status: READY; Lane: B; Dependencies: MIG-006.
- Files: new `lib/drives/**`, `components/drives/**`; integrate through company page
  files owned by B. Integrator handles any navbar/root-layout additions.
- Blocks: MIG-005 drive selection and MIG-008 persistence.

Decision recorded 2026-10-22: the initial management UI and mutations are
SUPERADMIN-only. A SUPERADMIN may manage institute-wide drives, roles and events;
department ADMIN access is deferred to a later role-based-access task. Do not
invent role-target tables or infer drive ownership from an offer's department.

At checkpoint publish exact read/action exports and option shapes with companyId,
cycleId, driveId, reference, roleId and nullable title. Repeated titles and multiple
drives must remain distinguishable by identity/reference. Support historical drive
records only; no applications, shortlists or interview decisions.

Acceptance: explicit creation/selection, server checks at every mutation, no
arbitrary first-row lookup, no invented unique company/cycle/title constraint,
safe rejection of deleting referenced drives/roles, and SUPERADMIN/professor/admin
authorization tested. A consumes these options without modifying B's implementation.

### [MIG-008] Persist the process calendar with event identity and atomic role links

- Priority: P1; Status: READY; Lane: B; Dependencies: merged MIG-007 drive options
  and MIG-002 protection.
- Files: `lib/calendar/**`, calendar components/route and tests. Use the existing
  `drives`, `drive_events` and `event_roles` schema; no schema/migration redesign.

Evidence: `DriveCalendar` persists department-keyed free-text entries in local
storage. `CalendarData`/actions project earliest PPT per company only, not events.
The page enables editing for SUPERADMIN with scope `all`. `saveVisit()` can overwrite
global company contacts through a name upsert. Neither dormant visit API represents
selected roles, nullable event dates or stable event IDs.

Required implementation decision recorded 2026-10-22: this is calendar UI
integration over the existing database model. Build the UI/data flow and the server
actions needed to call existing tables; do not add new calendar entities or change
the schema. Persist eventId/driveId/canonical processType/nullable scheduledDate/
scope/label with explicit role IDs. Map display labels to GD and
RESUME_SHORTLISTING. Repeated/undated events remain accessible; no company-contact
upsert as a side effect. Enforce WHOLE_DRIVE zero links and SELECTED_ROLES >=1 same-
drive links transactionally on create/update/delete, including concurrent role edits.
Preserve existing local data; do not silently import ambiguous names/dates into
invented drives. An explicit mapping/export plan is required before any transfer.
Tests must cover two browsers, SUPERADMIN-only write auth, role changes, rollback,
undated events and repeated stages. Do not present scheduled stages as recruitment
workflow state.

### [MIG-009] Review and migrate preserved legacy data without guessing identities

- Priority: P1; Status: BLOCKED; Lane: A later; Dependencies: MIG-003/004/005,
  actual source review and confirmed registration/cycle/company mappings.
- Files: dedicated reviewed import files under `db/`, `db/legacy-schema.ts`,
  `db/seed-mme-2027-roster.ts`; integrator exclusively owns new migrations/metadata.

Evidence: migration 0005 renames old tables and creates empty target tables; it does
not copy history. Current analytics query target rows only. The roster importer
still inserts `legacy_students`, so successful legacy import does not make rows
appear in the current dashboard. This is a known staged gap, not deleted source data.

Acceptance: dry-run source-to-target reconciliation, explicitly resolved missing
registration and cycle mappings, duplicate/conflicting offers reported, confirmed
programme/cohort matching, preserved nullable compensation and legacy visit dates,
idempotent import and row/count checks. Do not rewrite 0000-0005, reset tables, or
retire legacy tables in this task. Applying to a shared database requires a reviewed
backup/rollback and execution plan. No fabricated source gender/category values.

### [MIG-010] Add a correctly defined drive/PPT company metric when events are usable

- Priority: P1; Status: READY; Lane: B after calendar; Dependencies: MIG-008.
- Files (exclusive later handoff): home components, `lib/placements/home-cycle*`,
  placement query/types/README and home page; integrator releases shared ownership.

The old home-label bug is already resolved. Current company counts intentionally
mean companies with final offers. Decision recorded 2026-10-22: a PPT event that is
scheduled and has not been manually deleted from the calendar is treated as a visit.
This is the product definition for this metric; it does not claim independently
verified real-world attendance. Null/undated PPT events do not qualify as scheduled
visits unless the project owner later changes that rule.

Acceptance: aggregate distinct company IDs in the selected explicit cycle using the
rule "at least one dated PPT event exists"; deleting that event removes the company
from the metric. Include qualifying companies with no offers, avoid multiplication
by role/event joins, label the metric as scheduled PPT visits, and keep registered
placement denominators unchanged. Tests: no-offer company, multiple drives/PPTs for
one company, deleted/undated events and two cycles. This must not race PLACEMENTS-003
or another home/analytics edit.

### [MIG-013] Expose deferred optional student and offer fields

- Priority: P2; Status: PAUSED by project owner on 2026-10-22; Lane: A when resumed.
- Dependencies: MIG-004 and MIG-005, as applicable.
- Files: student types/read/store/validation/actions/editor/tests; no schema change.

Deferred scope: monthly stipend in INR, reservation category, gender and any other
currently omitted optional student/offer fields. These fields already exist in the
target schema where applicable. When resumed, expose manual edit/display controls,
preserve null rather than inventing values, distinguish omitted values from explicit
clears, and protect existing stored values during unrelated edits. This task must not
be started until the project owner resumes it.

### [MIG-011] Resolve remaining academic coverage and invariant enforcement gates

- Priority: P1; Status: BLOCKED; Owner: integrator until assigned serially.
- Dependencies: programme/PG presentation and shared-person/global-write decisions;
  MIG-004/007/008 contracts before any schema change.
- Files: schema/new migrations and db docs only under integrator ownership; any
  analytics expansion is separately assigned after the contract decision.

Evidence: UG filters admit all UG degrees while comments/UI say B.Tech; PG is absent
from analytics/editor despite valid target rows. PG specialization, immutable roll,
registration/offer compatibility and event-scope cardinality are not all enforced
by schema checks/FKs. Some are application rules today, not SQL guarantees.

Decision confirmed by the project owner after Lane A merged: PostgreSQL must also
enforce registration/offer compatibility. A new reviewed migration must reject an
offer insert or update unless the matching `student_cycles` row is REGISTERED, and
must reject changing/removing that participation while its offer exists. The Lane A
application checks remain defense in depth, not the final enforcement boundary.

Decision confirmed by the project owner after Lane B merged: PostgreSQL must also
enforce drive-event role cardinality against direct SQL and future import paths.
WHOLE_DRIVE events must have zero `event_roles`; SELECTED_ROLES events must have at
least one; and every linked role must belong to the event's drive. Cover inserts,
updates and deletes transactionally in a new reviewed migration. The Lane B server
action checks remain defense in depth, not the final enforcement boundary.

Required decision: which UG degrees are supported and whether PG has separate views;
do not enable PG by simply removing the UG predicate. Record a matrix mapping each
invariant to all write paths and transactional enforcement/trigger choice. Existing
MIG-001/004/008 tasks own their application checks; do not implement them twice.
Any added database enforcement must use a new reviewed migration, validate existing
rows first and test later updates/deletes/concurrent writes. No weakening of the
one-final-offer-per-enrollment key. Update stale schema/module documentation with
the actual integration status; do not claim checks exist before verification.

### [MIG-012] Verify migration contracts against PostgreSQL with realistic cardinality

- Priority: P1; Status: READY; Lane: integrator assigns one worker after dependencies.
- Dependencies: MIG-001/002/004/005/006/008 implementations available for integration.
- Files: dedicated integration-test fixtures/harness; package scripts, if needed,
  changed only by integrator. No production behavior changes in this task.

Evidence: PLACEMENTS-008 tests generated fragments and preassembled records. They
do not execute `getPlacementRecords()` joins, auth boundaries or concurrent writes
on PostgreSQL; the earlier "offer cannot leak" claim is limited to that coverage.

Acceptance: disposable synthetic PostgreSQL dataset with two departments, multiple
programmes, one enrollment in two cycles, one final offer, repeated drives/titles,
unregistered/no-participation records, null stipend/dates, and shared-person
enrollments. Exercise real reads and actions with department/professor/superadmin
contexts; verify isolation, no offer multiplication/leakage, immutable roll,
registered denominator and offer filters, stale edits and transactional rollback.
Run concurrency cases for offer/registration and event-role changes. Never use or
reset a shared database; record how the test database is isolated and disposed.

Lane B follow-up confirmed by the project owner: exercise calendar operations
against that real disposable PostgreSQL database and through two authenticated
browser sessions. Verify cross-browser visibility, professor read-only behavior,
SUPERADMIN write authorization, stale concurrent edits, rollback on partial event/
role failure, and correct handling of repeated and undated events. Unit tests and a
successful build do not satisfy this integration acceptance by themselves.

### [MIG-014] Reject participation payloads with any validation error

- Priority: P2; Status: READY; Owner: Unassigned.
- Dependencies: Lane A merge (`c9598ff`).
- Files: `lib/students/store.ts`, focused student validation/action tests.

Evidence: `validateParticipation()` can return valid parsed cycle/status data and a
nonempty `fieldErrors` object when the request also contains a forbidden field.
`mutateStudent()` currently rejects only when parsed data is absent, so that malformed
request is accepted and its valid fields are saved despite the validation error.

Acceptance: `setParticipation` rejects whenever participation validation returns any
field error, performs no write, and returns the error to the caller. Add a regression
test using a valid cycle/status plus an unexpected field. Preserve the existing valid
registration behavior and authorization checks.

### [MIG-015] Replace calendar question-mark separators with commas

- Priority: P2; Status: READY; Owner: Unassigned.
- Dependencies: Lane B merge (`7b7b229`).
- Files: `components/calendar/DriveCalendar.tsx` and the Lane B changelog heading.

Evidence: Lane B contains literal ` ? ` text separators in calendar event metadata,
role labels, day chips and the changelog heading. They render as question marks and
look like missing or corrupted characters even though the underlying data is valid.

Acceptance: replace those literal text separators with comma separators, keeping
normal TypeScript conditional (`? :`) operators unchanged. Check the rendered event
card, selected-role list and calendar chip text, and update the changelog heading.

### [MIG-016] Show accessible warnings for blocked student deletions

- Priority: P2; Status: READY; Owner: Unassigned.
- Requested by: Project owner on 2026-10-23.
- Dependencies: Lane A student mutation safeguards.
- Files: `components/students/StudentRecords.tsx`, student styles and focused UI tests.

Evidence: the server refuses to delete an enrollment while it has an offer, and the
table disables that Delete button. However, the explanation exists only in the
disabled button's `title` tooltip; it is not a persistent visible warning and may be
unavailable to keyboard and screen-reader users. Main-table mutation failures are
also rendered with `role="status"`, while the registration editor correctly provides
a visible rule explanation and renders rejected operations with `role="alert"`.

Acceptance: clearly show that the offer must be removed before deletion without
depending on hover, and associate the explanation with the disabled action for
assistive technology. The confirmation for an allowed deletion must explain that it
removes the selected enrollment and its cycle registrations, while the person record
is retained if another enrollment exists. Display the server's exact rejection as an
accessible alert and keep the record unchanged. Add focused UI coverage for blocked
deletion, confirmed allowed deletion and a server-side rejection. Frontend checks are
guidance only; preserve all server authorization, transaction and foreign-key checks.

## P3 — Low priority

### [NEXT-001] Fix Next.js blocking-route warning on /students (Cache Components)

- Priority: P3; Status: READY; Owner: Unassigned.
- Requested by: Project owner on 2026-10-23.
- Dependencies: None.
- Files: `app/(portal)/students/page.tsx`, student query/cache boundaries and
  focused route validation only as required by the accepted implementation.

Context:
- `cacheComponents: true` is enabled in `next.config`.
- `/students` returns 200 but logs a "blocking prerender / uncached data outside
  Suspense" warning. This is a warning, not a functional error; the page works.
- Cause: `StudentsPage` calls `requireRole("ADMIN")` (which reads cookies), and
  `getStudentData()` runs an uncached database query, both outside a `<Suspense>`
  boundary.
- The `.limit(1)` line is only where Next.js detected the database access; it is
  not a bug.
- The branch containing `.limit(1)` runs locally because `AUTH_BYPASS` selects the
  first department when no department cookie exists.

Planned fix:
1. Move the authentication check, cookie read and data loading into an async child
   component (for example, `StudentData`) and wrap it in
   `<Suspense fallback={<Loading />}>` inside `StudentsPage`.
2. Remove the duplicate `requireRole("ADMIN")` call; it is currently called in both
   `StudentsPage` and `getStudentData()`.
3. Optionally cache the query only, never authentication or cookie reading:
   - Create `getStudentsByDepartment(departmentId: string)` with `"use cache"`,
     `cacheLife(...)` and ``cacheTag(`students-${departmentId}`)``.
   - Read the department cookie outside the cached function and pass the department
     ID as an argument.
   - Call `revalidateTag` (or `updateTag` in Server Actions) with that tag after any
     student create, update or delete.

Constraints:
- Do not put `"use cache"` around anything that calls `cookies()` or `headers()`.
- Do not cache per-user or per-department data without the department ID as an
  argument.
- Authorization must always run before the cached call, never inside it.
- Do not use `export const instant = false` unless Suspense is not feasible; it only
  hides the warning.

Acceptance:
- The warning no longer appears for `/students`.
- The administrator check still runs on every request.
- Departments never see each other's data.
- Student edits appear after revalidation.

### Audit validation and handoff

This is a source review, not runtime reproduction against deployed institute data.
Only `TASKS.md` is changed by this audit. Existing application edits remain intact.
Review checks: `npm.cmd run lint` passed; `git diff --check` passed (line-ending
warnings only). No database commands, migrations, seed runs or application edits
were performed. The reviewed baseline and this board still need the agreed Git
publication step before another computer can rely on them.
Implementation owners must run relevant unit/integration tests, lint, TypeScript,
build and diff checks, record actual results in their unique handoff, and have the
integrator update this board before a task becomes DONE. Tasks gated by a decision
remain BLOCKED; do not substitute an unreviewed business assumption.

## Task template

Copy this template into the appropriate priority section only after the project
owner specifies the task.

```md
### [TASK-ID] Task title

- Status: READY
- Owner: Unassigned
- Requested by: Project owner
- Dependencies: None
- Blocks: None
- Scope/files: To be confirmed

#### Context

Why this work is needed and the repository state it depends on.

#### Required outcome

The exact behavior, artifact, or contract requested by the project owner.

#### In scope

- Explicitly approved work only.

#### Out of scope

- Related work that must not be included in this task.

#### Acceptance criteria

- Observable conditions that must be true before marking the task done.

#### Validation

- Commands, tests, inspections, or reviews required.

#### Handoff notes

- Files changed:
- Contracts changed:
- Validation results:
- Known limitations:
- Follow-up required:
```

## Cross-computer workflow

1. Pull or inspect the latest agreed branch before taking ownership.
2. Confirm the task is present here and dependency-ready.
3. Set its owner and status to `IN_PROGRESS` before editing shared files.
4. Keep implementation within the recorded scope and `AGENTS.md` boundaries.
5. Record validation results and handoff details before setting `DONE`.
6. Commit and push the task-board update with the related reviewed changes so
   other computers receive the same state.

## Completed-task archive

Move completed entries here only when the active sections become difficult to
scan. Preserve their task IDs, acceptance criteria, validation results, and
handoff notes.

_No archived tasks._
