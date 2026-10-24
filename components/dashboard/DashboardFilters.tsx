"use client";

import { useId } from "react";
import type {
  DashboardFilterState,
  PlacementCycleOption,
} from "@/lib/placements/analytics";
import { OFFER_TYPES, type OfferTypeValue } from "@/lib/placements/types";
import { OFFER_TYPE_LABELS } from "./chartTheme";

export interface FilterOptions {
  cycles: PlacementCycleOption[];
  companies: string[];
  domains: string[];
  /** Whole-LPA bounds of recorded packages. */
  ctc: [number, number];
}

interface Props {
  filters: DashboardFilterState;
  options: FilterOptions;
  onChange: (patch: Partial<DashboardFilterState>) => void;
  onReset: () => void;
}

const lpa = (value: number) =>
  `${Number.isInteger(value) ? value : value.toFixed(1)} LPA`;

/** Shared filters for every KPI and chart, with removable chips for what is active. */
export default function DashboardFilters({
  filters,
  options,
  onChange,
  onReset,
}: Props) {
  const id = useId();
  const [lo, hi] = options.ctc;
  const min = filters.ctcMin ?? lo;
  const max = filters.ctcMax ?? hi;

  const chips: { label: string; clear: () => void }[] = [];
  if (filters.cycleId) {
    const cycle = options.cycles.find((option) => option.id === filters.cycleId);
    chips.push({
      label: `Cycle ${cycle?.code ?? filters.cycleId}`,
      clear: () => onChange({ cycleId: null }),
    });
  }
  if (filters.comparisonCycleId) {
    const cycle = options.cycles.find(
      (option) => option.id === filters.comparisonCycleId,
    );
    chips.push({
      label: `Compare ${cycle?.code ?? filters.comparisonCycleId}`,
      clear: () => onChange({ comparisonCycleId: null }),
    });
  }
  if (filters.company)
    chips.push({
      label: filters.company,
      clear: () => onChange({ company: null }),
    });
  if (filters.domain)
    chips.push({
      label: `Domain: ${filters.domain}`,
      clear: () => onChange({ domain: null }),
    });
  if (filters.offerType)
    chips.push({
      label: OFFER_TYPE_LABELS[filters.offerType],
      clear: () => onChange({ offerType: null }),
    });
  if (filters.ctcMin !== null || filters.ctcMax !== null)
    chips.push({
      label: `CTC ${lpa(min)} – ${lpa(max)}`,
      clear: () => onChange({ ctcMin: null, ctcMax: null }),
    });

  return (
    <section className="panel mme-filters" aria-label="Dashboard filters">
      <div className="mme-filter-grid">
        <label className="mme-field" htmlFor={`${id}-cycle`}>
          <span>Placement cycle</span>
          <select
            id={`${id}-cycle`}
            value={filters.cycleId ?? ""}
            onChange={(e) => onChange({ cycleId: e.target.value || null })}
          >
            <option value="">All placement cycles</option>
            {options.cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.code}
              </option>
            ))}
          </select>
        </label>

        <label className="mme-field" htmlFor={`${id}-comparison-cycle`}>
          <span>Compare with cycle</span>
          <select
            id={`${id}-comparison-cycle`}
            value={filters.comparisonCycleId ?? ""}
            disabled={!filters.cycleId}
            onChange={(e) =>
              onChange({ comparisonCycleId: e.target.value || null })
            }
          >
            <option value="">Select comparison</option>
            {options.cycles
              .filter((cycle) => cycle.id !== filters.cycleId)
              .map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.code}
                </option>
              ))}
          </select>
        </label>

        <label className="mme-field" htmlFor={`${id}-company`}>
          <span>Company</span>
          <select
            id={`${id}-company`}
            value={filters.company ?? ""}
            onChange={(e) => onChange({ company: e.target.value || null })}
          >
            <option value="">All companies</option>
            {options.companies.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
        </label>

        <label className="mme-field" htmlFor={`${id}-domain`}>
          <span>Domain</span>
          <select
            id={`${id}-domain`}
            value={filters.domain ?? ""}
            onChange={(e) => onChange({ domain: e.target.value || null })}
          >
            <option value="">All domains</option>
            {options.domains.map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>
        </label>

        <label className="mme-field" htmlFor={`${id}-type`}>
          <span>Offer type</span>
          <select
            id={`${id}-type`}
            value={filters.offerType ?? ""}
            onChange={(e) =>
              onChange({
                offerType: (e.target.value || null) as OfferTypeValue | null,
              })
            }
          >
            <option value="">All types</option>
            {OFFER_TYPES.map((type) => (
              <option key={type} value={type}>
                {OFFER_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="mme-field mme-ctc" disabled={hi <= lo}>
          <legend>
            CTC range{" "}
            <b>
              {lpa(min)} – {lpa(max)}
            </b>
          </legend>
          <div className="mme-range">
            <input
              type="range"
              aria-label="Minimum CTC (LPA)"
              min={lo}
              max={hi}
              step={0.5}
              value={min}
              onChange={(e) => {
                const value = Math.min(Number(e.target.value), max);
                onChange({ ctcMin: value <= lo ? null : value });
              }}
            />
            <input
              type="range"
              aria-label="Maximum CTC (LPA)"
              min={lo}
              max={hi}
              step={0.5}
              value={max}
              onChange={(e) => {
                const value = Math.max(Number(e.target.value), min);
                onChange({ ctcMax: value >= hi ? null : value });
              }}
            />
          </div>
        </fieldset>

        <button type="button" className="mme-reset" onClick={onReset}>
          Reset filters
        </button>
      </div>

      {chips.length > 0 && (
        <ul className="mme-chips" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.label}>
              <span>{chip.label}</span>
              <button
                type="button"
                aria-label={`Remove filter ${chip.label}`}
                onClick={chip.clear}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
