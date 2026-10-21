"use client";

import { useMemo } from "react";
import {
  batchYears,
  companyNames,
  computeKpis,
  ctcBounds,
  ctcHistogram,
  hasOfferFilters,
  offerTypeSplit,
  previousBatchKpis,
  scopeRecords,
  sectorNames,
  sectorPlacement,
  topCompanies,
} from "@/lib/placements/analytics";
import type { PlacementRecord } from "@/lib/placements/types";
import CTCDistributionChart from "./charts/CTCDistributionChart";
import OfferTypeDistributionChart from "./charts/OfferTypeDistributionChart";
import SectorPlacementChart from "./charts/SectorPlacementChart";
import TopCompaniesOfferChart from "./charts/TopCompaniesOfferChart";
import DashboardFilters from "./DashboardFilters";
import DashboardHeader, { type HeaderRole } from "./DashboardHeader";
import KPICards from "./KPICards";
import { useDashboardFilters } from "./useDashboardFilters";
import "./analytics.css";

interface Props {
  records: PlacementRecord[];
  role: HeaderRole;
  department: { code: string; name: string } | null;
}

/** The main dashboard: header, shared filters, KPIs and the four independent charts. */
export default function PlacementAnalytics({ records, role, department }: Props) {
  const { filters, update, toggle, reset } = useDashboardFilters(records);

  const options = useMemo(
    () => ({
      batches: batchYears(records),
      companies: companyNames(records),
      sectors: sectorNames(records),
      ctc: ctcBounds(records),
    }),
    [records],
  );

  const view = useMemo(() => {
    const scope = scopeRecords(records, filters);
    return {
      kpis: computeKpis(scope),
      previous: previousBatchKpis(records, filters),
      companies: topCompanies(scope),
      offerTypes: offerTypeSplit(scope),
      sectors: sectorPlacement(scope),
      ctc: ctcHistogram(scope),
    };
  }, [records, filters]);

  if (records.length === 0) {
    return (
      <div className="mme-analytics">
        <DashboardHeader role={role} department={department} batches={0} students={0} />
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
        batches={options.batches.length}
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
        previous={view.previous}
        offerFiltersActive={hasOfferFilters(filters)}
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
        <SectorPlacementChart
          data={view.sectors}
          unplaced={view.kpis.unplaced}
          onSectorSelect={(sector) => toggle("sector", sector)}
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
