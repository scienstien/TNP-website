-- Real PG departments without a B.Tech programme in the existing nine-department demo.
-- Preserve any existing department with the same code or name; do not create programmes
-- or placement data here. The PG catalogue provides display-only programme names.
INSERT INTO "departments" ("code", "name")
SELECT candidate.code, candidate.name
FROM (VALUES
  ('dee', 'Energy and Environment'),
  ('ca', 'Computer Applications'),
  ('physics', 'Physics'),
  ('architecture', 'Architecture and Planning'),
  ('chemistry', 'Chemistry'),
  ('maths', 'Mathematics'),
  ('humanities', 'Humanities and Social Sciences'),
  ('management', 'Management Studies')
) AS candidate(code, name)
WHERE NOT EXISTS (
  SELECT 1 FROM "departments" AS existing
  WHERE existing."code" = candidate.code OR lower(existing."name") = lower(candidate.name)
)
ON CONFLICT ("code") DO NOTHING;
