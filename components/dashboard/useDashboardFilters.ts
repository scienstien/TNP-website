"use client";

import { useCallback, useState } from "react";
import {
  defaultFilters,
  mergeDashboardFilters,
  type DashboardFilterState,
} from "@/lib/placements/analytics";

/**
 * The one filter state every KPI and chart reads. Chart clicks and the filter bar both
 * write here, so nothing filters on its own.
 */
export function useDashboardFilters(defaultCycleId: string | null = null) {
  const [filters, setFilters] = useState<DashboardFilterState>(() =>
    defaultFilters(defaultCycleId),
  );

  const update = useCallback(
    (patch: Partial<DashboardFilterState>) =>
      setFilters((current) => mergeDashboardFilters(current, patch)),
    [],
  );

  /** Select a value, or clear it when it is already selected (chart clicks). */
  const toggle = useCallback(
    <K extends "company" | "domain" | "offerType" | "specialization">(
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
    () => setFilters(defaultFilters(defaultCycleId)),
    [defaultCycleId],
  );

  return { filters, update, toggle, reset };
}
