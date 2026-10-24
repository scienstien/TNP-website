import { plural } from "./format";
import type { DegreeLevel } from "@/lib/placements/types";

export type HeaderRole = "Admin" | "Professor" | "Super admin";

interface Props {
  role: HeaderRole;
  /** The department shown; null when a super admin is looking at every department. */
  department: { code: string; name: string } | null;
  cycles: number;
  students: number;
  degreeLevel?: DegreeLevel;
}

/** Title, institute branding, data coverage and the signed-in role. */
export default function DashboardHeader({ role, department, cycles, students, degreeLevel = "UG" }: Props) {
  return (
    <header className="mme-header">
      <div>
        <p className="eyebrow">
          NIT TRICHY · {department ? department.name.toUpperCase() : "ALL DEPARTMENTS"}
        </p>
        <h1>
          {department ? `${department.code.toUpperCase()} ${degreeLevel === "PG" ? "PG" : "UG"} Placement Dashboard` : `${degreeLevel === "PG" ? "PG" : "UG"} Placement Dashboard`}
        </h1>
        <p className="mme-header-sub">
          {plural(cycles, "placement cycle")} ·{" "}
          {plural(students, "recorded student")}
        </p>
      </div>
      <span className={`mme-role mme-role--${role === "Professor" ? "professor" : "admin"}`}>
        {role === "Admin" ? "ADMIN" : role === "Super admin" ? "SUPER ADMIN" : "PROFESSOR · READ-ONLY"}
      </span>
    </header>
  );
}
