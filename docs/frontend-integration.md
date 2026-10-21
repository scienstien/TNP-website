# Historical dashboard UI integration

Branch `feature/historical-dashboard-ui` starts from master at `3fa00d8`.
The visual foundation was adapted from `origin/feature/main` at `e343511`;
that remote branch has unrelated Git history, so it was not merged wholesale.

## Included

- Sidebar navigation, landing cards, dashboard cards, responsive styling, and
  MME department metadata.
- Explicit preview and empty states; no generated student records, fixed
  statistics, invented year comparisons, or simulated authentication.
- Batch selection is disabled until actual batches are available. No report
  export, upload, or editing controls imply functionality that does not exist.
- No recruitment calendar or drive scheduling, which are outside this project's
  historical-data scope.
- Imported styling is scoped to the preview; existing fonts and global theme
  remain in place. No external Google Fonts CSS import was carried over.

## Contracts preserved

The schema, project instructions, dependency manifest and lockfile, TypeScript
strictness and alias, ESLint configuration, and Next.js configuration are unchanged.
No database queries, API contracts, auth tables, or permissions are introduced.
`app/page.tsx` is a presentation-only preview, not a secured dashboard.

## Follow-up integration

The authentication owner must implement server-side access control before
student-level data is exposed. The analytics owner must supply authorized
aggregates from `db/schema.ts`, available batches, roster completeness, and
missing-compensation handling. Wire the batch selector and chart panels only
when those queries are implemented. Offer type values must remain `PPO`, `FTE`,
and `FTE+6month`; placement status follows offer existence.

## Validation

TypeScript checking, ESLint, and production build were run during integration.
No database migration or live-data validation is part of this UI change.
