import Companies from "@/components/companies/Companies";
import { requireRole, resolveDepartment } from "@/lib/auth/dal";
import { getCompanies, getCompanyCycles } from "@/lib/companies/queries";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ cycle?: string | string[] }> }) {
  return <Suspense fallback={<p role="status">Loading companies…</p>}><CompanyData searchParams={searchParams} /></Suspense>;
}

async function CompanyData({ searchParams }: { searchParams: Promise<{ cycle?: string | string[] }> }) {
  const user = await requireRole("ADMIN");
  const department = await resolveDepartment(user);
  if (user.role !== "SUPERADMIN" && !department) notFound();
  const params = await searchParams;
  const cycles = await getCompanyCycles();
  if (params.cycle !== undefined && (typeof params.cycle !== "string" || (params.cycle !== "all" && !cycles.some(option => option.cycleId === params.cycle)))) notFound();
  const cycle = params.cycle === "all" ? null : params.cycle === undefined ? cycles[0] ?? null : cycles.find(option => option.cycleId === params.cycle) ?? null;
  const companies = await getCompanies(cycle?.cycleId ?? null);
  return <Companies data={companies} isAdmin={department !== null} canManageDrives={user.role === "SUPERADMIN"} cycles={cycles} cycle={cycle} scopeKey={department?.departmentId ?? "all"} scopeLabel={department?.name ?? "All departments"} />;
}
