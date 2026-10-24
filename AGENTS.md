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
There are three application roles, all scoped by department (see "Departments and
access" below):
- SUPERADMIN: Belongs to no department. Has every ADMIN power in every department,
  working in one department at a time, or reading all of them.
- ADMIN: Belongs to one department. Manages that department's historical placement
  data and authorized administrative actions there only.
- PROFESSOR: Belongs to one department. Has read-only dashboard access to it unless
  the project owner changes it.
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

Delivery status: the target schema is deployed by migration 0005 and the application
is ported to it.
- Legacy migrations 0000-0004 remain unchanged. 0005_institute_wide_schema renames
  the legacy MME tables (students, companies, placement_offers and their indexes)
  to legacy_students, legacy_companies and legacy_placement_offers, keeping every
  row, then creates the target tables. Nothing is dropped. Copying the legacy rows
  into the target model (including company visit dates as drive events) is a
  reviewed data migration that has NOT been done.
- Analytics, the student editor, company directory, outreach tracker and the
  dormant calendar query/action files now read and write the target tables, scoped
  by department. Recheck cross-table rules below before relying on them.
- Calendar UI persistence remains browser local storage (kept per department). Target
  event tables do not mean the calendar UI is connected to PostgreSQL; the company
  directory's visit date is the earliest dated PPT drive event of the current cycle.
- db/seed.ts and db/seed-dashboard-demo.ts (legacy fictional seeds) were removed;
  npm run db:seed:departments fills the target schema with fictional data.
  db/seed-mme-2027-roster.ts still targets the preserved legacy_students table
  through db/legacy-schema.ts and has not been ported (it needs a registration
  decision per student, see below).

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
  name-based offer references. domain is only a company description: never filter
  or chart by it. hr_name/email/phone_number are legacy global contacts (kept, not
  edited) until they are retired.
- `drives`: UUID drive_id PK, required company_id FK and cycle_id FK, optional
  reference, and hr_name/hr_email/hr_phone_number (migration 0006). One company may
  have many drives in the same cycle, with no uniqueness on company/year/date. The
  application requires the drive HR contact on create and edit; the columns are
  nullable only for older rows.
- `drive_roles`: UUID role_id PK, drive_id FK, nullable job_title and nullable domain
  (0006). Repeated titles and multiple roles per drive are allowed. domain is the
  role's field (e.g. Production for a supply engineer, Software for an SDE at the
  same company); every distribution-across-fields chart uses it.
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
  legacy visit-date values (kept in legacy_companies) in the eventual reviewed data
  migration; do not discard them or fabricate their drive/cycle mapping. The
  company directory edits a visit date by moving the company's PPT events in the
  current cycle (creating a whole-drive PPT event on a drive if none exists).
  Calendar UI integration is pending.

Enforcement boundaries:
- Keys, local checks and composite FKs do not enforce every business rule.
  PG specialization, no offer for unregistered participation, event scope/link
  cardinality and roll immutability need future triggers or coordinated
  transactional write paths, including later updates/deletes.
- Do not claim those cross-table rules are implemented by schema.ts alone.
  Authorization must always be enforced separately on the server.

Departments and access (user-requested multi-department extension):
- Every department user sees only their own department. A department is reached
  through programme -> cohort -> enrollment; no placement table has its own
  department column. users.department_id and outreach_contacts.department_id are
  the only department columns outside the academic hierarchy.
- Every protected query and Server Action scopes with resolveDepartment() in
  lib/auth/dal.ts: department users are pinned to their own department whatever the
  client sends. A SUPERADMIN chooses a department in the dashboard's department
  navbar (a cookie, re-checked against the database) or "All departments", which
  is read-only. Mutations that need one department reject "all".
- Dashboard analytics use undergraduate (UG, B.Tech) cohorts only. Student Records
  has explicit `/students/ug` and `/students/pg` views and scopes reads and writes to
  the selected degree level; the batch is cohort.graduation_year. PG dashboard
  analytics are not shown yet.
- Because the target schema has no role-target links, drives and company contacts are
  institute-wide, not per department.
