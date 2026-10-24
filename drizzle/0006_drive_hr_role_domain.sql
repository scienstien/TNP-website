ALTER TABLE "drive_roles" ADD COLUMN "domain" text;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "hr_name" text;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "hr_email" text;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "hr_phone_number" text;--> statement-breakpoint
ALTER TABLE "drive_roles" ADD CONSTRAINT "drive_roles_domain_nonblank" CHECK (char_length("drive_roles"."domain") > 0 and "drive_roles"."domain" = btrim("drive_roles"."domain"));--> statement-breakpoint
-- One-time copy of the legacy company-level HR contact into that company's existing drives.
-- companies.hr_name/email/phone_number are kept unchanged as legacy global contacts.
UPDATE "drives" SET "hr_name" = "companies"."hr_name", "hr_email" = "companies"."email", "hr_phone_number" = "companies"."phone_number" FROM "companies" WHERE "companies"."company_id" = "drives"."company_id";
