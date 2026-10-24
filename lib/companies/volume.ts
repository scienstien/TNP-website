/**
 * A company's "volume": the median recorded package (LPA) of its final offers multiplied by the
 * number of students it took. It is undefined (null) when no offer has a recorded package, so
 * such companies are never ranked as if their volume were zero.
 */
export function companyVolume(medianLpa: number | null, offers: number): number | null {
  if (medianLpa === null || !Number.isFinite(medianLpa) || !Number.isInteger(offers) || offers <= 0) return null;
  return medianLpa * offers;
}

/** Highest volume first; companies without a volume go last, ties and the rest by name. */
export function compareByVolume(a: { name: string; volume: number | null }, b: { name: string; volume: number | null }): number {
  if (a.volume === null && b.volume === null) return a.name.localeCompare(b.name);
  if (a.volume === null) return 1;
  if (b.volume === null) return -1;
  return b.volume - a.volume || a.name.localeCompare(b.name);
}

/** The header's Volume control: how the directory is ordered and, for "top10", filtered. */
export const VOLUME_MODES = [
  { value: "any", label: "Any volume (A–Z)" },
  { value: "high", label: "High to low" },
  { value: "low", label: "Low to high" },
  { value: "top10", label: "Top 10 by volume" },
] as const;
export type VolumeMode = (typeof VOLUME_MODES)[number]["value"];
export const TOP_VOLUME_COUNT = 10;

/** Companies without a volume never rank, so "top10" leaves them out and the orderings put them last. */
export function applyVolumeMode<T extends { name: string; volume: number | null }>(companies: T[], mode: VolumeMode): T[] {
  if (mode === "any") return companies;
  if (mode === "high") return [...companies].sort(compareByVolume);
  if (mode === "low") {
    return [...companies].sort((a, b) => {
      if (a.volume === null || b.volume === null) return compareByVolume(a, b);
      return a.volume - b.volume || a.name.localeCompare(b.name);
    });
  }
  return [...companies].filter(company => company.volume !== null).sort(compareByVolume).slice(0, TOP_VOLUME_COUNT);
}
