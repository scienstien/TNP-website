AGENTS.md --- NIT Tiruchirappalli TNP Placement Dashboard
1. Project context
Build a Training and Placement (TNP) dashboard for twenty years of historical
placement data across all departments at NIT Tiruchirappalli, including UG and PG
programmes and PG specializations. This institute-wide scope supersedes the
original six-year, MME-only scope.

The dashboard generates charts, KPIs, filters, comparisons and reports dynamically
from stored historical data. The process calendar records drive stages; this is
not authorization to add live recruitment-management workflows.

This file is shared project context for agents and developers on every laptop.
Use committed documentation, the current repository and migration history rather
than private chat history or local memory. The target schema and deployed
migration state are distinct during the staged transition below.

2. Scope boundaries
There are two application roles:
- ADMIN: Manages historical placement data and authorized administrative actions.
- PROFESSOR: Has read-only dashboard access unless the project owner changes it.
The users table exists only for authentication and role-based access control.
Students and academic enrollments are placement data, not login accounts.

The approved scope includes all departments, academic programmes, graduating
cohorts, explicit placement cycles, repeated company drives, roles, individual
final offers and drive-stage events. Do not add student/recruiter login accounts,
job applications, shortlisting decisions, interview evaluation or other live
recruitment workflows without an explicit requirement. Scheduled process stages
do not imply those workflows.

3. Approved target data model and staged delivery
`db/schema.ts` is the canonical Drizzle PostgreSQL target definition.
`db/README.md` documents keys, relationships, units and enforcement boundaries.
TypeScript properties use camelCase; SQL tables/columns use snake_case.

Current delivery is schema-only:
- Legacy migrations 0000-0004 remain unchanged. No target migration is generated
  or applied, and no database is reset or seeded by this task.
- Existing analytics, student/company/calendar queries and actions, seed scripts
  and UI contracts are not migrated to the new columns. Full-application type
  checks are expected to fail at these legacy references until integration.
- Calendar UI persistence remains browser local storage. Target event tables do
  not mean the calendar is connected to PostgreSQL.
- Do not run legacy seed scripts against the target schema or claim the complete
  application works with it. Existing database migration state remains legacy.

Academic identity:
- `departments`: UUID department_id PK, required unique code and required name.
- `degrees`: UUID degree_id PK, required unique code and level (UG/PG).
- `programmes`: UUID programme_id PK, department_id FK, degree_id FK and nullable
  specialization. The department/degree/specialization combination is unique,
  including unspecialized programmes. PG specialization is a required business
  rule whose cross-table enforcement is pending.
- `cohorts`: UUID cohort_id PK, programme_id FK and required four-digit
  graduation_year; unique (programme_id, graduation_year).
- `gender_types` and `reservation_categories`: controlled code PK/label
  reference tables. Do not invent or seed missing source classifications.
- `students`: UUID student_id PK, required name and nullable gender_code FK.
  This is a person; UG and later PG may use separate enrollments for that person.
- `enrollments`: UUID enrollment_id PK, student_id FK, required unique
  roll_number, cohort_id FK, nullable admission_year and reservation_category_code
  FK. Rolls remain nine-digit integers, 100000000-999999999, and immutable through
  editing. Category is recorded for the enrollment.
- Names remain trimmed, 1-100 characters. Student input permits Unicode letters,
  combining marks, spaces, apostrophes, periods and hyphens, with at least one
  letter; normalize whitespace and reject digits/other symbols.
- Programme and cohort IDs are generated internally. Imports match confirmed
  department/degree/specialization and graduation-year combinations to existing
  records; roll number identifies an enrollment, not the person's UUID.
- Delayed graduation/cohort changes are explicitly nonblocking for this delivery;
  no academic-progression history model is included.

Cycles and participation:
- `placement_cycles`: UUID cycle_id PK, required unique code; optional starts_on
  and ends_on. Overlapping cycles and missing cycle dates are allowed.
- `cycle_cohorts`: composite PK/FKs (cycle_id, cohort_id), resolving the cycle/
  cohort many-to-many relationship.
