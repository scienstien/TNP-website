# Company directory

`getCompanies(cycleId: string | null)` uses explicit existing placement cycles. With a
cycle it includes companies with a drive in that cycle, OR same-cycle final offers
to UG enrollments in the chosen department, OR no offers anywhere. All-scope reads
apply the UG/cycle predicates across departments. Without a cycle it lists global
contacts with no cycle-specific columns. No batch filter or date-derived cycle.

`getCompanyCycles()` lists `{ cycleId, code }` by code descending. The route validates
`?cycle=<uuid>` against these rows. Empty lists never cause cycle creation.

`CompanyRecord.companyId` is the stable editor/React identity. Names remain read-only.
`updateCompany(companyId: unknown, input: unknown, expected: unknown)` locks that company
FOR UPDATE and compares the JSON client snapshot's ID, name and all company fields.
The derived visitDate is excluded from that contact comparison because saves neither
read nor overwrite events. Renames or contact changes reject stale saves. Returned
records have visitDate null; a route refresh loads the selected cycle projection.

ADMIN/SUPERADMIN writes require a chosen department; contacts are global and the UI
states this. All departments is read-only. New PVR defaults to Unknown (NULL); Yes/No/
Unknown round-trip. Duplicate-name creation never overwrites contacts.

Any visitDate key is rejected on create/update. Company saves touch only companies;
there is no PPT/offer ordering restriction. `visitDatesByCompany` retains its cross-lane
signature and earliest non-null PPT-per-company meaning. No migrations or seeds run.
