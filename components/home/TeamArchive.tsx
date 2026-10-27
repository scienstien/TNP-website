"use client";

import { useEffect, useState } from "react";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

const PLACEHOLDER_YEARS = ["2026", "2025", "2024", "2023", "2022", "2021"] as const;

export default function TeamArchive() {
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (!api) return;
    const update = () => setActiveIndex(api.selectedScrollSnap());
    update();
    api.on("select", update);
    api.on("reInit", update);
    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!api || isInteracting || prefersReducedMotion) return;
    const timer = window.setInterval(() => api.scrollNext(), 4500);
    return () => window.clearInterval(timer);
  }, [api, isInteracting, prefersReducedMotion]);

  return (
    <section className="home-team" aria-labelledby="home-team-title">
      <div className="home-section-heading">
        <div>
          <h2 id="home-team-title">Our team over the years</h2>
        </div>
      </div>
      <Carousel
        opts={{ align: "center", loop: true }}
        setApi={setApi}
        className="home-team-carousel"
        aria-label="Team archive by year"
        tabIndex={0}
        onMouseEnter={() => setIsInteracting(true)}
        onMouseLeave={() => setIsInteracting(false)}
        onFocusCapture={() => setIsInteracting(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsInteracting(false);
        }}
      >
        <CarouselContent className="home-team-track">
          {PLACEHOLDER_YEARS.map((year, index) => (
            <CarouselItem
              key={year}
              className="home-team-slide"
              data-active={index === activeIndex}
              aria-label={`${year} team archive placeholder`}
            >
              <article className="home-team-card">
                <div className="home-team-photo">
                  <span>Photograph pending</span>
                  <strong>{year}</strong>
                </div>
                <div className="home-team-card-copy">
                  <h3>Placement team</h3>
                </div>
              </article>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}
