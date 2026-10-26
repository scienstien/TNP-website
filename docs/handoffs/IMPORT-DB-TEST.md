# Strict import templates: database acceptance

Tester: independent database tester, 2026-10-25.

## Isolation

All writes ran against a newly created `tnp_import_test_*` database on the local
PostgreSQL 17 container. Migrations 0000–0008 were applied to that empty database.
The application's existing database and Docker volume were not reset or deleted.
Fixtures contain fictional people, companies and authentication accounts only.
Connection credentials remain in an untracked mode-0600 file under `/tmp`.

The committed harness refuses to run unless `IMPORT_TEST_DATABASE_URL` explicitly
names a `tnp_import_test_*` database. It does not fall back to the application's
`DATABASE_URL`, does not truncate tables, and does not delete previous import rows.
It creates minimal approved catalogue fixtures and a unique administrator per run.

## Repeating the database tests

Create a separate empty PostgreSQL test database, apply the project's migrations,
and set `IMPORT_TEST_DATABASE_URL` to its connection string. Then run:

```sh
node --import tsx --test lib/import/database.integration.test.ts
npx eslint lib/import/database.integration.test.ts
```

The harness replaces `DATABASE_URL` with that explicit isolated URL before loading
the application database module. No production credentials belong in a command
committed to this repository.

## Results

The initial completed database run passed **18 of 18 tests**, including actual
PostgreSQL reads after import, rather than mocked persistence:

- Preview leaves no company, enrollment, offer or import-history rows behind.
- Confirmed companies preserve unrelated legacy contacts and PVR values.
- Identical imports skip records; duplicate input keys reject the whole file.
- Headers, column counts, values and catalogue references are validated.
- A cohort template matches an approved programme and creates one requested year.
- Students retain explicit historical graduation/admission years and nullable
  demographics; absent historical records remain intact.
- Unknown programmes/cohorts/cycles/classifications and conflicting identities fail.
- Offers require registered participation and consistent company/drive/role links.
- Conflicting final offers, including those in another cycle, are rejected.
- A professor, unknown account, forged role and mismatched department are rejected.
- A role revoked after preview prevents confirmation.
- Database changes after preview invalidate the reviewed plan.
- A deliberately injected deferred PostgreSQL commit failure rolls back every
  imported row and its import-history entry. Its test-only trigger is removed.
- One new roll in multiple cycles creates one person and enrollment, with a stable
  preview plan despite generated UUIDs.
- Concurrent duplicate confirmations commit exactly one company row.
- Concurrent offer and unregistration imports preserve registration compatibility.
- The actual Student Records editor and import confirmation share enrollment
  locking; concurrent changes cannot leave an offer on unregistered participation.

Focused ESLint passed. The main implementation owner runs repository-wide checks.

## Browser/database reconciliation

Pending the browser tester's final upload run and an independent SQL comparison of
the exact imported fixture rows, dashboard aggregates and import-history counts.
The database tester has not granted final acceptance until that comparison agrees.
