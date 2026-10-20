"use client";

import { useCallback, useState } from "react";
import {
  defaultFilters,
  type DashboardFilterState,
} from "@/lib/placements/analytics";
import type { PlacementRecord } from "@/lib/placements/types";

/**
 * The one filter state every KPI and chart reads. Chart clicks and the filter bar both
 * write here, so nothing filters on its own.
 */
export function useDashboardFilters(records: PlacementRecord[]) {
  const [filters, setFilters] = useState<DashboardFilterState>(() =>
    defaultFilters(records),
  );

  const update = useCallback(
    (patch: Partial<DashboardFilterState>) =>
      setFilters((current) => ({ ...current, ...patch })),
    [],
  );

  /** Select a value, or clear it when it is already selected (chart clicks). */
  const toggle = useCallback(
    <K extends "company" | "sector" | "offerType">(
      key: K,
      value: DashboardFilterState[K],
    ) =>
      setFilters((current) => ({
        ...current,
        [key]: current[key] === value ? null : value,
      })),
    [],
  );

  const reset = useCallback(
    () => setFilters(defaultFilters(records)),
    [records],
  );

  return { filters, update, toggle, reset };
}
