import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Institute-wide historical placement target schema; see db/README.md.
 * Runtime queries, actions and the institute demo seed use this target model. Preserved
 * legacy rows and their dedicated importer remain isolated pending the reviewed data
 * migration. Updating this file does not migrate a database or integrate the calendar UI.
 *
 * Future transactional writes/custom SQL must additionally enforce:
 * - PG programmes have a specialization and enrollment rolls are immutable.
 * - An offer's student-cycle is REGISTERED, including on registration changes.
 * - WHOLE_DRIVE events have no event roles; SELECTED_ROLES events have >= 1.
 * These cross-row/lifecycle rules are not enforced by the declarations below.
 */
// SUPERADMIN belongs to no department and has every ADMIN power in every department; ADMIN and
// PROFESSOR belong to exactly one department (users.department_id, enforced in the application).
export const userRole = pgEnum("user_role", ["ADMIN", "PROFESSOR", "SUPERADMIN"]);
export const offerType = pgEnum("offer_type", ["PPO", "FTE", "FTE+6month"]);
export const degreeLevel = pgEnum("degree_level", ["UG", "PG"]);
export const registrationStatus = pgEnum("registration_status", [
  "REGISTERED",
  "UNREGISTERED",
]);
export const processType = pgEnum("process_type", [
  "PPT",
  "OT",
  "GD",
  "RESUME_SHORTLISTING",
  "PI",
]);
export const eventScope = pgEnum("event_scope", [
  "WHOLE_DRIVE",
  "SELECTED_ROLES",
]);

// Reference values come from the institute's catalogue; no demographic defaults.
export const genderTypes = pgTable("gender_types", {
  code: text("code").primaryKey(),
  label: text("label").notNull(),
}, (table) => [
  check("gender_types_code_required", sql`char_length(${table.code}) > 0 and ${table.code} = btrim(${table.code})`),
  check("gender_types_label_required", sql`char_length(btrim(${table.label})) > 0`),
]);

export const reservationCategories = pgTable("reservation_categories", {
  code: text("code").primaryKey(),
  label: text("label").notNull(),
}, (table) => [
  check("reservation_categories_code_required", sql`char_length(${table.code}) > 0 and ${table.code} = btrim(${table.code})`),
  check("reservation_categories_label_required", sql`char_length(btrim(${table.label})) > 0`),
]);

