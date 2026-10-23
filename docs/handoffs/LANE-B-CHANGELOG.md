# Lane B changelog

## 2026-10-22, MIG-002, MIG-002: stop contact saves from rewriting PPT events
- SHA: `bc21aa2d41fba2dc43eeddf87a1ce5179faefd30`
- Files: lib/companies/actions.ts, validation.ts, validation.test.ts, visit.ts, README.md; lib/calendar/actions.ts (deleted); components/companies/Companies.tsx; docs/handoffs/MIG-002.md, LANE-B-CHANGELOG.md.
- What / why: contact saves now touch only companies; reject visitDate keys, remove broad writer and unused calendar bypass. Earliest PPT is read-only. Scope statement was recorded in MIG-002 handoff before edits.
- Verify: lint, tsc, build and diff check passed; company validation 6 passed / 0 failed. DB/browser checks not run; see task handoff.
- Revert: `git revert bc21aa2d41fba2dc43eeddf87a1ce5179faefd30`; dependencies: MIG-006, MIG-007, MIG-008.

## 2026-10-22 · MIG-006 · MIG-006: use company IDs and explicit directory cycles
- SHA: `942fe23cc33a89366805a947ea88cabff5e1ef3c`
- Files: lib/companies/actions.ts, queries.ts, types.ts, validation.ts, validation.test.ts, records.ts, records.test.ts, directory-condition.ts, README.md; components/companies/Companies.tsx; app/(portal)/companies/page.tsx; docs/handoffs/MIG-006.md, LANE-B-CHANGELOG.md.
- What / why: UUID company saves with row locks/stale protection; existing-cycle selector and same-cycle UG offers; global contacts copy and Unknown PVR default.
- Verify: lint/type-check/build/diff check passed; company tests 11 passed / 0 failed. DB/browser checks not run.
- Revert: `git revert 942fe23cc33a89366805a947ea88cabff5e1ef3c`; dependencies: MIG-007, MIG-008.

## 2026-10-22 · MIG-007 · MIG-007: add explicit historical drive and role management
- SHA: `d4ba2ac26ced081e53e8434e48a6b3848351da07`
- Files: lib/drives/{types,read,queries,rules,rules.test,write,actions}.ts and README.md; components/drives/DriveManager.tsx, drives.css; app/(portal)/companies/drives/page.tsx; company page/editor/CSS; docs/handoffs/MIG-007.md, LANE-B-CHANGELOG.md.
- What / why: exact two-query option contract; SUPERADMIN/chosen-department transactional writes, fixed identities and reference-safe deletes; Companies entry point and duplicate-friendly UI.
- Verify: lint/type-check/build/diff check passed; 15 passed / 0 failed (drive 4, company 11). DB/browser checks not run.
- Revert: `git revert d4ba2ac26ced081e53e8434e48a6b3848351da07`; dependencies: MIG-008.

## 2026-10-22 · MIG-008 · MIG-008: persist drive-stage events and atomic role links
- SHA: `42e7ea1b13b9bee43c7e1d27e37f12e37a263d64`
- Files: lib/calendar/{types,queries,actions,read,rules,rules.test,labels,local-entries}.ts and README.md; components/calendar/{DriveCalendar,CalendarView,EventForm,NullableDateInput,BrowserEntries}.tsx and calendar.css; app/(portal)/calendar/page.tsx; docs/handoffs/MIG-008.md, LANE-B-CHANGELOG.md.
- What / why: database-backed dated/undated stage identity, parent-drive locks and transactional role links, stale protection, SUPERADMIN/chosen-department writes; preserve/export browser-only entries read-only.
- Verify: lint/type-check/build/diff check passed; focused 22/22; full suites 65 passed / 0 failed after registering both tsx CJS/ESM loaders (initial CJS-only: 63/65 due to dynamic-import resolution). DB/two-browser tests not run.
- Revert: `git revert 42e7ea1b13b9bee43c7e1d27e37f12e37a263d64`; dependencies: none in this round.

## 2026-10-22 · docs · docs: backfill Lane B commit SHAs
- SHA: `HEAD` (this final documentation commit; resolve with `git rev-parse HEAD`; a literal self-hash cannot be embedded in its own commit).
- Files: docs/handoffs/MIG-002.md, MIG-006.md, MIG-007.md, MIG-008.md, LANE-B-CHANGELOG.md.
- What / why: backfill all implementation SHAs, record final ownership/remote/integration checks and the proposed PR text. Shared task/schema documentation remains frozen.
- Verify: git diff --check passed; no application changes since the successful integration checks below.
- Revert: `git revert HEAD` immediately after this commit; dependencies: none; documentation only.

## Pre-PR checks (2026-10-22)

### 9(a): Lane B path allowlist
Command: owner's PowerShell allowlist against `git diff --name-only 5687c05...HEAD`.
Output:
```text
OK: all paths in Lane B
```
`git diff --check 5687c05...HEAD`: no output, exit 0. Working tree was clean before the temporary integration branch.

