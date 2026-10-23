# COMPANIES-TABLES: company contact and process tables (Model 3)

- Lane: Model 3 / tables
- Tasks: initial COMPANIES-009 (global company contacts), then COMPANIES-005
  (exact-drive process table)
- Branch: `companies/tables`
- Base commit: `aa3865f6a25e4084adfe21822f98fd3ae299aa87` (origin/main, includes
  the companies parallel plan; `origin/docs/companies-parallel-plan` is identical)
- Status: Step 1 checkpoint recorded; Step 2 not started
- Commits:

| SHA | Step | Subject |
| --- | --- | --- |
| (this commit) | 1 | docs: record companies tables Step 1 checkpoint |

## Step 1: inspection checkpoint (2026-10-23)

### Git state

- Local main, origin/main and the remote main ref all resolved to the base commit
  above before branching. `git pull --ff-only origin main` was a no-op.
- No `companies/*` branch existed locally or on origin before this branch.
- The only local change outside this lane is an untracked `TNP-website/.next/`
  build cache inside the checkout. It is not owned by this lane and is never staged.

### Owned files (exclusive allowlist)

- `components/companies/CompanyContactsTable.tsx`
- `components/companies/CompanyContactsTable.module.css`
- `components/companies/CompanyContactsTable.test.tsx`
- `components/companies/CompanyProcessTable.tsx`
- `components/companies/CompanyProcessTable.module.css`
- `components/companies/CompanyProcessTable.test.tsx`
- `docs/handoffs/COMPANIES-TABLES.md`

No other file is edited by this lane. Read-only inspection covered the files listed
under "Inspected contracts" below.

### Public exports (planned, per docs/companies/PARALLEL-PLAN.md)

`CompanyContactsTable.tsx`:

```ts
import type { CompanyRecord } from "@/lib/companies/types";
export interface CompanyContactsTableProps {
  company: Pick<CompanyRecord,
    "companyId" | "name" | "hrName" | "phoneNumber" | "email"> | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}
export default function CompanyContactsTable(props: CompanyContactsTableProps): React.JSX.Element;
```

`CompanyProcessTable.tsx`:

```ts
import type { DriveOption } from "@/lib/drives/types";
import type { CalendarEvent } from "@/lib/calendar/types";
export interface CompanyProcessTableProps {
  company: { companyId: string; name: string } | null;
  cycle: { cycleId: string; code: string } | null;
  drives: DriveOption[];
  selectedDriveId: string | null;
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  onDriveChange: (driveId: string | null) => void;
  onRefresh: () => void;
}
export default function CompanyProcessTable(props: CompanyProcessTableProps): React.JSX.Element;
```

Type imports are type-only. The only runtime import from `lib/` is
`PROCESS_LABELS` from `lib/calendar/labels.ts`, which has no server dependency and
is already used by client calendar components. Neither component fetches,
authorizes, writes or stores data.

### Inspected contracts

- `lib/companies/types.ts`: `CompanyRecord` holds one global `hrName`, `email` and
  `phoneNumber` (all nullable) per company.
- `lib/drives/types.ts`: `DriveOption { driveId, companyId, companyName, cycleId,
  cycleCode, reference: string | null, roles: DriveRoleOption[] }`.
- `lib/calendar/types.ts`: `CalendarEvent { eventId, driveId, companyId,
  companyName, cycleId, cycleCode, driveReference, processType, scheduledDate:
  string | null, scope: "WHOLE_DRIVE" | "SELECTED_ROLES", label: string | null,
  roles: DriveRoleOption[] }`.
- `lib/calendar/labels.ts`: `PROCESS_LABELS` = PPT, OT, "Group Discussion",
  "Resume Shortlisting", PI.
- `lib/calendar/read.ts` / `queries.ts`: `readCalendarEvents()` reads a month
  window plus undated events, or one eventId, ordered by scheduled date (NULLs
  last), company name, eventId. Role links come from a separate query, so events
  are not multiplied. A company/cycle/drive filter does not exist yet; COMPANIES-010
  owns that reader extension.
- `lib/calendar/actions.ts` writes PostgreSQL `drive_events`/`event_roles`
  (MIG-008). This lane does not call it.

### Reused display patterns

- Drive identity: `{reference ?? "No reference"} · {driveId.slice(0, 8)}`
  (`components/calendar/EventForm.tsx`, `components/drives/DriveManager.tsx`).
- Role identity: `{jobTitle ?? "Unknown title"} · {roleId.slice(0, 8)}`.
- Scope: "Whole drive" / "Selected roles".
- Dates: ISO `YYYY-MM-DD` strings rendered as stored, never parsed through `Date`.
- Email: `mailto:` links, as in `components/companies/Companies.tsx`.
- Tables: `components/ui/table.tsx` primitives; visual treatment follows
  `companies.css` (scroll wrapper, `overflow-wrap: anywhere`, uppercase headers)
  but is written into each component's own CSS module. Colours use the existing
  `globals.css` variables (`--ink`, `--line`, `--muted`, `--accent`). These are the
  repository's first CSS modules; Next's types already declare `*.module.css`.

### Behavior decisions (approved by the project owner for this lane)

1. Stale-data guard: the process table renders only events whose `driveId`
   equals `selectedDriveId`, and only drives whose `companyId`/`cycleId` match the
   `company`/`cycle` props. The props do not change; this prevents a previous
   selection's rows from appearing as current.
2. No automatic selection: the process table never calls `onDriveChange` on its
   own, including when exactly one drive exists. A `selectedDriveId` that is not in
   the matching drives shows a "drive not available" state. The integrator may
   preselect a single drive if desired.
3. Wording: stage names come from `PROCESS_LABELS` unchanged. A NULL date shows
   "Not scheduled" (the task's wording; the calendar shows "Unscheduled").
4. Order: events render in the supplied order; the component does not re-sort.

### Validation tooling

- Available: `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Tests use `node:test` with the Windows workaround
  `node -e "process.geteuid=()=>0; require('tsx/cjs/api').register(); require('<file>')"`.
- No DOM/component test tooling exists (no jsdom or Testing Library), and no
  dependency is added. Approved approach: each `.test.tsx` renders the component
  with `react-dom/server` (already installed) under `node:test`, with an in-file
  `.css` require stub so the CSS-module import loads under `tsx`. This covers
  rendered states and text. Keyboard interaction, responsive overflow and real
  browser rendering are not covered by these tests; no preview route is allowed,
  so they are left to integration (see below).

### Notes for Model 1 (not changed by this lane)

- `components/calendar/DriveCalendar.tsx` line 39 renders literal `?` separators
  where `·` appears intended (encoding damage); `EventForm.tsx` uses `·`.
- `AGENTS.md` ("Process calendar (temporary client-only mode)") still describes
  browser-only calendar storage; MIG-008 now persists events in PostgreSQL.
- The calendar labels undated events "Unscheduled"; the process table will say
  "Not scheduled" per COMPANIES-005. Align them if one wording is preferred.
- The process table needs all events for the selected drive regardless of month
  or optional cycle dates; `readCalendarEvents()` cannot provide that today.

## Step 2: global company contacts

Not started. Awaiting "Continue Step 2".

## Step 3: exact-drive process table

Not started. Awaiting "Continue Step 3" after Step 2 review.
