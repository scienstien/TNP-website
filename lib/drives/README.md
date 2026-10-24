# Historical drives and roles

Institute-wide records, with no department column or inferred ownership. There is no
separate drives page (the old `/companies/drives` was merged into the company directory):
drives are drafted in "Add company" (saved with the company in one transaction by
createCompany) and changed with "Edit drives" in the expanded company's Drive process
card, which also edits each drive's process stages through lib/calendar/actions. ADMIN
and SUPERADMIN with a chosen department may write drives, roles and stages
(authorizeDriveWrite/canManageDrives). All departments is read-only. Every mutation
rechecks the current database user and resolved department. Creating a drive (createDrive
or createCompany's `drives`) requires `jobTitles` with at least one non-blank title and
accepts optional `stages: { processType, scheduledDate, label }[]`, inserted as
WHOLE_DRIVE drive_events (every role in a drive shares its process) in the same
transaction. The UI warns before creating a drive without stages (dates can be added
later on the Calendar page or in Edit drives). Deleting a drive's last role is rejected.
loadCompanyDriveOptions(companyId) reads one company's drives and their events.

Pure option types live in types.ts. readDriveOptions(connection, filter) has no auth:
callers authorize first. It works with Database or Transaction and uses two queries
(drives, then roles), ordered cycle code descending/company name/reference nulls last/
drive ID. Roles are ordered title nulls last/role ID. getDriveOptions authorizes ADMIN
(including SUPERADMIN); invalid UUID filters return []. Empty results stay empty.

Create uses explicit existing company/cycle IDs. Company and cycle are fixed; update
changes reference only. Roles may repeat titles or have NULL titles; updates change
jobTitle only. References/titles are trimmed, nullable and at most 120 characters.
All updates/deletes check JSON snapshots under locks. Drive snapshots are DriveOption;
role snapshots are DriveRoleOption. All role/event mutations lock the parent drive
before children. Delete checks references explicitly, with FK RESTRICT as final guard;
23503 maps to the same reference message. No cycle creation or live recruitment state.

Public contracts and validation limits are in docs/handoffs/MIG-007.md. Pure rules
are tested; PostgreSQL concurrency and browser behavior still require isolated testing.
