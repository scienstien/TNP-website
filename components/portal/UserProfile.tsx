import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import type { DashboardUser, PortalRole } from "./types";

export default function UserProfile({
  user,
  role,
  isSuper,
  collapsed = false,
}: {
  user: DashboardUser;
  role: PortalRole;
  isSuper: boolean;
  collapsed?: boolean;
}) {
  const displayName = user.name?.trim() || user.email;
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`profile ${collapsed ? "profile--collapsed" : ""}`}>
      <b title={displayName}>{initials}</b>
      <span className="profile-details">
        {displayName}
        {role === "Admin" && (
          <small>{isSuper ? "Super administrator" : "Administrator"}</small>
        )}
      </span>
      <form action={signOutAction} className="profile-signout-form">
        <button
          type="submit"
          className="signout-button"
          title="Sign out"
          aria-label="Sign out"
        >
          {collapsed ? <LogOut size={14} strokeWidth={2} /> : "Sign out"}
        </button>
      </form>
    </div>
  );
}
