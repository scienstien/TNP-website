# Historical placement schema

`schema.ts` defines PostgreSQL tables using the installed Drizzle ORM and
PostgreSQL stack. `index.ts` exports the typed Drizzle database instance as
`db` and its underlying postgres-js connection as `postgresClient`. In Next.js
development, the connection is reused across hot reloads.

## Local database workflow

1. Copy the example environment file and review its development-only values:

   ```sh
   cp .env.example .env
   ```

   Keep `DATABASE_URL` aligned if the PostgreSQL user, password, database, or
   host port changes. The untracked `.env` file is read by both Docker Compose
   and the database scripts.
2. Start the local PostgreSQL 17 container and check its status:

   ```sh
   npm run db:up
   docker compose ps
   ```

   Docker Desktop users on WSL must first enable integration for this distro.
   PostgreSQL is exposed only on `127.0.0.1` and stores its files in the named
   `tnp_postgres_data` volume.
3. Apply all committed migrations once PostgreSQL reports healthy:

   ```sh
   npm run db:migrate
   ```

4. Optionally load the small fictional smoke-test dataset:

   ```sh
   npm run db:seed
   ```

   The seed is safe to rerun: it updates only its fixed fictional records
   (DEMO company names and nine-digit 9xx roll numbers) and
   preserves unrelated data. On a fresh database it creates five companies,
   seven placed students and four unplaced students in the 2026 batch.
   All records are fictional; this is not a complete historical eligible roster.
   It does not create an authentication user.
5. Stop the container without removing its persisted data:

   ```sh
   npm run db:down
   ```

   `npm run db:logs` follows the PostgreSQL logs. Running
   `docker compose down -v` also deletes the named volume and all local database
   data, so use it only when an intentional reset is required.

## Schema change workflow

1. After changing `schema.ts`, create a named migration with
   `npm run db:generate -- --name <migration_name>`.
2. Review the generated SQL and metadata in `drizzle/`, then validate the
   migration history with `npm run db:check`.
3. Commit the schema and generated migration artifacts together.
4. Apply committed migrations with `npm run db:migrate` only after confirming
   that `DATABASE_URL` points to the intended running PostgreSQL database.

Use committed migrations for schema changes; do not use `drizzle-kit push`.
Drizzle Studio is available through `npm run db:studio` when a database is
running. The initial migration is generated for an empty database and has not
been applied by this setup.

## Confirmed departmental rules

- Only eligible MME students are recorded. All historical batches share tables;
  `students.batch_year` identifies the graduating batch.
- Student roll number is the student primary key. Company name is the company
  primary key; imports must normalize names and review ambiguous matches.
- Student roll numbers are nine-digit integers (100000000–999999999).
  Names are required, trimmed, 1–100 characters; batches are four-digit integers.
  The student editor's stricter natural-name validation rejects digits/symbols
  other than spaces, apostrophes, periods and hyphens.
- A student has zero or one offer. Each offer belongs to exactly one student
  and one company. A company can exist with zero offers and have many offers.
- Offers use `(company_name, student_roll_number)` as their composite primary
  key, plus a separate unique constraint on `student_roll_number`. There is no
  `offer_id`. Both key columns are foreign keys.
- Referenced key updates cascade. Deleting a referenced student or company is
  restricted so historical offers are not silently deleted.
- Placement status is derived from offer existence: `PLACED` or `UNPLACED`.
  It is not independently stored. Offer type is `PPO`, `FTE`, or `FTE+6month`.
- Compensation belongs to the individual offer, in LPA. PostgreSQL numeric
  preserves precision; Drizzle reads it as a string.
- Keep offer date. Exclude company profile, joining date, and user is_active.
- PVR status is a yes/no field. A missing source value remains NULL, not false.
- Non-key source details, including the admin-editable company `remarks` field,
  are nullable to preserve missing historical data.
  Student names and batch years are exceptions: both are required.
- Placement rate is students with offers divided by all recorded students in
  the batch. Publish it only after confirming the complete eligible roster;
  an empty batch has no defined percentage.
- Users are for authentication only. PROFESSOR is the default role and has
  read-only access. Server-side authorization must be implemented separately.

## Remaining decisions and integration

- No historical source files were available during this schema implementation.
  Validate import mappings and available values against the actual dataset.
- The exact meaning of PVR and whether it describes a company or contact is
  unresolved. It is stored alongside the company's single contact fields for
  now; no additional interpretation is encoded.
- `placement_year` is omitted until a distinct placement-cycle meaning is
  confirmed. Calendar year can be derived from `offer_date`.
- The repository includes Auth.js but has no authentication implementation yet.
  The users table is a domain definition, not a complete Auth.js adapter schema.
  Password hashes are nullable for provider-based authentication. The auth owner
  must select the provider/session strategy and integrate the required tables.
- Schema exports use camelCase TypeScript property names and snake_case SQL
  column names. Database deployment and UI integration remain separate work.

## Company visit date

`companies.visit_date` (nullable `date`, migration `0001_company_visit_date`) records when a
company visits campus, for the drive calendar. NULL means no visit is scheduled. It holds one
date per company and is separate from historical offers. Clearing it removes the visit from the
calendar without touching the company or its offers.

## Company remarks

The ADMIN company directory can create standalone `companies` rows with no
offers. It lists current-batch companies alongside companies with no offers in
any batch. Contact fields remain global; explicit batch associations and
batch-specific contact storage are deferred. This behavior requires no schema
change and does not create student, offer, or outreach records.

`companies.remarks` (nullable `text`, migration `0003_company_remarks`) stores optional admin
notes about a company. It is editable only through the admin Companies view and is not used in
placement analytics. The PVR editor presents `No` first while preserving `Unknown` for an
explicitly unresolved value.

## Outreach contacts

`outreach_contacts` is a contact/to-do list that is deliberately independent of
`companies`, students, offers, analytics and the process calendar. Signed-in
professors can read it; only administrators can create, edit or delete entries.
It stores a free-form company name, optional HR contact details, PVR status,
remarks and an automatically maintained `updated_at` timestamp. PVR defaults to
false (No). No foreign keys connect these records to placement data.

## Student identity migration (0002)

This migration converts student roll numbers and offer references from text to
integer and adds roll-range, required-name and batch-range constraints. It preserves
keys and foreign-key behavior. Preflight blocks invalid legacy rolls/names/years;
resolve those explicitly before migration. Existing migration files remain intact.
The approved local DEMO cleanup was a separate operation, not migration SQL.

The seeds now use valid nine-digit fictional rolls and non-null names. They are
optional and must not be run on a database containing real students in those ranges.
No seed is run automatically after migration. Student editing is documented in
`lib/students/README.md`.
