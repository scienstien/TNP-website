import HomeView from "@/components/home/HomeView";
import { requireUser } from "@/lib/auth/dal";
import { getPlacementRecords } from "@/lib/placements/queries";

export default async function HomePage() {
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
