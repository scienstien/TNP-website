"use client";

import { useMemo } from "react";
import type { PlacementRecord } from "@/lib/placements/types";
import { batchYearForDate } from "@/lib/placements/year-to-date";
import PlacedSoFar from "./PlacedSoFar";

export default function PlacementProgress({
  placementRecords,
  today,
  canChooseBatch,
}: {
  placementRecords: PlacementRecord[];
  today: string;
  canChooseBatch: boolean;
}) {
  const offers = useMemo(
    () => placementRecords.flatMap((record) => record.offer ? [{
      batchYear: record.batchYear,
      offerDate: record.offer.offerDate,
      company: record.offer.company,
    }] : []),
    [placementRecords],
  );
  const batches = useMemo(() => {
    const totals = new Map<number, { placed: number; unplaced: number }>();
    // The batch of today's date is always listed, even before any student is recorded for it.
    totals.set(batchYearForDate(today), { placed: 0, unplaced: 0 });
    for (const record of placementRecords) {
      const total = totals.get(record.batchYear) ?? { placed: 0, unplaced: 0 };
      if (record.offer !== null) total.placed++;
      else total.unplaced++;
      totals.set(record.batchYear, total);
    }
    return [...totals]
      .map(([batchYear, total]) => ({ batchYear, ...total }))
      .sort((a, b) => b.batchYear - a.batchYear);
  }, [placementRecords, today]);

  return (
    <PlacedSoFar
      offers={offers}
      batches={batches}
      canChooseBatch={canChooseBatch}
      today={today}
    />
  );
}
