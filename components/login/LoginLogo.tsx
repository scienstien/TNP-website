"use client";

/** The 3D NIT Trichy medallion for the login page: turns slowly, leans and slides toward the pointer on hover. */

import dynamic from "next/dynamic";

const NittLogoCanvas = dynamic(
  () => import("@/components/nitt-logo/NittLogoCanvas"),
  { ssr: false },
);

export default function LoginLogo({ className = "" }: { className?: string }) {
  // Fixed box so nothing shifts while the canvas loads; the medallion fills ~60% of it, leaving room to move.
  return (
    <div
      role="img"
      aria-label="NIT Tiruchirappalli emblem"
      className={`h-44 w-44 sm:h-52 sm:w-52 ${className}`}
    >
      <NittLogoCanvas followPointer spin={0.35} angle={[0, 0, 0]} fill={0.6} />
    </div>
  );
}
