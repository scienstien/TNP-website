# Companies Panel: Model 2 (Charts Lane) Handoff

- **Lane**: Model 2 / Charts
- **Branch**: `companies/charts`
- **Base Commit**: `aa3865f6a25e4084adfe21822f98fd3ae299aa87` (`docs: coordinate three-laptop companies panel development`)
- **Status**: COMPLETE (COMPANIES-006 & COMPANIES-007 Implemented and Validated)

---

## 1. Summary of Delivered Components

### 1. COMPANIES-006: `CompanyOfferHistoryChart`
- **Component File**: `components/companies/CompanyOfferHistoryChart.tsx`
- **CSS Module**: `components/companies/CompanyOfferHistoryChart.module.css`
- **Unit Tests**: `components/companies/CompanyOfferHistoryChart.test.ts`
- **Functionality**:
  - Horizontally scrollable bar chart showing final reported offer counts for each recorded cycle of a selected company.
  - Constrained card width prevents long histories (e.g. 20 cycles) from distorting bars or expanding the parent page layout.
  - One integer-count bar per recorded cycle across all combined company drives.
  - Distinct UI views:
    - No company selected
    - Loading state with accessible spinner (`role="status"`, `aria-live="polite"`)
    - Error state with alert message and `Retry` button calling `onRetry`
    - Empty state (company has no recorded placement cycles)
    - Zero-offer cycles rendered accurately with tick and height 0.
  - Responsive Enlarged Modal Dialog (`role="dialog"`, `aria-modal="true"`):
    - Visible Close button
    - `Escape` key close listener
    - Tab key focus trap containment
    - Focus restoration to the Expand trigger button on close
    - Document body scroll prevention (`overflow: hidden`)
    - Compact chart horizontal scroll position preserved across open/close cycles.
  - Screen reader accessible `<table className={styles.srOnly}>` with caption, columns, and cycle rows.

### 2. COMPANIES-007: `CompanyOfferDistribution`
- **Component File**: `components/companies/CompanyOfferDistribution.tsx`
- **CSS Module**: `components/companies/CompanyOfferDistribution.module.css`
- **Unit Tests**: `components/companies/CompanyOfferDistribution.test.ts`
- **Functionality**:
  - Donut chart representing offer composition for a selected company and explicit cycle.
  - Segmented dimension control: `department`, `gender`, and `reservationCategory`.
  - Role filter dropdown: `All roles` (`null`) or an exact `roleId`.
  - Distinct role formatting (`formatRoleOptionLabel`):
    - Differentiates duplicate titles across drives using drive references or drive ID snippets.
    - Gracefully handles NULL/empty titles as `Unspecified title (Drive Reference/ID)`.
  - Footnote reporting `missingRoleCount` when "All roles" is selected.
  - Demographic null values are preserved in an explicit "Not recorded" bucket in the same total denominator, avoiding skewed calculations.
  - Single department slice (e.g. for a single-department scoped user) renders cleanly at 100%.
  - Zero total offers handled safely (empty state displayed; prevents NaN or division by zero).
  - Center total count and label (`Offer` / `Offers`).
  - Accessible legend with color swatches, labels, counts, and percentages.
  - Screen reader accessible table (`<table className={styles.srOnly}>`).

---

## 2. Public Exports & Prop Contracts

### `CompanyOfferHistoryChart.tsx`
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

export default function CompanyOfferHistoryChart(
  props: CompanyOfferHistoryChartProps
): React.JSX.Element;
```

### `CompanyOfferDistribution.tsx`
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

export function formatRoleOptionLabel(
  option: CompanyOfferRoleOption,
  allOptions: CompanyOfferRoleOption[]
): string;

export default function CompanyOfferDistribution(
  props: CompanyOfferDistributionProps
): React.JSX.Element;
```

---

## 3. Validation Summary

All checks completed cleanly with zero warnings or errors:
1. **Type Checking**: `npx tsc --noEmit` — ✅ Passed
2. **Linting**: `npm run lint` — ✅ Passed
3. **Automated Unit Tests**: `npx tsx --test components/companies/*.test.ts` — ✅ 13/13 tests passed:
   - History chart:
     - Component export and prop contract satisfaction
     - Stable incoming order preservation
     - Zero-offer vs unrecorded cycles
     - Total offer accumulation
     - Constrained horizontal scroll width scaling (340px min, 1200px+ for 20 cycles)
     - UI distinct state branching
   - Distribution donut:
     - Component export and role label formatter
     - Distinct, duplicate, and NULL title disambiguation across drives
     - Dimension coverage (`department`, `gender`, `reservationCategory`)
     - "Not recorded" demographic preservation
     - Empty denominator safety (prevents NaN / division by zero)
     - Single department slice 100% share
     - UI state branching (no company, no cycle, loading, error, empty, active)
4. **Browser Testing Note**: CLI tests verified responsive CSS units, DOM structures, keyboard handlers, and modal focus traps; live browser session verification is left to the integrator.

---

## 4. Commits in `companies/charts`

1. `ff11d09`: `feat(companies): implement company offer history bar chart and overlay (COMPANIES-006)`
2. `304b066`: `feat(companies): implement cycle offer distribution donut and controls (COMPANIES-007)`

---

## 5. Notes for Integrator (Model 1)

- Both components are client components (`"use client"`), self-contained with CSS modules.
- Data arrives via props without direct database queries or auth checks in the components.
- Incoming rows in `CompanyOfferHistoryChart` are rendered in their exact provided order.
- In `CompanyOfferDistribution`, `buckets` sum to `totalOffers`; `missingRoleCount` is provided for informational display when `selectedRoleId === null`.
