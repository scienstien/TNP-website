"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { selectDepartmentAction } from "@/lib/auth/department-actions";
import "./department-navbar.css";

export interface DepartmentOption {
  code: string;
  name: string;
}

interface Props {
  /** The department being shown; null means every department (super admin only). */
  current: DepartmentOption | null;
  /** Every department. Only a super admin can switch; others see their own department as a label. */
  departments: DepartmentOption[];
  canSwitch: boolean;
}

/** Top bar for choosing the department the whole dashboard is showing. */
export default function DepartmentNavbar({ current, departments, canSwitch }: Props) {
  const [pending, startSwitch] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const choose = (code: string) => startSwitch(() => selectDepartmentAction(code));
  const programme = pathname?.includes("/dashboard/pg") ? "PG" : "UG";

  const options = [{ code: "all", name: "All departments", short: "All" }, ...departments.map((department) => ({
    ...department,
    short: department.code.toUpperCase(),
  }))];

  return (
    <nav className="dept-navbar" aria-label="Department" aria-busy={pending}>
      <label className="dept-navbar-select-label">
        <span className="dept-navbar-label">Programme</span>
        <select
          className="dept-navbar-select"
          value={programme}
          onChange={(event) => router.push(`/dashboard/${event.target.value.toLowerCase()}`)}
          aria-label="Programme level"
        >
          <option value="UG">UG</option>
          <option value="PG">PG</option>
        </select>
      </label>
      <label className="dept-navbar-select-label">
        <span className="dept-navbar-label">Department</span>
        <select
          className="dept-navbar-select"
          value={current?.code ?? "all"}
          disabled={!canSwitch || pending}
          onChange={(event) => choose(event.target.value)}
          aria-label="Department"
        >
          {options.map((option) => <option key={option.code} value={option.code}>{option.short}</option>)}
        </select>
      </label>
      <span className="dept-navbar-current" aria-live="polite">
        {current ? current.name : "All departments"}
      </span>
    </nav>
  );
}
