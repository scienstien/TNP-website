/**
 * Safety gate for the fictional demo seed (db/seed-departments-demo.ts). Pure: the seed reads a
 * snapshot of the database inside its transaction and asks planDemoSeed() what it may do before
 * its first write. Provenance is never inferred from roll-number ranges or company-name prefixes
 * (a real roll can start with 9); instead the operator must name the exact database as disposable,
 * and a database holding preserved legacy (historical) rows is always refused.
 */

/** Target tables the seed empties and refills, children first so foreign keys allow the deletes. */
export const DEMO_RESET_TABLES = [
  "event_roles",
  "drive_events",
  "placement_offers",
  "drive_roles",
  "drives",
  "student_cycles",
  "cycle_cohorts",
  "enrollments",
  "students",
  "cohorts",
  "programmes",
  "companies",
  "placement_cycles",
] as const;

/** Historical MME tables preserved by migration 0005. The seed never reads their rows or writes them. */
export const LEGACY_TABLES = ["legacy_students", "legacy_companies", "legacy_placement_offers"] as const;

/** Environment variable that must equal current_database() for the seed to run at all. */
export const RESET_DATABASE_ENV = "DEMO_SEED_RESET_DATABASE";

export interface SeedSnapshot {
  /** current_database() of the connection the seed is about to write to. */
  database: string;
  /** Row counts for every DEMO_RESET_TABLES and LEGACY_TABLES entry (a missing legacy table is 0). */
  rows: Readonly<Record<string, number>>;
}

export interface SeedEnvironment {
  resetDatabase?: string;
  nodeEnv?: string;
}

/** "fresh": the target tables are empty, insert only. "reset": empty them, then insert. */
export type SeedPlan =
  | { mode: "fresh" | "reset"; refuse?: undefined }
  | { mode?: undefined; refuse: string };

export function planDemoSeed(snapshot: SeedSnapshot, environment: SeedEnvironment): SeedPlan {
  if (environment.nodeEnv === "production") {
    return { refuse: "The demo seed never runs with NODE_ENV=production." };
  }
  const confirmed = environment.resetDatabase?.trim();
  if (!confirmed) {
    return {
      refuse: `Refusing to seed "${snapshot.database}". The demo seed replaces every placement and academic row, so it only runs on a disposable database: set ${RESET_DATABASE_ENV}=${snapshot.database} to confirm this database may be overwritten.`,
    };
  }
  if (confirmed !== snapshot.database) {
    return {
      refuse: `${RESET_DATABASE_ENV} names "${confirmed}" but the connection is to "${snapshot.database}". Nothing was changed.`,
    };
  }
  const missing = [...DEMO_RESET_TABLES, ...LEGACY_TABLES].filter((table) => {
    const count = snapshot.rows[table];
    return typeof count !== "number" || !Number.isInteger(count) || count < 0;
  });
  if (missing.length) {
    return { refuse: `Could not count rows in ${missing.join(", ")}; refusing to seed an unknown dataset.` };
  }
  const legacy = LEGACY_TABLES.filter((table) => snapshot.rows[table] > 0);
  if (legacy.length) {
    return {
      refuse: `"${snapshot.database}" holds preserved historical rows (${legacy.join(", ")}), so it is not a disposable demo database. Create a separate database for the demo instead.`,
    };
  }
  return { mode: DEMO_RESET_TABLES.some((table) => snapshot.rows[table] > 0) ? "reset" : "fresh" };
}

/**
 * The retired placeholder department (created by migration 0005) is removed only when nothing
 * refers to it; users, outreach records and programmes are never deleted or moved to make room.
 */
export function canRemoveRetiredDepartment(references: { users: number; outreachContacts: number; programmes: number }): boolean {
  return references.users === 0 && references.outreachContacts === 0 && references.programmes === 0;
}

/** Environment variable that must equal current_database() for the add-only top-up to run. */
export const TOPUP_DATABASE_ENV = "DEMO_TOPUP_DATABASE";

/**
 * The add-only top-up never deletes or updates rows, and legacy rows are allowed (it never touches
 * them); it still needs the database named explicitly and never runs in production.
 */
export function planDemoTopUp(database: string, environment: { topUpDatabase?: string; nodeEnv?: string }): { refuse?: string } {
  if (environment.nodeEnv === "production") return { refuse: "The demo top-up never runs with NODE_ENV=production." };
  const confirmed = environment.topUpDatabase?.trim();
  if (!confirmed) return { refuse: `Refusing to add demo departments to "${database}": set ${TOPUP_DATABASE_ENV}=${database} to confirm.` };
  if (confirmed !== database) return { refuse: `${TOPUP_DATABASE_ENV} names "${confirmed}" but the connection is to "${database}". Nothing was changed.` };
  return {};
}
