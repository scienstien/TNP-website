# Isolated logo components

Extracted from `origin/feature/logo` at `43dbfbe`. Only the two branding
components and their supporting files were imported; no login form,
mock authentication, background scene, or placement queries were copied.

Preview both at `/logo-preview` using `npm run dev`.

```tsx
import LoginLogo from "@/components/login/LoginLogo";
import TnpTitle from "@/components/login/TnpTitle";

// Render on a dark background; both accept className for placement/sizing.
<LoginLogo />
<TnpTitle className="text-[clamp(1.35rem,5.8vw,3.25rem)]" />
```

- `LoginLogo` loads the 3D canvas only in the browser. It spins slowly, then
  leans and moves toward the pointer while hovered. Its container has a fixed
  size to avoid layout shifts.
- `TnpTitle` expands T&P to Training & Placement on mouse hover; touch and
  pen taps toggle expansion. It uses the local Brigold DEMO font from `fonts.ts`.
  Keep the expanded title's width in mind when choosing its font size.
- The medallion needs `components/nitt-logo/`, `public/nitt-logo.webp`,
  `three`, `@react-three/fiber`, `@react-three/drei`, and development types
  `@types/three`. See the medallion folder README for its lower-level API.
- The title needs no 3D packages. It uses React, Tailwind, and Next.js local fonts.
- No schema, authentication, or dashboard contracts are changed.

The user-supplied Brigold DEMO OTF and its original license are in `fonts/`.
The archive provides only the normal 400 face; no synthetic bold or italic
is requested. The included license limits use to personal use and restricts
publication/redistribution; obtain the appropriate permission before publishing
the font or using it outside those terms.
