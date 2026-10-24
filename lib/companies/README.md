# Company directory

The Companies panel composes CompanyPageHeader and CompanyPanelController. It
keeps the directory editor and loads history, demographic distribution, process
and contacts independently, plus separate role compensation and offer-type cards.
Department scope comes from server authentication, never a client department ID.

`getCompanies(cycleId)`: All cycles lists every company master; an explicit cycle
requires a retained drive, including zero-offer companies. Contacts/drives/roles
are institute-wide. The old offer/UG/no-offer fallback has been removed.

`getCompanyCycles()` lists `{ cycleId, code }` by code descending. The route validates
`?cycle=<uuid>` against these rows. Empty lists never cause cycle creation.

`CompanyRecord.companyId` is the stable editor/React identity. Names remain read-only.
`updateCompany(companyId: unknown, input: unknown, expected: unknown)` locks that company
FOR UPDATE and compares the JSON client snapshot's ID, name and all company fields.
The derived visitDate is excluded from that contact comparison because saves neither
read nor overwrite events. Renames or contact changes reject stale saves. Returned
records have visitDate null; a route refresh loads the selected cycle projection.

ADMIN/SUPERADMIN writes require a chosen department; contacts are global and the UI
states this. `createCompany` also accepts `drives: { cycleId, reference, hrName, hrEmail,
hrPhoneNumber, roles: { jobTitle, domain }[], stages }[]` and inserts them in the
company's transaction; a duplicate name creates nothing. Adding a company with no drive
asks for confirmation. Each drive's HR contact (required) is stored on `drives`; the
legacy `companies` HR columns are no longer edited (new companies get NULL, and the
company edit form sends stored values back unchanged). `companies.domain` is shown as
the company's Description only and is not searched, filtered or charted. All departments is read-only. New PVR defaults to Unknown (NULL); Yes/No/
Unknown round-trip. Duplicate-name creation never overwrites contacts.

Any visitDate key is rejected on create/update. Company saves touch only companies;
there is no PPT/offer ordering restriction. `visitDatesByCompany` retains its cross-lane
signature and earliest non-null PPT-per-company meaning. No migrations or seeds run.


## Protected panel reads

- offer-history counts final REGISTERED offers across UG and PG, per explicit cycle;
  company drive cycles remain visible with zero offers. No date-based cycle inference.
- offer-distribution groups that population by department/gender/reservationCategory
  and exact role. The Department view is an institute-wide aggregate so it can show
  the cross-department composition; Gender and Reservation category remain scoped to
  the authenticated department. Missing demographics have a Not recorded slice; All
  roles includes offers without roles. Its total is independently counted and
  reconciled.
- panel-queries authorizes then reuses readDriveOptions for exact company/cycle.
  Repeated/NULL titles and zero-offer roles retain stable IDs. Process validates the
  selected drive and reads all its shared calendar events with no date window.
- offer-summaries returns only aggregates: role offer count, known annual package
  count, SQL median/min/max (LPA), and typed/unknown offer counts. The offer-type
  card also reports annual-package and monthly-stipend median/ranges independently
  for each FTE, FTE+6month, PPO, or unknown type. Offer types have their own role
  filter, independent of the donut.
- panel-actions exposes reads as protected Server Actions; each delegated query
  rechecks authorization. Independent key/retry generations prevent late responses
  replacing the current scope/company/cycle/role/dimension.

  The HR contacts card lists each drive's HR contact (drives.hr_*, 0006) for the selected
  cycle from the same drive read as the process card; the legacy global contact is not shown.

See ../../docs/handoffs/COMPANIES-MODEL1.md for coverage and remaining live-session checks.
