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

_No tasks recorded._

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
- Previous-batch comparison does not cross into another cycle.
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
- Known limitations: analytics still includes UNREGISTERED participation in its
  denominator. The normal `tsx` CLI fails before test execution under the local
  Node 24 Windows environment (`uv_os_get_passwd` ENOMEM), so validation used the
  same tsx loader after supplying the missing Windows process identity hook.
- Follow-up required: PLACEMENTS-003 records the requested server-side cycle
  filtering optimization. Registered-student analytics remains separate work.

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

Allow the selected explicit cycle ID to scope `getPlacementRecords()` on the
server while preserving department authorization and a usable cycle-options
query. Do not derive cycle membership from batch years or dates.

#### In scope

- Define a server-safe selected-cycle input and validation path.
- Apply `student_cycles.cycle_id` filtering in the authorized server query.
- Preserve access to the allowed cycle options needed by the dashboard.
- Update route integration, tests, and documentation.

#### Out of scope

- Database schema changes.
- KPI-definition changes.
- Inferring a cycle from graduation year, offer date, or event date.

#### Acceptance criteria

- The server returns placement records only for the requested allowed cycle.
- Department authorization remains server-enforced.
- Invalid or unavailable cycle IDs are rejected or safely produce no records.
- The dashboard can still render its cycle selector.
- Relevant validation passes.

#### Validation

- To be recorded by the implementing owner.

#### Handoff notes

- Files changed:
- Contracts changed:
- Validation results:
- Known limitations:
- Follow-up required:

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
