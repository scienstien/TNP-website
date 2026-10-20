# Company directory

`getCompanies` is the signed-in read query used by the dashboard's Companies
view. `updateCompany` is the ADMIN-only mutation for existing companies; the
company name is never accepted as an editable field because it is the primary
key referenced by offers.

The directory's offer count is derived with a left join against
`placement_offers`, so companies with no offers appear with `0` and the count
always reflects the current historical records.

The update validation is shared with calendar visit writes. It normalizes
contact fields, preserves PVR as Yes/No/Unknown (`true`/`false`/`NULL`),
accepts a nullable real ISO date, and rejects a visit date later than an
existing offer date. Student offer validation separately rejects offer dates
before the company's visit date.
