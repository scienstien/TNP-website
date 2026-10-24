import type { DashboardFilterState } from "@/lib/placements/analytics";
import { OFFER_TYPE_LABELS } from "./chartTheme";

const lpa = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

function ctcRange({ ctcMin, ctcMax }: DashboardFilterState): string | null {
  if (ctcMin !== null && ctcMax !== null) return `${lpa(ctcMin)}–${lpa(ctcMax)} LPA`;
  if (ctcMin !== null) return `${lpa(ctcMin)} LPA or more`;
  if (ctcMax !== null) return `up to ${lpa(ctcMax)} LPA`;
  return null;
}

/** The active offer filters as short phrases, e.g. ["Acme", "Software domain", "FTE", "10–20 LPA"]. */
export function offerFilterParts(filters: DashboardFilterState): string[] {
  return [
    filters.company,
    filters.domain ? `${filters.domain} domain` : null,
    filters.offerType ? OFFER_TYPE_LABELS[filters.offerType] : null,
    ctcRange(filters),
  ].filter((part): part is string => part !== null);
}
