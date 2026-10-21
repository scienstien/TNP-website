"use client";

import { useMemo, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  Building2,
  CalendarDays,
  ClipboardList,
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
import DepartmentNavbar, { type DepartmentOption } from "@/components/dashboard/DepartmentNavbar";
import type { PlacementRecord } from "@/lib/placements/types";
import Companies from "@/components/companies/Companies";
import type { CompanyRecord } from "@/lib/companies/types";
import OutreachTracker from "@/components/outreach/OutreachTracker";
import type { OutreachRecord } from "@/lib/outreach/types";
import PlacedSoFar from "@/components/home/PlacedSoFar";
import { batchYearForDate } from "@/lib/placements/year-to-date";
import "@/components/home/home.css";

type View = "Home" | "Overview" | "Calendar" | "Companies" | "Outreach" | "Students";
const VIEW_STORAGE_KEY = "mme-dashboard-active-view";
const VIEW_CHANGE_EVENT = "mme-dashboard-view-change";

const subscribeToView = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener(VIEW_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(VIEW_CHANGE_EVENT, callback);
  };
};

const getStoredView = () =>
  window.localStorage.getItem(VIEW_STORAGE_KEY) ?? "Home";

export interface DashboardUser {
  name: string | null;
  email: string;
  role: "ADMIN" | "PROFESSOR" | "SUPERADMIN";
  /**
   * The department being shown: a department user's own, or the one a super admin chose.
   * null for a super admin viewing every department.
   */
  department: DepartmentOption | null;
}

/** Rendered by app/page.tsx with the user verified on the server; the role cannot be switched here. */
export default function Dashboard({
  user,
  departments,
  placementRecords,
  studentData,
  companies,
  outreachContacts,
  today,
}: {
  user: DashboardUser;
  /** Every department, for the super admin's switcher; empty for everyone else. */
  departments: DepartmentOption[];
  placementRecords: PlacementRecord[];
  studentData: StudentData | null;
  companies: CompanyRecord[];
  outreachContacts: OutreachRecord[];
  /** Today's date at the institute (YYYY-MM-DD), computed on the server. */
  today: string;
}) {
  const isSuper = user.role === "SUPERADMIN";
  // A super admin has every administrator's powers, in whichever department they chose.
  const role: "Professor" | "Admin" = user.role === "PROFESSOR" ? "Professor" : "Admin";
  // Editing needs one department; a super admin looking at all of them is read-only.
  const canEdit = role === "Admin" && user.department !== null;
  const storedView = useSyncExternalStore(subscribeToView, getStoredView, () => "Home");
  const allowedViews: View[] = role === "Admin"
    ? ["Home", "Overview", "Calendar", "Companies", "Outreach", "Students"]
    : ["Home", "Overview", "Calendar", "Outreach"];
  const view: View = allowedViews.includes(storedView as View)
    ? storedView as View
    : "Home";
  const setView = (next: View) => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    window.dispatchEvent(new Event(VIEW_CHANGE_EVENT));
  };
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
            <small>NIT TRICHY · {user.department ? user.department.code.toUpperCase() : "ALL DEPARTMENTS"}</small>
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
            Calendar
          </NavButton>
          {role === "Admin" && (
            <NavButton
              active={view === "Companies"}
              onClick={() => setView("Companies")}
              icon={Building2}
            >
              Companies
            </NavButton>
          )}
          <NavButton
            active={view === "Outreach"}
            onClick={() => setView("Outreach")}
            icon={ClipboardList}
          >
            Outreach
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
            {role === "Admin" && <small>{isSuper ? "Super administrator" : "Administrator"}</small>}
          </span>
          <form action={signOutAction}>
            <button type="submit" className="signout-button">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <section className="content-area">
        <DepartmentNavbar current={user.department} departments={departments} canSwitch={isSuper} />
        {view === "Home" && (
          <HomeView
            firstName={firstName}
            placementRecords={placementRecords}
            today={today}
            canChooseBatch={role === "Admin"}
            onDashboard={() => setView("Overview")}
            onCalendar={() => setView("Calendar")}
          />
        )}
        {view === "Overview" && (
          <PlacementAnalytics
            records={placementRecords}
            role={isSuper ? "Super admin" : role}
            department={user.department}
          />
        )}
        {view === "Calendar" && (
          <>
            <Heading
              eyebrow="RECRUITMENT PIPELINE"
              title="Process calendar"
              subtitle="Plan and track OT, group discussions, resume shortlisting and PI rounds."
            />
            <DriveCalendar
              today={today}
              isAdmin={role === "Admin"}
              scope={user.department?.code ?? "all"}
            />
          </>
        )}
        {view === "Companies" && role === "Admin" && (
          canEdit ? <Companies data={companies} isAdmin /> : <ChooseDepartment />
        )}
        {view === "Outreach" && (
          <OutreachTracker data={outreachContacts} isAdmin={canEdit} />
        )}
        {view === "Students" && role === "Admin" && (
          canEdit && studentData ? <StudentRecords data={studentData} /> : <ChooseDepartment />
        )}
      </section>
    </main>
  );
}

/** Shown to a super admin on a view that edits one department's data while "All departments" is chosen. */
function ChooseDepartment() {
  return (
    <section className="panel" role="status">
      <p>Choose a department in the bar above to manage its records.</p>
    </section>
  );
}

function HomeView({
  firstName,
  placementRecords,
  today,
  canChooseBatch,
  onDashboard,
  onCalendar,
}: {
  firstName: string;
  placementRecords: PlacementRecord[];
  today: string;
  canChooseBatch: boolean;
  onDashboard: () => void;
  onCalendar: () => void;
}) {
  const offers = useMemo(
    () => placementRecords.flatMap((record) => record.offer ? [{
      batchYear: record.batchYear,
      offerDate: record.offer.offerDate,
      company: record.offer.company,
    }] : []),
    [placementRecords],
  );
  const batches = useMemo(() => {
    const totals = new Map<number, { placed: number; unplaced: number }>();
    // The batch of today's date is always listed, even before any student is recorded for it.
    totals.set(batchYearForDate(today), { placed: 0, unplaced: 0 });
    for (const record of placementRecords) {
      const total = totals.get(record.batchYear) ?? { placed: 0, unplaced: 0 };
      if (record.offer !== null) total.placed++;
      else total.unplaced++;
      totals.set(record.batchYear, total);
    }
    return [...totals]
      .map(([batchYear, total]) => ({ batchYear, ...total }))
      .sort((a, b) => b.batchYear - a.batchYear);
  }, [placementRecords, today]);
  return (
    <section className="home-view home-view--comparison">
      <div className="home-intro">
        <div className="home-hero">
          <h1>
            Hello,{" "}
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
        <PlacedSoFar offers={offers} batches={batches} canChooseBatch={canChooseBatch} today={today} />
      </div>
      <div className="home-grid">
        <button className="home-card coral-card" onClick={onDashboard}>
          <span>01</span>
          <strong>
            Placement
            <br />
            dashboard
          </strong>
        </button>
        <button className="home-card dark-card" onClick={onCalendar}>
          <span>02</span>
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
