"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { homeCycleSummaries } from "@/lib/placements/home-cycle";
import type { PlacementRecord } from "@/lib/placements/types";
import { useProgrammeLevel } from "@/components/portal/useProgrammeLevel";
import HomeActions from "./HomeActions";
import HomeHighlights from "./HomeHighlights";
import PlacementProgress from "./PlacementProgress";
import TeamArchive from "./TeamArchive";
import "./home.css";

export default function HomeView({
  firstName,
  placementRecords,
}: {
  firstName: string;
  placementRecords: PlacementRecord[];
}) {
  const router = useRouter();
  const cycles = useMemo(() => homeCycleSummaries(placementRecords), [placementRecords]);
  const programme = useProgrammeLevel(usePathname());
  const onDashboard = () => router.push(`/dashboard/${programme.toLowerCase()}`);
  const onCalendar = () => router.push("/calendar");
  return (
    <div className="home-view home-view--comparison">
      <header className="home-hero">
        <div className="home-hero-copy">
          <h1>Welcome, {firstName}.</h1>
        </div>
        <HomeActions onDashboard={onDashboard} onCalendar={onCalendar} />
      </header>
      <HomeHighlights cycles={cycles} />
      <TeamArchive />
      <PlacementProgress cycles={cycles} />
    </div>
  );
}
