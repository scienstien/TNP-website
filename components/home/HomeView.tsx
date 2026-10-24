"use client";

import { usePathname, useRouter } from "next/navigation";
import type { PlacementRecord } from "@/lib/placements/types";
import { useProgrammeLevel } from "@/components/portal/useProgrammeLevel";
import HomeActions from "./HomeActions";
import PlacementProgress from "./PlacementProgress";
import "./home.css";

export default function HomeView({
  firstName,
  placementRecords,
}: {
  firstName: string;
  placementRecords: PlacementRecord[];
}) {
  const router = useRouter();
  const programme = useProgrammeLevel(usePathname());
  const onDashboard = () => router.push(`/dashboard/${programme.toLowerCase()}`);
  const onCalendar = () => router.push("/calendar");
  return (
    <section className="home-view home-view--comparison">
      <div className="home-intro">
        <div className="home-hero">
          <h1>
            Hello,{" "}
            <br />
            <em>{firstName}.</em>
          </h1>
          <HomeActions onDashboard={onDashboard} onCalendar={onCalendar} />
        </div>
        <PlacementProgress placementRecords={placementRecords} />
      </div>
    </section>
  );
}
