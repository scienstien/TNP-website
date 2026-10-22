import { signOutAction } from "@/lib/auth/actions";
import type { DashboardUser, PortalRole } from "./types";

export default function UserProfile({
  user,
  role,
  isSuper,
}: {
  user: DashboardUser;
  role: PortalRole;
  isSuper: boolean;
}) {
  const displayName = user.name?.trim() || user.email;
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="profile">
      <b>{initials}</b>
      <span>
        {displayName}
        {role === "Admin" && <small>{isSuper ? "Super administrator" : "Administrator"}</small>}
      </span>
      <form action={signOutAction}>
        <button type="submit" className="signout-button">
          Sign out
        </button>
      </form>
    </div>
  );
}
