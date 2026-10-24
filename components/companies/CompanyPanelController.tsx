"use client";
import { useState } from "react";
import { loadCompanyHistory, loadCompanyDistribution, loadCompanyDrives, loadCompanyProcess, loadCompanySummaries } from "@/lib/companies/panel-actions";
import CompanyRolePackages from "./CompanyRolePackages";
import CompanyOfferTypes from "./CompanyOfferTypes";
import CompanyDirectory from "./CompanyDirectory";
import CompanyOfferHistoryChart from "./CompanyOfferHistoryChart";
import CompanyOfferDistribution, { type CompanyOfferDimension } from "./CompanyOfferDistribution";
import CompanyProcessTable from "./CompanyProcessTable";
import CompanyContactsTable from "./CompanyContactsTable";
import { useCompanyPanel } from "./use-company-panel";
import type { CompanyListRecord } from "@/lib/companies/types";
import type { VolumeMode } from "@/lib/companies/volume";

export interface CompanyPanelProps {
  data: CompanyListRecord[]; isAdmin: boolean;
  cycles: { cycleId: string; code: string }[]; cycle: { cycleId: string; code: string } | null;
  scopeKey: string; scopeLabel: string;
}

export default function CompanyPanelController({ data, isAdmin, cycles, cycle, scopeKey, scopeLabel, volumeMode }: CompanyPanelProps & { volumeMode: VolumeMode }) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [typeRoleId, setTypeRoleId] = useState<string | null>(null);
  const [dimension, setDimension] = useState<CompanyOfferDimension>("department");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [driveId, setDriveId] = useState<string | null>(null);
  const [drivesForId, setDrivesForId] = useState<string | null>(null);
  const company = data.find(record => record.companyId === companyId) ?? null;
  const base = company ? `${scopeKey}:${company.companyId}:${selectionVersion}` : null;
  const selected = base && cycle ? `${base}:${cycle.cycleId}` : null;
  const history = useCompanyPanel(base, () => loadCompanyHistory(company!.companyId));
  const distribution = useCompanyPanel(selected && `${selected}:${dimension}:${roleId ?? "all"}`, () => loadCompanyDistribution({ companyId: company!.companyId, cycleId: cycle!.cycleId, dimension, selectedRoleId: roleId }));
  const drives = useCompanyPanel(selected, () => loadCompanyDrives(company!.companyId, cycle!.cycleId));
  const summaries = useCompanyPanel(selected, () => loadCompanySummaries(company!.companyId, cycle!.cycleId));
  const offerTypes = useCompanyPanel(selected && `${selected}:type:${typeRoleId ?? "all"}`, () => loadCompanySummaries(company!.companyId, cycle!.cycleId, typeRoleId));
  const process = useCompanyPanel(selected && driveId ? `${selected}:${driveId}` : null, () => loadCompanyProcess(company!.companyId, cycle!.cycleId, driveId!));
  const chooseCompany = (id: string | null) => {
    setCompanyId(id);
    setSelectionVersion(value => value + 1);
    setRoleId(null);
    setDriveId(null);
    setTypeRoleId(null);
  };
  const details = <div className="company-panel-grid">
      <CompanyOfferHistoryChart company={company} scopeLabel={scopeLabel} rows={history.data?.rows ?? []} loading={history.loading} error={history.error} onRetry={history.retry} />
      <CompanyOfferDistribution company={company} cycle={cycle} scopeLabel={scopeLabel} dimension={dimension} selectedRoleId={distribution.data ? distribution.data.selectedRoleId : roleId} roleOptions={distribution.data?.roleOptions ?? []} buckets={distribution.data?.buckets ?? []} totalOffers={distribution.data?.totalOffers ?? 0} missingRoleCount={distribution.data?.missingRoleCount ?? 0} loading={distribution.loading} error={distribution.error} onDimensionChange={setDimension} onRoleChange={setRoleId} onRetry={distribution.retry} />
      <CompanyProcessTable company={company} cycle={cycle} drives={drives.data ?? []} selectedDriveId={driveId} events={process.data ?? []} loading={drives.loading || process.loading} error={drives.error ?? process.error} onDriveChange={setDriveId} onRefresh={() => { drives.retry(); process.retry(); }} onEditDrives={isAdmin && company ? () => setDrivesForId(company.companyId) : undefined} />
      <CompanyContactsTable company={company} cycle={cycle} drives={drives.data ?? []} loading={drives.loading} error={drives.error} onRetry={drives.retry} />
      <CompanyRolePackages rows={summaries.data?.rows ?? []} active={!!selected} loading={summaries.loading} error={summaries.error} onRetry={summaries.retry} />
      <CompanyOfferTypes types={offerTypes.data?.types ?? []} total={offerTypes.data?.typeTotal ?? 0} active={!!selected} loading={offerTypes.loading} error={offerTypes.error} onRetry={offerTypes.retry} roles={summaries.data?.rows ?? []} roleId={offerTypes.data ? offerTypes.data.selectedRoleId : typeRoleId} onRoleChange={setTypeRoleId} />
    </div>;
  // Drive edits change the open company's drives, roles and contacts: reload its panels.
  const reloadSelected = () => { if (companyId) chooseCompany(companyId); };
  return <CompanyDirectory data={data} volumeMode={volumeMode} isAdmin={isAdmin} cycle={cycle} cycles={cycles} selectedCompanyId={company?.companyId ?? null} onSelect={chooseCompany} drivesForId={drivesForId} onCloseDrives={() => setDrivesForId(null)} onDrivesChanged={reloadSelected} details={details} />;
}
