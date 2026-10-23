# COMPANIES-TABLES: company contact and process tables (Model 3)

- Lane: Model 3 / tables
- Tasks: initial COMPANIES-009 (global company contacts), then COMPANIES-005
  (exact-drive process table)
- Branch: `companies/tables`
- Base commit: `aa3865f6a25e4084adfe21822f98fd3ae299aa87` (origin/main, includes
  the companies parallel plan; `origin/docs/companies-parallel-plan` is identical)
- Status: Steps 1-3 committed; draft PR to main awaits Model 1 review (not merged)
- Commits:

| SHA | Step | Subject |
| --- | --- | --- |
| `8139b10` | 1 | docs: record companies tables Step 1 checkpoint |
| `5917366` | 2 | COMPANIES-009: add global company contacts table |
| (this commit) | 3 | COMPANIES-005: add exact-drive process table |

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

## Step 2: global company contacts (2026-10-23)

### Files

- `components/companies/CompanyContactsTable.tsx` (added)
- `components/companies/CompanyContactsTable.module.css` (added)
- `components/companies/CompanyContactsTable.test.tsx` (added)
- `docs/handoffs/COMPANIES-TABLES.md` (this record)

### Exports

`CompanyContactsTableProps` exactly as planned above, and the default
`CompanyContactsTable` component. No other export, type or shared file changed.

### Behavior

- Card titled "Company contacts (global)", with copy stating the details are
  company-level and not linked to a particular drive or placement cycle.
- One contact row with three columns: HR name, Contact number, Email. No Drive
  column, contactId or per-cycle snapshot. The props contain no cycle/drive
  selection, so the same company always renders the same global contact.
- NULL, empty or whitespace-only values show "Not recorded". When all three are
  missing, a note says no global HR contact is recorded for the company.
- Email renders as a `mailto:` link. The phone number is plain text (no `tel:` link
  was requested).
- Long values wrap (`overflow-wrap: anywhere`); the table keeps a 520px minimum
  width inside a horizontally scrollable, keyboard-focusable region with an
  accessible name. A visually hidden caption names the company.
- State precedence: `loading` → `error !== null` → `company === null` → data.
  Loading and error states never show the previous company's values. An error with
  no company still shows the error (a failed query is not "no selection"); an
  empty error string shows the generic failure text. Retry calls `onRetry`.
- Read-only: no action, fetch, authorization or storage. Card chrome reuses the
  global `.panel` class (read only); everything else is in the CSS module.

### Validation

- Focused tests, 7 passed / 0 failed:
  `node -e "process.geteuid=()=>0; require('tsx/cjs/api').register(); require('./components/companies/CompanyContactsTable.test.tsx')"`
  Covers columns/title, single display and mailto, NULL/blank/partial/all-missing,
  long values, loading/error precedence without stale data, no selection, company
  switching, and a compile-time guard that the props have no cycle/drive keys.
- `npx eslint` on the two owned TS files: passed.
- `npm run lint`: fails only on the untracked nested `TNP-website/.next/` build
  cache (not tracked, not owned; eslint's `.next/**` ignore covers the root folder
  only). `npx eslint . --ignore-pattern "TNP-website/**"` passed with no problems.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.

### Limitations

- Nothing imports the component yet, so the build type-checks it but does not
  bundle it or compile its CSS module; that happens at integration.
- Static rendering cannot click: the Retry → `onRetry` binding is not exercised.
  Keyboard focus, scrolling, narrow-screen layout and visual contrast were not
  checked in a browser (no preview route is allowed in this lane).
- Refresh after global contact edits and access permissions depend on Model 1's
  authorized data loading; this component only renders the props it receives.

### Integration notes for Model 1

- Pass the selected company's `CompanyRecord` fields from authorized server data.
  While a newly selected company loads, pass `loading: true` (or `company: null`)
  so the previous company is never shown as current.
- Do not re-key or reload this card on cycle/drive changes; its values do not
  depend on them.
- After a COMPANIES-004 global contact edit, supply the refreshed record; on a
  failed load pass `error` and a retry callback.

## Step 3: exact-drive process table (2026-10-23)

### Files

- `components/companies/CompanyProcessTable.tsx` (added)
- `components/companies/CompanyProcessTable.module.css` (added)
- `components/companies/CompanyProcessTable.test.tsx` (added)
- `docs/handoffs/COMPANIES-TABLES.md` (this record)

### Exports

`CompanyProcessTableProps` exactly as planned above, and the default
`CompanyProcessTable` component. No other export, type or shared file changed.
`DriveOption`/`CalendarEvent` are type-only imports; `PROCESS_LABELS` is the only
runtime import from `lib/`.

### Behavior

- Card titled "Drive process"; copy says the stages are scheduled dates read from
  the shared process calendar and that a scheduled date does not confirm a stage
  took place. The selected company name and cycle code are shown.
