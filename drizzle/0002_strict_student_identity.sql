-- Refuse incompatible historical identifiers rather than silently coercing them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM students WHERE roll_number !~ '^[1-9][0-9]{8}$')
     OR EXISTS (SELECT 1 FROM placement_offers WHERE student_roll_number !~ '^[1-9][0-9]{8}$') THEN
    RAISE EXCEPTION 'Invalid roll numbers: resolve legacy identifiers before migration 0002';
  END IF;
  IF EXISTS (SELECT 1 FROM students WHERE name IS NULL OR char_length(name) NOT BETWEEN 1 AND 100 OR name <> btrim(name)) THEN
    RAISE EXCEPTION 'Missing or invalid student names: resolve before migration 0002';
  END IF;
  IF EXISTS (SELECT 1 FROM students WHERE batch_year NOT BETWEEN 1000 AND 9999) THEN
    RAISE EXCEPTION 'Invalid graduating years: resolve before migration 0002';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "placement_offers" DROP CONSTRAINT "placement_offers_student_roll_number_students_roll_number_fk";--> statement-breakpoint
ALTER TABLE "placement_offers" ALTER COLUMN "student_roll_number" SET DATA TYPE integer USING "student_roll_number"::integer;--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "roll_number" SET DATA TYPE integer USING "roll_number"::integer;--> statement-breakpoint
ALTER TABLE "placement_offers" ADD CONSTRAINT "placement_offers_student_roll_number_students_roll_number_fk" FOREIGN KEY ("student_roll_number") REFERENCES "public"."students"("roll_number") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_roll_number_nine_digits" CHECK ("students"."roll_number" between 100000000 and 999999999);--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_name_required" CHECK (char_length("students"."name") between 1 and 100 and "students"."name" = btrim("students"."name"));--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_batch_year_four_digits" CHECK ("students"."batch_year" between 1000 and 9999);
