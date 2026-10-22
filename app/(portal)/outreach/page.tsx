import OutreachTracker from "@/components/outreach/OutreachTracker";
import { isAdminRole, requireUser, resolveDepartment } from "@/lib/auth/dal";
import { getOutreachContacts } from "@/lib/outreach/queries";

export default async function OutreachPage() {
  const user = await requireUser();
  const [department, outreachContacts] = await Promise.all([
    resolveDepartment(user),
    getOutreachContacts(),
  ]);
  const canEdit = isAdminRole(user.role) && department !== null;

  return <OutreachTracker data={outreachContacts} isAdmin={canEdit} />;
}
