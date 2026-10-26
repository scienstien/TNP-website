# Outreach contact tracker

The Outreach page is a lightweight contact/to-do list. Signed-in professors
have read-only access to their assigned department; administrators can read all
departments and create, edit and delete entries after choosing one. Its
`outreach_contacts` records are intentionally independent of `companies`,
students, offers, placement analytics and the calendar. A prospective company
can therefore be tracked before it exists anywhere else in the portal.

Every create, update and delete action rechecks the authenticated database role
as `ADMIN`. PVR defaults to No. `updated_at` is set when a row is created and is
refreshed by the server on every edit.
