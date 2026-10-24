/**
 * Dashboard analytics: pure functions over PlacementRecord[] shared by every KPI and chart.
 *
 * Definitions (AGENTS.md, db/README.md):
 * - Population: REGISTERED participation records in the selected placement cycle
 *   (every cycle when none is chosen).
 * - Placed: a registered participation has an offer; registered without an offer is unplaced.
 *   UNREGISTERED participation is outside the placement-rate population.
 * - Offer filters (company, role domain, offer type, CTC range) narrow which offers count as
 *   "matching". The population and the unplaced count never change with offer filters.
 * - CTC statistics use matching offers whose package is recorded; missing packages are
 *   excluded and reported, never filled in.
 * - Mode CTC: the most frequent exact package (LPA, 2 decimals). On a tie the lowest tied
 *   value is shown and flagged; when every value occurs once there is no mode.
 */
import {
  OFFER_TYPES,
  type OfferTypeValue,
  type PlacementOffer,
  type PlacementRecord,
} from "./types";
import { PG_BRANCHES } from "./pg-catalog";

export const NOT_RECORDED = "Not recorded";

export interface DashboardFilterState {
  cycleId: string | null;
  comparisonCycleId: string | null;
  specialization: string | null;
  company: string | null;
  domain: string | null;
  offerType: OfferTypeValue | null;
  ctcMin: number | null;
  ctcMax: number | null;
}

export const EMPTY_FILTERS: DashboardFilterState = {
  cycleId: null,
  comparisonCycleId: null,
  specialization: null,
  company: null,
  domain: null,
  offerType: null,
  ctcMin: null,
  ctcMax: null,
};

type PlacedRecord = PlacementRecord & { offer: PlacementOffer };

export interface PlacementCycleOption {
  id: string;
  code: string;
}

/* ---------------------------------------------------------------- options */

export function placementCycles(records: PlacementRecord[]): PlacementCycleOption[] {
  const cycles = new Map<string, string>();
  for (const record of records) cycles.set(record.cycleId, record.cycleCode);
  return [...cycles].map(([id, code]) => ({ id, code })).sort((a, b) =>
    b.code.localeCompare(a.code, undefined, { numeric: true }),
  );
}

export function companyNames(records: PlacementRecord[]): string[] {
  return uniqueSorted(
    records.flatMap((r) => (r.offer ? [r.offer.company] : [])),
  );
}

export function domainNames(records: PlacementRecord[]): string[] {
  return uniqueSorted(
    records.flatMap((r) => (r.offer ? [domainOf(r.offer)] : [])),
  );
}

export function specializationNames(records: PlacementRecord[]): string[] {
  return uniqueSorted(records.map(specializationOf));
}

export function pgSpecializationNames(
  records: PlacementRecord[],
  authorizedDepartment: { code: string; name: string } | null,
): string[] {
  const visibleBranch = authorizedDepartment?.code ?? null;
  const catalogue = PG_BRANCHES
    .filter((item) => authorizedDepartment === null || item.code === visibleBranch || item.name === authorizedDepartment.name)
    .flatMap((item) => [...item.specializations]);
  const recorded = records
    .filter((record) => visibleBranch === null || record.department === visibleBranch)
    .map(specializationOf);
  return uniqueSorted([...catalogue, ...recorded]);
}

export function specializationOf(record: PlacementRecord): string {
  return record.specialization?.trim() || NOT_RECORDED;
}

/** Whole-LPA bounds of the recorded packages, for the CTC range control. */
export function ctcBounds(records: PlacementRecord[]): [number, number] {
  const values = packages(records.flatMap((r) => (r.offer ? [r.offer] : [])));
  if (values.length === 0) return [0, 0];
  return [Math.floor(Math.min(...values)), Math.ceil(Math.max(...values))];
}

export function defaultFilters(cycleId: string | null = null): DashboardFilterState {
  return { ...EMPTY_FILTERS, cycleId };
}

export function mergeDashboardFilters(
  current: DashboardFilterState,
  patch: Partial<DashboardFilterState>,
): DashboardFilterState {
  const next = { ...current, ...patch };
  if (
    next.cycleId === null ||
    next.cycleId === next.comparisonCycleId
  ) next.comparisonCycleId = null;
  return next;
}

/* ---------------------------------------------------------------- scoping */

