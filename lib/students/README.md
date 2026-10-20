# Student records

`getStudentData()` requires ADMIN and returns names, integer roll numbers, batch
years, optional offers (decimal LPA strings), and existing company choices.
Professor analytics remain name-free. `StudentRecords` renders only these persisted
rows; add/edit forms keep clearly marked drafts until the server saves them.

`createStudent`, `patchStudent`, `removeStudentOffer`, and `deleteStudent` are
Server Actions. Each rechecks the database-backed role before validation or writes.
Patch accepts only name, batchYear, and allowlisted offer fields. Roll is immutable.
Names are normalized natural-name strings of 1–100 Unicode characters; nine-digit
rolls and four-digit batches are strictly parsed. No exponent, fractional, signed
or zero-prefixed identifiers are accepted. Optional dates are real ISO dates.
Package inputs are nonnegative plain-decimal strings, never parsed to floats for
storage. Nullable offer fields can be explicitly cleared; omitted fields are untouched.

Select an existing company or use **Create new company** beside the selector.
`createStudentCompany` checks ADMIN and validates a 2–120 character company name
and optional sector (up to 80 characters), then inserts without overwriting an
existing company. Duplicate names return a field error. No contacts or visit date
are invented. After the database confirms creation, the company is selected and
the student draft remains intact. Company creation is a separate explicit save;
cancelling the student draft does not delete the company.
Existing company profiles/sectors cannot be edited here.
Offer existence defines placement status, independently of nullable offer type.
No package/date defaults are invented. Deleting an offer requires confirmation;
deleting a student is blocked until there is no offer.

Writes run in a transaction and lock the student row. Updates/removals compare an
expected serialized snapshot to the current database record. Stale drafts return an
error; Cancel and reopen to load fresh values. Unique/FK constraints remain the final
concurrency guard. Errors preserve the draft; successful writes revalidate `/` and
refresh server props, including dashboard analytics. External DB edits require refresh.

The old local-only CSV importer and legacy editors were removed. Importing files is
a separate workflow requiring actual source inspection and the same validation rules.

## Verification

Run shared-validator tests with `npx tsx --test lib/students/validation.test.ts`,
then `npm run db:check`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

Local integration verification covered 28 browser/HTTP checks: invalid drafts and
forged payloads, persistence/reload, optional offers, field-only updates, dashboard
refresh, stale edits, guarded removal, and denied professor/signed-out mutations.
Ten direct PostgreSQL constraint checks ran inside rolled-back transactions.
Disposable accounts, companies, students, and offers were removed afterward.
