# Company directory

`getCompanies` is the signed-in read query used by the dashboard's Companies
view. It accepts the current graduating year and returns companies linked
to an offer for a student in that batch, plus companies with no offers in any
batch. Companies linked exclusively to other batches remain excluded. The page
computes that year from the current institute calendar date. `updateCompany` is the ADMIN-only mutation for
existing companies; the company name is never accepted as an editable field
because it is the primary key referenced by offers.

The directory's **Add company** form calls `createCompany`, which rechecks ADMIN
authorization and inserts only a company row. It reuses student-editor name
validation and directory contact validation. Name is required; contact fields
are optional and PVR defaults to No (Unknown is still available). Duplicate
names are rejected without overwriting existing data. Successful writes refresh
the directory; offerless companies remain visible after reload. Contacts are
still global company fields, not batch-specific; explicit batch associations
and per-batch contacts are deferred. No migration is required.

The update validation is shared with calendar visit writes. It normalizes
contact fields, preserves PVR as Yes/No/Unknown (`true`/`false`/`NULL`),
accepts a nullable real ISO date, and rejects a visit date later than an
existing offer date. Student offer validation separately rejects offer dates
before the company's visit date.
