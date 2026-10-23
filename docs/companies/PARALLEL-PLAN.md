# Companies panel: three-laptop execution plan

Owner requested this division on 2026-10-23. Read AGENTS.md and the Companies
section of TASKS.md first. This document is the initial component-prop checkpoint
for COMPANIES-010. It becomes available to workers when committed on origin/main.
No components, protected queries or database changes are implemented by this plan.

## Ownership and branches

| Lane | Tasks in this component wave | Branch | Exclusive files |
| --- | --- | --- | --- |
| Model 1 / Codex integrator | COMPANIES-002, 003, 010 | `companies/integration` | Company header/cycle selector/directory/controller, Companies.tsx, company page route, lib/companies reads/panel types, authorized calendar read extension, company README, TASKS.md |
| Model 2 / charts | COMPANIES-006, then 007 | `companies/charts` | CompanyOfferHistoryChart.tsx, CompanyOfferDistribution.tsx, each component's own CSS module and focused coverage, docs/handoffs/COMPANIES-CHARTS.md |
| Model 3 / tables | Initial COMPANIES-009, then 005 | `companies/tables` | CompanyContactsTable.tsx, CompanyProcessTable.tsx, each component's own CSS module and focused coverage, docs/handoffs/COMPANIES-TABLES.md |

Reserve only these files, not the whole components/companies directory. Each worker
exports its component props/row types from its own component file as specified
below. The integrator imports those types with type-only imports when needed;
workers do not create competing lib/companies/panel-types.ts files. Backend DTOs
must satisfy these props. Component imports of existing types are type-only.

Model 1 is the sole TASKS.md editor. This is the owner's explicit coordination
exception to workers independently editing task status: worker assignments are
recorded there; each worker reports its start, checkpoint, validation and commit
in its unique handoff; Model 1 updates the central board when integrating.

COMPANIES-004 stays in the existing backlog. COMPANIES-008 is PAUSED, including
the future per-drive phase of 009. COMPANIES-011 cancellation is an approved later
integrator task, outside the simultaneous component wave: it will edit shared
schema/contracts and component displays only after these component PRs are merged.
Do not implement cancellation fields or drive HR schemas during this wave.

## Shared product rules

- Explicit companyId and cycleId identify the selection. Drives are separate
  driveIds within a cycle; references/titles can be NULL or repeated.
- Counts mean stored final reported offers per enrollment, not every offer ever
  issued, unique people or applicants. Do not infer cycles from dates or batches.
- The company charts cover recorded UG and PG programmes with server-authorized
  department scope. The integrator enforces that scope and sends aggregates only.
- History bars cover all recorded company cycles; the donut follows the selected
  top-level cycle. The process table additionally chooses an exact drive.
- The contact card initially uses the company's single GLOBAL HR name/phone/email.
  Label it "Company contacts (global)". No Drive column or historical attribution.
  Future multiple contacts per drive remain documented, but their schema is paused.
- All-role donut counts include offers with no role/drive. Specific selections use
  roleId; same-title roles remain distinct using drive/reference/ID labels. Gender
  and reservation-category NULLs belong to a "Not recorded" bucket.
- Process dates are scheduled dates. Repeated events remain separate rows and
  NULL dates remain visible. Missing events do not mean a stage did not happen.
- Calendar and process table use the same persisted event IDs/data. Deleting one
  event never deletes/cancels its company/drive/siblings/offers. Future cancellation
  retains the drive and marks it Cancelled; that marker is not in today's schema.
- Keep current access boundaries. The company page currently requires ADMIN or
  SUPERADMIN; department aggregates cannot leak other departments. All-scope is
  read-only. Existing event writes remain SUPERADMIN/chosen-department only.
- No recruitment-management flows, extra KPIs, packages/dependencies, database
  resets, migrations, seeds, real student records or credentials in this wave.

## Initial prop checkpoint

These definitions specify public interfaces, not code to paste into shared files.
Each component exports its own named Props interface and its named row/option
interfaces from its owned TSX file, and a default component export. `company` and
`cycle` shapes below are inline prop types, not duplicate runtime implementations.
The integrator supplies data and callbacks; components do not fetch or authorize.
Use the repository's existing CompanyRecord, DriveOption and CalendarEvent types.

### Model 2: history

```ts
export interface CompanyOfferCycleRow {
  cycleId: string;
  cycleCode: string;
  offerCount: number;
}
export interface CompanyOfferHistoryChartProps {
  company: { companyId: string; name: string } | null;
  scopeLabel: string;
  rows: CompanyOfferCycleRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}
```

Rows arrive in stable display order; render them in that order. Distinct recorded
company cycles are represented through drives or authorized final offers. A drive
cycle can have zero recorded final offers. Unrecorded years are not invented zeros.

