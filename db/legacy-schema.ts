import { sql } from "drizzle-orm";
import { check, integer, pgTable, text } from "drizzle-orm/pg-core";

/**
 * The pre-migration-0005 MME student table, renamed to legacy_students when the institute-wide
 * schema arrived (see drizzle/0005_institute_wide_schema.sql and db/README.md). It is not part of
 * the application schema or of drizzle's migration diff: it exists only so the one-purpose MME
 * roster import can keep writing to the preserved legacy rows until they are migrated.
 */
export const legacyStudents = pgTable("legacy_students", {
  rollNumber: integer("roll_number").primaryKey(),
  name: text("name").notNull(),
  batchYear: integer("batch_year").notNull(),
}, (table) => [
  check("students_roll_number_nine_digits", sql`${table.rollNumber} between 100000000 and 999999999`),
]);
