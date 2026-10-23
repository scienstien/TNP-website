# Prompt for Model 3: company information tables

You are Model 3, working on a separate laptop in the NIT Tiruchirappalli historical
TNP dashboard repository. Implement your assigned components in separate reviewed
steps. Execute Step 1 now, then stop and wait for my explicit instruction to
continue Step 2. Do not implement the entire assignment in one turn.

Read AGENTS.md, TASKS.md's Companies panel section, and
docs/companies/PARALLEL-PLAN.md before editing. The last document contains the
owner-approved lane boundaries and initial exact prop interfaces. Inspect current
code and handoffs: older docs saying the calendar is only browser storage are stale.
Current calendar actions write PostgreSQL drive_events/event_roles; cross-browser
and database-concurrency acceptance still needs integration verification.

Your tasks are initial COMPANIES-009 (global company contacts), then COMPANIES-005
(exact-drive processes). Model 1/Codex owns protected queries, shared selection,
authorization and final composition. Model 2 owns both offer charts. Your components
receive data/callbacks and export the documented Props interfaces from their own
files; do not define another backend or shared schema.

## Step 1: inspect, branch and report; stop before implementation

Inspect git status and ownership. With a clean checkout, fetch origin, fast-forward
local main from origin/main and create `companies/tables`. Preserve unrelated dirty
work; never stash/reset/clean it to make branching convenient. If the publication
plan is not on origin/main yet, wait for it. Record the main base SHA.

Read company/schema/types, lib/drives/types.ts, lib/calendar/types.ts and labels,
existing calendar read/actions, table/style patterns and package scripts. Report
base SHA, the two tasks, exact owned files/exports/props, existing reusable patterns,
available checks and any unresolved contract mismatch. Record the checkpoint in
docs/handoffs/COMPANIES-TABLES.md. Do not edit TASKS.md: the owner assigned central
board updates to Model 1 to avoid cross-laptop conflicts. STOP before implementation.

## Step 2: global company contacts only, after I say continue Step 2

Implement CompanyContactsTable using the existing global company HR fields. Three
columns: HR name, Contact number, Email. Title it Company contacts (global).
Display a company's supplied information once, with Not recorded for missing
fields, readable long values, responsive overflow and useful email links.
Handle no company, loading, error/retry and partial/all-missing contact data.

The owner explicitly deferred the drive HR schema: COMPANIES-008 is PAUSED. Do not
add multiple contacts, a Drive column, contactId, migrations or invented historical
rows. Do not copy current global contacts to each drive. Selecting another cycle
or drive does not change that company's global HR. Future multiple contacts per
drive remain a later phase; current contact editing is a separate existing task.
Your card is read-only and has no create/update/delete action or direct database call.

Run lint/type-check and meaningful available validation for company changes, NULLs,
long values and unchanged global data across cycle/drive changes. Record any browser
limits; do not add dependencies. Update your handoff, commit only the contacts
component/CSS/coverage/handoff. STOP for review before the process component.

## Step 3: exact-drive process table, after I say continue Step 3

Implement CompanyProcessTable with the documented controlled props and existing
DriveOption/CalendarEvent types. Show an exact-drive selector inside the selected
company and top-level cycle. Distinguish repeated drives and NULL/duplicate
references using reference plus a stable ID label. Do not arbitrarily pick the
first drive when several exist. Call onDriveChange; selection state is Model 1's.

Two table columns: Event type and Scheduled date. Use existing display mappings
for PPT, OT, GD, Resume shortlisting and PI. Keep scope, selected roles, round/label
information inside the event cell. Use eventId as identity; retain repeated stages
and undated events. NULL date means Not scheduled; absent event means No event
recorded. A scheduled/past date never proves attendance or completion.

Receive events from the shared persisted calendar source through Model 1's data
layer. Do not filter rows to the calendar's visible month, optional cycle dates
or today's year. No localStorage persistence or event writer. Provide Refresh
through onRefresh; do not claim automatic realtime cross-browser updates.
Calendar deletion removes that event only, never the drive/company/sibling events/
offers. Cancellation retention is approved but its schema extension is a later
integrator task: do not invent a status field or infer cancellation from missing
events. Future marker integration will be coordinated after this PR is merged.

Check repeated/undated/selected-role events, no drives, no selected drive, empty
events, loading/error/refresh, changed company/cycle/drive props and keyboard
selection. Model 1 will validate real calendar-to-table consistency after merging;
do not claim database/browser integration from synthetic component checks alone.
Update your handoff; make a second focused commit; push companies/tables and open
or update a draft PR targeting main if tools/access permit. Never merge it. If
GitHub tools are unavailable, return branch/SHA and a reviewable proposed PR body.
STOP without starting other tasks.

## Exclusive edit allowlist

- components/companies/CompanyContactsTable.tsx
- components/companies/CompanyContactsTable.module.css
- components/companies/CompanyContactsTable.test.* (only useful existing tooling)
- components/companies/CompanyProcessTable.tsx
- components/companies/CompanyProcessTable.module.css
- components/companies/CompanyProcessTable.test.* (same restriction)
- docs/handoffs/COMPANIES-TABLES.md

Do not touch Companies.tsx, any app route/layout, chart components, shared
header/directory/controller components, companies.css, global styles,
components/ui, lib/**, db/**, drizzle/**, authentication, calendar/drive writers,
student/dashboard modules, package manifests/lockfiles, TASKS.md, AGENTS.md or
shared documentation. Read-only inspection is fine. Ask Model 1 for a coordinated
contract change through your handoff; do not edit another owner's file or add
another data service, preview route, dependency or live recruitment feature.

Stage only owned named files; no git add ., forced rebases/pushes, or main pushes.
Your unique handoff records base/current SHAs, each completed step, public exports,
changed files, commands/results, limitations and work required from the integrator.
