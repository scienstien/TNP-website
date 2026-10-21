"use client";

/**
 * <NittLogoCanvas />: drop-in, self-contained version of the 3D logo with its own canvas and lighting.
 * Transparent background, fills its parent. In Next.js load it with next/dynamic and { ssr: false }.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import * as THREE from "three";
import NittLogo, { type NittLogoProps } from "./NittLogo";

export interface NittLogoCanvasProps {
  className?: string;
  style?: CSSProperties;
  /** Turntable speed in radians per second. Ignored for visitors who prefer reduced motion. Default 0.5. */
  spin?: number;
  /** Starting angle in radians, handy when `spin` is 0. Default a slight three-quarter view. */
  angle?: [number, number, number];
  /** While the pointer is over the canvas, stop spinning and lean and slide toward the pointer. Default false. */
  followPointer?: boolean;
  /** Logo radius as a fraction of half the canvas height. Leave room when `followPointer` is on. Default 0.73. */
  fill?: number;
  textureUrl?: NittLogoProps["textureUrl"];
}

const FOV = 35;

type PointerState = { x: number; y: number; inside: boolean };

/**
 * Idle: turns at `spin`. Hovered: eases to the nearest face-on angle (the back carries the same face,
 * so every half turn counts), then turns toward the pointer and slides a little toward it.
 */
function PointerFollow({
  pointer,
  spin,
  children,
}: {
  pointer: RefObject<PointerState>;
  spin: number;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null!);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1); // avoid a jump after the tab was in the background
    const group = ref.current;
    const { x, y, inside } = pointer.current;
    const damp = (from: number, to: number, speed: number) =>
      THREE.MathUtils.damp(from, to, speed, delta);

    if (inside) {
      const faceOn = Math.round(group.rotation.y / Math.PI) * Math.PI;
      group.rotation.y = damp(group.rotation.y, faceOn + x * 0.65, 6);
      group.rotation.x = damp(group.rotation.x, -y * 0.5, 6);
      group.position.x = damp(group.position.x, x * 0.3, 5);
      group.position.y = damp(group.position.y, y * 0.24, 5);
    } else {
      group.rotation.y += delta * spin;
      group.rotation.x = damp(group.rotation.x, 0, 3);
      group.position.x = damp(group.position.x, 0, 3);
      group.position.y = damp(group.position.y, 0, 3);
    }
  });

  return <group ref={ref}>{children}</group>;
}

export default function NittLogoCanvas({
  className,
  style,
  spin = 0.5,
  angle = [-0.12, -0.45, 0],
  followPointer = false,
  fill = 0.73,
  textureUrl,
}: NittLogoCanvasProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const pointer = useRef<PointerState>({ x: 0, y: 0, inside: false });

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const idleSpin = reducedMotion ? 0 : spin;
  // Distance at which the 1.02-radius medallion fills `fill` of half the view height.
  const distance = 1.02 / fill / Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  const track = (event: PointerEvent<HTMLDivElement>, inside: boolean) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointer.current = {
      x: THREE.MathUtils.clamp(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -1,
        1,
      ),
      y: THREE.MathUtils.clamp(
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
        -1,
        1,
      ),
      inside,
    };
  };

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", ...style }}
      onPointerMove={followPointer ? (event) => track(event, true) : undefined}
      onPointerLeave={
        followPointer ? (event) => track(event, false) : undefined
      }
    >
      <Canvas
        dpr={[1, 1.75]}
        frameloop={idleSpin !== 0 || followPointer ? "always" : "demand"}
        camera={{ position: [0, 0, distance], fov: FOV }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[3, 4, 5]}
          intensity={2.2}
          color="#FFF4E8"
        />
        <directionalLight
          position={[-4, -1, -3]}
          intensity={0.9}
          color="#FFD9B8"
        />

        {/* small procedural environment for the copper edge to reflect; no downloads */}
        <Environment resolution={64} frames={1}>
          <Lightformer
            form="rect"
            intensity={2}
            position={[-4, 4, 3]}
            scale={[5, 3, 1]}
            color="#FFE3C8"
          />
          <Lightformer
            form="rect"
            intensity={1.2}
            position={[4, -1, 3]}
            scale={[4, 2, 1]}
            color="#C9A98B"
          />
          <Lightformer
            form="rect"
            intensity={0.8}
            position={[0, 0, -5]}
            scale={[6, 6, 1]}
            color="#FFFFFF"
          />
        </Environment>

        <Suspense fallback={null}>
          {followPointer ? (
            <PointerFollow pointer={pointer} spin={idleSpin}>
              <NittLogo rotation={angle} spin={0} textureUrl={textureUrl} />
            </PointerFollow>
          ) : (
            <NittLogo
              rotation={angle}
              spin={idleSpin}
              textureUrl={textureUrl}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
