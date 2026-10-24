"use client";
import { useRouter } from "next/navigation";

export default function CompanyCycleSelector({ cycles, cycleId }: {
  cycles: { cycleId: string; code: string }[]; cycleId: string | null;
}) {
  const router = useRouter();
  return <label className="company-field">Placement cycle<select value={cycleId ?? "all"}
    onChange={event => router.push(`/companies?cycle=${event.target.value}`)}>
    <option value="all">All cycles</option>{cycles.map(cycle => <option key={cycle.cycleId} value={cycle.cycleId}>{cycle.code}</option>)}
  </select></label>;
}
