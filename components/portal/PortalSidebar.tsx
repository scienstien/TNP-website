import Image from "next/image";
import PortalNavigation from "./PortalNavigation";
import UserProfile from "./UserProfile";
import type { DashboardUser, PortalRole } from "./types";

interface Props {
  user: DashboardUser;
  role: PortalRole;
  isSuper: boolean;
  collapsed: boolean;
  pinned: boolean;
  onToggle: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function PortalSidebar({
  user,
  role,
  isSuper,
  collapsed,
  pinned,
  onToggle,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  return (
    <aside
      className={`sidebar ${collapsed ? "sidebar--collapsed" : "sidebar--expanded"} ${
        pinned ? "sidebar--pinned" : ""
      }`}
      aria-label="Main Navigation"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="sidebar-header">
        <div className="sidebar-logo-wrap">
          <Image
            className="sidebar-logo"
            src="/nitt-logo.webp"
            alt="NIT Trichy"
            width={40}
            height={40}
            priority
          />
          <span className="sidebar-brandDivider" aria-hidden="true" />
          <span className="sidebar-lockup">
            <strong>T&amp;P</strong>
            <small>
              NIT TRICHY ·{" "}
              {user.department ? user.department.code.toUpperCase() : "ALL DEPARTMENTS"}
            </small>
          </span>
        </div>
        <button
          type="button"
          className={`sidebar-toggle-btn ${pinned ? "sidebar-toggle-btn--pinned" : ""}`}
          onClick={onToggle}
          aria-label={pinned ? "Unpin sidebar (Ctrl+B)" : "Pin sidebar open (Ctrl+B)"}
          title={pinned ? "Unpin sidebar (auto-collapse on hover)" : "Pin sidebar open"}
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>
      </div>
      <PortalNavigation role={role} collapsed={collapsed} />
      <UserProfile user={user} role={role} isSuper={isSuper} collapsed={collapsed} />
    </aside>
  );
}
