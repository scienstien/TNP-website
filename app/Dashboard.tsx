"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Building2,
  CalendarDays,
  GraduationCap,
  Home as HomeIcon,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import StudentRecords from "@/components/students/StudentRecords";
import type { StudentData } from "@/lib/students/types";
import DriveCalendar from "@/components/calendar/DriveCalendar";
import PlacementAnalytics from "@/components/dashboard/PlacementAnalytics";
import { signOutAction } from "@/lib/auth/actions";
import type { CalendarData } from "@/lib/calendar/types";
import type { PlacementRecord } from "@/lib/placements/types";
import Companies from "@/components/companies/Companies";
import type { CompanyRecord } from "@/lib/companies/types";

type View = "Home" | "Overview" | "Calendar" | "Companies" | "Students";

export interface DashboardUser {
  name: string | null;
  email: string;
  role: "ADMIN" | "PROFESSOR";
}

/** Rendered by app/page.tsx with the user verified on the server; the role cannot be switched here. */
export default function Dashboard({
  user,
  placementRecords,
  calendar,
  studentData,
  companies,
  today,
}: {
  user: DashboardUser;
  placementRecords: PlacementRecord[];
  calendar: CalendarData;
  studentData: StudentData | null;
  companies: CompanyRecord[];
  /** Today's date at the institute (YYYY-MM-DD), computed on the server. */
  today: string;
}) {
  const [view, setView] = useState<View>("Home");
  const role: "Professor" | "Admin" =
    user.role === "ADMIN" ? "Admin" : "Professor";
  const upcomingCount = calendar.visits.filter(
    (visit) => visit.visitDate >= today,
  ).length;
  const displayName = user.name?.trim() || user.email;
  const firstName = displayName.split(/[\s@]/)[0];
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <main className="portal-shell">
      <aside className="sidebar">
        <div className="sidebar-logo-wrap">
          <Image className="sidebar-logo" src="/nitt-logo.webp" alt="NIT Trichy" width={48} height={48} priority />
          <span className="sidebar-brandDivider" aria-hidden="true" />
          <span className="sidebar-lockup">
            <strong>T&amp;P</strong>
            <small>NIT TRICHY · MME</small>
          </span>
        </div>
        <nav>
          <NavButton
            active={view === "Home"}
            onClick={() => setView("Home")}
            icon={HomeIcon}
          >
            Home
          </NavButton>
          <NavButton
            active={view === "Overview"}
            onClick={() => setView("Overview")}
            icon={LayoutDashboard}
          >
            Dashboard
          </NavButton>
          <NavButton
            active={view === "Calendar"}
            onClick={() => setView("Calendar")}
            icon={CalendarDays}
          >
            Calendar {upcomingCount > 0 && <small aria-label={`${upcomingCount} upcoming visits`}>{upcomingCount}</small>}
          </NavButton>
          <NavButton
            active={view === "Companies"}
            onClick={() => setView("Companies")}
            icon={Building2}
          >
            Companies
          </NavButton>
          {role === "Admin" && (
            <NavButton
              active={view === "Students"}
              onClick={() => setView("Students")}
              icon={GraduationCap}
            >
              Student records
            </NavButton>
          )}
        </nav>
        <div className="profile">
          <b>{initials}</b>
          <span>
            {displayName}
            <small>
              {role === "Admin" ? "Administrator" : "Faculty · read-only"}
            </small>
          </span>
          <form action={signOutAction}>
            <button type="submit" className="signout-button">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <section className="content-area">
        {view === "Home" && (
          <HomeView
            role={role}
            firstName={firstName}
            onDashboard={() => setView("Overview")}
            onCalendar={() => setView("Calendar")}
          />
        )}
        {view === "Overview" && (
          <PlacementAnalytics records={placementRecords} role={role} />
        )}
        {view === "Calendar" && (
          <>
            <Heading
              eyebrow="RECRUITMENT PIPELINE"
              title="Drive calendar"
              subtitle="Companies visiting campus. Select a day to see who is coming."
            />
            <DriveCalendar
              data={calendar}
              today={today}
              isAdmin={role === "Admin"}
            />
          </>
        )}
        {view === "Companies" && <Companies data={companies} isAdmin={role === "Admin"} />}
        {view === "Students" && role === "Admin" && studentData && (
          <StudentRecords data={studentData} />
        )}
      </section>
    </main>
  );
}

function HomeView({
  role,
  firstName,
  onDashboard,
  onCalendar,
}: {
  role: "Professor" | "Admin";
  firstName: string;
  onDashboard: () => void;
  onCalendar: () => void;
}) {
  return (
    <section className="home-view">
      <div className="home-hero">
        <p className="eyebrow">
          {role === "Admin"
            ? "CIC REPRESENTATIVE WORKSPACE"
            : "FACULTY WORKSPACE"}
        </p>
        <h1>
          Hello,
          <br />
          <em>{firstName}.</em>
        </h1>
        <div className="home-actions">
          <button className="dark-button" onClick={onDashboard}>
            Open dashboard <span>{"->"}</span>
          </button>
          <button className="light-button" onClick={onCalendar}>
            View drive calendar
          </button>
        </div>
      </div>
      <div className="home-grid">
        <button className="home-card coral-card" onClick={onDashboard}>
          <span>01 / SIGNAL</span>
          <strong>
            Placement
            <br />
            dashboard
          </strong>
        </button>
        <button className="home-card dark-card" onClick={onCalendar}>
          <span>02 / PIPELINE</span>
          <strong>
            Drive
            <br />
            calendar
          </strong>
        </button>
      </div>
    </section>
  );
}

function NavButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick} aria-current={active ? "page" : undefined}>
      <span aria-hidden="true"><Icon size={18} strokeWidth={1.8} /></span>
      {children}
    </button>
  );
}
function Heading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">
          {eyebrow}
          <i className="coral-dot" />
        </p>
        <h1>
          {title} <span>*</span>
        </h1>
        <p>{subtitle}</p>
      </div>
      {action && <div className="heading-actions">{action}</div>}
    </div>
  );
}
