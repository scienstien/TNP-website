"use client";

/**
 * "T&P" title that unfolds into "Training & Placement".
 * Mouse: opens on hover. Touch and pen: a tap toggles it (there is no hover).
 *
 * Each word's tail sits in a one-column grid whose track animates from 0fr to 1fr, so it widens to its
 * natural width with no measuring; its letters then rise in one after another. The plain "&" spins away
 * while a copper "&" spins in, and the space around it opens up.
 */

import { useEffect, useState, type PointerEvent } from "react";
import { display } from "./fonts";

const EASE_OUT = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const EASE_BACK = "ease-[cubic-bezier(0.34,1.56,0.64,1)]";

function Tail({
  text,
  open,
  delay,
}: {
  text: string;
  open: boolean;
  delay: number;
}) {
  return (
    <span
      className={`grid transition-[grid-template-columns] duration-500 motion-reduce:transition-none ${EASE_OUT} ${
        open ? "grid-cols-[1fr]" : "grid-cols-[0fr]"
      }`}
    >
      <span className="min-w-0 overflow-hidden whitespace-nowrap">
        {[...text].map((letter, i) => (
          <span
            key={i}
            className={`inline-block transition duration-300 motion-reduce:transition-none ${EASE_OUT} ${
              open
                ? "translate-y-0 opacity-100"
                : "translate-y-[0.4em] opacity-0"
            }`}
            style={{ transitionDelay: open ? `${delay + i * 28}ms` : "0ms" }}
          >
            {letter}
          </span>
        ))}
      </span>
    </span>
  );
}

function Ampersand({ open }: { open: boolean }) {
  return (
    <span
      className={`grid transition-[margin] duration-500 motion-reduce:transition-none ${EASE_OUT} ${
        open ? "mx-[0.25em]" : "mx-[0.04em]"
      }`}
    >
      <span
        className={`[grid-area:1/1] transition duration-300 motion-reduce:transition-none ${
          open
            ? "-rotate-90 scale-50 opacity-0"
            : "rotate-0 scale-100 opacity-100"
        }`}
      >
        &amp;
      </span>
      <span
        className={`[grid-area:1/1] font-normal text-[#E08A50] transition duration-700 motion-reduce:transition-none ${EASE_BACK} ${
          open
            ? "rotate-0 scale-110 opacity-100"
            : "rotate-[200deg] scale-50 opacity-0"
        }`}
      >
        &amp;
      </span>
    </span>
  );
}

export default function TnpTitle({
  className = "",
  as = "h1",
  useDisplayFont = true,
  autoIntervalMs,
}: {
  className?: string;
  as?: "h1" | "span";
  useDisplayFont?: boolean;
  autoIntervalMs?: number;
}) {
  const [open, setOpen] = useState(false);
  const Tag = as;

  useEffect(() => {
    if (!autoIntervalMs) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let interval: number | undefined;
    const sync = () => {
      window.clearInterval(interval);
      if (reducedMotion.matches) {
        setOpen(false);
      } else {
        interval = window.setInterval(
          () => setOpen((value) => !value),
          autoIntervalMs,
        );
      }
    };

    sync();
    reducedMotion.addEventListener("change", sync);
    return () => {
      window.clearInterval(interval);
      reducedMotion.removeEventListener("change", sync);
    };
  }, [autoIntervalMs]);

  const hover = (event: PointerEvent, next: boolean) => {
    if (!autoIntervalMs && event.pointerType === "mouse") setOpen(next);
  };

  return (
    <Tag
      aria-label="Training and Placement"
      className={`${useDisplayFont ? display.className : ""} flex w-max shrink-0 cursor-default select-none items-start whitespace-nowrap font-normal leading-[1.2] tracking-[-0.025em] text-[#F3EDE7] ${className}`}
      onPointerEnter={(event) => hover(event, true)}
      onPointerLeave={(event) => hover(event, false)}
      onPointerUp={(event) => {
        if (!autoIntervalMs && event.pointerType !== "mouse")
          setOpen((value) => !value);
      }}
    >
      <span aria-hidden="true" className="flex items-start">
        <span>T</span>
        <Tail text="raining" open={open} delay={60} />
        <Ampersand open={open} />
        <span>P</span>
        <Tail text="lacement" open={open} delay={160} />
      </span>
    </Tag>
  );
}
