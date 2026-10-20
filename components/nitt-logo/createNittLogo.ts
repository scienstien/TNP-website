/**
 * createNittLogo: the NIT Trichy logo as a 3D medallion, in plain three.js.
 *
 * Framework-agnostic on purpose: it only needs `three`, so the same function works in
 * React Three Fiber (see NittLogo.tsx), in a vanilla three.js page, or in any other renderer setup.
 *
 * Construction (front to back), all in logo space where the logo's radius is 1:
 *   - raised emblem: the white bell and gear, extruded from an outline traced off the real logo
 *   - raised ring: the tan band with the lettering, with the red field cut out of it
 *   - the flat logo face underneath (the red field shows through here)
 *   - a bevelled copper body, with the same face mirrored correctly on the back
 * Every top surface is textured with the logo itself using planar UVs, so artwork and relief line up.
 */

import * as THREE from "three";
import { EMBLEM, INNER_FIELD } from "./outlines";

export const NITT_LOGO_COLORS = {
  edge: "#9A5530",
  ringSide: "#BCA289",
  emblemSide: "#EDE6DC",
} as const;

export interface NittLogoOptions {
  /** The logo artwork. Pass a loaded texture, or a URL and it is loaded for you. */
  texture?: THREE.Texture;
  /** Used when `texture` is not given. Default '/nitt-logo.webp'. */
  textureUrl?: string;
  /** Thickness of the coin body. Default 0.14 (the logo radius is 1). */
  thickness?: number;
  /** Repeat the relief on the back so the medallion reads correctly from both sides. Default true. */
  doubleSided?: boolean;
  /** Override the untextured side colours. */
  colors?: Partial<
    Record<keyof typeof NITT_LOGO_COLORS, THREE.ColorRepresentation>
  >;
}

export interface NittLogo {
  /** Add this to your scene. Centred at the origin, facing +z, radius about 1.02. */
  object: THREE.Group;
  /** Frees every geometry, material and texture the medallion created. */
  dispose: () => void;
}

const BODY_BEVEL = 0.02;
const RING_HEIGHT = 0.03;
const EMBLEM_HEIGHT = 0.045;

function toPoints(flat: readonly number[]) {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < flat.length; i += 2)
    points.push(new THREE.Vector2(flat[i], flat[i + 1]));
  return points;
}

/** Map x, y in logo space straight onto the logo texture, so every cap shows the right part of the artwork. */
function planarUVs(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = (position.getX(i) + 1) / 2;
    uv[i * 2 + 1] = (position.getY(i) + 1) / 2;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/** Extrude `shape` upward from z = 0 by `height`, with a small bevel; caps are group 0, sides group 1. */
function extrudeUp(shape: THREE.Shape, height: number, bevel: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height - bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.6,
    bevelSegments: 2,
    curveSegments: 64,
  });
  geometry.translate(0, 0, bevel);
  return planarUVs(geometry);
}

export function createNittLogo(options: NittLogoOptions = {}): NittLogo {
  const { thickness = 0.14, doubleSided = true } = options;
  const colors = { ...NITT_LOGO_COLORS, ...options.colors };

  const ownsTexture = !options.texture;
  const texture =
    options.texture ??
    new THREE.TextureLoader().load(options.textureUrl ?? "/nitt-logo.webp");
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  /* materials */
  // The artwork doubles as a bump map: dark lettering and line work read as lightly engraved.
  const face = new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: texture,
    bumpScale: 1.5,
    roughness: 0.55,
    metalness: 0.15,
  });
  const edge = new THREE.MeshStandardMaterial({
    color: colors.edge,
    metalness: 0.85,
    roughness: 0.35,
  });
  const ringSide = new THREE.MeshStandardMaterial({
    color: colors.ringSide,
    metalness: 0.5,
    roughness: 0.45,
  });
  const emblemSide = new THREE.MeshStandardMaterial({
    color: colors.emblemSide,
    metalness: 0.1,
    roughness: 0.6,
  });

  /* geometry, shared by front and back */
  const bodyShape = new THREE.Shape().absarc(0, 0, 1, 0, Math.PI * 2, false);
  const body = new THREE.ExtrudeGeometry(bodyShape, {
    depth: thickness - BODY_BEVEL * 2,
    bevelEnabled: true,
    bevelThickness: BODY_BEVEL,
    bevelSize: BODY_BEVEL,
    bevelSegments: 4,
    curveSegments: 128,
  });
  body.translate(0, 0, -(thickness - BODY_BEVEL * 2) / 2);

  const faceDisc = new THREE.CircleGeometry(1, 128);

  const ringShape = new THREE.Shape().absarc(
    0,
    0,
    0.995,
    0,
    Math.PI * 2,
    false,
  );
  ringShape.holes.push(new THREE.Path(toPoints(INNER_FIELD)));
  const ring = extrudeUp(ringShape, RING_HEIGHT, 0.006);

  const emblem = extrudeUp(
    new THREE.Shape(toPoints(EMBLEM)),
    EMBLEM_HEIGHT,
    0.008,
  );

  /* assembly */
  const object = new THREE.Group();
  object.name = "NittLogo";
  object.add(new THREE.Mesh(body, edge));

  const makeFace = () => {
    const side = new THREE.Group();
    const disc = new THREE.Mesh(faceDisc, face);
    disc.position.z = 0.0005; // just above the body cap, avoids z-fighting
    side.add(disc);
    side.add(new THREE.Mesh(ring, [face, ringSide]));
    side.add(new THREE.Mesh(emblem, [face, emblemSide]));
    side.position.z = thickness / 2;
    return side;
  };

  object.add(makeFace());
  if (doubleSided) {
    // Turning a copy half a turn about y puts it on the back and keeps the artwork reading the right way round.
    const back = new THREE.Group();
    back.rotation.y = Math.PI;
    back.add(makeFace());
    object.add(back);
  }

  return {
    object,
    dispose: () => {
      [body, faceDisc, ring, emblem].forEach((geometry) => geometry.dispose());
      [face, edge, ringSide, emblemSide].forEach((material) =>
        material.dispose(),
      );
      if (ownsTexture) texture.dispose();
    },
  };
}