export function domainOf(offer: PlacementOffer): string {
  return offer.domain?.trim() || NOT_RECORDED;
}

export function hasOfferFilters(filters: DashboardFilterState): boolean {
  return Boolean(
    filters.company ||
      filters.domain ||
      filters.offerType ||
      filters.ctcMin !== null ||
      filters.ctcMax !== null,
  );
}

function offerMatches(offer: PlacementOffer, f: DashboardFilterState): boolean {
  if (f.company && offer.company !== f.company) return false;
  if (f.domain && domainOf(offer) !== f.domain) return false;
  if (f.offerType && offer.offerType !== f.offerType) return false;
  if (f.ctcMin !== null || f.ctcMax !== null) {
    // An offer without a recorded package cannot be placed in a CTC range.
    if (offer.packageLpa === null) return false;
    if (f.ctcMin !== null && offer.packageLpa < f.ctcMin) return false;
    if (f.ctcMax !== null && offer.packageLpa > f.ctcMax) return false;
  }
  return true;
}

export interface Scope {
  population: PlacementRecord[];
  /** Population students whose offer passes the offer filters. */
  matching: PlacedRecord[];
}

export function isRegisteredParticipation(record: PlacementRecord): boolean {
  return record.registrationStatus === "REGISTERED";
}

export function scopeRecords(
  records: PlacementRecord[],
  filters: DashboardFilterState,
): Scope {
  const population = records.filter(
    (record) =>
      isRegisteredParticipation(record) &&
      (filters.cycleId === null || record.cycleId === filters.cycleId) &&
      (filters.specialization === null || specializationOf(record) === filters.specialization),
  );
  const matching = population.filter(
    (r): r is PlacedRecord =>
      r.offer !== null && offerMatches(r.offer, filters),
  );
  return { population, matching };
}

/* ---------------------------------------------------------------- KPIs */

export interface ModeResult {
  value: number;
  tie: boolean;
  frequency: number;
}

export interface Kpis {
  /** Registered participation records in the selected cycle. */
  total: number;
  /** Placed through an offer that passes the offer filters. */
  placed: number;
  /** Placed through any offer; independent of offer filters. */
  placedOverall: number;
  /** Students without any offer (independent of offer filters). */
  unplaced: number;
  /** Students placed through offers outside the current offer filters. */
  placedElsewhere: number;
  /** placed / registered total × 100, or null for an empty registered population. */
  placementPct: number | null;
  average: number | null;
  median: number | null;
  mode: ModeResult | null;
  packagesRecorded: number;
  packagesMissing: number;
}

export function computeKpis(scope: Scope): Kpis {
  const total = scope.population.length;
  const withAnyOffer = scope.population.filter((r) => r.offer !== null).length;
  const placed = scope.matching.length;
  const values = packages(scope.matching.map((r) => r.offer));
  return {
    total,
    placed,
    placedOverall: withAnyOffer,
    unplaced: total - withAnyOffer,
    placedElsewhere: withAnyOffer - placed,
    placementPct: total > 0 ? (placed / total) * 100 : null,
    average: values.length ? sum(values) / values.length : null,
    median: median(values),
    mode: mode(values),
    packagesRecorded: values.length,
    packagesMissing: placed - values.length,
  };
}

export interface CycleComparisonKpis {
  cycleId: string;
  cycleCode: string;
  kpis: Kpis;
}

/** KPIs for the explicitly selected comparison cycle under the same remaining filters. */
export function comparisonCycleKpis(
  records: PlacementRecord[],
  filters: DashboardFilterState,
): CycleComparisonKpis | null {
  if (
    filters.cycleId === null ||
    filters.comparisonCycleId === null ||
    filters.cycleId === filters.comparisonCycleId
  ) return null;
  const comparisonRecord = records.find(
    (record) => record.cycleId === filters.comparisonCycleId,
  );
  if (!comparisonRecord) return null;
  return {
    cycleId: comparisonRecord.cycleId,
    cycleCode: comparisonRecord.cycleCode,
    kpis: computeKpis(
      scopeRecords(records, {
        ...filters,
        cycleId: comparisonRecord.cycleId,
        comparisonCycleId: null,
      }),
    ),
  };
}

/* ---------------------------------------------------------------- charts */

