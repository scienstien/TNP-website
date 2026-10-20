import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["ADMIN", "PROFESSOR"]);
export const offerType = pgEnum("offer_type", ["PPO", "FTE", "FTE+6month"]);

export const students = pgTable("students", {
  rollNumber: integer("roll_number").primaryKey(),
  name: text("name").notNull(),
  batchYear: integer("batch_year").notNull(),
  // Derive placement_status using EXISTS on placement_offers:
  // an offer means PLACED; no offer means UNPLACED.
}, (table) => [
  check("students_roll_number_nine_digits", sql`${table.rollNumber} between 100000000 and 999999999`),
  check("students_name_required", sql`char_length(${table.name}) between 1 and 100 and ${table.name} = btrim(${table.name})`),
  check("students_batch_year_four_digits", sql`${table.batchYear} between 1000 and 9999`),
]);

export const companies = pgTable("companies", {
  name: text("name").primaryKey(),
  domain: text("domain"),
  hrName: text("hr_name"),
  email: text("email"),
  phoneNumber: text("phone_number"),
  // NULL preserves an unknown source value instead of assuming "no".
  pvrStatus: boolean("pvr_status"),
  // Date of the company's campus visit, shown on the placement calendar. NULL means no
  // visit is scheduled. One date per company; it is not part of the historical offers.
  visitDate: date("visit_date", { mode: "string" }),
});

export const placementOffers = pgTable(
  "placement_offers",
  {
    companyName: text("company_name")
      .notNull()
      .references(() => companies.name, {
        onUpdate: "cascade",
        onDelete: "restrict",
      }),
    studentRollNumber: integer("student_roll_number")
      .notNull()
      .unique()
      .references(() => students.rollNumber, {
        onUpdate: "cascade",
        onDelete: "restrict",
      }),
    jobRole: text("job_role"),
    // Lakhs per annum. Drizzle returns numeric as a string to preserve precision.
    packageLpa: numeric("package_lpa"),
    offerType: offerType("offer_type"),
    offerDate: date("offer_date", { mode: "string" }),
  },
  (table) => [
    primaryKey({ columns: [table.companyName, table.studentRollNumber] }),
  ],
);

// Authentication only; no student or placement fields belong here.
// Auth.js provider/adapter integration is a separate task.
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  // Nullable for provider-based authentication; never store plaintext passwords.
  passwordHash: text("password_hash"),
  role: userRole("role").notNull().default("PROFESSOR"),
});
