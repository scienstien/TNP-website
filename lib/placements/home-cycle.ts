import type { PlacementRecord } from "./types";

export interface HomeCycleSummary {
  cycleId: string;
  cycleCode: string;
  placed: number;
  unplaced: number;
  companies: string[];
}

/** Full-cycle registered placement totals for home highlights and comparison. */
export function homeCycleSummaries(
  records: ReadonlyArray<PlacementRecord>,
): HomeCycleSummary[] {
  const summaries = new Map<
    string,
    Omit<HomeCycleSummary, "companies"> & { companies: Set<string> }
  >();

  for (const record of records) {
    const summary = summaries.get(record.cycleId) ?? {
      cycleId: record.cycleId,
      cycleCode: record.cycleCode,
      placed: 0,
      unplaced: 0,
      companies: new Set<string>(),
    };
    if (record.registrationStatus === "REGISTERED") {
      if (record.offer) {
        summary.placed++;
        summary.companies.add(record.offer.company);
      } else {
        summary.unplaced++;
      }
    }
    summaries.set(record.cycleId, summary);
  }

  return [...summaries.values()]
    .map((summary) => ({
      ...summary,
      companies: [...summary.companies].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) =>
      b.cycleCode.localeCompare(a.cycleCode, undefined, { numeric: true }),
    );
}
