"use server";

import { isUuid } from "@/lib/companies/records";
import { BREAKDOWN_DIMENSIONS, type BreakdownDimension } from "./breakdown-types";
import { getPlacementBreakdown } from "./breakdown-queries";

/** Runtime payloads are untyped, so validate before querying. Authorization is in the query. */
export async function loadPlacementBreakdown(
  dimension: BreakdownDimension,
  cycleId: string | null,
) {
  if (!BREAKDOWN_DIMENSIONS.includes(dimension)) {
    throw new Error("Choose a valid breakdown.");
  }
  if (cycleId !== null && !isUuid(cycleId)) {
    throw new Error("Choose a valid placement cycle.");
  }
  return getPlacementBreakdown(dimension, cycleId);
}
