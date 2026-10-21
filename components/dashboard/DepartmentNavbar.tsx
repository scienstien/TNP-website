"use client";

import { useTransition } from "react";
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
  const choose = (code: string) => startSwitch(() => selectDepartmentAction(code));

  if (!canSwitch) {
    return (
      <nav className="dept-navbar" aria-label="Department">
        <span className="dept-navbar-label">Department</span>
        <span className="dept-chip is-active is-static">
          {current ? current.name : "All departments"}
        </span>
      </nav>
    );
  }

  const options = [{ code: "all", name: "All departments", short: "All" }, ...departments.map((department) => ({
    ...department,
    short: department.code.toUpperCase(),
  }))];

  return (
    <nav className="dept-navbar" aria-label="Department" aria-busy={pending}>
      <span className="dept-navbar-label">Department</span>
      <div className="dept-navbar-list">
        {options.map((option) => {
          const active = (current?.code ?? "all") === option.code;
          return (
            <button
              key={option.code}
              type="button"
              className={`dept-chip${active ? " is-active" : ""}`}
              aria-pressed={active}
              title={option.name}
              disabled={pending}
              onClick={() => choose(option.code)}
            >
              {option.short}
            </button>
          );
        })}
      </div>
      <span className="dept-navbar-current" aria-live="polite">
        {current ? current.name : "All departments"}
      </span>
    </nav>
  );
}
