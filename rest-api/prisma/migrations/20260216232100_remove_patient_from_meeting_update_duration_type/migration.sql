-- DropForeignKey
ALTER TABLE "meetings" DROP CONSTRAINT IF EXISTS "meetings_patientId_fkey";

-- AlterTable: convert duration from text to integer (minutes)
UPDATE "meetings" SET "duration" = CASE
  WHEN "duration" ~ '^\d+h$' THEN (REPLACE("duration", 'h', '')::integer * 60)::text
  WHEN "duration" ~ '^\d+min$' THEN REPLACE("duration", 'min', '')
  WHEN "duration" ~ '^\d+$' THEN "duration"
  ELSE '30'
END;

ALTER TABLE "meetings" ALTER COLUMN "duration" SET DATA TYPE INTEGER USING "duration"::integer;

-- DropColumn
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "patientId";
