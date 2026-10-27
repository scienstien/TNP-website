"use client";

import type { HomeCycleSummary } from "@/lib/placements/home-cycle";
import PlacedSoFar from "./PlacedSoFar";

export default function PlacementProgress({
  cycles,
}: {
  cycles: ReadonlyArray<HomeCycleSummary>;
}) {
  return <PlacedSoFar cycles={cycles} />;
}
