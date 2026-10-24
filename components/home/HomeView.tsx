"use client";

import { useRouter } from "next/navigation";
import type { PlacementRecord } from "@/lib/placements/types";
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
  const onDashboard = () => router.push("/dashboard");
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
