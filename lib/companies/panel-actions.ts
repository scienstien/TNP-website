"use server";
import { getCompanyOfferHistory } from "./offer-history";
import { getCompanyOfferDistribution, type CompanyOfferDistributionInput } from "./offer-distribution";
import { getCompanyDriveOptions, getCompanyProcess } from "./panel-queries";
import { getCompanyOfferSummaries } from "./offer-summaries";

export async function loadCompanyHistory(companyId: string) { return getCompanyOfferHistory(companyId); }
export async function loadCompanyDistribution(input: CompanyOfferDistributionInput) { return getCompanyOfferDistribution(input); }
export async function loadCompanyDrives(companyId: string, cycleId: string) { return getCompanyDriveOptions(companyId, cycleId); }
export async function loadCompanySummaries(companyId: string, cycleId: string, roleId: string | null = null) { return getCompanyOfferSummaries(companyId, cycleId, roleId); }
export async function loadCompanyProcess(companyId: string, cycleId: string, driveId: string) { return getCompanyProcess(companyId, cycleId, driveId); }
