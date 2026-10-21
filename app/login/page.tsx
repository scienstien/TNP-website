import { Suspense } from "react";
import { listDepartments } from "@/lib/auth/dal";
import LoginView from "./LoginView";

// The sign-up form lists the departments in the database. Until they load, the form is shown
// with an empty list: signing in does not need it.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginView departments={[]} />}>
      <LoginWithDepartments />
    </Suspense>
  );
}

async function LoginWithDepartments() {
  // An unreachable database only empties the sign-up choices.
  const departments = await listDepartments().catch(() => []);
  return (
    <LoginView
      departments={departments.map(({ code, name }) => ({ code, name }))}
    />
  );
}
