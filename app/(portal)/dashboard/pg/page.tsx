import { requireUser } from "@/lib/auth/dal";

export default async function PostgraduateDashboardPage() {
  await requireUser();
  return null;
}