### 9(b): Lane A overlap
`git fetch origin`: exit 0, no output. `git branch -r --list 'origin/lane-a/*'`: no output.
`git show-ref --verify refs/remotes/origin/lane-a/mig-students-seed` output:
```text
fatal: 'refs/remotes/origin/lane-a/mig-students-seed' - not a valid ref
```
NOT RUN: no pushed Lane A ref exists. This is absence of a branch, not a proven overlap/combined-build result. Repeat the intersection and both-lane dry run after Lane A is pushed.

### 9(c): Integration dry run
origin/main resolved to `5687c05b65a451cf12cb1241e06483712dca6d95`.
Commands: owner's temporary branch/merge workflow; Lane A merge skipped because its ref is absent.
Merge output:
```text
Switched to a new branch 'tmp/integration-dry-run'
branch 'tmp/integration-dry-run' set up to track 'origin/main'.
Merge made by the 'ort' strategy.
 45 files changed, 1346 insertions(+), 745 deletions(-)
```
No conflict messages. Temporary merge SHA: `e03e8812e32f333605a050067297ba9fba0a02b7` (never pushed).
Validation output on temporary merge:
```text
TSC_EXIT=0

> placement-portal@0.1.0 lint
> eslint

LINT_EXIT=0
```
Build output:
```text
> placement-portal@0.1.0 build
> next build

▲ Next.js 16.4.2 (Turbopack)
- Environments: .env
✓ Running next.config.ts took 25ms
- Cache Components enabled
- Partial Prefetching enabled
- Experiments (use with caution):
  ✓ agentFeedback

  Creating an optimized production build ...
✓ Compiled successfully in 807ms
  Running TypeScript ...
  Finished TypeScript in 3.6s ...
  Collecting page data using 14 workers ...
  Generating static pages using 14 workers (0/12) ...
  Generating static pages using 14 workers (3/12)
  Generating static pages using 14 workers (6/12)
  Generating static pages using 14 workers (9/12)
✓ Generating static pages using 14 workers (12/12) in 748ms
  Finalizing page optimization ...

Route (app)
┌ ◐ /
├ ○ /_not-found
├ ƒ /api/auth/[...nextauth]
├ ƒ /auth/session-expired
├ ◐ /calendar
├ ◐ /companies
├ ◐ /companies/drives
├ ◐ /dashboard
├ ◐ /login
├ ◐ /outreach
└ ◐ /students
```
Build exit 0. Every test file in lib/companies, lib/drives, lib/calendar, lib/placements, lib/students and lib/auth was run (10 files). Full test command in MIG-008 handoff; both tsx CJS/ESM loaders registered. Test summary output:
```text
ℹ tests 65
ℹ suites 0
ℹ pass 65
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 70.6239
TEST_EXIT=0
```
`git diff --check`: no output, exit 0. Return/cleanup output:
```text
Switched to branch 'lane-b/mig-companies-drives-calendar'
Deleted branch tmp/integration-dry-run (was e03e881).
## lane-b/mig-companies-drives-calendar
```
Scope: Lane B + current origin/main only. Full Lane A + B verification remains pending remote availability. Repeat after both PRs are available; no claim about unobserved Lane A source.

## Integrator requests
Apply the exact TASKS.md, AGENTS.md and db/README.md text in each task handoff in one separate integration commit after both PRs merge. Keep tasks VALIDATION until isolated PostgreSQL and browser scenarios are checked. Retain schema/legacy migration caveats. MIG-005 may consume the exact MIG-007 contract next round. MIG-010/012 remain separate work. Cycle/company option queries and institute-wide write authorization are consolidation candidates after ownership release.

## Proposed PR title
MIG-002/006/007/008: protect company history and persist drive calendar

## Proposed PR body
Company contact saves now update only company rows, with stable UUID identity and stale-edit protection. The directory uses an explicit existing placement cycle and preserves unknown PVR. SUPERADMIN with one department chosen can manage historical drives/roles and database-backed drive-stage events; undated/repeated stages and atomic selected-role links are supported. Browser-only calendar entries remain read-only and exportable.

Handoffs: [MIG-002](docs/handoffs/MIG-002.md), [MIG-006](docs/handoffs/MIG-006.md), [MIG-007](docs/handoffs/MIG-007.md), [MIG-008](docs/handoffs/MIG-008.md), [Lane B changelog](docs/handoffs/LANE-B-CHANGELOG.md).

Validation: lint, TypeScript, production build and diff checks pass. All 65 tests pass. Lane B merges into current origin/main without conflicts and passes the same checks. Lane A overlap/combined-branch checks await its remote branch. No migrations/seeds/shared data were changed. Isolated PostgreSQL concurrency/rollback and two-browser checks were not run and are enumerated in the handoffs. Shared AGENTS/TASKS/db documentation requests are reserved for the integrator's separate commit.
