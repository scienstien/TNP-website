AGENTS.md --- MME TNP Placement Dashboard
1. Project context
Build a departmental Training and Placement (TNP) dashboard for the
Metallurgical and Materials Engineering (MME) department at NIT
Tiruchirappalli.

The website is for viewing and managing historical placement data from
the previous six years. It is not a college-wide placement portal and is
not a live recruitment-management system.

The dashboard must generate its charts, KPIs, filters, comparisons, and
reports dynamically from the stored historical data.

This file is the shared project context for every coding agent and every
developer working on the repository, including developers using
different laptops. Treat the committed version of this file and the
current repository code as the source of truth. Do not depend on private
chat history, local agent memory, or assumptions that are not documented
here.
2. Scope boundaries
There are two application roles:
- ADMIN: Can manage historical placement data and perform
  authorized administrative actions.
- PROFESSOR: Can access the dashboard. Default permission is
  read-only unless the project owner explicitly changes this rule.
The users table exists only for authentication and role-based access
control. It is not a student or placement-data table.

Do not add features or tables for: - Other departments or department
management. - Student or recruiter login accounts. - Job postings,
applications, shortlisting, interviews, or live recruitment workflows. -
A college-wide placement portal.

Do not expand the project beyond this scope without an explicit
requirement.
3. Current implemented data model
`db/schema.ts` is the canonical Drizzle PostgreSQL schema. `db/README.md`
documents its decisions and integration limitations. Use this model rather
than the original sketch. TypeScript properties use camelCase; SQL columns
use snake_case. The table and column names below are SQL names.

Student (`students`; export `students`)
- roll_number: text primary key.
- name: nullable text.
- batch_year: required integer identifying the graduating batch.
Only eligible MME students are recorded. A student has zero or one offer.
Placement status is derived using offer existence: PLACED when an offer
exists, otherwise UNPLACED. Do not add an independently stored
placement_status or a company reference to students.

Company (`companies`; export `companies`)
- name: text primary key; there is no company_id.
- domain: nullable text.
- hr_name, email, phone_number: nullable text contact fields.
- pvr_status: nullable boolean; true/false means yes/no, NULL means unknown.
- visit_date: nullable date of the company's campus visit, shown on the drive
  calendar; NULL means none scheduled. One date per company. Only admins change
  it (server-side); deleting a visit clears the date, never the company.
A company can exist with zero offers and can make offers to many students.
Company profile is excluded. Compensation belongs to the individual offer,
not the company. PVR's exact business meaning remains unresolved; do not
infer additional behavior from it.

Placement offer (`placement_offers`; export `placementOffers`)
- company_name: required text foreign key referencing companies.name.
- student_roll_number: required text foreign key referencing
  students.roll_number, with a separate UNIQUE constraint.
- Composite primary key: (company_name, student_roll_number).
- job_role: nullable text.
- package_lpa: nullable PostgreSQL numeric, in lakhs per annum. Drizzle
  returns this value as a string to preserve precision.
- offer_type: nullable offer_type enum: PPO, FTE, or FTE+6month.
- offer_date: nullable date, represented as a string by Drizzle.
Every offer belongs to exactly one student and one company. The unique
student_roll_number constraint enforces at most one offer per student;
the composite primary key alone does not enforce that rule.
Both foreign keys use ON UPDATE CASCADE and ON DELETE RESTRICT.
There is no offer_id, offer_status, joining_date, or placement_year column.
Keep offer_date even though missing historical values are permitted.

User (`users`; export `users`)
- id: UUID primary key, generated randomly by default.
- name: nullable text.
- email: required unique text.
- password_hash: nullable text for compatibility with provider-based auth;
  never store plaintext passwords.
- role: required user_role enum, ADMIN or PROFESSOR; defaults to PROFESSOR.
Users exist only for authentication and role-based access. Do not add
student placement details, placement relationships, or is_active to users.
Professor permissions remain read-only. The users table is not a complete
Auth.js adapter implementation; authentication integration is separate.

