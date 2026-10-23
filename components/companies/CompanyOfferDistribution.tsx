"use client";

import React, { useId } from "react";
import { AlertCircle, PieChart as PieChartIcon, RefreshCw } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import styles from "./CompanyOfferDistribution.module.css";

export type CompanyOfferDimension = "department" | "gender" | "reservationCategory";

export interface CompanyOfferRoleOption {
  roleId: string;
  driveId: string;
  driveReference: string | null;
  jobTitle: string | null;
}

export interface CompanyOfferBucket {
  key: string;
  label: string;
  count: number | string;
}

export interface CompanyOfferDistributionProps {
  company: { companyId: string; name: string } | null;
  cycle: { cycleId: string; code: string } | null;
  scopeLabel: string;
  dimension: CompanyOfferDimension;
  selectedRoleId: string | null; // NULL means All roles
  roleOptions: CompanyOfferRoleOption[];
  buckets: CompanyOfferBucket[];
  totalOffers: number | string;
  missingRoleCount: number;
  loading: boolean;
  error: string | null;
  onDimensionChange: (dimension: CompanyOfferDimension) => void;
  onRoleChange: (roleId: string | null) => void;
  onRetry: () => void;
}

const PALETTE = [
  "#3a72e6", // royal blue
  "#22a08c", // emerald teal
  "#9b6fe0", // amethyst purple
  "#f59e0b", // warm amber
  "#ec4899", // magenta rose
  "#06b6d4", // bright cyan
  "#f97316", // vivid orange
  "#10b981", // fresh green
  "#8b5cf6", // violet
  "#6366f1", // indigo
];

const NOT_RECORDED_COLOR = "#50617a";
const COUNT_ERROR = "These figures don't add up; please refresh or report this.";

export function validateDistributionCounts(total: unknown, buckets: CompanyOfferBucket[]) {
  const parsedTotal = typeof total === "number" ? total : typeof total === "string" && total.trim() ? Number(total) : NaN;
  const parsedBuckets = buckets.map((bucket) => ({ ...bucket, count: typeof bucket.count === "number" ? bucket.count : typeof bucket.count === "string" && bucket.count.trim() ? Number(bucket.count) : NaN }));
  if (!Number.isSafeInteger(parsedTotal) || parsedTotal < 0 || parsedBuckets.some((bucket) => !Number.isSafeInteger(bucket.count) || bucket.count < 0)) return null;
  return parsedBuckets.reduce((sum, bucket) => sum + bucket.count, 0) === parsedTotal
    ? { totalOffers: parsedTotal, buckets: parsedBuckets as { key: string; label: string; count: number }[] }
    : null;
}

/**
 * Format a human-readable, distinct label for each role option.
 * Distinguishes duplicate/same titles and NULL titles using drive reference or ID.
 */
export function formatRoleOptionLabel(
  option: CompanyOfferRoleOption,
  allOptions: CompanyOfferRoleOption[]
): string {
  const title = option.jobTitle?.trim() || "Unspecified title";
  const duplicateCount = allOptions.filter(
    (o) => (o.jobTitle?.trim() || "Unspecified title").toLowerCase() === title.toLowerCase()
  ).length;

  if (duplicateCount > 1 || !option.jobTitle) {
    const detail = option.driveReference?.trim()
      ? option.driveReference.trim()
      : `Drive #${option.driveId.slice(0, 6)}`;
    const ambiguous = allOptions.some(other => other.roleId !== option.roleId &&
      (other.jobTitle?.trim() || "Unspecified title").toLowerCase() === title.toLowerCase() &&
      (other.driveReference?.trim() || `Drive #${other.driveId.slice(0, 6)}`) === detail);
    return `${title} (${detail})${ambiguous ? ` · Role ${option.roleId}` : ""}`;
  }

  return option.driveReference?.trim()
    ? `${title} (${option.driveReference.trim()})`
    : title;
}

/**
 * Deterministically pick an accessible color for a bucket based on its key/label and index.
 */
