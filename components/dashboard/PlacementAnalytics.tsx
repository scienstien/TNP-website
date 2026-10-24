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
  specializationOf,
  domainNames,
  pgSpecializationNames,
  domainPlacement,
  topCompanies,
} from "@/lib/placements/analytics";
import type { PlacementRecord } from "@/lib/placements/types";
import type { DegreeLevel } from "@/lib/placements/types";
import CTCDistributionChart from "./charts/CTCDistributionChart";
import OfferTypeDistributionChart from "./charts/OfferTypeDistributionChart";
import DomainPlacementChart from "./charts/DomainPlacementChart";
import TopCompaniesOfferChart from "./charts/TopCompaniesOfferChart";
import DashboardFilters from "./DashboardFilters";
import DashboardHeader, { type HeaderRole } from "./DashboardHeader";
import KPICards from "./KPICards";
import PlacementBreakdown from "./PlacementBreakdown";
import StudentsOverTime from "./StudentsOverTime";
import { offerFilterParts } from "./offerFilterText";
import { useDashboardFilters } from "./useDashboardFilters";
import "./analytics.css";

interface Props {
  records: PlacementRecord[];
  role: HeaderRole;
  department: { code: string; name: string } | null;
  /** Today at the institute (YYYY-MM-DD); decides the "current" year, month and week. */
  today: string;
  degreeLevel?: DegreeLevel;
}

/** The main dashboard: header, shared filters, KPIs and the four independent charts. */
export default function PlacementAnalytics({ records, role, department, today, degreeLevel = "UG" }: Props) {
  const options = useMemo(
    () => ({
      cycles: placementCycles(records),
      companies: companyNames(records),
      domains: domainNames(records),
      showPgProgrammes: degreeLevel === "PG",
      ctc: ctcBounds(records),
    }),
    [records, degreeLevel],
  );
  const { filters, update, toggle, reset } = useDashboardFilters(
    options.cycles[0]?.id ?? null,
  );
  const filterOptions = useMemo(() => ({
    ...options,
    specializations: degreeLevel === "PG"
      ? pgSpecializationNames(records, department)
      : [],
  }), [options, degreeLevel, records, department]);

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

  // The trend spans every cycle and ignores offer filters; PG specialization still applies.
  const trendRecords = useMemo(
    () => records.filter((record) =>
      (filters.specialization === null || specializationOf(record) === filters.specialization)),
    [records, filters.specialization],
  );

  if (records.length === 0 && degreeLevel === "UG") {
    return (
      <div className="mme-analytics">
        <DashboardHeader role={role} department={department} cycles={0} students={0} degreeLevel={degreeLevel} />
        <section className="panel mme-empty mme-empty--page" role="status">
          No UG placement records yet. Once historical data is imported, the
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
        degreeLevel={degreeLevel}
      />
      <DashboardFilters
        filters={filters}
        options={filterOptions}
        onChange={update}
        onReset={reset}
      />
      {records.length === 0 && (
        <section className="panel mme-empty mme-empty--page" role="status">
          No PG placement records yet. The programme catalogue is available above;
          figures will appear after historical records are imported.
        </section>
      )}
      <KPICards
        kpis={view.kpis}
        comparison={view.comparison}
        offerFiltersActive={hasOfferFilters(filters)}
        placedFilterHeading={filters.company ? "Offers by this company" : "Placed (filtered)"}
        placedFilterParts={offerFilterParts(filters)}
      />

      <PlacementBreakdown
        cycleId={filters.cycleId}
        degreeLevel={degreeLevel}
        specialization={filters.specialization}
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

      {/* Across every cycle and independent of the offer filters: a trend cut to one cycle would say nothing. */}
      <StudentsOverTime records={trendRecords} today={today} departmentName={department?.name ?? null} degreeLevel={degreeLevel} />
    </div>
  );
}