Historical data
All six years share these tables, with graduating batches identified by
students.batch_year. Do not create per-year tables or a department table.
Non-key historical details remain nullable where the schema permits;
never fabricate missing source values. Inspect actual source files before
implementing imports. If source rows appear to contain multiple offers for
one student, report the conflict with the confirmed one-offer rule rather
than silently dropping records or relaxing the constraint.

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
- Use PostgreSQL and Drizzle ORM as defined in db/schema.ts. Do not
  replace the database engine or ORM without explicit approval.
- Keep historical years in shared tables.
- Use foreign keys and appropriate unique constraints.
- Store compensation in placement_offers.package_lpa as numeric LPA.
  Convert source values only when the unit and amount are reliable.
- Preserve missing or uncertain source values as missing; do not
  fabricate them.
- Normalize company names carefully during imports and retain a way to
  review ambiguous matches.
- Only eligible students are recorded. For a batch, placement rate is
  students with an offer divided by all recorded students in that batch,
  multiplied by 100. Publish the rate only when the complete eligible
  roster has been entered. An empty batch has an undefined rate, not 0%.
  No separate eligible-count field is currently required.
- Under the unique student constraint, each offer represents one placed
  student. Avoid double-counting through joins; flag source data that
  contradicts the one-offer rule.
- Derive placement status from offer existence. Offer type describes
  PPO/FTE/FTE+6month and is not a separate placement-status field.
- Compute dashboard statistics from the data, using SQL aggregation or
  an existing query layer. Do not store derived KPIs as manually
  maintained values.
- Apply server-side authorization to data-changing operations. Hiding
  a button in the UI is not access control.
- Keep student-level data restricted to authorized users; aggregate
  dashboard views should expose only the data needed for their
  purpose.
8. Definition of done
A task is complete only when: - It satisfies the assigned scope and this
project context. - It integrates with the current codebase and agreed
contracts. - It does not introduce unrelated features or duplicate
implementations. - Relevant validation commands have been run, or the
limitation is clearly reported. - Documentation is updated if a shared
assumption, contract, or workflow changed. - The handoff states exactly
what changed and what remains.
9. Remaining decisions and integration work
The database engine, keys, one-offer rule, offer-level compensation,
eligible-student model, and read-only professor permissions are settled
as described above. Do not treat them as open questions.

The following remain unresolved:
- What exactly does PVR mean, and does it describe the company or its
  contact? Retain the nullable boolean in companies without inventing
  additional semantics.
- Is a distinct placement cycle needed beyond graduating batch and offer
  date? placement_year is currently omitted; derive calendar year from
  offer_date if that is all that is needed.
- Validate import mappings, missing values, company-name normalization,
  and complete eligible rosters against actual historical source files.

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

Analytics dashboard (implemented; see lib/placements/README.md):
- KPIs and the four charts are computed from the database through
  lib/placements/analytics.ts; filtering and counting rules live there only.
- The schema has no academic stream. The stream-wise chart uses the company
  sector (companies.domain) until a stream field is decided by the database
  owner; unplaced students are reported separately because they have no sector.
- Placement % is shown as placed / recorded students with a note that it assumes
  a complete roster; where roster completeness is recorded is still undecided.
- Charts use Recharts. Local development data: npm run db:seed:dashboard
  (fictional, DEMO-prefixed).

Drive calendar (implemented; see lib/calendar/):
- Visits are companies.visit_date (migration 0001); no separate table. Status
  (Upcoming / Today / Completed) is derived from the date, never stored.
- "Upcoming" lists visits dated today or later, and a company leaves it once its
  date passes. Today is computed in Asia/Kolkata.
- Limitation: one visit date per company at a time.
- lib/calendar/actions.ts authorises every change as ADMIN on the server.

When a decision changes, update this file and db/README.md along with any
relevant implementation, and commit the shared documentation so every
laptop and agent receives the same context.