- `student_cycles`: composite PK (cycle_id, enrollment_id), required cohort_id
  and registration_status (REGISTERED/UNREGISTERED) with no default. Composite
  FKs require the enrollment's cohort and an existing cycle/cohort association.
- UNREGISTERED includes opt-outs and academically ineligible students. There is
  no separate eligibility model, roster-completeness field or import-audit model;
  college-provided complete data is trusted. Required registration still cannot
  be fabricated: missing historical registration is flagged before import.
- Placement status is derived per student-cycle: an offer means PLACED;
  REGISTERED without an offer means UNPLACED; UNREGISTERED has no offer.
  Do not store an independent placement_status.
- Cycle membership is explicit. Never infer it from calendar year, offer date,
  event date or a mandatory cycle date range.

Companies, drives and final offers:
- `companies`: UUID company_id PK; required unique name; nullable domain,
  hr_name, email, phone_number, pvr_status and remarks. Stable company IDs replace
  name-based offer references. Contacts remain global company data.
- `drives`: UUID drive_id PK, required company_id FK and cycle_id FK, optional
  reference. One company may have many drives in the same cycle, with no
  uniqueness on company/year/date.
- `drive_roles`: UUID role_id PK, drive_id FK and nullable job_title. Repeated
  titles and multiple roles per drive are allowed.
- `placement_offers`: UUID offer_id PK; required unique enrollment_id, required
  cycle_id and company_id; nullable drive_id, role_id, package_lpa,
  monthly_stipend_inr, offer_type and offer_date.
- Each offer belongs to one student-cycle and company. Optional drive/role
  references must agree with company, cycle and parent drive; a role needs a drive.
  Historical offers/PPOs do not require an invented drive or role.
- One final reported offer is allowed per enrollment/roll across all cycles.
  This is not one offer per person for life. Revocation clears the final offer.
  Report conflicting source offers; do not silently discard them or relax the key.
- Actual annual compensation is numeric INR LPA; actual monthly stipend is
  numeric INR. Drizzle returns numeric as strings. Missing values remain NULL.
  Offer type remains nullable PPO/FTE/FTE+6month; offer date remains nullable.
- No advertised-package variants or role-target associations are included.
  PVR remains nullable yes/no/unknown; its exact meaning is unresolved.

Drive-stage events:
- `drive_events`: UUID event_id PK, drive_id FK, required process_type and scope,
  nullable scheduled_date and label. Stages: PPT, OT, GD, RESUME_SHORTLISTING, PI.
  Scope: WHOLE_DRIVE or SELECTED_ROLES. A drive may have repeated/undated events.
- `event_roles`: composite PK (event_id, role_id), required drive_id; composite
  FKs require the selected event and role to belong to that same drive.
- WHOLE_DRIVE events have zero role links; SELECTED_ROLES events have at least
  one. This rule requires coordinated transactional enforcement.
- Target companies have no visit_date. Dates belong to drive events. Preserve
  legacy visit-date values in the eventual reviewed migration; do not discard
  them or fabricate their drive/cycle mapping. Calendar UI integration is pending.

Enforcement boundaries:
- Keys, local checks and composite FKs do not enforce every business rule.
  PG specialization, no offer for unregistered participation, event scope/link
  cardinality and roll immutability need future triggers or coordinated
  transactional write paths, including later updates/deletes.
- Do not claim those cross-table rules are implemented by schema.ts alone.
  Authorization must always be enforced separately on the server.

Users and historical data:
- `users` remains unchanged: UUID id PK, nullable name, required unique email,
  nullable password_hash, required ADMIN/PROFESSOR role defaulting to PROFESSOR.
  Never store plaintext passwords, student relationships or is_active here.
- All twenty years and departments share these tables; never create per-year or
  per-department placement tables. Preserve nullable historical details and
  inspect actual source files before implementing imports.

4. Shared engineering rules
1. Inspect before editing. Read the relevant existing files,
   package scripts, schema, migrations, and nearby code before making
   changes.
2. Follow the existing stack. Do not replace frameworks, libraries,
   authentication, styling systems, or database tooling without an
   explicit reason and approval.
3. Use the repository as shared memory. If a decision affects other
   agents, document it in this file or the relevant project
   documentation and commit it.