function getBucketColor(key: string, label: string, index: number): string {
  const normalizedKey = key.toLowerCase();
  const normalizedLabel = label.toLowerCase();

  // Known Not recorded / unknown buckets
  if (
    normalizedKey.includes("not_recorded") ||
    normalizedKey.includes("unknown") ||
    normalizedLabel.includes("not recorded") ||
    normalizedLabel.includes("unknown")
  ) {
    return NOT_RECORDED_COLOR;
  }

  // Gender known mappings
  if (normalizedKey === "m" || normalizedLabel === "male") return "#3a72e6";
  if (normalizedKey === "f" || normalizedLabel === "female") return "#ec4899";
  if (normalizedKey === "o" || normalizedLabel === "other") return "#22a08c";

  // Category known mappings
  if (normalizedKey === "open" || normalizedKey === "gen") return "#3a72e6";
  if (normalizedKey.includes("obc")) return "#22a08c";
  if (normalizedKey === "sc") return "#9b6fe0";
  if (normalizedKey === "st") return "#f59e0b";
  if (normalizedKey === "ews") return "#06b6d4";

  return PALETTE[index % PALETTE.length];
}

/**
 * CompanyOfferDistribution renders a cycle-specific donut chart representing
 * offer composition by department, gender, or reservation category, with an optional
 * exact job-role filter.
 */
