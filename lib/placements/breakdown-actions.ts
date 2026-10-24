"use server";

import { isUuid } from "@/lib/companies/records";
import { BREAKDOWN_DIMENSIONS, type BreakdownDimension } from "./breakdown-types";
import { getPlacementBreakdown } from "./breakdown-queries";
import type { DegreeLevel } from "./types";

/** Runtime payloads are untyped, so validate before querying. Authorization is in the query. */
export async function loadPlacementBreakdown(
  dimension: BreakdownDimension,
  cycleId: string | null,
  degreeLevel: DegreeLevel = "UG",
  specialization: string | null = null,
) {
  if (!BREAKDOWN_DIMENSIONS.includes(dimension)) {
    throw new Error("Choose a valid breakdown.");
  }
  if (cycleId !== null && !isUuid(cycleId)) {
    throw new Error("Choose a valid placement cycle.");
  }
  if (degreeLevel !== "UG" && degreeLevel !== "PG") {
    throw new Error("Choose a valid degree level.");
  }
  if (specialization !== null && typeof specialization !== "string") {
    throw new Error("Choose a valid specialization.");
  }
  return getPlacementBreakdown(dimension, cycleId, degreeLevel, specialization);
}
