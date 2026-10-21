/** A placement cycle covers July–June; the cycle for graduating batch 2027 is "2026-27". */
export const cycleCodeForBatch = (batchYear: number) =>
  `${batchYear - 1}-${String(batchYear).slice(2)}`;

export const cycleStartsOn = (batchYear: number) => `${batchYear - 1}-07-01`;
export const cycleEndsOn = (batchYear: number) => `${batchYear}-06-30`;