export interface CompanyOfferRow {
  company: string;
  offers: number;
  average: number | null;
  min: number | null;
  max: number | null;
  byType: Record<OfferTypeValue | typeof NOT_RECORDED, number>;
}

export function topCompanies(scope: Scope, limit = 10): CompanyOfferRow[] {
  const groups = groupBy(scope.matching, (r) => r.offer.company);
  return [...groups]
    .map(([company, rows]) => {
      const values = packages(rows.map((r) => r.offer));
      const byType = Object.fromEntries(
        [...OFFER_TYPES, NOT_RECORDED].map((type) => [type, 0]),
      ) as CompanyOfferRow["byType"];
      for (const r of rows) byType[r.offer.offerType ?? NOT_RECORDED] += 1;
      return {
        company,
        offers: rows.length,
        average: values.length ? sum(values) / values.length : null,
        min: values.length ? Math.min(...values) : null,
        max: values.length ? Math.max(...values) : null,
        byType,
      };
    })
    .sort((a, b) => b.offers - a.offers || a.company.localeCompare(b.company))
    .slice(0, limit);
}

export interface OfferTypeSlice {
  type: OfferTypeValue | typeof NOT_RECORDED;
  offers: number;
  share: number;
}

/** Counts offers (not students) by offer type; unrecorded types are shown, not dropped. */
export function offerTypeSplit(scope: Scope): OfferTypeSlice[] {
  const types: OfferTypeSlice["type"][] = [...OFFER_TYPES, NOT_RECORDED];
  const total = scope.matching.length;
  const counts = new Map<OfferTypeSlice["type"], number>();
  for (const r of scope.matching) {
    const type = r.offer.offerType ?? NOT_RECORDED;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return types
    .map((type) => ({
      type,
      offers: counts.get(type) ?? 0,
      share: total ? ((counts.get(type) ?? 0) / total) * 100 : 0,
    }))
    .filter((slice) => slice.offers > 0);
}

export interface DomainRow {
  domain: string;
  placed: number;
  /** Share of all placed students in scope. */
  share: number;
}

/** Placed students per role domain (drive_roles.domain). Offers without a role or domain are "Not recorded"; unplaced students have no domain and are reported separately. */
export function domainPlacement(scope: Scope): DomainRow[] {
  const total = scope.matching.length;
  return [...groupBy(scope.matching, (r) => domainOf(r.offer))]
    .map(([domain, rows]) => ({
      domain,
      placed: rows.length,
      share: total ? (rows.length / total) * 100 : 0,
    }))
    .sort((a, b) => b.placed - a.placed || a.domain.localeCompare(b.domain));
}

/** Bucket lower bounds in LPA; the last bucket is open-ended. Same for every cycle. */
export const DEFAULT_CTC_BUCKETS = [0, 5, 10, 15, 20, 30, 40];

export interface CtcBucket {
  label: string;
  min: number;
  max: number | null;
  offers: number;
  share: number;
  average: number | null;
}

export function ctcHistogram(
  scope: Scope,
  bounds: number[] = DEFAULT_CTC_BUCKETS,
): { buckets: CtcBucket[]; excluded: number } {
  const values = packages(scope.matching.map((r) => r.offer));
  const buckets = bounds.map((min, i) => {
    const max = bounds[i + 1] ?? null;
    const inside = values.filter((v) => v >= min && (max === null || v < max));
    return {
      label: max === null ? `${min}+` : `${min}–${max}`,
      min,
      max,
      offers: inside.length,
      share: values.length ? (inside.length / values.length) * 100 : 0,
      average: inside.length ? sum(inside) / inside.length : null,
    };
  });
  return { buckets, excluded: scope.matching.length - values.length };
}

/* ---------------------------------------------------------------- helpers */

function packages(offers: PlacementOffer[]): number[] {
  return offers.flatMap((o) => (o.packageLpa === null ? [] : [o.packageLpa]));
}

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mode(values: number[]): ModeResult | null {
  const counts = new Map<number, number>();
  for (const v of values) {
    const key = Math.round(v * 100) / 100;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = 0;
  for (const count of counts.values()) best = Math.max(best, count);
  if (best < 2) return null;
  const tied = [...counts].filter(([, c]) => c === best).map(([v]) => v);
  return { value: Math.min(...tied), tie: tied.length > 1, frequency: best };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = groups.get(k);
    if (list) list.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