4. Do not invent requirements. If a requirement or source data is
   ambiguous, record the uncertainty and ask for a decision instead of
   silently choosing a business rule.
5. Keep changes focused. Implement only the task assigned to you.
   Do not rebuild unrelated modules or rewrite files owned by another
   workstream.
6. Preserve compatibility. Check existing imports, routes, API
   contracts, types, and database migrations before changing shared
   interfaces.
7. Protect data. Never commit real student records, passwords,
   tokens, .env files, or private credentials. Use fictional data in
   examples and tests.
8. Validate changes. Run relevant lint, type-check, tests, and
   build commands where available. Report commands that could not be
   run.
9. Avoid destructive changes. Do not drop tables, reset shared
   databases, rewrite migrations already used by teammates, or remove
   other agents' work without approval.
10. No duplicate implementations. Search for an existing component,
    query, utility, or service before creating another version.
5. Multi-agent collaboration protocol
Different agents may work from different laptops. The shared Git
repository is the coordination mechanism.
Before starting a task
- Pull or inspect the latest agreed branch state.
- Read this AGENTS.md and any module-specific instructions.
- Inspect the files relevant to the assigned task.
- Check whether another agent owns or is editing the same files.
- State the exact scope of the task before editing.
While working
- Own a clearly bounded module or set of files.
- Avoid simultaneous edits to shared files such as the root layout,
  global styles, database schema, authentication configuration,
  package manifest, and shared types.
- If a shared contract must change, coordinate the change first and
  document it.
- Do not implement another agent's module merely because it is
  referenced by your task. Use its agreed interface or a clearly
  marked temporary stub.
- Do not overwrite, revert, or reformat unrelated changes.
- Keep commits small and descriptive.
Before handing off
Report: - What was implemented. - Which files changed. - Any schema,
API, type, or component contracts introduced or changed. - Commands and
tests run, with results. - Known limitations or unresolved questions. -
Any work that another agent must do next.

Never claim a feature works unless it has been implemented and checked.
6. Suggested work boundaries
These are coordination boundaries, not instructions for every agent to
implement every module. Assign each task to one owner.
- Database and data-import owner: schema, migrations, constraints,
  historical CSV/Excel import, validation, and seed data.
- Authentication and access owner: login, session handling,
  ADMIN/PROFESSOR permissions, and route/API protection. This
  owner must not redesign placement records.
- Dashboard and analytics owner: KPI definitions, filtered
  aggregate queries, charts, and year-to-year comparisons using agreed
  data contracts.
- UI and integration owner: shared layout, navigation, filters,
  responsive presentation, and integration of existing modules.
One person or agent may own multiple areas if the team is small, but
each file and shared contract must have a clear owner. Do not ask every
agent to independently build the entire website.
7. Database and analytics rules
- Use PostgreSQL and Drizzle ORM as defined in db/schema.ts.
- Use the academic hierarchy and explicit cycle associations above. Do not infer
  placement cycles or graduation cohorts solely from event/offer dates.
- Store actual compensation on the final offer, in INR LPA and monthly INR.
  Convert values only when source currency, period and amount are reliable.
- Preserve missing source values; resolve missing required fields before import.
  Normalize company names and review ambiguous matches without silently merging.
- College roster data is trusted; no completeness or separate eligibility audit
  is part of this model. UNREGISTERED includes ineligible students and opt-outs.
- Placement status is derived per student-cycle. Offer type is not status.
  Keep the one-final-reported-offer-per-enrollment rule across cycles.
- For a report choosing registered-student placement percentage, divide placed
  enrollments by registered enrollments within the same filtered population.
  An empty denominator is undefined, not 0%. State other denominators explicitly.
  Final analytics integration/metric presentation is separate from schema work.
- Avoid multiplying student/offer counts when joining events or roles. Calculate
  statistics through SQL aggregation or the existing agreed query layer rather
  than storing manually maintained KPIs.
- Professors remain read-only. Protected reads and every mutation require
  server-side authorization; hidden UI controls are not access control.
- Keep student-level information restricted to authorized users and expose only
  the aggregates needed by dashboard/report consumers.

