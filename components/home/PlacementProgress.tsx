"use client";

import { useMemo } from "react";
import { homeCycleSummaries } from "@/lib/placements/home-cycle";
import type { PlacementRecord } from "@/lib/placements/types";
import PlacedSoFar from "./PlacedSoFar";

export default function PlacementProgress({
  placementRecords,
}: {
  placementRecords: PlacementRecord[];
}) {
  const cycles = useMemo(
    () => homeCycleSummaries(placementRecords),
    [placementRecords],
  );

  return <PlacedSoFar cycles={cycles} />;
}