export default function CompanyOfferDistribution({
  company,
  cycle,
  scopeLabel,
  dimension,
  selectedRoleId,
  roleOptions,
  buckets,
  totalOffers,
  missingRoleCount,
  loading,
  error,
  onDimensionChange,
  onRoleChange,
  onRetry,
}: CompanyOfferDistributionProps): React.JSX.Element {
  const titleId = useId();
  const roleSelectId = useId();

  const dimensionLabels: Record<CompanyOfferDimension, string> = {
    department: "Department",
    gender: "Gender",
    reservationCategory: "Reservation category",
  };

  const validated = validateDistributionCounts(totalOffers, buckets);
  const dataError = error ?? (validated === null ? COUNT_ERROR : null);
  const safeTotalOffers = validated?.totalOffers ?? 0;
  const safeBuckets = validated?.buckets ?? [];
  const hasData = Boolean(company && cycle && !loading && !dataError && safeTotalOffers > 0 && safeBuckets.length > 0);

  // Compute color assignments stably per bucket
  const bucketColors = safeBuckets.map((bucket, index) => getBucketColor(bucket.key, bucket.label, index));

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <p className={styles.kicker}>OFFER COMPOSITION</p>
          <h2 id={titleId} className={styles.title}>
            Offer distribution
          </h2>
          <p className={styles.subtitle}>
            {company && cycle ? (
              <>
                <span>{company.name}</span>
                <span>•</span>
                <span>Cycle {cycle.code}</span>
                <span>•</span>
                <span>{scopeLabel}</span>
              </>
            ) : (
              <span>Select a company and cycle to view distribution</span>
            )}
          </p>
        </div>
      </header>

      {/* Controls: Dimension Segmented Control + Role Filter */}
      {company && cycle && (
        <div className={styles.toolbar}>
          <div
            className={styles.dimensionGroup}
            role="group"
            aria-label="Offer distribution dimension"
          >
            <button
              type="button"
              className={
                dimension === "department"
                  ? styles.dimensionActive
                  : styles.dimensionButton
              }
              onClick={() => onDimensionChange("department")}
              aria-pressed={dimension === "department"}
            >
              Department
            </button>
            <button
              type="button"
              className={
                dimension === "gender"
                  ? styles.dimensionActive
                  : styles.dimensionButton
              }
              onClick={() => onDimensionChange("gender")}
              aria-pressed={dimension === "gender"}
            >
              Gender
            </button>
            <button
              type="button"
              className={
                dimension === "reservationCategory"
                  ? styles.dimensionActive
                  : styles.dimensionButton
              }
              onClick={() => onDimensionChange("reservationCategory")}
              aria-pressed={dimension === "reservationCategory"}
            >
              Category
            </button>
          </div>

          <div className={styles.roleFilter}>
            <label htmlFor={roleSelectId} className={styles.roleLabel}>
              Role:
            </label>
            <select
              id={roleSelectId}
              value={selectedRoleId ?? ""}
              onChange={(e) =>
                onRoleChange(e.target.value ? e.target.value : null)
              }
              className={styles.roleSelect}
              disabled={loading}
              aria-label="Filter offers by job role"
            >
              <option value="">All roles</option>
              {roleOptions.map((opt) => (
                <option key={opt.roleId} value={opt.roleId}>
                  {formatRoleOptionLabel(opt, roleOptions)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Unassigned role footnote when All roles is chosen */}
      {selectedRoleId === null && missingRoleCount > 0 && hasData && (
        <p className={styles.missingRoleHint}>
          * Includes {missingRoleCount}{" "}
          {missingRoleCount === 1 ? "offer" : "offers"} with unassigned role/drive.
        </p>
      )}

      {/* State Views */}
      {!company && (
        <div className={styles.stateBox} role="status">
          <PieChartIcon size={32} className={styles.stateIcon} aria-hidden="true" />
          <p>Select a company to view offer distribution.</p>
        </div>
      )}

      {company && !cycle && (
        <div className={styles.stateBox} role="status">
          <PieChartIcon size={32} className={styles.stateIcon} aria-hidden="true" />
          <p>Select a placement cycle to view offer distribution.</p>
        </div>
      )}

      {company && cycle && loading && (
        <div className={styles.stateBox} role="status" aria-live="polite">
          <div className={styles.loadingSpinner} aria-hidden="true" />
          <p>Loading offer distribution for {company.name} ({cycle.code})...</p>
        </div>
      )}

      {company && cycle && !loading && dataError && (
        <div className={`${styles.stateBox} ${styles.errorBox}`} role="alert">
          <AlertCircle size={32} className={styles.errorIcon} aria-hidden="true" />
          <p className={styles.errorMessage}>{dataError}</p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={onRetry}
          >
            <RefreshCw size={13} aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {company && cycle && !loading && !dataError && (safeTotalOffers === 0 || safeBuckets.length === 0) && (
        <div className={styles.stateBox} role="status">
          <PieChartIcon size={32} className={styles.stateIcon} aria-hidden="true" />
          <p>
            No offers recorded for {company.name} in cycle {cycle.code} under the
            selected {dimensionLabels[dimension].toLowerCase()} and role filter.
          </p>
        </div>
      )}

      {/* Active Chart View */}
      {hasData && company && cycle && (
        <>
          <div className={styles.donutLayout}>
            {/* Donut Canvas */}
            <div className={styles.donutWrapper} aria-hidden="true">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={safeBuckets}
                    dataKey="count"
                    nameKey="label"
                    innerRadius="62%"
                    outerRadius="92%"
                    startAngle={90}
                    endAngle={-270}
                    stroke="#131c2b"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {safeBuckets.map((bucket, index) => (
                      <Cell
                        key={bucket.key}
                        fill={bucketColors[index]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const bucket = payload[0].payload as { key: string; label: string; count: number };
                      const share =
                        safeTotalOffers > 0
                          ? ((bucket.count / safeTotalOffers) * 100).toFixed(1)
                          : "0.0";
                      return (
                        <div className={styles.tooltip}>
                          <p className={styles.tooltipTitle}>{bucket.label}</p>
                          <p className={styles.tooltipValue}>
                            {bucket.count}{" "}
                            {bucket.count === 1 ? "offer" : "offers"}
                          </p>
                          <p className={styles.tooltipDetail}>
                            {share}% of {safeTotalOffers} total offers
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className={styles.donutCenter}>
                <span className={styles.donutCenterTotal}>{safeTotalOffers}</span>
                <span className={styles.donutCenterLabel}>
                  {safeTotalOffers === 1 ? "Offer" : "Offers"}
                </span>
              </div>
            </div>

            {/* Accessible Legend & Counts */}
            <ul
              className={styles.legendContainer}
              aria-label={`${dimensionLabels[dimension]} distribution breakdown`}
            >
              {safeBuckets.map((bucket, index) => {
                const share =
                  safeTotalOffers > 0
                    ? ((bucket.count / safeTotalOffers) * 100).toFixed(1)
                    : "0.0";
                return (
                  <li key={bucket.key} className={styles.legendItem}>
                    <div className={styles.legendLeft}>
                      <span
                        className={styles.colorSwatch}
                        style={{ backgroundColor: bucketColors[index] }}
                        aria-hidden="true"
                      />
                      <span className={styles.legendLabel} title={bucket.label}>
                        {bucket.label}
                      </span>
                    </div>
                    <div className={styles.legendRight}>
                      <span className={styles.legendCount}>{bucket.count}</span>
                      <span className={styles.legendPercent}>({share}%)</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Accessible Table for Screen Readers */}
          <table className={styles.srOnly}>
            <caption>
              Offer distribution by {dimensionLabels[dimension]} for{" "}
              {company.name} in cycle {cycle.code} ({scopeLabel})
            </caption>
            <thead>
              <tr>
                <th scope="col">{dimensionLabels[dimension]}</th>
                <th scope="col">Offers</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {safeBuckets.map((bucket) => {
                const share =
                  safeTotalOffers > 0
                    ? ((bucket.count / safeTotalOffers) * 100).toFixed(1)
                    : "0.0";
                return (
                  <tr key={bucket.key}>
                    <td>{bucket.label}</td>
                    <td>{bucket.count}</td>
                    <td>{share}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

