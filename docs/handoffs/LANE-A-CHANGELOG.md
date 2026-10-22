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

## 2026-10-22 · MIG-003 · MIG-003: gate the demo seed on an explicitly disposable database
- SHA: _backfilled_
- Files:
  - `db/seed-safety.ts` (new)
  - `db/seed-safety.test.ts` (new)
  - `db/seed-departments-demo.ts`
  - `docs/handoffs/MIG-003.md` (new)
  - `docs/handoffs/LANE-A-CHANGELOG.md`
- What and why:
  - The seed runs only when `DEMO_SEED_RESET_DATABASE` equals `current_database()`, never
    in production, and never next to preserved legacy rows. It decides before its first
    write.
  - It no longer deletes, moves or creates users, never renames departments, and never
    deletes outreach records.
  - It no longer uses roll ranges or name prefixes as provenance.
- Verify: `db/seed-safety.test.ts` (8 passed); `tsc --noEmit`; eslint on the Lane A paths.
- Revert: `git revert <SHA>`. No later Lane A commit depends on it.
- Environment note: `next build` creates an untracked `TNP-website/TNP-website/.next/`
  folder, because Next.js picks `C:\Users\hp\Desktop\tnp dashboard\package-lock.json` as
  the workspace root. Whole-repo `npm run lint` then fails on those generated chunks. The
  agent was not permitted to delete the folder. Delete it manually, or lint the source
  paths. It is untracked and never committed.

## 2026-10-22 · MIG-004 · MIG-004: explicit programme, cycle and registration editing for students
- SHA: _backfilled_
- Files:
  - `lib/students/types.ts`
  - `lib/students/validation.ts`
  - `lib/students/validation.test.ts`
  - `lib/students/rules.ts`
  - `lib/students/rules.test.ts`
  - `lib/students/read.ts`
  - `lib/students/queries.ts`
  - `lib/students/store.ts`
  - `lib/students/actions.ts`
  - `lib/students/README.md`
  - `components/students/StudentRecords.tsx`
  - `components/students/students.css`
  - `docs/handoffs/MIG-004.md` (new)
  - `docs/handoffs/LANE-A-CHANGELOG.md`
- What and why:
  - The student contract carries IDs and nested participations.
  - Create uses an explicit programme, a manual admission year and an optional explicit
    registration. No cycle is inferred or created.
  - New registration actions (set, remove) refuse to touch the offer's cycle.
  - Companies are chosen by ID.
  - Cohort moves stay rejected.
- Verify: Lane A tests (27 passed); `tsc --noEmit`; eslint on the Lane A paths; `next build`.
- Revert: `git revert <SHA>` (restores MIG-001 behavior). Revert before MIG-001 if both
  go.
