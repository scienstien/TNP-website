# Portal theme

`PortalShell` imports `portal-theme.css`, so the authenticated pages share one palette while `/login` retains its own styling.

Use `#FFF9D2` for the main page (roughly 40% of colored area), `#FFEBCC` for primary panels (30%), `#BFDDF0` for navigation and supporting surfaces (20%), and `#8CC0EB` for selected states and actions (10%). Dark ink is reserved for readable text; error and success text keeps a small semantic color cue. These are visual proportions, not pixel quotas, since page content and viewport size vary.

New portal components should use the `--theme-*` variables defined in `portal-theme.css`. CSS modules with fixed backgrounds need a portal-scoped rule so they remain legible on the light theme.
