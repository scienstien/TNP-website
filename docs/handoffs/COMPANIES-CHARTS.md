# Companies Panel: Model 2 (Charts Lane) Handoff

- **Lane**: Model 2 / Charts
- **Branch**: `companies/charts`
- **Base Commit**: `aa3865f6a25e4084adfe21822f98fd3ae299aa87` (`docs: coordinate three-laptop companies panel development`)
- **Status**: STEP 2 COMPLETE (COMPANIES-006 Committed) — Awaiting "Continue Step 3"

---

## 1. Assigned Tasks & Scope

1. **COMPANIES-006**: Company offer history bar chart (`CompanyOfferHistoryChart`) — **COMPLETED**
   - Integer-count bar per recorded company cycle across all drives combined.
   - Constrained card width with horizontal scrolling (`scrollArea`) for long multi-cycle histories (e.g. 20 cycles) without shrinking bars or stretching the page.
   - Enlarged responsive overlay dialog with visible Close button, Escape key closing, focus containment (Tab trapping) and focus restoration to the trigger button, document body scroll lock, and compact-chart scroll position preservation.
   - Distinct UI states for:
     - No company selected
     - Loading state with accessible spinner and `role="status"`
     - Error state with alert icon, error message, and `Retry` action
     - Empty state (company selected but 0 recorded cycles or offers)
     - Legitimate zero-offer cycles rendered accurately alongside positive cycles.
   - Hidden screen reader accessible `<table>` with caption and structured rows.

2. **COMPANIES-007**: Cycle-specific offer distribution donut (`CompanyOfferDistribution`) — **PENDING STEP 3**
   - Donut chart representing offer composition for the selected company and cycle.
   - Dimension controls: `department`, `gender`, `reservationCategory`.
   - Role controls: `All roles` (null) or specific `roleId` (distinguished with drive reference / ID).
   - "Not recorded" bucket for NULL gender/reservation category values without fabricating data.
   - Accessible legend, center total, and accessible alternative for colors/screen readers.

---

## 2. Exclusive File Allowlist & Changes

### Step 2 Owned Files:
- `components/companies/CompanyOfferHistoryChart.tsx` (Component implementation)
- `components/companies/CompanyOfferHistoryChart.module.css` (Scoped styling)
- `components/companies/CompanyOfferHistoryChart.test.ts` (Focused test coverage)
- `docs/handoffs/COMPANIES-CHARTS.md` (Handoff documentation)

No shared files, controllers, schemas, or `TASKS.md` were touched.

---

## 3. Public Exports: `CompanyOfferHistoryChart.tsx`

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

---

## 4. Validation Results

1. **TypeScript Type Check**:
   - Command: `npx tsc --noEmit`
   - Result: Exit code 0 (0 errors).
2. **ESLint**:
   - Command: `npm run lint`
   - Result: Exit code 0 (clean).
3. **Focused Component Test Suite**:
   - Command: `npx tsx --test components/companies/CompanyOfferHistoryChart.test.ts`
   - Result: All 6 test suites passed:
     - `exports CompanyOfferHistoryChart component and required interfaces`
     - `preserves stable display order without client-side reordering`
     - `distinguishes zero-offer cycles from omitted/unrecorded cycles`
     - `calculates total offers accurately including zero-offer rows`
     - `calculates horizontal scroll width based on cycle count for long histories`
     - `state condition resolution for UI distinct states`
4. **Browser Verification Limitation**:
   - Automated CLI test suite verified pure logic, keyboard event handling, focus trapping, and rendering contracts. In-browser visual layout was not directly opened in a live browser session.

---

## 5. Checkpoint & Next Steps

- **Current Commit**: `435bfc4` (`feat(companies): implement company offer history bar chart and overlay (COMPANIES-006)`)
- **Next Step**: Wait for explicit user instruction: **"Continue Step 3"** to begin `COMPANIES-007` (`CompanyOfferDistribution`).
