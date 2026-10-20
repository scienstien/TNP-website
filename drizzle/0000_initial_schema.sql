CREATE TYPE "public"."offer_type" AS ENUM('PPO', 'FTE', 'FTE+6month');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'PROFESSOR');--> statement-breakpoint
CREATE TABLE "companies" (
	"name" text PRIMARY KEY NOT NULL,
	"domain" text,
	"hr_name" text,
	"email" text,
	"phone_number" text,
	"pvr_status" boolean
);
--> statement-breakpoint
CREATE TABLE "placement_offers" (
	"company_name" text NOT NULL,
	"student_roll_number" text NOT NULL,
	"job_role" text,
	"package_lpa" numeric,
	"offer_type" "offer_type",
	"offer_date" date,
	CONSTRAINT "placement_offers_company_name_student_roll_number_pk" PRIMARY KEY("company_name","student_roll_number"),
	CONSTRAINT "placement_offers_student_roll_number_unique" UNIQUE("student_roll_number")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"roll_number" text PRIMARY KEY NOT NULL,
	"name" text,
	"batch_year" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"password_hash" text,
	"role" "user_role" DEFAULT 'PROFESSOR' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "placement_offers" ADD CONSTRAINT "placement_offers_company_name_companies_name_fk" FOREIGN KEY ("company_name") REFERENCES "public"."companies"("name") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "placement_offers" ADD CONSTRAINT "placement_offers_student_roll_number_students_roll_number_fk" FOREIGN KEY ("student_roll_number") REFERENCES "public"."students"("roll_number") ON DELETE restrict ON UPDATE cascade;