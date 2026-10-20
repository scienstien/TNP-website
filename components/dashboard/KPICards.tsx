import type { Kpis } from "@/lib/placements/analytics";
import { formatLpa, formatPct } from "./format";

interface Props {
  kpis: Kpis;
  previous: { batchYear: number; kpis: Kpis } | null;
  offerFiltersActive: boolean;
}

type Direction = "higher-is-better" | "lower-is-better";

/** Signed change versus the previous batch, with an arrow and words, never colour alone. */
function Delta({
  current,
  previous,
  label,
  direction = "higher-is-better",
  format = (v: number) => String(v),
}: {
  current: number | null;
  previous: number | null | undefined;
  label: string;
  direction?: Direction;
  format?: (value: number) => string;
}) {
  if (current === null || previous === null || previous === undefined) {
    return (
      <span className="mme-delta mme-delta--none">
        No earlier batch to compare
      </span>
    );
  }
  const change = current - previous;
  const good = direction === "higher-is-better" ? change > 0 : change < 0;
  const tone = change === 0 ? "flat" : good ? "good" : "bad";
  const arrow = change === 0 ? "→" : change > 0 ? "↑" : "↓";
  return (
    <span className={`mme-delta mme-delta--${tone}`}>
      {label}: {format(previous)}{" "}
      <b>
        {arrow} {format(Math.abs(change))}
      </b>
    </span>
  );
}

const lpaShort = (v: number) => v.toFixed(1);

/** KPI cards computed from the filtered placement records. */
export default function KPICards({
  kpis,
  previous,
  offerFiltersActive,
}: Props) {
  const prev = previous?.kpis;
  const vs = previous ? `vs ${previous.batchYear}` : "";

  return (
    <section className="mme-kpis" aria-label="Key figures">
      <article className="mme-kpi">
        <p>Total students</p>
        <strong>{kpis.total}</strong>
        <Delta current={kpis.total} previous={prev?.total} label={vs} />
      </article>

      <article className="mme-kpi">
        <p>Placed students</p>
        <strong>{kpis.placed}</strong>
        <span className="mme-kpi-pct">
          {formatPct(kpis.placementPct)} <small>of recorded students</small>
        </span>
        <Delta current={kpis.placed} previous={prev?.placed} label={vs} />
      </article>

      <article className="mme-kpi">
        <p>Unplaced students</p>
        <strong>{kpis.unplaced}</strong>
        <span className="mme-kpi-pct">
          {formatPct(kpis.total ? (kpis.unplaced / kpis.total) * 100 : null)}{" "}
          <small>without an offer</small>
        </span>
        <Delta
          current={kpis.unplaced}
          previous={prev?.unplaced}
          label={vs}
          direction="lower-is-better"
        />
      </article>

      <article className="mme-kpi">
        <p>Average CTC</p>
        <strong>{formatLpa(kpis.average)}</strong>
        <Delta
          current={kpis.average}
          previous={prev?.average}
          label={vs}
          format={lpaShort}
        />
      </article>

      <article className="mme-kpi">
        <p>Median CTC</p>
        <strong>{formatLpa(kpis.median)}</strong>
        <Delta
          current={kpis.median}
          previous={prev?.median}
          label={vs}
          format={lpaShort}
        />
      </article>

      <article className="mme-kpi">
        <p>Mode CTC</p>
        <strong>{kpis.mode ? formatLpa(kpis.mode.value) : "—"}</strong>
        <span className="mme-delta mme-delta--none">
          {kpis.mode
            ? `${kpis.mode.frequency} offers at this package${kpis.mode.tie ? " · tie, lowest shown" : ""}`
            : "No package repeats"}
        </span>
      </article>

      <p className="mme-kpi-note">
        Placement % is placed ÷ recorded students and assumes the batch roster
        is complete.
        {kpis.packagesMissing > 0 &&
          ` CTC figures exclude ${kpis.packagesMissing} offer${kpis.packagesMissing === 1 ? "" : "s"} without a recorded package.`}
        {offerFiltersActive &&
          kpis.placedElsewhere > 0 &&
          ` ${kpis.placedElsewhere} further student${kpis.placedElsewhere === 1 ? " was" : "s were"} placed through offers outside the current filters.`}
      </p>
    </section>
  );
}