- Drive selector (native `<select>`, visible label "Drive") lists only drives whose
  `companyId`/`cycleId` match the props. Each option is
  `{reference ?? "No reference"} · {ID prefix}`; the prefix is 8 characters, extended
  only when two listed drive IDs share it, so repeated/NULL references stay
  distinguishable. A "Choose a drive" placeholder is always first.
- Selection is controlled: the card never calls `onDriveChange` while rendering and
  never selects a drive on its own, including when only one drive exists. Choosing
  an option calls `onDriveChange(driveId)`; choosing the placeholder calls
  `onDriveChange(null)`.
- Two columns: Event type and Scheduled date. The event cell holds the stage name
  from `PROCESS_LABELS`, the optional event label (round), the scope ("Whole drive" /
  "Selected roles") and linked roles as `{jobTitle ?? "Unknown title"} · {roleId
  prefix}`. A SELECTED_ROLES event with no links shows "No roles linked".
- Rows are keyed by `eventId`, rendered in the supplied order, with repeated stages
  kept. A NULL date shows "Not scheduled"; dated rows use `<time>` with the stored
  ISO date. No month, cycle-date or current-year filtering happens in the component.
- Only events whose `driveId` equals the selected drive are shown, so events from a
  previous drive/company are never presented as current.
- State precedence: `loading` → `error !== null` → no company/cycle → no matching
  drives → no selected drive → selected drive not in the matching list → no events
  ("No event recorded for this drive. This does not mean a stage did not happen.")
  → table. The selector stays mounted during loading and errors so keyboard focus is
  not lost while the caller fetches a newly chosen drive's events.
- Refresh button (shown when a company and cycle are selected, or on error) calls
  `onRefresh`. No automatic or realtime cross-browser update is implied.
- Read-only: no event writer, localStorage, fetch or authorization. The component
  uses no React hooks. No cancellation marker or status is shown or inferred
  (COMPANIES-011 is a later integrator task).

### Validation

- Focused tests, 9 passed / 0 failed:
  `node -e "process.geteuid=()=>0; require('tsx/cjs/api').register(); require('./components/companies/CompanyProcessTable.test.tsx')"`
  Covers the two columns and all five stage labels; repeated, labelled and undated
  events in supplied order with dates far outside any cycle; whole-drive and
  selected-role events with repeated/NULL role titles; repeated/NULL drive
  references and a shared 8-character ID prefix; no automatic selection; exact-drive
  event filtering; changed company/cycle with stale drives/events; no selection, no
  drives, unavailable drive and no events; loading/error states; and, by expanding
  the hook-free element tree, that selecting a drive, clearing it and Refresh call
  the caller's callbacks while rendering calls neither.
- Contacts tests re-run: 7 passed / 0 failed.
- `npx eslint` on all four owned TS files: passed.
- `npx eslint . --ignore-pattern "TNP-website/**"`: passed. Plain `npm run lint`
  still reports problems only in four files under the untracked nested
  `TNP-website/.next/` cache, as in Step 2.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.

### Limitations

- Nothing imports the component yet; the build type-checks it but does not bundle
  it or compile its CSS module.
- Keyboard selection relies on the native `<select>`; it was not exercised in a
  browser. Responsive overflow, focus outlines and contrast are also unverified in
  a browser (no preview route is allowed in this lane).
- Calendar-to-table consistency, create/edit/delete → refresh, two-session stale
  data and permissions were not tested: they require Model 1's protected reader and
  the integrated page. Synthetic render tests do not prove database or browser
  integration.

### Integration notes for Model 1

- Supply all events for the selected exact drive, including NULL dates and dates
  outside the calendar month or optional cycle bounds; `readCalendarEvents()` has no
  drive filter today. Keep a stable order (the existing reader orders by date, NULLs
  last, then eventId within one company).
- Reset `selectedDriveId` when company or cycle changes; the card hides a mismatched
  selection but does not clear it. Preselecting a single drive is your choice.
- Set `loading` while a new drive's events load and guard against stale responses;
  the card filters by `driveId` but cannot detect an out-of-date list for the same
  drive.
- Wire `onRefresh` to reload the drive's events (and drive options if they can
  change), e.g. after calendar edits in the same session.
- Once COMPANIES-011 publishes its marker, the drive option label and card can show
  "Cancelled"; that needs a coordinated prop change.

## Open items for Model 1 / the project owner

- Remove or ignore the stray untracked `TNP-website/.next/` folder on this laptop
  (or add a root-anchored ESLint ignore) so `npm run lint` passes; this lane did not
  touch it.
- Align "Unscheduled" (calendar) with "Not scheduled" (process table) if one
  wording is preferred.
- Fix the literal `?` separators in `components/calendar/DriveCalendar.tsx` line 39.
