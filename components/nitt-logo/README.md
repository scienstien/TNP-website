# 3D NIT Trichy logo

A coin-style 3D medallion of the NIT Trichy logo, built with three.js. The tan ring with the lettering and the white bell-and-gear emblem are raised in relief over the red field, with a bevelled copper edge. The back carries the same face, reading the right way round.

The relief comes from outlines traced off the official logo, and every raised surface is textured with the logo itself, so the artwork and the relief line up exactly. Geometry is built in code; the only asset is the logo image.

## Files

| File | What it is | Needs |
| --- | --- | --- |
| `createNittLogo.ts` | The medallion as a plain three.js `Group`. Framework-agnostic. | `three` |
| `outlines.ts` | Traced emblem and inner-field outlines (data only). | nothing |
| `NittLogo.tsx` | React Three Fiber object, to put inside your own `<Canvas>`. | `@react-three/fiber` |
| `NittLogoCanvas.tsx` | Drop-in component with its own canvas, lights and transparent background. | `@react-three/drei` |
| `public/nitt-logo.webp` | The logo artwork used as the texture. | |

## Use it

### Next.js / React, drop-in

`NittLogoCanvas` fills its parent, so give the parent a size. Load it client-side only:

```tsx
'use client';
import dynamic from 'next/dynamic';

const NittLogoCanvas = dynamic(() => import('@/components/nitt-logo/NittLogoCanvas'), { ssr: false });

export default function Badge() {
  return (
    <div style={{ width: 320, height: 320 }}>
      <NittLogoCanvas spin={0.5} />
    </div>
  );
}
```

Props:
- `spin`: turntable speed in radians per second. `0` holds it still. Default `0.5`.
- `angle`: the starting rotation.
- `followPointer`: while the pointer is over the canvas, the medallion stops spinning, eases face-on, then leans and slides toward the pointer. It resumes spinning when the pointer leaves. Default `false`.
- `fill`: the medallion's radius as a fraction of half the canvas height. Lower it with `followPointer` so the medallion has room to move. Default `0.73`.
- `textureUrl`, `className`, `style`.

Visitors who prefer reduced motion don't get the idle spin.

### Inside an existing React Three Fiber scene

```tsx
<Suspense fallback={null}>
  <NittLogo position={[2, 0, 0]} scale={0.8} spin={0.4} />
</Suspense>
```

It accepts all the usual group props. Your scene supplies the lights; an `Environment` makes the copper edge look best.

### Plain three.js (no React)

```ts
import { createNittLogo } from './createNittLogo';

const logo = createNittLogo({ textureUrl: '/nitt-logo.webp' });
scene.add(logo.object);
// later
logo.dispose();
```

Options: `texture` or `textureUrl`, `thickness` (default `0.14`), `doubleSided` (default `true`), `colors` (`edge`, `ringSide`, `emblemSide`).

## Moving it to another project

Copy this folder and `public/nitt-logo.webp`, then install `three` (plus `@react-three/fiber` and `@react-three/drei` for the React components). If the image lives somewhere else, pass its path as `textureUrl`.

## Size and cost

The medallion is centred on the origin, faces +z and has a radius of about 1.02. It uses five draw calls per face, one 1280 × 1280 texture and no post-processing.

## Notes

- The outlines in `outlines.ts` match this exact logo image. Swapping in a different picture needs re-traced outlines.
- The logo belongs to NIT Tiruchirappalli; use it in line with the institute's guidelines.
