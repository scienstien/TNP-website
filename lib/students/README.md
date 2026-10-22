# Student records

`getStudentData()` requires ADMIN (SUPERADMIN included) and returns the chosen
department's **undergraduate enrollments** and the editor's choices. It returns
null when a SUPERADMIN has not chosen a department.

Each `StudentRecord` is one enrollment (roll number). It carries:
- stable IDs: `studentId`, `enrollmentId`, `programmeId`, `cohortId`;
- the programme label and the cohort's graduation year (`batchYear`);
- a manual, nullable `admissionYear`;
- its explicit placement-cycle `participations` (`cycleId`, `cycleCode`,
  `registrationStatus`), ordered by cycle code;
- its one final `offer` (`offerId`, `cycleId`, `cycleCode`, `companyId`,
  `companyName`, job role, LPA decimal string, offer type, date), or null.

The options are the department's UG programmes and cohorts (with the cycles each cohort
is associated with), **every existing** placement cycle, and every company by ID.
Nothing is inferred from today's date or a graduation year, and no placement cycle is
created here. Professor analytics remain name-free.

## Server Actions (`actions.ts`)

Every action rechecks the database-backed role and the department
(`resolveDepartment`) before validating or writing. The "All departments" scope is
rejected.

| Action | Does |
| --- | --- |
| `createStudent(input)` | A new person plus an enrollment in an explicitly chosen UG programme of the department and a graduation year; the cohort is created when missing. Optional `admissionYear` (stays null when blank). Optional `participation: { cycleId, registrationStatus }`: an existing cycle and an explicit status, never defaulted. Optional `offer`, only for a REGISTERED participation. |
| `patchStudent(roll, changes, expected)` | Name, admission year and offer fields. A different programme or batch (cohort move) is **rejected**: moving would discard registrations and offer details. |
| `setStudentParticipation(roll, { cycleId, registrationStatus }, expected)` | Adds a registration for an existing cycle or changes its status. Choosing a cycle the cohort is not associated with records that association in `cycle_cohorts`, as the admin's explicit choice. The cycle holding the offer cannot become UNREGISTERED. |
| `removeStudentParticipation(roll, cycleId, expected)` | Removes one registration; refused for the cycle holding the offer. |
| `removeStudentOffer(roll, expected)` | Deletes the final offer (confirmed in the UI). |
| `deleteStudent(roll, expected)` | Deletes the enrollment and its registrations, and the person if no other enrollment remains. Refused while an offer exists. |
| `createStudentCompany({ name, domain })` | Explicit company creation that never overwrites an existing company. Returns `{ companyId, name, domain }`. |

## Rules (`rules.ts`, pure and unit-tested)

- `offerTarget()`: an offer write goes to the existing offer's own cycle, or an
  explicit `offer.cycleId`, or the only participation. With more participations it is
  rejected as ambiguous. The target must be REGISTERED: an UNREGISTERED candidate
  cannot have an offer.
- `registrationChangeProblem()` and `participationRemovalProblem()`: the
  participation holding the offer cannot become UNREGISTERED or be removed. An offer is
  never deleted to make either succeed.
- `sharedPersonProblem()`: a rename is rejected when the person also has an enrollment
  in another department. A cross-department ownership policy is still undecided.

## Concurrency and stale edits

Every write runs in one transaction. It locks the enrollment row, compares the
`expected` JSON snapshot (the full `StudentRecord`, including IDs, participations and
offer) with the current record, then locks the person, participation and offer rows it
touches, always in that order. Every rejection after the first write throws, so the
transaction rolls back. Unique and FK constraints remain the final guard. Offers are
updated by `offer_id`. Columns the editor does not show, such as the monthly stipend,
are never written, so they are preserved.

## Known limits

- Drive and role selection by ID is MIG-005. A job title is still linked through the
  first drive of the company in the offer's cycle, created if missing.
- The editor still rejects an offer date before the company's earliest PPT in the offer's
  cycle; MIG-005 removes that rule.
- Creating a student always creates a new person. Reusing an existing person needs an
  explicit identity and shared-person policy, never a name match.
- PG enrollments are not shown (AGENTS.md), and cohort moves are not supported.

## Verification

```bash
npx tsx --test lib/students/rules.test.ts lib/students/validation.test.ts
# Windows + Node 24, where the tsx CLI fails with uv_os_get_passwd ENOMEM:
node -e "process.geteuid=()=>0; require('tsx/cjs/api').register(); require('./lib/students/rules.test.ts'); require('./lib/students/validation.test.ts')"
```

Then run `npx tsc --noEmit`, `npm run lint` and `npm run build`. Database-level
verification is recorded in `docs/handoffs/LANE-A-CHANGELOG.md`.