export const departments = pgTable("departments", {
  departmentId: uuid("department_id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
}, (table) => [
  check("departments_code_required", sql`char_length(${table.code}) > 0 and ${table.code} = btrim(${table.code})`),
  check("departments_name_required", sql`char_length(btrim(${table.name})) > 0`),
]);

export const degrees = pgTable("degrees", {
  degreeId: uuid("degree_id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  level: degreeLevel("level").notNull(),
}, (table) => [
  check("degrees_code_required", sql`char_length(${table.code}) > 0 and ${table.code} = btrim(${table.code})`),
]);

export const programmes = pgTable("programmes", {
  programmeId: uuid("programme_id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id").notNull().references(() => departments.departmentId, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
  degreeId: uuid("degree_id").notNull().references(() => degrees.degreeId, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
  specialization: text("specialization"),
}, (table) => [
  // PostgreSQL 15+: NULL specialization still identifies one department/degree programme.
  unique("programmes_department_degree_specialization_unique")
    .on(table.departmentId, table.degreeId, table.specialization)
    .nullsNotDistinct(),
  check("programmes_specialization_nonblank", sql`char_length(${table.specialization}) > 0 and ${table.specialization} = btrim(${table.specialization})`),
  index("programmes_degree_idx").on(table.degreeId),
]);

export const cohorts = pgTable("cohorts", {
  cohortId: uuid("cohort_id").defaultRandom().primaryKey(),
  programmeId: uuid("programme_id").notNull().references(() => programmes.programmeId, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
  graduationYear: integer("graduation_year").notNull(),
}, (table) => [
  unique("cohorts_programme_year_unique").on(table.programmeId, table.graduationYear),
  check("cohorts_graduation_year_four_digits", sql`${table.graduationYear} between 1000 and 9999`),
  index("cohorts_graduation_year_idx").on(table.graduationYear),
]);

export const students = pgTable("students", {
  studentId: uuid("student_id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  genderCode: text("gender_code").references(() => genderTypes.code, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
}, (table) => [
  check("students_name_required", sql`char_length(${table.name}) between 1 and 100 and ${table.name} = btrim(${table.name})`),
  index("students_gender_idx").on(table.genderCode),
]);

export const enrollments = pgTable("enrollments", {
  enrollmentId: uuid("enrollment_id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").notNull().references(() => students.studentId, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
  rollNumber: integer("roll_number").notNull().unique(),
  cohortId: uuid("cohort_id").notNull().references(() => cohorts.cohortId, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
  admissionYear: integer("admission_year"),
  reservationCategoryCode: text("reservation_category_code"),
}, (table) => [
  // Composite candidate key lets participation verify the enrollment's cohort.
  unique("enrollments_id_cohort_unique").on(table.enrollmentId, table.cohortId),
  foreignKey({
    name: "enrollments_reservation_category_fk",
    columns: [table.reservationCategoryCode],
    foreignColumns: [reservationCategories.code],
  }).onUpdate("cascade").onDelete("restrict"),
  check("enrollments_roll_number_nine_digits", sql`${table.rollNumber} between 100000000 and 999999999`),
  check("enrollments_admission_year_four_digits", sql`${table.admissionYear} between 1000 and 9999`),
  index("enrollments_student_idx").on(table.studentId),
  index("enrollments_cohort_idx").on(table.cohortId),
  index("enrollments_category_idx").on(table.reservationCategoryCode),
]);

export const placementCycles = pgTable("placement_cycles", {
  cycleId: uuid("cycle_id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  startsOn: date("starts_on", { mode: "string" }),
  endsOn: date("ends_on", { mode: "string" }),
}, (table) => [
  check("placement_cycles_code_required", sql`char_length(${table.code}) > 0 and ${table.code} = btrim(${table.code})`),
  check("placement_cycles_date_order", sql`${table.startsOn} <= ${table.endsOn}`),
  // Dates are descriptive, optional and may overlap other cycles.
]);

export const cycleCohorts = pgTable("cycle_cohorts", {
  cycleId: uuid("cycle_id").notNull().references(() => placementCycles.cycleId, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
  cohortId: uuid("cohort_id").notNull().references(() => cohorts.cohortId, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
}, (table) => [
  primaryKey({ name: "cycle_cohorts_pk", columns: [table.cycleId, table.cohortId] }),
  index("cycle_cohorts_cohort_idx").on(table.cohortId),
]);

export const studentCycles = pgTable("student_cycles", {
  cycleId: uuid("cycle_id").notNull(),
  enrollmentId: uuid("enrollment_id").notNull(),
  cohortId: uuid("cohort_id").notNull(),
  // Ineligible and opted-out students are both UNREGISTERED; never infer a default.
  registrationStatus: registrationStatus("registration_status").notNull(),
}, (table) => [
  primaryKey({ name: "student_cycles_pk", columns: [table.cycleId, table.enrollmentId] }),
  foreignKey({
    name: "student_cycles_cycle_cohort_fk",
    columns: [table.cycleId, table.cohortId],
    foreignColumns: [cycleCohorts.cycleId, cycleCohorts.cohortId],
  }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({
    name: "student_cycles_enrollment_cohort_fk",
    columns: [table.enrollmentId, table.cohortId],
    foreignColumns: [enrollments.enrollmentId, enrollments.cohortId],
  }).onUpdate("cascade").onDelete("restrict"),
  index("student_cycles_enrollment_idx").on(table.enrollmentId),
  index("student_cycles_cycle_cohort_idx").on(table.cycleId, table.cohortId),
]);

export const companies = pgTable("companies", {
  companyId: uuid("company_id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  domain: text("domain"),
  hrName: text("hr_name"),
  email: text("email"),
  phoneNumber: text("phone_number"),
  remarks: text("remarks"),
  // NULL preserves an unknown source value instead of assuming "no".
  pvrStatus: boolean("pvr_status"),
  // Scheduling belongs to drive_events, not a single company-level visit date.
}, (table) => [
  check("companies_name_required", sql`char_length(${table.name}) > 0 and ${table.name} = btrim(${table.name})`),
]);

export const drives = pgTable("drives", {
  driveId: uuid("drive_id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.companyId, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
  cycleId: uuid("cycle_id").notNull().references(() => placementCycles.cycleId, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
  reference: text("reference"),
  // The HR contact for this drive. Required by the application when a drive is created or
  // edited; nullable only for drives recorded before 0006 without a company contact to copy.
  // companies.hr_name/email/phone_number remain as legacy global contacts for now.
  hrName: text("hr_name"),
  hrEmail: text("hr_email"),
  hrPhoneNumber: text("hr_phone_number"),
}, (table) => [
  unique("drives_id_company_cycle_unique").on(table.driveId, table.companyId, table.cycleId),
  // Intentionally non-unique: a company can conduct many drives in one cycle.
  index("drives_company_cycle_idx").on(table.companyId, table.cycleId),
  index("drives_cycle_idx").on(table.cycleId),
]);

export const driveRoles = pgTable("drive_roles", {
  roleId: uuid("role_id").defaultRandom().primaryKey(),
  driveId: uuid("drive_id").notNull().references(() => drives.driveId, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
  jobTitle: text("job_title"),
  // The role's field (e.g. Software, Production); NULL when not recorded. Analytics that
  // show distribution across fields use this column. companies.domain is only a description.
  domain: text("domain"),
}, (table) => [
  unique("drive_roles_id_drive_unique").on(table.roleId, table.driveId),
  check("drive_roles_title_nonblank", sql`char_length(${table.jobTitle}) > 0 and ${table.jobTitle} = btrim(${table.jobTitle})`),
  check("drive_roles_domain_nonblank", sql`char_length(${table.domain}) > 0 and ${table.domain} = btrim(${table.domain})`),
  index("drive_roles_drive_idx").on(table.driveId),
]);

export const placementOffers = pgTable("placement_offers", {
  offerId: uuid("offer_id").defaultRandom().primaryKey(),
  // One final reported offer per roll/enrollment, even across multiple cycles.
  enrollmentId: uuid("enrollment_id").notNull().unique(),
  cycleId: uuid("cycle_id").notNull(),
  companyId: uuid("company_id").notNull().references(() => companies.companyId, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
  // Partial historical records need not identify a particular drive or role.
  driveId: uuid("drive_id"),
  roleId: uuid("role_id"),
  // Actual offer amounts, never company/role defaults. Numeric returns decimal strings.
  packageLpa: numeric("package_lpa"),
  monthlyStipendInr: numeric("monthly_stipend_inr"),
  offerType: offerType("offer_type"),
  offerDate: date("offer_date", { mode: "string" }),
}, (table) => [
  foreignKey({
    name: "placement_offers_student_cycle_fk",
    columns: [table.cycleId, table.enrollmentId],
    foreignColumns: [studentCycles.cycleId, studentCycles.enrollmentId],
  }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({
    name: "placement_offers_drive_context_fk",
    columns: [table.driveId, table.companyId, table.cycleId],
    foreignColumns: [drives.driveId, drives.companyId, drives.cycleId],
  }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({
    name: "placement_offers_role_drive_fk",
    columns: [table.roleId, table.driveId],
    foreignColumns: [driveRoles.roleId, driveRoles.driveId],
  }).onUpdate("cascade").onDelete("restrict"),
  // MATCH SIMPLE composite FKs must not let a NULL drive bypass a supplied role.
  check("placement_offers_role_requires_drive", sql`${table.roleId} is null or ${table.driveId} is not null`),
  check("placement_offers_package_nonnegative_finite", sql`${table.packageLpa} >= 0 and ${table.packageLpa} < 'Infinity'::numeric`),
  check("placement_offers_stipend_nonnegative_finite", sql`${table.monthlyStipendInr} >= 0 and ${table.monthlyStipendInr} < 'Infinity'::numeric`),
  index("placement_offers_company_cycle_idx").on(table.companyId, table.cycleId),
  index("placement_offers_cycle_idx").on(table.cycleId),
  index("placement_offers_drive_idx").on(table.driveId),
  index("placement_offers_role_idx").on(table.roleId),
  index("placement_offers_date_idx").on(table.offerDate),
  // Derive status per student-cycle: REGISTERED + offer = PLACED; REGISTERED
  // without an offer = UNPLACED; UNREGISTERED must have no offer in that cycle.
]);

export const driveEvents = pgTable("drive_events", {
  eventId: uuid("event_id").defaultRandom().primaryKey(),
  driveId: uuid("drive_id").notNull().references(() => drives.driveId, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
  processType: processType("process_type").notNull(),
  // NULL is unscheduled; dated events can be displayed on the calendar.
  scheduledDate: date("scheduled_date", { mode: "string" }),
  label: text("label"),
  scope: eventScope("scope").notNull(),
}, (table) => [
  unique("drive_events_id_drive_unique").on(table.eventId, table.driveId),
  index("drive_events_drive_idx").on(table.driveId),
  index("drive_events_date_idx").on(table.scheduledDate),
  // No uniqueness or ordering rules on process type/date: repeated PI/OT/etc. are valid.
]);

export const eventRoles = pgTable("event_roles", {
  eventId: uuid("event_id").notNull(),
  roleId: uuid("role_id").notNull(),
  // Shared context enforces that the event and each selected role use the same drive.
  driveId: uuid("drive_id").notNull(),
}, (table) => [
  primaryKey({ name: "event_roles_pk", columns: [table.eventId, table.roleId] }),
  foreignKey({
    name: "event_roles_event_drive_fk",
    columns: [table.eventId, table.driveId],
    foreignColumns: [driveEvents.eventId, driveEvents.driveId],
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    name: "event_roles_role_drive_fk",
    columns: [table.roleId, table.driveId],
    foreignColumns: [driveRoles.roleId, driveRoles.driveId],
  }).onUpdate("cascade").onDelete("restrict"),
  index("event_roles_role_drive_idx").on(table.roleId, table.driveId),
]);

// Independent outreach/contact checklist. Deliberately has no foreign key to
// companies or placement records so prospective contacts can be tracked freely.
export const outreachContacts = pgTable("outreach_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Each department keeps its own outreach checklist.
  departmentId: uuid("department_id")
    .notNull()
    .references(() => departments.departmentId, { onUpdate: "cascade", onDelete: "restrict" }),
  companyName: text("company_name").notNull(),
  hrName: text("hr_name"),
  phoneNumber: text("phone_number"),
  email: text("email"),
  pvrStatus: boolean("pvr_status").notNull().default(false),
  remarks: text("remarks"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

// Authentication only; no student or placement fields belong here (the department is the
// user's scope, not placement data). Existing Auth.js JWT/Credentials authentication needs no
// adapter tables.
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  // Nullable for provider-based authentication; never store plaintext passwords.
  passwordHash: text("password_hash"),
  role: userRole("role").notNull().default("PROFESSOR"),
  // NULL only for SUPERADMIN. Authorization is separate: see lib/auth/dal.ts.
  departmentId: uuid("department_id").references(() => departments.departmentId, {
    onUpdate: "cascade",
    onDelete: "restrict",
  }),
});
