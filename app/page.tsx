import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import Dashboard from "./Dashboard";

// The dashboard needs a signed-in user; the role shown comes from the database, not the client.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignedInDashboard />
    </Suspense>
  );
}

async function SignedInDashboard() {
  const user = await requireUser();
  return (
    <Dashboard user={{ name: user.name, email: user.email, role: user.role }} />
  );
}
