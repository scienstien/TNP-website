"use client";

import { useState } from "react";
import { useCompanyPanel } from "@/components/companies/use-company-panel";
import { loadPlacementBreakdown } from "@/lib/placements/breakdown-actions";
import {
  BREAKDOWN_DIMENSIONS,
  BREAKDOWN_LABELS,
  LISTED_GENDER_KEYS,
  placementRate,
  type BreakdownDimension,
} from "@/lib/placements/breakdown-types";
import { formatPct } from "./format";
import type { DegreeLevel } from "@/lib/placements/types";

interface Props {
  /** Selected placement cycle; null covers every cycle. */
  cycleId: string | null;
  cycleLabel: string;
  /** Changes when the server-side department scope changes, so older answers are dropped. */
  scopeKey: string;
  degreeLevel?: DegreeLevel;
  specialization: string | null;
  branch: string | null;
}

/** Placed ÷ registered per department, gender or category, switched with a toggle. */
export default function PlacementBreakdown({ cycleId, cycleLabel, scopeKey, degreeLevel = "UG", specialization, branch }: Props) {
  const [dimension, setDimension] = useState<BreakdownDimension>("department");
  const { data, error, loading, retry } = useCompanyPanel(
    `${scopeKey}:${degreeLevel}:${branch ?? "all"}:${specialization ?? "all"}:${dimension}:${cycleId ?? "all"}`,
    () => loadPlacementBreakdown(dimension, cycleId, degreeLevel, specialization, branch),
  );

  const rows = data?.rows;
  // Totals cover every group in scope, so the Total row matches the KPI cards in every view.
  const registered = rows?.reduce((sum, row) => sum + row.registered, 0) ?? 0;
  const placed = rows?.reduce((sum, row) => sum + row.placed, 0) ?? 0;
  // A department is compared with the whole institute; gender and category with the
  // placed students of the current selection.
  const shareOfInstitute = dimension === "department";
  const shareBase = shareOfInstitute ? (data?.institutePlaced ?? 0) : placed;
  const listed =
    dimension === "gender"
      ? rows?.filter((row) => LISTED_GENDER_KEYS.includes(row.key))
      : rows;
  const unlisted = rows?.filter((row) => !listed?.includes(row)) ?? [];
  const unlistedRegistered = unlisted.reduce((sum, row) => sum + row.registered, 0);
  const unlistedPlaced = unlisted.reduce((sum, row) => sum + row.placed, 0);

  return (
    <section className="panel mme-card mme-breakdown" aria-label="Placement by group">
      <header className="mme-card-head">
        <div>
          <h2>Placement by {BREAKDOWN_LABELS[dimension].toLowerCase()}</h2>
          <p>
            Placed ÷ registered {degreeLevel === "PG" ? "PG " : ""}students · {cycleLabel}
          </p>
        </div>
        <div className="mme-toggle" role="group" aria-label="Group placement by">
          {BREAKDOWN_DIMENSIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === dimension}
              onClick={() => setDimension(option)}
            >
              {BREAKDOWN_LABELS[option]}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <p className="mme-empty" role="status">Loading…</p>
      ) : error ? (
        <p className="mme-empty" role="alert">
          {error} <button type="button" onClick={retry}>Retry</button>
        </p>
      ) : !rows?.length ? (
        <p className="mme-empty" role="status">No registered students in this selection.</p>
      ) : (
        <table className="mme-breakdown-table">
          <thead>
            <tr>
              <th scope="col">{BREAKDOWN_LABELS[dimension]}</th>
              <th scope="col">Placed / registered</th>
              <th scope="col">Placed %</th>
              <th scope="col">
                {shareOfInstitute ? "Share of institute placed" : "Share of placed"}
              </th>
            </tr>
          </thead>
          <tbody>
            {listed?.map((row) => (
              <BreakdownLine
                key={row.key}
                label={row.label}
                placed={row.placed}
                registered={row.registered}
                shareBase={shareBase}
              />
            ))}
          </tbody>
          <tfoot>
            <BreakdownLine label="Total" placed={placed} registered={registered} shareBase={shareBase} />
          </tfoot>
        </table>
      )}

      {!loading && !error && unlisted.length > 0 && (
        <p className="mme-footnote">
          Not listed ({unlisted.map((row) => row.label).join(", ")}): {unlistedPlaced} placed
          of {unlistedRegistered} registered. They are included in the total.
        </p>
      )}
    </section>
  );
}

function BreakdownLine({
  label,
  placed,
  registered,
  shareBase,
}: {
  label: string;
  placed: number;
  registered: number;
  /** The placed count the group's share is measured against. */
  shareBase: number;
}) {
  const rate = placementRate(placed, registered);
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{placed} / {registered}</td>
      <td>
        <span className="mme-bar" aria-hidden="true">
          <span style={{ width: `${rate ?? 0}%` }} />
        </span>
        {formatPct(rate)}
      </td>
      <td>
        {placed} / {shareBase} <small>({formatPct(placementRate(placed, shareBase))})</small>
      </td>
    </tr>
  );
}
