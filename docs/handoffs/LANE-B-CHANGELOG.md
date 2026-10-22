# Lane B changelog

## 2026-10-22 ? MIG-002 ? MIG-002: stop contact saves from rewriting PPT events
- SHA: pending backfill
- Files: lib/companies/actions.ts, validation.ts, validation.test.ts, visit.ts, README.md; lib/calendar/actions.ts (deleted); components/companies/Companies.tsx; docs/handoffs/MIG-002.md, LANE-B-CHANGELOG.md.
- What / why: contact saves now touch only companies; reject visitDate keys, remove broad writer and unused calendar bypass. Earliest PPT is read-only. Scope statement was recorded in MIG-002 handoff before edits.
- Verify: lint, tsc, build and diff check passed; company validation 6 passed / 0 failed. DB/browser checks not run; see task handoff.
- Revert: `git revert <MIG-002 SHA>`; dependencies: MIG-006, MIG-007, MIG-008.
