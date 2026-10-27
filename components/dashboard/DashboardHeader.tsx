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

/** Short dashboard title and signed-in role. */
export default function DashboardHeader({ role, degreeLevel = "UG" }: Props) {
  return (
    <header className="mme-header">
      <div>
        <h1>{degreeLevel} dashboard</h1>
      </div>
      <span className={`mme-role mme-role--${role === "Professor" ? "professor" : "admin"}`}>
        {role === "Admin" ? "ADMIN" : role === "Super admin" ? "SUPER ADMIN" : "PROFESSOR · READ-ONLY"}
      </span>
    </header>
  );
}