- Development accounts (created on the first sign-in request; in production only
  with SEED_TRIAL_ADMIN=true): superadmin / test123 (SUPERADMIN) and
  admin123<department code>@nitt.edu / test1234 (ADMIN, e.g.
  admin123civil@nitt.edu). Sign-in accepts a bare username and appends the first
  allowed domain. Sign-up asks for a department and creates PROFESSOR accounts only.
- Migration 0005 creates a placeholder 'mme' department so existing users and
  outreach contacts stay valid; replace or rename it when the real department list
  is imported. The demo seed removes it.

Users and historical data:
- `users`: UUID id PK, nullable name, required unique email, nullable password_hash,
  required ADMIN/PROFESSOR/SUPERADMIN role defaulting to PROFESSOR, and a nullable
  department_id FK to departments (NULL only for SUPERADMIN; enforced in the
  application, not by a constraint). Never store plaintext passwords, student
  relationships or is_active here. The department is the user's access scope, not
  placement data.
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
`TASKS.md` is the shared implementation queue and execution-order source. Before
starting implementation, check it for explicitly assigned work, priority,
dependencies, ownership and status. Do not invent or add tasks to `TASKS.md`;
new task entries require an explicit request from the project owner.
Before starting a task
- Pull or inspect the latest agreed branch state.
- Read this AGENTS.md, `TASKS.md` and any module-specific instructions.
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

Companies integration checkpoint (2026-10-24; supersedes older company/calendar
status descriptions below): the calendar UI already persists PostgreSQL events
through the Lane B implementation. Companies now reuses its event reader for an
exact company/cycle/drive without a date window. Companies.tsx is composition only;
the controller loads cards independently. All cycles includes every company master;
cycle mode includes companies with explicit drives, even zero offers. Contacts and
drive metadata are institute-wide. Offer aggregates include REGISTERED UG and PG
enrollments in the authenticated department (SUPERADMIN can read all), without
student detail payloads. Separate role compensation and offer-type cards complement
the three-dimension demographic donut. Live database/browser integration acceptance
is still pending; see docs/handoffs/COMPANIES-MODEL1.md. Cancellation status remains
separate future schema work; per-drive HR storage was added by migration 0006.
Drive management (2026-10-24, owner request): the separate /companies/drives page is
merged into the company directory. "Add company" drafts drives and roles (saved in the
company's transaction; no drive asks for confirmation). The Drive process card of an
expanded company has "Edit drives": add new drives, edit recorded drives, roles and
process stages (drive_events), and each drive's HR contact. ADMIN and SUPERADMIN (with a chosen
department) may write drives, roles and process stages, here and on the calendar page.
A new drive needs at least one titled role (its last role cannot be deleted); stages
drafted with it are WHOLE_DRIVE events shared by all its roles, and creating a drive
with no stages asks for confirmation (dates can be added later in either place).
Every drive needs its own HR name, email and phone (drives.hr_*), entered inside each
drive; the legacy companies.hr_name/email/phone_number are kept but no longer edited.
Roles take an optional domain (drive_roles.domain) used by domain-wise analytics;
companies.domain is shown only as the company's Description and is not searched,
filtered or charted.

Settled: twenty-year/all-department coverage, UG/PG programme hierarchy, generated
UUID identities, explicit cycles, registration including ineligible opt-outs,
trusted source rosters, one final offer per enrollment, actual offer compensation
in INR, optional drive/role context, drive events and read-only professors.
Do not reopen these as unresolved requirements.

Remaining work:
- Review actual historical files, missing required registration, category values,
  globally unique rolls and programme/cohort/company mappings before imports.
- Copy the preserved legacy_* rows into the target model (departments, programmes,
  cohorts, enrollments, registration, companies, drives, offers, visit dates as
  drive events) with a reviewed, data-preserving migration; then retire the
  legacy tables. Do not rewrite migrations 0000-0005 or reset shared databases.
- Persist the process calendar in drive_events. Implement the pending cross-table
  rules before production integration (the student editor registers every student it
  creates or moves as REGISTERED so offers stay valid).
- Resolve PVR semantics without inferring behavior from the nullable field.
- Update the analytics placement-percentage definition for the registered-student
  denominator, and decide whether PG cohorts get their own views.
- Module READMEs (lib/students, lib/companies, lib/placements, lib/outreach) were
  written for the legacy model; their data-model statements are superseded by this
  file and db/README.md until they are revised.

