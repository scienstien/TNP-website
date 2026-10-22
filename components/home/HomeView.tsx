"use client";

import { useRouter } from "next/navigation";
import type { PlacementRecord } from "@/lib/placements/types";
import HomeActions from "./HomeActions";
import PlacementProgress from "./PlacementProgress";
import "./home.css";

export default function HomeView({
  firstName,
  placementRecords,
  today,
  canChooseBatch,
}: {
  firstName: string;
  placementRecords: PlacementRecord[];
  today: string;
  canChooseBatch: boolean;
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
        <PlacementProgress
          placementRecords={placementRecords}
          canChooseBatch={canChooseBatch}
          today={today}
        />
      </div>
      <div className="home-grid">
        <button className="home-card coral-card" onClick={onDashboard}>
          <span>01</span>
          <strong>
            Placement
            <br />
            dashboard
          </strong>
        </button>
        <button className="home-card dark-card" onClick={onCalendar}>
          <span>02</span>
          <strong>
            Drive
            <br />
            calendar
          </strong>
        </button>
      </div>
    </section>
  );
}
