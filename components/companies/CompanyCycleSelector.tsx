"use client";
import { useRouter } from "next/navigation";

export default function CompanyCycleSelector({ cycles, cycleId }: {
  cycles: { cycleId: string; code: string }[]; cycleId: string | null;
}) {
  const router = useRouter();
  return <label className="company-field">Placement cycle<select value={cycleId ?? ""}
    onChange={event => router.push(event.target.value ? `/companies?cycle=${event.target.value}` : "/companies")}>
    <option value="">All cycles</option>{cycles.map(cycle => <option key={cycle.cycleId} value={cycle.cycleId}>{cycle.code}</option>)}
  </select></label>;
}
