/**
 * Readable drive/role labels for the UI. Internal UUIDs are never shown: when two labels
 * still read the same (repeated titles and references are allowed), each copy gets a
 * plain number in list order, e.g. "Main campus (1)" and "Main campus (2)". `keys` decides
 * what counts as "the same" when it differs from the shown label (defaults to the label).
 */
export function numberDuplicates(labels: string[], keys: string[] = labels): string[] {
  const totals = new Map<string, number>();
  for (const key of keys) totals.set(key.toLowerCase(), (totals.get(key.toLowerCase()) ?? 0) + 1);
  const seen = new Map<string, number>();
  return labels.map((label, position) => {
    const key = keys[position].toLowerCase();
    if ((totals.get(key) ?? 0) < 2) return label;
    const index = (seen.get(key) ?? 0) + 1;
    seen.set(key, index);
    return `${label} (${index})`;
  });
}

export const driveName = (drive: { reference: string | null }) => drive.reference?.trim() || "No reference";
export const roleName = (role: { jobTitle: string | null; domain?: string | null }) =>
  `${role.jobTitle?.trim() || "Unspecified title"}${role.domain?.trim() ? ` · ${role.domain.trim()}` : ""}`;

/** One label per drive, in the given order. */
export const driveLabels = (drives: { reference: string | null }[]) => numberDuplicates(drives.map(driveName));
