import { Suspense } from "react";
import HomeView from "@/components/home/HomeView";
import { requireUser } from "@/lib/auth/dal";
import { getPlacementRecords } from "@/lib/placements/queries";

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeData />
    </Suspense>
  );
}

async function HomeData() {
  const user = await requireUser();
  const placementRecords = await getPlacementRecords();
  const displayName = user.name?.trim() || user.email;

  return (
    <HomeView
      firstName={displayName.split(/[\s@]/)[0]}
      placementRecords={placementRecords}
    />
  );
}

function HomeFallback() {
  return (
    <div className="home-view home-view--comparison" role="status" aria-busy="true">
      <header className="home-hero"><h1>Home</h1></header>
      <p>Loading placement highlights…</p>
    </div>
  );
}
