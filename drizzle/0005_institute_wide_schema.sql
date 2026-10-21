-- Institute-wide placement model (departments, programmes, cohorts, enrollments, cycles, drives,
-- offers, events), plus department scoping for users and outreach contacts.
--
-- The legacy MME tables public.students, public.companies and public.placement_offers hold the
-- previous history. They are NOT dropped: they are renamed to legacy_* (together with their
-- indexes) so the new tables can take the names, and every row is kept. Copying their data into
-- the new model, including each company's visit_date as drive events, is a reviewed data
-- migration that has not been done here.
--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename IN ('students', 'companies', 'placement_offers')
  LOOP
    EXECUTE format('ALTER INDEX public.%I RENAME TO %I', r.indexname, 'legacy_' || r.indexname);
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "students" RENAME TO "legacy_students";
--> statement-breakpoint
ALTER TABLE "companies" RENAME TO "legacy_companies";
--> statement-breakpoint
ALTER TABLE "placement_offers" RENAME TO "legacy_placement_offers";
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'SUPERADMIN';
--> statement-breakpoint
CREATE TYPE "public"."degree_level" AS ENUM('UG', 'PG');
--> statement-breakpoint
CREATE TYPE "public"."event_scope" AS ENUM('WHOLE_DRIVE', 'SELECTED_ROLES');
--> statement-breakpoint
CREATE TYPE "public"."process_type" AS ENUM('PPT', 'OT', 'GD', 'RESUME_SHORTLISTING', 'PI');
--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('REGISTERED', 'UNREGISTERED');
--> statement-breakpoint
CREATE TABLE "cohorts" (
	"cohort_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"programme_id" uuid NOT NULL,
	"graduation_year" integer NOT NULL,
	CONSTRAINT "cohorts_programme_year_unique" UNIQUE("programme_id","graduation_year"),
	CONSTRAINT "cohorts_graduation_year_four_digits" CHECK ("cohorts"."graduation_year" between 1000 and 9999)
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"company_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"hr_name" text,
	"email" text,
	"phone_number" text,
	"remarks" text,
	"pvr_status" boolean,
	CONSTRAINT "companies_name_unique" UNIQUE("name"),
	CONSTRAINT "companies_name_required" CHECK (char_length("companies"."name") > 0 and "companies"."name" = btrim("companies"."name"))
);
--> statement-breakpoint
CREATE TABLE "cycle_cohorts" (
	"cycle_id" uuid NOT NULL,
	"cohort_id" uuid NOT NULL,
	CONSTRAINT "cycle_cohorts_pk" PRIMARY KEY("cycle_id","cohort_id")
);
--> statement-breakpoint
CREATE TABLE "degrees" (
	"degree_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"level" "degree_level" NOT NULL,
	CONSTRAINT "degrees_code_unique" UNIQUE("code"),
	CONSTRAINT "degrees_code_required" CHECK (char_length("degrees"."code") > 0 and "degrees"."code" = btrim("degrees"."code"))
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"department_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "departments_code_unique" UNIQUE("code"),
	CONSTRAINT "departments_code_required" CHECK (char_length("departments"."code") > 0 and "departments"."code" = btrim("departments"."code")),
	CONSTRAINT "departments_name_required" CHECK (char_length(btrim("departments"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "drive_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_id" uuid NOT NULL,
	"process_type" "process_type" NOT NULL,
	"scheduled_date" date,
	"label" text,
	"scope" "event_scope" NOT NULL,
	CONSTRAINT "drive_events_id_drive_unique" UNIQUE("event_id","drive_id")
);
--> statement-breakpoint
CREATE TABLE "drive_roles" (
	"role_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_id" uuid NOT NULL,
	"job_title" text,
	CONSTRAINT "drive_roles_id_drive_unique" UNIQUE("role_id","drive_id"),
	CONSTRAINT "drive_roles_title_nonblank" CHECK (char_length("drive_roles"."job_title") > 0 and "drive_roles"."job_title" = btrim("drive_roles"."job_title"))
);
--> statement-breakpoint
CREATE TABLE "drives" (
	"drive_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"reference" text,
	CONSTRAINT "drives_id_company_cycle_unique" UNIQUE("drive_id","company_id","cycle_id")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"enrollment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"roll_number" integer NOT NULL,
	"cohort_id" uuid NOT NULL,
	"admission_year" integer,
	"reservation_category_code" text,
	CONSTRAINT "enrollments_roll_number_unique" UNIQUE("roll_number"),
	CONSTRAINT "enrollments_id_cohort_unique" UNIQUE("enrollment_id","cohort_id"),
	CONSTRAINT "enrollments_roll_number_nine_digits" CHECK ("enrollments"."roll_number" between 100000000 and 999999999),
	CONSTRAINT "enrollments_admission_year_four_digits" CHECK ("enrollments"."admission_year" between 1000 and 9999)
);
--> statement-breakpoint
CREATE TABLE "event_roles" (
	"event_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"drive_id" uuid NOT NULL,
	CONSTRAINT "event_roles_pk" PRIMARY KEY("event_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "gender_types" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "gender_types_code_required" CHECK (char_length("gender_types"."code") > 0 and "gender_types"."code" = btrim("gender_types"."code")),
	CONSTRAINT "gender_types_label_required" CHECK (char_length(btrim("gender_types"."label")) > 0)
);
--> statement-breakpoint
CREATE TABLE "placement_cycles" (
	"cycle_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"starts_on" date,
	"ends_on" date,
	CONSTRAINT "placement_cycles_code_unique" UNIQUE("code"),
	CONSTRAINT "placement_cycles_code_required" CHECK (char_length("placement_cycles"."code") > 0 and "placement_cycles"."code" = btrim("placement_cycles"."code")),
	CONSTRAINT "placement_cycles_date_order" CHECK ("placement_cycles"."starts_on" <= "placement_cycles"."ends_on")
);
--> statement-breakpoint
CREATE TABLE "placement_offers" (
	"offer_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"drive_id" uuid,
	"role_id" uuid,
	"package_lpa" numeric,
	"monthly_stipend_inr" numeric,
	"offer_type" "offer_type",
	"offer_date" date,
	CONSTRAINT "placement_offers_enrollment_id_unique" UNIQUE("enrollment_id"),
	CONSTRAINT "placement_offers_role_requires_drive" CHECK ("placement_offers"."role_id" is null or "placement_offers"."drive_id" is not null),
	CONSTRAINT "placement_offers_package_nonnegative_finite" CHECK ("placement_offers"."package_lpa" >= 0 and "placement_offers"."package_lpa" < 'Infinity'::numeric),
	CONSTRAINT "placement_offers_stipend_nonnegative_finite" CHECK ("placement_offers"."monthly_stipend_inr" >= 0 and "placement_offers"."monthly_stipend_inr" < 'Infinity'::numeric)
);
--> statement-breakpoint
CREATE TABLE "programmes" (
	"programme_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"degree_id" uuid NOT NULL,
	"specialization" text,
	CONSTRAINT "programmes_department_degree_specialization_unique" UNIQUE NULLS NOT DISTINCT("department_id","degree_id","specialization"),
	CONSTRAINT "programmes_specialization_nonblank" CHECK (char_length("programmes"."specialization") > 0 and "programmes"."specialization" = btrim("programmes"."specialization"))
);
--> statement-breakpoint
CREATE TABLE "reservation_categories" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "reservation_categories_code_required" CHECK (char_length("reservation_categories"."code") > 0 and "reservation_categories"."code" = btrim("reservation_categories"."code")),
	CONSTRAINT "reservation_categories_label_required" CHECK (char_length(btrim("reservation_categories"."label")) > 0)
);
--> statement-breakpoint
CREATE TABLE "student_cycles" (
	"cycle_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"cohort_id" uuid NOT NULL,
	"registration_status" "registration_status" NOT NULL,
	CONSTRAINT "student_cycles_pk" PRIMARY KEY("cycle_id","enrollment_id")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"student_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"gender_code" text,
	CONSTRAINT "students_name_required" CHECK (char_length("students"."name") between 1 and 100 and "students"."name" = btrim("students"."name"))
);
--> statement-breakpoint
-- Existing accounts and outreach contacts belong to the original MME department.
INSERT INTO "departments" ("code", "name") VALUES ('mme', 'Metallurgical and Materials Engineering') ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "outreach_contacts" ADD COLUMN "department_id" uuid;
--> statement-breakpoint
UPDATE "outreach_contacts" SET "department_id" = (SELECT "department_id" FROM "departments" WHERE "code" = 'mme');
--> statement-breakpoint
ALTER TABLE "outreach_contacts" ALTER COLUMN "department_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "department_id" uuid;
--> statement-breakpoint
UPDATE "users" SET "department_id" = (SELECT "department_id" FROM "departments" WHERE "code" = 'mme') WHERE "role" <> 'SUPERADMIN';
--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_programme_id_programmes_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("programme_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "cycle_cohorts" ADD CONSTRAINT "cycle_cohorts_cycle_id_placement_cycles_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."placement_cycles"("cycle_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "cycle_cohorts" ADD CONSTRAINT "cycle_cohorts_cohort_id_cohorts_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("cohort_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "drive_events" ADD CONSTRAINT "drive_events_drive_id_drives_drive_id_fk" FOREIGN KEY ("drive_id") REFERENCES "public"."drives"("drive_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "drive_roles" ADD CONSTRAINT "drive_roles_drive_id_drives_drive_id_fk" FOREIGN KEY ("drive_id") REFERENCES "public"."drives"("drive_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "drives" ADD CONSTRAINT "drives_company_id_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "drives" ADD CONSTRAINT "drives_cycle_id_placement_cycles_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."placement_cycles"("cycle_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_cohort_id_cohorts_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("cohort_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_reservation_category_fk" FOREIGN KEY ("reservation_category_code") REFERENCES "public"."reservation_categories"("code") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "event_roles" ADD CONSTRAINT "event_roles_event_drive_fk" FOREIGN KEY ("event_id","drive_id") REFERENCES "public"."drive_events"("event_id","drive_id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "event_roles" ADD CONSTRAINT "event_roles_role_drive_fk" FOREIGN KEY ("role_id","drive_id") REFERENCES "public"."drive_roles"("role_id","drive_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "outreach_contacts" ADD CONSTRAINT "outreach_contacts_department_id_departments_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("department_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "placement_offers" ADD CONSTRAINT "placement_offers_company_id_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "placement_offers" ADD CONSTRAINT "placement_offers_student_cycle_fk" FOREIGN KEY ("cycle_id","enrollment_id") REFERENCES "public"."student_cycles"("cycle_id","enrollment_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "placement_offers" ADD CONSTRAINT "placement_offers_drive_context_fk" FOREIGN KEY ("drive_id","company_id","cycle_id") REFERENCES "public"."drives"("drive_id","company_id","cycle_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "placement_offers" ADD CONSTRAINT "placement_offers_role_drive_fk" FOREIGN KEY ("role_id","drive_id") REFERENCES "public"."drive_roles"("role_id","drive_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_department_id_departments_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("department_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_degree_id_degrees_degree_id_fk" FOREIGN KEY ("degree_id") REFERENCES "public"."degrees"("degree_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "student_cycles" ADD CONSTRAINT "student_cycles_cycle_cohort_fk" FOREIGN KEY ("cycle_id","cohort_id") REFERENCES "public"."cycle_cohorts"("cycle_id","cohort_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "student_cycles" ADD CONSTRAINT "student_cycles_enrollment_cohort_fk" FOREIGN KEY ("enrollment_id","cohort_id") REFERENCES "public"."enrollments"("enrollment_id","cohort_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_gender_code_gender_types_code_fk" FOREIGN KEY ("gender_code") REFERENCES "public"."gender_types"("code") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("department_id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX "cohorts_graduation_year_idx" ON "cohorts" USING btree ("graduation_year");
--> statement-breakpoint
CREATE INDEX "cycle_cohorts_cohort_idx" ON "cycle_cohorts" USING btree ("cohort_id");
--> statement-breakpoint
CREATE INDEX "drive_events_drive_idx" ON "drive_events" USING btree ("drive_id");
--> statement-breakpoint
CREATE INDEX "drive_events_date_idx" ON "drive_events" USING btree ("scheduled_date");
--> statement-breakpoint
CREATE INDEX "drive_roles_drive_idx" ON "drive_roles" USING btree ("drive_id");
--> statement-breakpoint
CREATE INDEX "drives_company_cycle_idx" ON "drives" USING btree ("company_id","cycle_id");
--> statement-breakpoint
CREATE INDEX "drives_cycle_idx" ON "drives" USING btree ("cycle_id");
--> statement-breakpoint
CREATE INDEX "enrollments_student_idx" ON "enrollments" USING btree ("student_id");
--> statement-breakpoint
CREATE INDEX "enrollments_cohort_idx" ON "enrollments" USING btree ("cohort_id");
--> statement-breakpoint
CREATE INDEX "enrollments_category_idx" ON "enrollments" USING btree ("reservation_category_code");
--> statement-breakpoint
CREATE INDEX "event_roles_role_drive_idx" ON "event_roles" USING btree ("role_id","drive_id");
--> statement-breakpoint
CREATE INDEX "placement_offers_company_cycle_idx" ON "placement_offers" USING btree ("company_id","cycle_id");
--> statement-breakpoint
CREATE INDEX "placement_offers_cycle_idx" ON "placement_offers" USING btree ("cycle_id");
--> statement-breakpoint
CREATE INDEX "placement_offers_drive_idx" ON "placement_offers" USING btree ("drive_id");
--> statement-breakpoint
CREATE INDEX "placement_offers_role_idx" ON "placement_offers" USING btree ("role_id");
--> statement-breakpoint
CREATE INDEX "placement_offers_date_idx" ON "placement_offers" USING btree ("offer_date");
--> statement-breakpoint
CREATE INDEX "programmes_degree_idx" ON "programmes" USING btree ("degree_id");
--> statement-breakpoint
CREATE INDEX "student_cycles_enrollment_idx" ON "student_cycles" USING btree ("enrollment_id");
--> statement-breakpoint
CREATE INDEX "student_cycles_cycle_cohort_idx" ON "student_cycles" USING btree ("cycle_id","cohort_id");
--> statement-breakpoint
CREATE INDEX "students_gender_idx" ON "students" USING btree ("gender_code");
