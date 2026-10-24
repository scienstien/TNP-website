"use client";

import { useMemo } from "react";
import {
  companyNames,
  comparisonCycleKpis,
  computeKpis,
  ctcBounds,
  ctcHistogram,
  hasOfferFilters,
  offerTypeSplit,
  placementCycles,
  scopeRecords,
  domainNames,
  domainPlacement,
  topCompanies,
} from "@/lib/placements/analytics";
import type { PlacementRecord } from "@/lib/placements/types";
import CTCDistributionChart from "./charts/CTCDistributionChart";
import OfferTypeDistributionChart from "./charts/OfferTypeDistributionChart";
import DomainPlacementChart from "./charts/DomainPlacementChart";
import TopCompaniesOfferChart from "./charts/TopCompaniesOfferChart";
import DashboardFilters from "./DashboardFilters";
import DashboardHeader, { type HeaderRole } from "./DashboardHeader";
import KPICards from "./KPICards";
import PlacementBreakdown from "./PlacementBreakdown";
import { offerFilterParts } from "./offerFilterText";
import { useDashboardFilters } from "./useDashboardFilters";
import "./analytics.css";

interface Props {
  records: PlacementRecord[];
  role: HeaderRole;
  department: { code: string; name: string } | null;
}

/** The main dashboard: header, shared filters, KPIs and the four independent charts. */
export default function PlacementAnalytics({ records, role, department }: Props) {
  const { filters, update, toggle, reset } = useDashboardFilters();

  const options = useMemo(
    () => ({
      cycles: placementCycles(records),
      companies: companyNames(records),
      domains: domainNames(records),
      ctc: ctcBounds(records),
    }),
    [records],
  );

  const view = useMemo(() => {
    const scope = scopeRecords(records, filters);
    return {
      kpis: computeKpis(scope),
      comparison: comparisonCycleKpis(records, filters),
      companies: topCompanies(scope),
      offerTypes: offerTypeSplit(scope),
      domains: domainPlacement(scope),
      ctc: ctcHistogram(scope),
    };
  }, [records, filters]);

  if (records.length === 0) {
    return (
      <div className="mme-analytics">
        <DashboardHeader role={role} department={department} cycles={0} students={0} />
        <section className="panel mme-empty mme-empty--page" role="status">
          No placement records yet. Once historical data is imported, the
          dashboard fills in automatically.
        </section>
      </div>
    );
  }

  return (
    <div className="mme-analytics">
      <DashboardHeader
        role={role}
        department={department}
        cycles={options.cycles.length}
        students={records.length}
      />
      <DashboardFilters
        filters={filters}
        options={options}
        onChange={update}
        onReset={reset}
      />
      <KPICards
        kpis={view.kpis}
        comparison={view.comparison}
        offerFiltersActive={hasOfferFilters(filters)}
        placedFilterHeading={filters.company ? "Offers by this company" : "Placed (filtered)"}
        placedFilterParts={offerFilterParts(filters)}
      />

      <PlacementBreakdown
        cycleId={filters.cycleId}
        cycleLabel={
          options.cycles.find((cycle) => cycle.id === filters.cycleId)?.code ??
          "all placement cycles"
        }
        scopeKey={department?.code ?? "all"}
      />

      <div className="mme-row mme-row--wide">
        <TopCompaniesOfferChart
          data={view.companies}
          onCompanySelect={(company) => toggle("company", company)}
        />
        <OfferTypeDistributionChart
          data={view.offerTypes}
          selectedType={filters.offerType}
          onOfferTypeSelect={(type) => toggle("offerType", type)}
        />
      </div>

      <div className="mme-row">
        <DomainPlacementChart
          data={view.domains}
          unplaced={view.kpis.unplaced}
          onDomainSelect={(domain) => toggle("domain", domain)}
        />
        <CTCDistributionChart
          data={view.ctc.buckets}
          excluded={view.ctc.excluded}
          onRangeSelect={(bucket) =>
            update(
              filters.ctcMin === bucket.min
                ? { ctcMin: null, ctcMax: null }
                : {
                    ctcMin: bucket.min,
                    ctcMax: bucket.max === null ? null : bucket.max - 0.01,
                  },
            )
          }
        />
      </div>
    </div>
  );
}
