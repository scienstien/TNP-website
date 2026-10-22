# Lane B changelog

## 2026-10-22 ? MIG-002 ? MIG-002: stop contact saves from rewriting PPT events
- SHA: pending backfill
- Files: lib/companies/actions.ts, validation.ts, validation.test.ts, visit.ts, README.md; lib/calendar/actions.ts (deleted); components/companies/Companies.tsx; docs/handoffs/MIG-002.md, LANE-B-CHANGELOG.md.
- What / why: contact saves now touch only companies; reject visitDate keys, remove broad writer and unused calendar bypass. Earliest PPT is read-only. Scope statement was recorded in MIG-002 handoff before edits.
- Verify: lint, tsc, build and diff check passed; company validation 6 passed / 0 failed. DB/browser checks not run; see task handoff.
- Revert: `git revert <MIG-002 SHA>`; dependencies: MIG-006, MIG-007, MIG-008.

## 2026-10-22 · MIG-006 · MIG-006: use company IDs and explicit directory cycles
- SHA: pending backfill
- Files: lib/companies/actions.ts, queries.ts, types.ts, validation.ts, validation.test.ts, records.ts, records.test.ts, directory-condition.ts, README.md; components/companies/Companies.tsx; app/(portal)/companies/page.tsx; docs/handoffs/MIG-006.md, LANE-B-CHANGELOG.md.
- What / why: UUID company saves with row locks/stale protection; existing-cycle selector and same-cycle UG offers; global contacts copy and Unknown PVR default.
- Verify: lint/type-check/build/diff check passed; company tests 11 passed / 0 failed. DB/browser checks not run.
- Revert: `git revert <MIG-006 SHA>`; dependencies: MIG-007, MIG-008.

## 2026-10-22 · MIG-007 · MIG-007: add explicit historical drive and role management
- SHA: pending backfill
- Files: lib/drives/{types,read,queries,rules,rules.test,write,actions}.ts and README.md; components/drives/DriveManager.tsx, drives.css; app/(portal)/companies/drives/page.tsx; company page/editor/CSS; docs/handoffs/MIG-007.md, LANE-B-CHANGELOG.md.
- What / why: exact two-query option contract; SUPERADMIN/chosen-department transactional writes, fixed identities and reference-safe deletes; Companies entry point and duplicate-friendly UI.
- Verify: lint/type-check/build/diff check passed; 15 passed / 0 failed (drive 4, company 11). DB/browser checks not run.
- Revert: `git revert <MIG-007 SHA>`; dependencies: MIG-008.