Authentication (implemented; see lib/auth/README.md):
- Auth.js (NextAuth v5) Credentials provider, email + password against the
  users table. Encrypted JWT session cookie, 8-hour lifetime. No adapter
  tables are needed for this strategy.
- Passwords are hashed with scrypt (lib/auth/password.ts); plaintext is
  never stored or logged.
- Self-service sign-up creates PROFESSOR accounts only, and only for email
  domains listed in ALLOWED_SIGNUP_DOMAINS (default nitt.edu). ADMIN
  accounts cannot be created through the UI.
- Development accounts (superadmin, admin123<dept>@nitt.edu; see "Departments and
  access") are created automatically on the first sign-in request in
  development; production creates them only with SEED_TRIAL_ADMIN=true. Seeds do
  not create users.
- Authorization: proxy.ts redirects visitors without a session to /login
  (optimistic check). Every page, Server Action and route handler that
  reads protected data or changes anything must call requireUser() or
  requireRole('ADMIN') from lib/auth/dal.ts, which re-reads the user and
  role from the database. Hiding UI is not access control.
- The app uses the shared connection in db/index.ts (DATABASE_URL). Run
  the local PostgreSQL container and migrations as described in
  db/README.md before signing in.

Ported analytics and student/company integration:
- lib/placements/queries.ts, lib/students/ and lib/companies/ read the target
  tables. PlacementRecord now represents one explicit undergraduate student-cycle
  participation and includes cycle identity, optional cycle dates, registration
  status, department and the offer for that same cycle. It carries no roll number,
  name or graduating batch: student identifiers stay on the server. The analytics
  functions and charts filter by explicit placement cycle only (there is no batch
  filter) and use REGISTERED participation as their population. UNREGISTERED participation is
  excluded before placed/unplaced and offer analytics are derived. Server-side
  cycle filtering is tracked as a later optimization; authorization remains
  server-enforced.
- Dashboard KPI deltas compare a user-selected primary cycle with a different
  user-selected comparison cycle under the same batch and offer filters. Never
  infer a previous cycle from its code or optional dates.
- The home placement wheel and comparison use full-cycle summaries for two
  different cycles explicitly selected by the user. They exclude UNREGISTERED
  participation and do not infer cycle identity or boundaries from dates or
  graduating batches. Their company figure means distinct companies attached to
  final offers; it is not a company-visit metric.
- Student editors remain ADMIN-only (SUPERADMIN included) with role and department
  rechecks on every mutation, explicit offer removal, draft Save/Cancel and
  no-overwrite company creation. Offer editing selects exact existing drive and role
  IDs, while historical offers may omit both; offer dates are not ordered against
  PPT events. Programme, cohort and offer-cycle reassignment remain blocked rather
  than inferring or discarding placement history.
- Recharts remain the current chart library; the domain-wise chart (role domain,
  drive_roles.domain) must not be mistaken for the academic department/programme
  dimension. The dashboard's domain filter also uses the role domain, never
  companies.domain.

Process calendar (temporary client-only mode):
- The dashboard calendar does not call lib/calendar/queries.ts or
  lib/calendar/actions.ts. Admins add/edit/remove process entries in browser
  local storage, kept separately per department; entries are not shared between
  browsers or stored in PostgreSQL.
- Professors remain read-only. The dormant company visit-date query/action files
  were ported to the PPT drive events but remain unconnected to the UI.
- Target drive_events/event_roles describe the future persistence contract,
  not an already connected calendar feature.

Outreach contact tracker (see lib/outreach/):
- Each department has its own checklist (outreach_contacts.department_id).
  Signed-in PROFESSOR users have read-only access to their department's records.
  ADMIN users can create, edit and delete their department's standalone records; a
  SUPERADMIN can read all departments and edit the chosen one.
- There is no FK or synchronization with companies, students, offers, analytics
  or the process calendar.
- PVR defaults to No; updated_at is maintained by the server on edits.

When a shared decision changes, update this file, db/README.md and relevant
module documentation with the implementation, and commit shared documentation
with the reviewed changes so every laptop receives the same context. Never
commit credentials or real student records.
