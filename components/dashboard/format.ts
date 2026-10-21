export const formatLpa = (value: number | null, digits = 1) =>
  value === null ? "—" : `${value.toFixed(digits)} LPA`;

export const formatPct = (value: number | null, digits = 1) =>
  value === null ? "—" : `${value.toFixed(digits)}%`;

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;
