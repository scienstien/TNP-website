CREATE TABLE "import_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "department_id" uuid NOT NULL REFERENCES "departments"("department_id") ON DELETE restrict,
  "dataset" text NOT NULL,
  "file_sha256" text NOT NULL,
  "inserted" integer NOT NULL,
  "updated" integer NOT NULL,
  "skipped" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
