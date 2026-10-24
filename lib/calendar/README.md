# Process calendar

The calendar reads `drive_events` and `event_roles` from PostgreSQL. `?month=YYYY-MM`
controls the visible date window; all undated events are also returned and displayed
in Unscheduled. Stage display names map to canonical PPT/OT/GD/RESUME_SHORTLISTING/PI.
No completed/passed/selected workflow status is recorded.

Every read calls requireUser and resolveDepartment. Events/drives have no department
targeting, so all signed-in roles may read these institute-wide stages. The page
computes canEdit = ADMIN or SUPERADMIN with non-null resolved department. Actions
independently recheck the database user and department on every call (authorizeDriveWrite);
PROFESSOR and all-scope cannot write. The same actions back the process-stage editor in
Companies → Drive process → Edit drives. No company contacts are written by event actions.

createEvent/updateEvent/deleteEvent use one transaction, parent drive FOR UPDATE first,
then event FOR UPDATE for update/delete. Role writers use the same parent-drive lock.
Validation enforces canonical stage, real ISO date or NULL, nullable trimmed label up
to 200 characters, WHOLE_DRIVE zero links, SELECTED_ROLES at least one distinct role,
and same-drive role membership. Updates atomically replace links; errors throw inside
the transaction for rollback. Event snapshots are JSON.stringify(CalendarEvent),
including the ordered role list. Moving to a different drive is rejected. Repeated
stages/dates and undated events remain distinct by event ID. Composite FKs are final
guards; application cardinality enforcement is not a database trigger guarantee.

readCalendarEvents is internal/auth-free for authorized page/action use; it queries
events then role links separately. getCalendarData is the authenticated public query.
The form picks an existing drive ID; no cycle/company/role is inferred or created.

Old browser-only data under mme-process-calendar-events:<scope> is no longer read or
shown (the read-only panel was removed); it stays untouched in browser storage. Saves
refresh the page data; there is no manual refresh button or realtime subscription.

The side panel's Upcoming companies section (lib/calendar/upcoming.ts) lists companies
with a dated stage from today through the next 5–30 days (toggle, remembered per
browser), ordered by first stage; the page loads today..today+30 separately from the
shown month. Undated stages never count. Unscheduled stages sit below it, collapsed.

Pure rule/label/local-parser tests pass. Isolated PostgreSQL rollback/concurrency and
two-browser behavior still require manual/integration verification; see MIG-008 handoff.
