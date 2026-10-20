"use client";

import { useMemo, useState } from "react";
import DriveCalendar from "@/components/calendar/DriveCalendar";
import PlacementAnalytics from "@/components/dashboard/PlacementAnalytics";
import { signOutAction } from "@/lib/auth/actions";
import type { CalendarData } from "@/lib/calendar/types";
import type { PlacementRecord } from "@/lib/placements/types";

type PlacementType = "FTE" | "PPO" | "FTE + 6M" | "NA";
type Student = {
  roll: string;
  name: string;
  company: string;
  stream: string;
  type: PlacementType;
  ctc: number | null;
  date: string;
  isNew?: boolean;
};
type View = "Home" | "Overview" | "Calendar" | "Students";

const names = [
  "Aarav Mehta",
  "Ananya Iyer",
  "Arjun Rao",
  "Diya Shah",
  "Kabir Nair",
  "Meera Joshi",
  "Rohan Kapoor",
  "Ishita Verma",
  "Vivaan Singh",
  "Sara Khan",
  "Neil Bhatia",
  "Kiara Menon",
  "Aditya Bose",
  "Tara Malhotra",
  "Yash Kulkarni",
  "Navya Reddy",
  "Ritvik Das",
  "Aanya Gupta",
  "Siddharth Jain",
  "Myra Thomas",
];
const companyData = [
  ["Deloitte", "Consulting", 18],
  ["Microsoft", "Technology", 34],
  ["TCS", "Technology", 7.5],
  ["Adobe", "Technology", 26],
  ["Google", "Technology", 42],
  ["JPMorgan", "Finance", 20],
  ["Zomato", "Consumer", 16],
  ["Accenture", "Consulting", 13],
  ["Myntra", "Consumer", 17],
  ["KPMG", "Consulting", 12],
] as const;
const sectors = [
  "Analytics & Data Science",
  "Core Engineering & Manufacturing",
  "IT / Software",
  "BFSI",
  "Oil & Gas / Energy",
  "Consulting",
  "Education",
  "E-commerce & Retail",
  "FMCG",
  "Pharma & Healthcare",
];
const unplaced = new Set([14, 19, 26, 34, 42, 48, 57, 60, 66, 69]);
const students: Student[] = Array.from({ length: 70 }, (_, index) => {
  const [company, stream, salary] = companyData[index % companyData.length];
  const isUnplaced = unplaced.has(index);
  return {
    roll: String(index + 1).padStart(2, "0"),
    name: names[index % names.length],
    company,
    stream,
    type: isUnplaced
      ? "NA"
      : index % 17 === 0
        ? "PPO"
        : index % 11 === 0
          ? "FTE + 6M"
          : "FTE",
    ctc: isUnplaced ? null : salary,
    date: isUnplaced
      ? ""
      : `2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
  };
});
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
  today,
}: {
  user: DashboardUser;
  placementRecords: PlacementRecord[];
  calendar: CalendarData;
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
  const [records, setRecords] = useState(students);
  const [filter, setFilter] = useState<PlacementType | "All">("All");
  const [query, setQuery] = useState("");
  const visibleStudents = useMemo(
    () =>
      records.filter(
        (student) =>
          (filter === "All" || student.type === filter) &&
          `${student.name} ${student.roll} ${student.company} ${student.stream}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [filter, query, records],
  );

  const updateStudent = (roll: string, changes: Partial<Student>) =>
    setRecords((current) =>
      current.map((student) =>
        student.roll === roll ? { ...student, ...changes } : student,
      ),
    );
  const clearDemoPlacements = () => {
    setRecords((current) =>
      current.map((student) => ({
        ...student,
        company: "",
        stream: "",
        type: "NA",
        ctc: null,
        date: "",
      })),
    );
    setFilter("NA");
    setQuery("");
  };
  const addStudent = () =>
    setRecords((current) => [
      {
        roll: String(
          Math.max(0, ...current.map((student) => Number(student.roll))) + 1,
        ).padStart(2, "0"),
        name: "",
        company: "",
        stream: "",
        type: "NA",
        ctc: null,
        date: "",
        isNew: true,
      },
      ...current,
    ]);
  const removeStudent = (roll: string) =>
    setRecords((current) => current.filter((student) => student.roll !== roll));
  const importStudents = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = String(reader.result)
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(1)
        .map((row) => row.split(","));
      setRecords((current) =>
        current.map((student) => {
          const row = rows.find(
            (item) =>
              item[0]?.trim() === student.roll ||
              item[1]?.trim().toLowerCase() === student.name.toLowerCase(),
          );
          if (!row) return student;
          const type = (row[4]?.trim() || "NA") as PlacementType;
          return {
            ...student,
            company: row[2]?.trim() || "",
            stream: row[3]?.trim() || "",
            type,
            ctc: row[5]?.trim() ? Number(row[5]) : null,
            date: row[6]?.trim() || "",
          };
        }),
      );
    };
    reader.readAsText(file);
  };

  return (
    <main className="portal-shell">
      <aside className="sidebar">
        <div className="wordmark" aria-label="TNP Placement Control Room">
          <b className="wordmark-mark">TNP</b>
          <span>
            <strong>PLACEMENT</strong>
            <strong>CONTROL ROOM</strong>
            <small>MME · 5 YEAR ARCHIVE</small>
          </span>
        </div>
        <div className="role-switch">
          <small>SIGNED IN AS</small>
          <p className="role-current">
            <i className={role === "Admin" ? "orange-dot" : "green-dot"} />
            {role}
          </p>
        </div>
        <nav>
          <NavButton
            active={view === "Home"}
            onClick={() => setView("Home")}
            icon="H"
          >
            Home
          </NavButton>
          <NavButton
            active={view === "Overview"}
            onClick={() => setView("Overview")}
            icon="O"
          >
            Dashboard
          </NavButton>
          <NavButton
            active={view === "Calendar"}
            onClick={() => setView("Calendar")}
            icon="[]"
          >
            Drive calendar {upcomingCount > 0 && <small>{upcomingCount}</small>}
          </NavButton>
          {role === "Admin" && (
            <NavButton
              active={view === "Students"}
              onClick={() => setView("Students")}
              icon="S"
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
        <header className="topbar">
          <span>
            PLACEMENT OFFICE <b>/</b> {view.toUpperCase()}
          </span>
          <div>
            <i className="green-dot" /> Live data <strong>{initials}</strong>
          </div>
        </header>
        {view === "Home" && (
          <HomeView
            role={role}
            firstName={firstName}
            upcomingCount={upcomingCount}
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
        {view === "Students" && (
          <Students
            role={role}
            data={visibleStudents}
            filter={filter}
            setFilter={setFilter}
            query={query}
            setQuery={setQuery}
            onUpdate={updateStudent}
            onImport={importStudents}
            onClear={clearDemoPlacements}
            onAdd={addStudent}
            onRemove={removeStudent}
          />
        )}
      </section>
    </main>
  );
}

function HomeView({
  role,
  firstName,
  upcomingCount,
  onDashboard,
  onCalendar,
}: {
  role: "Professor" | "Admin";
  firstName: string;
  upcomingCount: number;
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
          Good morning,
          <br />
          <em>{firstName}.</em>
        </h1>
        <p>
          Here is the pulse of the 2025-26 placement season. Everything
          important, one decision away.
        </p>
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
          <small>
            Live outcomes, CTC intelligence and year-on-year movement{" "}
            <b>{"->"}</b>
          </small>
        </button>
        <button className="home-card dark-card" onClick={onCalendar}>
          <span>02 / PIPELINE</span>
          <strong>
            Drive
            <br />
            calendar
          </strong>
          <small>
            Upcoming recruiters, HR contacts and campus dates <b>{"->"}</b>
          </small>
        </button>
        <div className="home-note">
          <span>STATUS</span>
          <strong>
            <i className="green-dot" /> Season in motion
          </strong>
          <p>
            {upcomingCount === 0
              ? "No company visits are scheduled."
              : `${upcomingCount} company ${upcomingCount === 1 ? "visit is" : "visits are"} scheduled from today onwards.`}
          </p>
        </div>
      </div>
    </section>
  );
}

// Retained from the dashboard branch as a reference while its newer row editor is active.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyStudents2({
  role,
  data,
  filter,
  setFilter,
  query,
  setQuery,
  onUpdate,
  onImport,
  onClear,
  onAdd,
  onRemove,
}: {
  role: "Professor" | "Admin";
  data: Student[];
  filter: PlacementType | "All";
  setFilter: (value: PlacementType | "All") => void;
  query: string;
  setQuery: (value: string) => void;
  onUpdate: (roll: string, changes: Partial<Student>) => void;
  onImport: (file: File) => void;
  onClear: () => void;
  onAdd: () => void;
  onRemove: (roll: string) => void;
}) {
  return (
    <>
      <Heading
        eyebrow={role === "Admin" ? "ADMIN DATA ENTRY" : "READ-ONLY VIEW"}
        title="Student records"
        subtitle={
          role === "Admin"
            ? "Maintain placement outcomes for your full roster."
            : "Placement outcomes for the class of 2026."
        }
        action={
          role === "Admin" ? (
            <div className="admin-actions">
              <button className="dark-button" onClick={onAdd}>
                Add student
              </button>
              <label className="upload-button">
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onImport(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <button className="clear-button" onClick={onClear}>
                Clear demo data
              </button>
            </div>
          ) : undefined
        }
      />
      <section className="panel table-panel">
        <div className="table-tools">
          <label>
            Search{" "}
            <input
              placeholder="name, roll no, company"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div>
            {["All", "FTE", "PPO", "FTE + 6M", "NA"].map((value) => (
              <button
                className={filter === value ? "selected" : ""}
                onClick={() => setFilter(value as PlacementType | "All")}
                key={value}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        {role === "Admin" && (
          <p className="table-hint">
            Add, edit, or remove any row. New students appear at the top.
          </p>
        )}
        <div className="table">
          <div className="table-row head">
            <span>STUDENT</span>
            <span>COMPANY</span>
            <span>STREAM</span>
            <span>TYPE</span>
            <span>CTC</span>
            <span>OFFER DATE</span>
            {role === "Admin" && <span />}
          </div>
          {data.map((student) => (
            <div className="table-row" key={student.roll}>
              <span className="student-record-cell">
                <span className="student-avatar">
                  {student.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2) || "NS"}
                </span>
                {role === "Admin" && student.isNew ? (
                  <input
                    className="cell-input"
                    value={student.name}
                    onChange={(event) =>
                      onUpdate(student.roll, { name: event.target.value })
                    }
                  />
                ) : (
                  <strong>
                    {student.name}
                    <small>#{student.roll}</small>
                  </strong>
                )}
              </span>
              {role === "Admin" ? (
                <>
                  <input
                    className="cell-input"
                    placeholder="Company"
                    value={student.company}
                    onChange={(event) =>
                      onUpdate(student.roll, { company: event.target.value })
                    }
                  />
                  <input
                    className="cell-input"
                    placeholder="Stream"
                    value={student.stream}
                    onChange={(event) =>
                      onUpdate(student.roll, { stream: event.target.value })
                    }
                  />
                  <select
                    className="cell-input"
                    value={student.type}
                    onChange={(event) => {
                      const type = event.target.value as PlacementType;
                      onUpdate(student.roll, {
                        type,
                        ctc: type === "NA" ? null : student.ctc || 10,
                        date: type === "NA" ? "" : student.date || "2026-03-20",
                      });
                    }}
                  >
                    <option>FTE</option>
                    <option>PPO</option>
                    <option>FTE + 6M</option>
                    <option>NA</option>
                  </select>
                  <input
                    className="cell-input"
                    type="number"
                    placeholder="LPA"
                    value={student.ctc ?? ""}
                    disabled={student.type === "NA"}
                    onChange={(event) =>
                      onUpdate(student.roll, {
                        ctc: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                  />
                  <input
                    className="cell-input"
                    type="date"
                    value={student.date}
                    disabled={student.type === "NA"}
                    onChange={(event) =>
                      onUpdate(student.roll, { date: event.target.value })
                    }
                  />
                  <button
                    className="row-remove"
                    aria-label={`Remove ${student.name}`}
                    title={`Remove ${student.name}`}
                    onClick={() => onRemove(student.roll)}
                  >
                    x
                  </button>
                </>
              ) : (
                <>
                  <span>{student.company || "-"}</span>
                  <span>{student.stream || "-"}</span>
                  <span>
                    <i className={student.type === "NA" ? "na" : "placed-tag"}>
                      {student.type}
                    </i>
                  </span>
                  <span>{student.ctc ? `Rs ${student.ctc} LPA` : "-"}</span>
                  <span>{student.date || "-"}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Students({
  role,
  data,
  filter,
  setFilter,
  query,
  setQuery,
  onUpdate,
  onImport,
  onClear,
  onAdd,
  onRemove,
}: {
  role: "Professor" | "Admin";
  data: Student[];
  filter: PlacementType | "All";
  setFilter: (value: PlacementType | "All") => void;
  query: string;
  setQuery: (value: string) => void;
  onUpdate: (roll: string, changes: Partial<Student>) => void;
  onImport: (file: File) => void;
  onClear: () => void;
  onAdd: () => void;
  onRemove: (roll: string) => void;
}) {
  const admin = role === "Admin";
  return (
    <>
      <Heading
        eyebrow={admin ? "ADMIN DATA ENTRY" : "READ-ONLY VIEW"}
        title="Student records"
        subtitle={
          admin
            ? "Add a person's name, then complete their placement details."
            : "Placement outcomes for the class of 2026."
        }
        action={
          admin ? (
            <div className="admin-actions">
              <button className="dark-button" onClick={onAdd}>
                Add student
              </button>
              <label className="upload-button">
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onImport(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <button className="clear-button" onClick={onClear}>
                Clear demo data
              </button>
            </div>
          ) : undefined
        }
      />
      <section className="panel table-panel">
        <div className="table-tools">
          <label>
            Search{" "}
            <input
              placeholder="name, roll no, company"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div>
            {["All", "FTE", "PPO", "FTE + 6M", "NA"].map((value) => (
              <button
                className={filter === value ? "selected" : ""}
                onClick={() => setFilter(value as PlacementType | "All")}
                key={value}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        {admin && (
          <p className="table-hint">
            New rows start with a <b>Student name</b> field. Enter the person
            first, then complete the row.
          </p>
        )}
        <div className="table">
          <div className="table-row head">
            <span>STUDENT</span>
            <span>COMPANY</span>
            <span>SECTOR</span>
            <span>TYPE</span>
            <span>CTC</span>
            <span>OFFER DATE</span>
            {admin && <span />}
          </div>
          {data.map((student) => (
            <div className="table-row" key={student.roll}>
              <span className="student-record-cell">
                <span className="student-avatar">
                  {student.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2) || "NS"}
                </span>
                {admin && student.isNew ? (
                  <input
                    className="cell-input"
                    placeholder="Student name"
                    value={student.name}
                    onChange={(event) =>
                      onUpdate(student.roll, { name: event.target.value })
                    }
                  />
                ) : (
                  <strong>{student.name || "Unnamed student"}</strong>
                )}
              </span>
              {admin ? (
                <>
                  <input
                    className="cell-input"
                    placeholder="Company"
                    value={student.company}
                    onChange={(event) =>
                      onUpdate(student.roll, { company: event.target.value })
                    }
                  />
                  <select
                    className="cell-input"
                    value={student.stream}
                    onChange={(event) =>
                      onUpdate(student.roll, { stream: event.target.value })
                    }
                  >
                    <option value="">Select sector</option>
                    {sectors.map((sector) => (
                      <option key={sector}>{sector}</option>
                    ))}
                  </select>
                  <select
                    className="cell-input"
                    value={student.type}
                    onChange={(event) => {
                      const type = event.target.value as PlacementType;
                      onUpdate(student.roll, {
                        type,
                        ctc: type === "NA" ? null : student.ctc || 10,
                        date: type === "NA" ? "" : student.date || "2026-03-20",
                      });
                    }}
                  >
                    <option>FTE</option>
                    <option>PPO</option>
                    <option>FTE + 6M</option>
                    <option>NA</option>
                  </select>
                  <input
                    className="cell-input"
                    type="number"
                    placeholder="LPA"
                    value={student.ctc ?? ""}
                    disabled={student.type === "NA"}
                    onChange={(event) =>
                      onUpdate(student.roll, {
                        ctc: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                  />
                  <input
                    className="cell-input"
                    type="date"
                    value={student.date}
                    disabled={student.type === "NA"}
                    onChange={(event) =>
                      onUpdate(student.roll, { date: event.target.value })
                    }
                  />
                  <button
                    className="row-remove"
                    aria-label={`Remove ${student.name || "student"}`}
                    onClick={() => onRemove(student.roll)}
                  >
                    x
                  </button>
                </>
              ) : (
                <>
                  <span>{student.company || "-"}</span>
                  <span>{student.stream || "-"}</span>
                  <span>
                    <i className={student.type === "NA" ? "na" : "placed-tag"}>
                      {student.type}
                    </i>
                  </span>
                  <span>{student.ctc ? `Rs ${student.ctc} LPA` : "-"}</span>
                  <span>{student.date || "-"}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      <span>{icon}</span>
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyStudents({
  role,
  data,
  filter,
  setFilter,
  query,
  setQuery,
  onUpdate,
  onImport,
  onClear,
  onAdd,
  onRemove,
}: {
  role: "Professor" | "Admin";
  data: Student[];
  filter: PlacementType | "All";
  setFilter: (value: PlacementType | "All") => void;
  query: string;
  setQuery: (value: string) => void;
  onUpdate: (roll: string, changes: Partial<Student>) => void;
  onImport: (file: File) => void;
  onClear: () => void;
  onAdd: () => void;
  onRemove: (roll: string) => void;
}) {
  return (
    <>
      <Heading
        eyebrow={role === "Admin" ? "ADMIN DATA ENTRY" : "READ-ONLY VIEW"}
        title="Student records"
        subtitle={
          role === "Admin"
            ? "Maintain placement outcomes for all 70 students."
            : "Placement outcomes for the class of 2026."
        }
        action={
          role === "Admin" ? (
            <div className="admin-actions">
              <button className="dark-button" onClick={onAdd}>
                Add student
              </button>
              <label className="upload-button">
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onImport(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <button className="clear-button" onClick={onClear}>
                Clear demo data
              </button>
            </div>
          ) : undefined
        }
      />
      <section className="panel table-panel">
        <div className="table-tools">
          <label>
            Search{" "}
            <input
              placeholder="name, roll no, company"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div>
            {["All", "FTE", "PPO", "FTE + 6M", "NA"].map((value) => (
              <button
                className={filter === value ? "selected" : ""}
                onClick={() => setFilter(value as PlacementType | "All")}
                key={value}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        {role === "Admin" && (
          <p className="table-hint">
            Add a student, upload CSV, or edit any row. CSV columns: roll, name,
            company, stream, type, ctc, offer_date.
          </p>
        )}
        <div className="table">
          <div className="table-row head">
            <span>STUDENT</span>
            <span>COMPANY</span>
            <span>STREAM</span>
            <span>TYPE</span>
            <span>CTC</span>
            <span>OFFER DATE</span>
          </div>
          {data.map((student) => (
            <div className="table-row" key={student.roll}>
              <span>
                {role === "Admin" && student.isNew ? (
                  <input
                    className="cell-input"
                    value={student.name}
                    onChange={(event) =>
                      onUpdate(student.roll, { name: event.target.value })
                    }
                  />
                ) : (
                  <>
                    <b className="student-avatar">
                      {student.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")}
                    </b>
                    <strong>
                      {student.name}
                      <small>#{student.roll}</small>
                    </strong>
                  </>
                )}
              </span>
              {role === "Admin" ? (
                <>
                  <input
                    className="cell-input"
                    placeholder="Company"
                    value={student.company}
                    onChange={(event) =>
                      onUpdate(student.roll, { company: event.target.value })
                    }
                  />
                  <input
                    className="cell-input"
                    placeholder="Stream"
                    value={student.stream}
                    onChange={(event) =>
                      onUpdate(student.roll, { stream: event.target.value })
                    }
                  />
                  <select
                    className="cell-input"
                    value={student.type}
                    onChange={(event) => {
                      const type = event.target.value as PlacementType;
                      onUpdate(student.roll, {
                        type,
                        ctc: type === "NA" ? null : student.ctc || 10,
                        date: type === "NA" ? "" : student.date || "2026-03-20",
                      });
                    }}
                  >
                    <option>FTE</option>
                    <option>PPO</option>
                    <option>FTE + 6M</option>
                    <option>NA</option>
                  </select>
                  <input
                    className="cell-input"
                    type="number"
                    placeholder="LPA"
                    value={student.ctc ?? ""}
                    disabled={student.type === "NA"}
                    onChange={(event) =>
                      onUpdate(student.roll, {
                        ctc: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                  />
                  <input
                    className="cell-input"
                    type="date"
                    value={student.date}
                    disabled={student.type === "NA"}
                    onChange={(event) =>
                      onUpdate(student.roll, { date: event.target.value })
                    }
                  />
                </>
              ) : (
                <>
                  <span>{student.company || "-"}</span>
                  <span>{student.stream || "-"}</span>
                  <span>
                    <i className={student.type === "NA" ? "na" : "placed-tag"}>
                      {student.type}
                    </i>
                  </span>
                  <span>{student.ctc ? `Rs ${student.ctc} LPA` : "-"}</span>
                  <span>{student.date || "-"}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
