import { Suspense } from "react";
import OutreachTracker from "@/components/outreach/OutreachTracker";
import { isAdminRole, requireUser, resolveDepartment } from "@/lib/auth/dal";
import { getOutreachContacts } from "@/lib/outreach/queries";

export default function OutreachPage() {
  return <Suspense fallback={<p role="status">Loading outreach…</p>}><OutreachData /></Suspense>;
}

async function OutreachData() {
  const user = await requireUser();
  const [department, outreachContacts] = await Promise.all([
    resolveDepartment(user),
    getOutreachContacts(),
  ]);
  const canManage = isAdminRole(user.role);
  const canEdit = canManage && department !== null;

  return <OutreachTracker data={outreachContacts} isAdmin={canEdit} canManage={canManage} />;
}
