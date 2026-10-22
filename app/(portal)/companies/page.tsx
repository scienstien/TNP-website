import Companies from "@/components/companies/Companies";
import ChooseDepartment from "@/components/portal/ChooseDepartment";
import { requireRole, resolveDepartment } from "@/lib/auth/dal";
import { todayInInstituteZone } from "@/lib/calendar/dates";
import { getCompanies } from "@/lib/companies/queries";
import { batchYearForDate } from "@/lib/placements/year-to-date";

export default async function CompaniesPage() {
  const user = await requireRole("ADMIN");
  const department = await resolveDepartment(user);
  if (!department) return <ChooseDepartment />;

  const companies = await getCompanies(batchYearForDate(todayInInstituteZone()));
  return <Companies data={companies} isAdmin />;
}
