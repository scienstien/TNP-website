"use client";

/**
 * <NittLogo />: the 3D NIT Trichy medallion as a React Three Fiber object.
 * Put it inside any <Canvas> (wrapped in <Suspense>, because it loads the logo texture).
 * Accepts the usual group props (position, rotation, scale, ...).
 */

import { useFrame, useLoader, type ThreeElements } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createNittLogo, type NittLogoOptions } from "./createNittLogo";

export interface NittLogoProps extends Omit<
  ThreeElements["group"],
  "children"
> {
  /** Logo artwork. Default '/nitt-logo.webp'. */
  textureUrl?: string;
  /** Turntable speed in radians per second. 0 stops it. Default 0.5. */
  spin?: number;
  thickness?: NittLogoOptions["thickness"];
  doubleSided?: NittLogoOptions["doubleSided"];
  colors?: NittLogoOptions["colors"];
}

export default function NittLogo({
  textureUrl = "/nitt-logo.webp",
  spin = 0.5,
  thickness,
  doubleSided,
  colors,
  ...props
}: NittLogoProps) {
  const texture = useLoader(THREE.TextureLoader, textureUrl);
  const logo = useMemo(
    () => createNittLogo({ texture, thickness, doubleSided, colors }),
    [texture, thickness, doubleSided, colors],
  );
  useEffect(() => () => logo.dispose(), [logo]);

  const turntable = useRef<THREE.Group>(null!);
  useFrame((_, delta) => {
    if (spin) turntable.current.rotation.y += delta * spin;
  });

  return (
    <group {...props}>
      <group ref={turntable}>
        <primitive object={logo.object} />
      </group>
    </group>
  );
}