8. Definition of done
A task is complete only when: - It satisfies the assigned scope and this
project context. - It integrates with the current codebase and agreed
contracts. - It does not introduce unrelated features or duplicate
implementations. - Relevant validation commands have been run, or the
limitation is clearly reported. - Documentation is updated if a shared
assumption, contract, or workflow changed. - The handoff states exactly
what changed and what remains.
9. Remaining decisions and integration work
Settled: twenty-year/all-department coverage, UG/PG programme hierarchy, generated
UUID identities, explicit cycles, registration including ineligible opt-outs,
trusted source rosters, one final offer per enrollment, actual offer compensation
in INR, optional drive/role context, drive events and read-only professors.
Do not reopen these as unresolved requirements.

Remaining work:
- Review actual historical files, missing required registration, category values,
  globally unique rolls and programme/cohort/company mappings before imports.
- Prepare a reviewed, data-preserving forward migration from the unchanged
  legacy history. Do not rewrite migrations 0000-0004 or reset shared databases.
- Port existing queries/actions, analytics contracts, editors, seeds and calendar
  persistence to the target. Implement the pending cross-table rules before
  production integration.
- Resolve PVR semantics without inferring behavior from the nullable field.
- Update module-specific READMEs when their implementations are ported; existing
  legacy module contracts are not evidence of target-schema compatibility.

Authentication (implemented; see lib/auth/README.md):
- Auth.js (NextAuth v5) Credentials provider, email + password against the
  users table. Encrypted JWT session cookie, 8-hour lifetime. No adapter
  tables are needed for this strategy.
- Passwords are hashed with scrypt (lib/auth/password.ts); plaintext is
  never stored or logged.
- Self-service sign-up creates PROFESSOR accounts only, and only for email
  domains listed in ALLOWED_SIGNUP_DOMAINS (default nitt.edu). ADMIN
  accounts cannot be created through the UI.
- A trial admin (admin@nitt.edu) is created automatically in development
  on the first sign-in request; production creates it only with
  SEED_TRIAL_ADMIN=true. db/seed.ts does not create users.
- Authorization: proxy.ts redirects visitors without a session to /login
  (optimistic check). Every page, Server Action and route handler that
  reads protected data or changes anything must call requireUser() or
  requireRole('ADMIN') from lib/auth/dal.ts, which re-reads the user and
  role from the database. Hiding UI is not access control.
- The app uses the shared connection in db/index.ts (DATABASE_URL). Run
  the local PostgreSQL container and migrations as described in
  db/README.md before signing in.

Legacy analytics and student/company integration:
- lib/placements/analytics.ts, lib/students/ and lib/companies/ still implement
  the previous MME model and use columns removed from the target. Their existing
  module READMEs describe that legacy implementation until integration updates.
- Legacy student editors remain ADMIN-only, with role rechecks on mutation.
  Preserve the same authorization, explicit offer removal, draft Save/Cancel and
  no-overwrite company creation requirements when porting their data contracts.
- Recharts remain the current chart library; the historical company-sector chart
  must not be mistaken for the new academic department/programme dimension.
- db/seed.ts and db/seed-dashboard-demo.ts contain fictional legacy examples.
  They are not migrated; do not run them against the target schema.

Process calendar (temporary client-only mode):
- The dashboard calendar does not call lib/calendar/queries.ts or
  lib/calendar/actions.ts. Admins add/edit/remove process entries in browser
  local storage; entries are not shared between browsers or stored in PostgreSQL.
- Professors remain read-only. The dormant company visit-date query/action files
  use the old schema and must be ported or replaced when persistence is integrated.
- Target drive_events/event_roles describe the future persistence contract,
  not an already connected calendar feature.

Outreach contact tracker (unchanged; see lib/outreach/):
- Signed-in PROFESSOR users have read-only access. ADMIN users can create,
  edit and delete standalone outreach_contacts records.
- There is no FK or synchronization with companies, students, offers, analytics
  or the process calendar.
- PVR defaults to No; updated_at is maintained by the server on edits.

When a shared decision changes, update this file, db/README.md and relevant
module documentation with the implementation, and commit shared documentation
with the reviewed changes so every laptop receives the same context. Never
commit credentials or real student records.
