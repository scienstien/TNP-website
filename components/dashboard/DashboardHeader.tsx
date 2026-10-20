import { plural } from "./format";

interface Props {
  role: "Admin" | "Professor";
  batches: number;
  students: number;
}

/** Title, institute branding, data coverage and the signed-in role. */
export default function DashboardHeader({ role, batches, students }: Props) {
  return (
    <header className="mme-header">
      <div>
        <p className="eyebrow">
          NIT TIRUCHIRAPPALLI · METALLURGICAL &amp; MATERIALS ENGINEERING
        </p>
        <h1>MME Placement Dashboard</h1>
        <p className="mme-header-sub">
          {plural(batches, "batch", "batches")} ·{" "}
          {plural(students, "recorded student")}
        </p>
      </div>
      <span className={`mme-role mme-role--${role.toLowerCase()}`}>
        {role === "Admin" ? "ADMIN" : "PROFESSOR · READ-ONLY"}
      </span>
    </header>
  );
}
