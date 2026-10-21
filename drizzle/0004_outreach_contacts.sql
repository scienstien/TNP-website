CREATE TABLE "outreach_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"hr_name" text,
	"phone_number" text,
	"email" text,
	"pvr_status" boolean DEFAULT false NOT NULL,
	"remarks" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
