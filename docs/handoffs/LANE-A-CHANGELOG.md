# Lane A changelog

- Lane: A (Claude). Owner of `lib/students/**`, `components/students/**`,
  `app/(portal)/students/**`, `db/seed-departments-demo.ts`, `db/seed-safety*.ts`.
- Branch: `lane-a/mig-students-seed`
- Base commit: `5687c05b65a451cf12cb1241e06483712dca6d95` (shared with Lane B)
- Tasks, in order: MIG-001 → MIG-003 → MIG-004
- Per-task handoffs: [MIG-001](MIG-001.md), [MIG-003](MIG-003.md), [MIG-004](MIG-004.md)

Entries are chronological, one per commit. SHAs are backfilled by the final
`docs: backfill Lane A commit SHAs` commit. Until then, find a commit with
`git log --grep "<subject>"`.

## 2026-10-22 · MIG-001 · MIG-001: make student writes target explicit registered participation
- SHA: _backfilled_
- Files:
  - `lib/students/rules.ts` (new)
  - `lib/students/rules.test.ts` (new)
  - `lib/students/store.ts`
  - `lib/students/types.ts`
  - `lib/students/validation.ts`
  - `lib/students/validation.test.ts`
  - `components/students/StudentRecords.tsx`
  - `docs/handoffs/MIG-001.md` (new)
  - `docs/handoffs/LANE-A-CHANGELOG.md` (new)
- What and why:
  - Removed the destructive batch move.
  - Offer writes now lock the participations and the offer, target the offer's own
    cycle (or an explicit or single participation), and require REGISTERED.
  - Offers are updated by `offer_id`.
  - Enrollment-only operations no longer need a participation.
  - A rename is rejected when the person also has an enrollment in another department.
- Verify: the student test files (13 passed); lint; `tsc --noEmit`; `next build`.
- Revert: `git revert <SHA>`. MIG-004 builds on `rules.ts` and `writeOffer()`, so revert
  MIG-004 first.
