import type { HomeCycleSummary } from "@/lib/placements/home-cycle";

export default function HomeHighlights({ cycles }: { cycles: ReadonlyArray<HomeCycleSummary> }) {
  const registeredParticipations = cycles.reduce(
    (total, cycle) => total + cycle.placed + cycle.unplaced,
    0,
  );
  const finalOffers = cycles.reduce((total, cycle) => total + cycle.placed, 0);
  const companies = new Set(cycles.flatMap((cycle) => cycle.companies)).size;

  return (
    <section className="home-highlights" aria-labelledby="home-highlights-title">
      <div className="home-section-heading">
        <div>
          <h2 id="home-highlights-title">UG placement highlights</h2>
        </div>
      </div>
      <div className="home-highlight-grid">
        <article>
          <span>Placement cycles</span>
          <strong>{cycles.length.toLocaleString("en-IN")}</strong>
        </article>
        <article>
          <span>Registered participations</span>
          <strong>{registeredParticipations.toLocaleString("en-IN")}</strong>
        </article>
        <article>
          <span>Final offers</span>
          <strong>{finalOffers.toLocaleString("en-IN")}</strong>
        </article>
        <article>
          <span>Companies with offers</span>
          <strong>{companies.toLocaleString("en-IN")}</strong>
        </article>
      </div>
    </section>
  );
}
