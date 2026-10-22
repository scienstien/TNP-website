import Companies from "@/components/companies/Companies";
import { requireRole, resolveDepartment } from "@/lib/auth/dal";
import { getCompanies, getCompanyCycles } from "@/lib/companies/queries";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ cycle?: string | string[] }> }) {
  const user = await requireRole("ADMIN");
  const department = await resolveDepartment(user);
  const params = await searchParams;
  const cycles = await getCompanyCycles();
  const cycle = cycles.find(option => option.cycleId === params.cycle) ?? null;
  const companies = await getCompanies(cycle?.cycleId ?? null);
  return <Companies data={companies} isAdmin={department !== null} canManageDrives={user.role === "SUPERADMIN"} cycles={cycles} cycle={cycle} />;
}
