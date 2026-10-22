import DriveManager from "@/components/drives/DriveManager";
import { requireRole, resolveDepartment } from "@/lib/auth/dal";
import { getCompanyCycles } from "@/lib/companies/queries";
import { getDriveCompanies, getDriveOptions } from "@/lib/drives/queries";

export default async function DrivesPage({ searchParams }: { searchParams: Promise<{ cycle?: string | string[]; company?: string | string[] }> }) {
  const user = await requireRole("SUPERADMIN");
  const department = await resolveDepartment(user);
  const params = await searchParams;
  const [cycles, companies] = await Promise.all([getCompanyCycles(), getDriveCompanies()]);
  const cycleId = cycles.find(cycle => cycle.cycleId === params.cycle)?.cycleId ?? "";
  const companyId = companies.find(company => company.companyId === params.company)?.companyId ?? "";
  const drives = cycleId ? await getDriveOptions({ cycleId, ...(companyId ? { companyId } : {}) }) : [];
  return <DriveManager drives={drives} cycles={cycles} companies={companies} cycleId={cycleId} companyId={companyId} canEdit={department !== null} />;
}
