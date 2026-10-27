"use client";

import * as React from "react";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";

type CarouselApi = UseEmblaCarouselType[1];
type CarouselOptions = Parameters<typeof useEmblaCarousel>[0];
type CarouselPlugins = Parameters<typeof useEmblaCarousel>[1];

type CarouselContextValue = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
};

const CarouselContext = React.createContext<CarouselContextValue | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);
  if (!context) throw new Error("Carousel controls must be inside a Carousel.");
  return context;
}

function Carousel({
  opts,
  plugins,
  setApi,
  className = "",
  children,
  ...props
}: React.ComponentProps<"div"> & {
  opts?: CarouselOptions;
  plugins?: CarouselPlugins;
  setApi?: (api: CarouselApi) => void;
}) {
  const [carouselRef, api] = useEmblaCarousel(opts, plugins);
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  React.useEffect(() => {
    if (!api) return;
    const update = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };
    setApi?.(api);
    update();
    api.on("select", update);
    api.on("reInit", update);
    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api, setApi]);

  const scrollPrev = React.useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = React.useCallback(() => api?.scrollNext(), [api]);

  return (
    <CarouselContext.Provider value={{ carouselRef, scrollPrev, scrollNext, canScrollPrev, canScrollNext }}>
      <div
        {...props}
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        className={`relative ${className}`}
        onKeyDownCapture={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            scrollPrev();
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            scrollNext();
          }
          props.onKeyDownCapture?.(event);
        }}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

function CarouselContent({ className = "", children, ...props }: React.ComponentProps<"div">) {
  const { carouselRef } = useCarousel();
  return (
    <div ref={carouselRef} className="overflow-hidden" data-slot="carousel-content">
      <div {...props} className={`flex -ml-4 ${className}`}>{children}</div>
    </div>
  );
}

function CarouselItem({ className = "", ...props }: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={`min-w-0 shrink-0 grow-0 basis-full pl-4 ${className}`}
    />
  );
}

function CarouselPrevious({ className = "", ...props }: React.ComponentProps<"button">) {
  const { scrollPrev, canScrollPrev } = useCarousel();
  return (
    <button
      {...props}
      type="button"
      data-slot="carousel-previous"
      aria-label={props["aria-label"] ?? "Previous slide"}
      className={className}
      disabled={!canScrollPrev || props.disabled}
      onClick={(event) => { scrollPrev(); props.onClick?.(event); }}
    >
      <ArrowLeft size={18} aria-hidden="true" />
    </button>
  );
}

function CarouselNext({ className = "", ...props }: React.ComponentProps<"button">) {
  const { scrollNext, canScrollNext } = useCarousel();
  return (
    <button
      {...props}
      type="button"
      data-slot="carousel-next"
      aria-label={props["aria-label"] ?? "Next slide"}
      className={className}
      disabled={!canScrollNext || props.disabled}
      onClick={(event) => { scrollNext(); props.onClick?.(event); }}
    >
      <ArrowRight size={18} aria-hidden="true" />
    </button>
  );
}

export { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious };
export type { CarouselApi };
