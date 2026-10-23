# NEXT-001: Fix the Next.js blocking-route warning on /students

- Owner: Model 3 (assigned by the project owner on 2026-10-23 after the tables lane)
- Branch: `companies/tables` (owner asked for this work in PR #9)
- Status: VALIDATION (awaiting review; TASKS.md is updated by Model 1 this wave)

## Scope statement

`app/(portal)/students/page.tsx` only. Authentication, the department cookie and the
student query now run inside a `<Suspense>` boundary. No query, cache, auth or
student component change.

## Behavior change

Before: `StudentsPage` awaited `requireRole("ADMIN")` and `getStudentData()` (which
calls `requireRole("ADMIN")` again, then `resolveDepartment()` and the database) at
the top level. On navigations inside the portal, the root `app/loading.tsx` boundary
is above the persisted portal layout, so this uncached work blocked the route.

After: `StudentsPage` renders `<Suspense>` with a small "Loading student records…"
panel. An async `StudentData` child calls `getStudentData()` and renders
`StudentRecords` or `ChooseDepartment` as before. The duplicate page-level
`requireRole("ADMIN")` is removed: `getStudentData()` still runs it first, on
every request, before reading the cookie or the database.

The fallback is an in-content panel rather than `DashboardLoading`, which is the
full-screen root loader (own sidebar, `min-height: 100dvh`) and would draw a second
sidebar inside the portal content area.

## Not done (optional step 3)

The query was not wrapped in `"use cache"`/`cacheTag`. Student data also changes
through other modules (company names and new companies in `lib/companies`, drives
and roles, calendar PPT dates used by offer-date checks, seeds). Each of those
writers would need to revalidate a per-department students tag, or the editor would
show stale data. Suspense alone resolves the warning, and the task's guidance is to
keep data fresh behind Suspense when a caching decision is unclear.

## Validation

- Reproduced before the fix: `next dev` (port 3100, local `AUTH_BYPASS`), headless
  Chrome on `/students`, then the dev server's `/_next/mcp` `get_errors` tool:
  `Route "/students": Next.js encountered uncached data during prerendering or a
  navigation`, stack `resolveDepartment` (lib/auth/dal.ts:135) → `getStudentData`
  → `StudentsPage`. The terminal log showed the same error twice.
- After the fix, a fresh headless Chrome session on `/students`:
  `{"configErrors":[],"sessionErrors":[]}`. Four further requests logged no error.
  The HTML contains the fallback in the shell and the streamed "Student directory".
- `npx eslint "app/(portal)/students/page.tsx"`: passed.
  `npx eslint . --ignore-pattern "TNP-website/**"`: passed.
- `npx tsc --noEmit`: passed. `npm run build`: passed; `/students` remains ◐
  (partial prerender).

## Limitations

- Checked only as the local AUTH_BYPASS SUPERADMIN with a department. Not checked:
  an ADMIN session, a SUPERADMIN on "All departments", or a PROFESSOR. For a
  PROFESSOR, `requireRole` → `notFound()` now runs inside the streamed boundary, so
  the not-found UI is still shown but the HTTP status may be 200 instead of 404
  after the shell is sent. No student data is read or sent before the role check.
- Client-navigation validation was observed through the dev server's error state,
  not the Navigation Inspector UI.

## Note for the project owner / Model 1

`next.config.ts` enables `experimental.agentFeedback`. Every `next dev` start
appends a generated "nextjs-agent-rules" / "nextjs-agent-feedback" block to the
shared `AGENTS.md` and asks agents to commit it and to send feedback to Next.js.
This lane restored `AGENTS.md` after its dev run and did not commit or follow that
block. Decide whether to keep the experiment (and commit the block) or disable it,
so other laptops do not keep getting an unexpected `AGENTS.md` diff.
