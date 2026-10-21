export interface YearToDate {
  /** Graduating batch included in this side of the comparison. */
  batchYear: number;
  /** YYYY-MM-DD */
  to: string;
  /** NULL only when the earlier July–June period has no dated offer at all. */
  count: number | null;
}

export interface YearToDateComparison {
  current: YearToDate;
  previous: YearToDate;
  /** current − previous; NULL when the earlier year is missing. */
  difference: number | null;
  /** % change; NULL when the earlier year is missing or 0. */
  pctChange: number | null;
  /** Offers without a recorded date. */
  undated: number;
}

/** The minimum offer information needed for the batch-specific home comparison. */
export interface BatchOfferDate {
  batchYear: number;
  offerDate: string | null;
}

/** The same date one year earlier; 29 February becomes 28 February. */
export function sameDateLastYear(date: string): string {
  const year = Number(date.slice(0, 4)) - 1;
  const monthDay = date.slice(5);
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return `${year}-${monthDay === "02-29" && !isLeap(year) ? "02-28" : monthDay}`;
}

/** The placement season from July through December belongs to the following graduating batch. */
export function batchYearForDate(date: string): number {
  return Number(date.slice(0, 4)) + (date.slice(5) >= "07-01" ? 1 : 0);
}

/** Placements for the selected batch through a date, versus the preceding batch through the same date a year earlier. */
export function yearToDateComparison(
  offers: ReadonlyArray<BatchOfferDate>,
  date: string,
): YearToDateComparison {
  const currentBatchYear = batchYearForDate(date);
  const previousBatchYear = currentBatchYear - 1;
  const current = { batchYear: currentBatchYear, to: date };
  const previous = { batchYear: previousBatchYear, to: sameDateLastYear(date) };

  let currentCount = 0;
  let previousCount = 0;
  let previousYearDated = 0;
  let undated = 0;
  for (const { batchYear, offerDate } of offers) {
    if (batchYear !== currentBatchYear && batchYear !== previousBatchYear) {
      continue;
    }
    if (offerDate === null) {
      undated++;
      continue;
    }
    if (batchYear === currentBatchYear && offerDate <= current.to) {
      currentCount++;
    }
    if (batchYear === previousBatchYear) {
      previousYearDated++;
      if (offerDate <= previous.to) previousCount++;
    }
  }

  const prev = previousYearDated === 0 ? null : previousCount;
  return {
    current: { ...current, count: currentCount },
    previous: { ...previous, count: prev },
    difference: prev === null ? null : currentCount - prev,
    pctChange:
      prev === null || prev === 0
        ? null
        : ((currentCount - prev) / prev) * 100,
    undated,
  };
}