### Model 2: donut

```ts
export type CompanyOfferDimension = "department" | "gender" | "reservationCategory";
export interface CompanyOfferRoleOption {
  roleId: string;
  driveId: string;
  driveReference: string | null;
  jobTitle: string | null;
}
export interface CompanyOfferBucket {
  key: string;
  label: string;
  count: number;
}
export interface CompanyOfferDistributionProps {
  company: { companyId: string; name: string } | null;
  cycle: { cycleId: string; code: string } | null;
  scopeLabel: string;
  dimension: CompanyOfferDimension;
  selectedRoleId: string | null; // NULL means All roles
  roleOptions: CompanyOfferRoleOption[];
  buckets: CompanyOfferBucket[];
  totalOffers: number;
  missingRoleCount: number;
  loading: boolean;
  error: string | null;
  onDimensionChange: (dimension: CompanyOfferDimension) => void;
  onRoleChange: (roleId: string | null) => void;
  onRetry: () => void;
}
```

Dimensions and role selection are controlled. Do not filter student data inside
the component or derive a different denominator. Buckets sum to totalOffers for
the selected dimension and role. missingRoleCount describes missing role links in
the company/cycle population; do not add it to bucket counts. The integrator
resets invalid role selections and protects against stale asynchronous responses.

### Model 3: initial global contacts

```ts
// import type { CompanyRecord } from "@/lib/companies/types";
export interface CompanyContactsTableProps {
  company: Pick<CompanyRecord,
    "companyId" | "name" | "hrName" | "phoneNumber" | "email"> | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}
```

Three columns only: HR name, Contact number, Email. Existing one-company contact
fields are displayed once, never repeated against each drive. Same company means
the same global contacts across cycle/drive selection.

### Model 3: exact-drive processes

```ts
// import type { DriveOption } from "@/lib/drives/types";
// import type { CalendarEvent } from "@/lib/calendar/types";
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
```

Two columns: Event type and Scheduled date. Keep scope/role/round/label information
inside the event cell. Event rows correspond to the selected exact drive. The
integrator queries all its events, including undated events and dates outside the
calendar's displayed month or optional cycle bounds. Use existing calendar label
mappings. Do not introduce another event writer or month-limited data fetch.

For all cards: distinguish no selection, loading, query failure/retry and empty
successful data. Do not display the previous selection's data as current while
loading. Render useful accessible text in addition to graphics. Styling uses each
component's own CSS module; retain existing design variables and patterns.

## Step checkpoints and integration

1. After this documentation is on main, all three laptops fetch and branch from
   the same main commit. First inspect, report scope/exports/file list and stop.
   The owner explicitly says "continue Step 2" to that laptop when ready.
2. Model 2 implements ONLY history bars; Model 3 implements ONLY global contacts.
   Model 1 starts protected reads/shared controls. Validate, make one focused
   commit, write the lane handoff, and stop for review before the next component.
3. After "continue Step 3", Model 2 implements the donut; Model 3 implements the
   process table. Validate and commit separately; open/update a draft PR to main
   if GitHub access exists, otherwise return branch/SHA and exact PR instructions.
   Do not merge your PR or start another task.
4. Model 1 reviews each lane, merges sequentially through the agreed PR workflow,
   then wires components into Companies.tsx. No shared-file conflict is resolved
   by rewriting another lane's work. Freeze prop changes until all affected
   owners agree via committed docs/handoffs.

Workers may use fictional local fixtures and existing test/preview facilities,
but must not commit a demo route, alter the shared shell, or add test dependencies
to demonstrate a component. Run lint, TypeScript and relevant meaningful checks;
report unavailable database/browser checks explicitly. Real calendar/table and
permission integration is Model 1's responsibility after merging.

## Git rules for all laptops

Inspect dirty work before doing anything. Never stash/reset/clean/switch over
unrelated changes. With a clean checkout use:

```text
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c companies/charts    # Model 2; Model 3 uses companies/tables
```

If main cannot fast-forward or the chosen branch already exists, inspect and
report instead of forcing it. Record `git rev-parse HEAD` as the base SHA in your
handoff. Later updates use explicit reviewed merges from origin/main; do not
rebase or force-push a shared/published branch. Stage named owned files only,
not `git add .`. Push your branch, never directly to main. PRs target main and
include tasks, changed files, exports, actual check results and remaining gaps.

TASKS.md and shared docs are integrator-owned. Workers write only their named
handoff document, including progress after each step, commits and conflicts.
Model 1 records publication/base/merge SHAs in handoffs so another laptop can
reproduce the agreed state without chat history.
