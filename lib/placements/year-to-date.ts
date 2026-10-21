export interface YearToDate {
  /** Graduating batch included in this side of the comparison. */
  batchYear: number;
  /** YYYY-MM-DD */
  to: string;
  /** NULL only when the earlier July–June period has no dated offer at all. */
  count: number | null;
  /** Distinct companies (sorted) with a dated offer through `to`; NULL whenever `count` is. */
  companies: string[] | null;
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
  /** Offering company; used to count the companies that had come by the cutoff. */
  company?: string | null;
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
  /** Batch to compare against, cut off at the same day and month in its own season. Defaults to the batch before the one `date` falls in. */
  compareBatchYear?: number,
): YearToDateComparison {
  const currentBatchYear = batchYearForDate(date);
  const previousBatchYear = compareBatchYear ?? currentBatchYear - 1;
  const current = { batchYear: currentBatchYear, to: date };
  const previous = { batchYear: previousBatchYear, to: dateInBatch(date, previousBatchYear) };

  let currentCount = 0;
  let previousCount = 0;
  let previousYearDated = 0;
  let undated = 0;
  const currentCompanies = new Set<string>();
  const previousCompanies = new Set<string>();
  for (const { batchYear, offerDate, company } of offers) {
    if (batchYear !== currentBatchYear && batchYear !== previousBatchYear) {
      continue;
    }
    if (offerDate === null) {
      undated++;
      continue;
    }
    if (batchYear === currentBatchYear && offerDate <= current.to) {
      currentCount++;
      if (company) currentCompanies.add(company);
    }
    if (batchYear === previousBatchYear) {
      previousYearDated++;
      if (offerDate <= previous.to) {
        previousCount++;
        if (company) previousCompanies.add(company);
      }
    }
  }

  const prev = previousYearDated === 0 ? null : previousCount;
  return {
    current: { ...current, count: currentCount, companies: [...currentCompanies].sort() },
    previous: {
      ...previous,
      count: prev,
      companies: prev === null ? null : [...previousCompanies].sort(),
    },
    difference: prev === null ? null : currentCount - prev,
    pctChange:
      prev === null || prev === 0
        ? null
        : ((currentCount - prev) / prev) * 100,
    undated,
  };
}

/** The same month and day inside a graduating batch's July–June season; 29 February becomes 28 in non-leap years. */
export function dateInBatch(date: string, batchYear: number): string {
  const monthDay = date.slice(5);
  const year = monthDay >= "07-01" ? batchYear - 1 : batchYear;
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return `${year}-${monthDay === "02-29" && !isLeap(year) ? "02-28" : monthDay}`;
}

export interface BatchTrendPoint {
  batchYear: number;
  /** YYYY-MM-DD cutoff inside this batch's season. */
  to: string;
  /** NULL when the batch has no dated offer at all (missing, not zero). */
  placed: number | null;
  companies: number | null;
}

/**
 * The same day and month cutoff applied to each of the `count` graduating batches ending at
 * `endBatchYear`, newest first, so batches can be compared at the same point of their season.
 */
export function batchTrend(
  offers: ReadonlyArray<BatchOfferDate>,
  date: string,
  endBatchYear: number,
  count = 20,
): BatchTrendPoint[] {
  const years = Array.from({ length: count }, (_, index) => endBatchYear - index);
  const cutoff = new Map(years.map((year) => [year, dateInBatch(date, year)]));
  const dated = new Map<number, number>();
  const placed = new Map<number, number>();
  const companies = new Map<number, Set<string>>();
  for (const { batchYear, offerDate, company } of offers) {
    const to = cutoff.get(batchYear);
    if (to === undefined || offerDate === null) continue;
    dated.set(batchYear, (dated.get(batchYear) ?? 0) + 1);
    if (offerDate > to) continue;
    placed.set(batchYear, (placed.get(batchYear) ?? 0) + 1);
    if (company) {
      const names = companies.get(batchYear) ?? new Set<string>();
      names.add(company);
      companies.set(batchYear, names);
    }
  }
  return years.map((batchYear) => ({
    batchYear,
    to: cutoff.get(batchYear)!,
    placed: dated.has(batchYear) ? (placed.get(batchYear) ?? 0) : null,
    companies: dated.has(batchYear) ? (companies.get(batchYear)?.size ?? 0) : null,
  }));
}
