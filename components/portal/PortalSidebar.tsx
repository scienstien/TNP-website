import Image from "next/image";
import PortalNavigation from "./PortalNavigation";
import UserProfile from "./UserProfile";
import type { DashboardUser, PortalRole } from "./types";

interface Props {
  user: DashboardUser;
  role: PortalRole;
  isSuper: boolean;
}

export default function PortalSidebar({ user, role, isSuper }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo-wrap">
        <Image className="sidebar-logo" src="/nitt-logo.webp" alt="NIT Trichy" width={48} height={48} priority />
        <span className="sidebar-brandDivider" aria-hidden="true" />
        <span className="sidebar-lockup">
          <strong>T&amp;P</strong>
          <small>NIT TRICHY · {user.department ? user.department.code.toUpperCase() : "ALL DEPARTMENTS"}</small>
        </span>
      </div>
      <PortalNavigation role={role} />
      <UserProfile user={user} role={role} isSuper={isSuper} />
    </aside>
  );
}
