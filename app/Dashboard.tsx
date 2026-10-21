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
  role: "ADMIN" | "PROFESSOR";
}

/** Rendered by app/page.tsx with the user verified on the server; the role cannot be switched here. */
export default function Dashboard({
  user,
  placementRecords,
  studentData,
  companies,
  outreachContacts,
  today,
}: {
  user: DashboardUser;
  placementRecords: PlacementRecord[];
  studentData: StudentData | null;
  companies: CompanyRecord[];
  outreachContacts: OutreachRecord[];
  /** Today's date at the institute (YYYY-MM-DD), computed on the server. */
  today: string;
}) {
  const role: "Professor" | "Admin" =
    user.role === "ADMIN" ? "Admin" : "Professor";
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
            {role === "Admin" && <small>Administrator</small>}
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
            firstName={firstName}
            placementRecords={placementRecords}
            today={today}
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
              title="Process calendar"
              subtitle="Plan and track OT, group discussions, resume shortlisting and PI rounds."
            />
            <DriveCalendar
              today={today}
              isAdmin={role === "Admin"}
            />
          </>
        )}
        {view === "Companies" && role === "Admin" && (
          <Companies data={companies} isAdmin />
        )}
        {view === "Outreach" && (
          <OutreachTracker data={outreachContacts} isAdmin={role === "Admin"} />
        )}
        {view === "Students" && role === "Admin" && studentData && (
          <StudentRecords data={studentData} />
        )}
      </section>
    </main>
  );
}

function HomeView({
  firstName,
  placementRecords,
  today,
  onDashboard,
  onCalendar,
}: {
  firstName: string;
  placementRecords: PlacementRecord[];
  today: string;
  onDashboard: () => void;
  onCalendar: () => void;
}) {
  const offers = useMemo(
    () => placementRecords.flatMap((record) => record.offer ? [{
      batchYear: record.batchYear,
      offerDate: record.offer.offerDate,
    }] : []),
    [placementRecords],
  );
  const batchStats = useMemo(() => {
    const batchYear = batchYearForDate(today);
    const batchRecords = placementRecords.filter((record) => record.batchYear === batchYear);
    const placed = batchRecords.filter((record) => record.offer !== null).length;
    return { batchYear, placed, unplaced: batchRecords.length - placed };
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
        <PlacedSoFar offers={offers} batchStats={batchStats} today={today} />
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
