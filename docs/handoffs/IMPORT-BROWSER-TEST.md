# Strict import templates: browser and SQL acceptance

Run: 2026-10-26, isolated `tnp_import_test_*` PostgreSQL database with migrations
0000–0008, fictional catalogue records and fictional authentication accounts.
The application database and Docker volume were not reset. The production build
used `npx next build --webpack`; the default Turbopack build failed while trying
to start a helper process and bind a port in this environment.

The Playwright Chromium script `scripts/import-browser-test.mjs` passed:

- All five CSV download links and exact headers; malformed headers, duplicates,
  invalid dates, unknown cycles and missing names rejected without confirmation.
- Five ordered dataset imports through preview and confirmation; repeated final
  offer skipped; company update reviewed and committed.
- Downloaded Excel template roundtrip; only the named data sheet imported;
  incorrect worksheet rejected.
- Historic and current imported students and offers visible in Student Records.
- Dashboard current-cycle figures of two registered, one placed, one unplaced and
  50% placement, with the chosen historic comparison cycle visible.
- Import history visible; professor, SUPERADMIN with All departments, and
  anonymous users unable to import.

Read-only SQL reconciliation for the browser fixture found four student-cycle
participations (three REGISTERED, one UNREGISTERED), two final offers, exactly
one company master and eight confirmed import-history rows. The company's final
remarks matched the browser-reviewed update. Browser evidence, screenshots and
response reports are under `/tmp/tnp-import-browser-1793015813722/` on this
machine; they contain only fictional test data and are not committed.

The browser run used a temporary Playwright installation and the already cached
Chromium binary. `PLAYWRIGHT_EXECUTABLE` lets the script use a compatible local
binary when Playwright's default revision is absent. The script chooses a fresh
fictional roll range per run so earlier isolated runs do not create false offer
conflicts. The project still needs the original independent tester signoff and
reviewed Git handoff before IMPORT-001 is marked DONE.
