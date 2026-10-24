# Student records

`/students` redirects to `/students/ug`. The explicit `/students/ug` and
`/students/pg` routes select the degree-level context; it is never inferred from
a cohort year. `getStudentData(level)` requires ADMIN (SUPERADMIN included) and
returns the chosen department's enrollments and editor choices for that level.
It returns null when a SUPERADMIN has not chosen a department.

Each `StudentRecord` is one enrollment (roll number). It carries:
- stable IDs: `studentId`, `enrollmentId`, `programmeId`, `cohortId`;
- the programme label and the cohort's graduation year (`batchYear`);
- nullable controlled `genderCode` (person-level) and `reservationCategoryCode`
  (enrollment-level); their labels come from the controlled choices loaded from
  `gender_types` and `reservation_categories`. Blank means unknown and is never
  defaulted. Administrators may explicitly clear either value;
- a manual, nullable `admissionYear`;
- its explicit placement-cycle `participations` (`cycleId`, `cycleCode`,
  `registrationStatus`), ordered by cycle code;
- its one final `offer` (`offerId`, `cycleId`, `cycleCode`, `companyId`,
  `companyName`, optional `driveId`/`roleId` with their labels, LPA decimal
  string, offer type, date), or null.

The options are controlled gender/category codes and labels, the department's
programmes and cohorts for the explicit UG or PG view (with the cycles each cohort
is associated with), **every existing** placement cycle, and every company by ID.
Nothing is inferred from today's date or a graduation year, and no placement cycle is
created here. The options include existing drives and roles; offer edits use their
exact IDs and never create or guess a drive or role. Historical offers may leave both
links empty. Company `domain` is presented only as the company description; role-domain
analytics use `drive_roles.domain`. Professor analytics remain name-free.

## Server Actions (`actions.ts`)

Every action receives the explicit UG/PG view, rechecks the database-backed role
and department (`resolveDepartment`), and verifies programme/enrollment degree
level on the server before writing. The "All departments" scope is rejected.

| Action | Does |
| --- | --- |
| `createStudent(level, input)` | A new person plus an enrollment in an explicitly chosen programme of the requested level and department and a graduation year; the cohort is created when missing. PG specialization is displayed from the existing programme label, never created here. Optional controlled gender and reservation category (both stay null when blank). Optional `admissionYear` (stays null when blank). Optional `participation: { cycleId, registrationStatus }`: an existing cycle and an explicit status, never defaulted. Optional `offer`, only for a REGISTERED participation. |
| `patchStudent(level, roll, changes, expected)` | Name, gender, reservation category, admission year and offer fields for an enrollment in that same level. Gender is shared person data and follows the same cross-department ownership safeguard as name. A different programme or batch (cohort move) is **rejected**: moving would discard registrations and offer details. |
| `setStudentParticipation(level, roll, { cycleId, registrationStatus }, expected)` | Adds a registration for an existing cycle or changes its status. Choosing a cycle the cohort is not associated with records that association in `cycle_cohorts`, as the admin's explicit choice. The cycle holding the offer cannot become UNREGISTERED. |
| `removeStudentParticipation(level, roll, cycleId, expected)` | Removes one registration; refused for the cycle holding the offer. |
| `removeStudentOffer(level, roll, expected)` | Deletes the final offer (confirmed in the UI). |
| `deleteStudent(level, roll, expected)` | Deletes the enrollment and its registrations, and the person if no other enrollment remains. Refused while an offer exists. |
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
- Offer dates are nullable ISO dates. They are not ordered against PPT/visit events;
  PPO, historical and no-drive offers therefore do not require an invented process date.
- Placement status is derived only from registration and offer presence. Offer type is
  displayed and filtered separately and is never treated as placement status.

## Concurrency and stale edits

Every write runs in one transaction. It locks the enrollment row, compares the
`expected` JSON snapshot (the full `StudentRecord`, including IDs, participations and
offer) with the current record, then locks the person, participation and offer rows it
touches, always in that order. Every rejection after the first write throws, so the
transaction rolls back. Unique and FK constraints remain the final guard. Offers are
updated by `offer_id`. Columns the editor does not show, such as the monthly stipend,
are never written, so they are preserved.

## Known limits

- Creating a student always creates a new person. Reusing an existing person needs an
  explicit identity and shared-person policy, never a name match.
- Cohort moves and cross-level edits are not supported. Switch between the explicit
  UG and PG routes to manage each roster.

## Verification

```bash
npx tsx --test lib/students/rules.test.ts lib/students/validation.test.ts
# Windows + Node 24, where the tsx CLI fails with uv_os_get_passwd ENOMEM:
node -e "process.geteuid=()=>0; require('tsx/cjs/api').register(); require('./lib/students/rules.test.ts'); require('./lib/students/validation.test.ts')"
```

Then run `npx tsc --noEmit`, `npm run lint` and `npm run build`. Database-level
verification is recorded in `docs/handoffs/LANE-A-CHANGELOG.md`.
