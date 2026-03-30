-- AlterTable
ALTER TABLE "Table"
ADD COLUMN "code" TEXT,
ADD COLUMN "inviteToken" TEXT,
ADD COLUMN "accessPasswordHash" TEXT;

ALTER TABLE "TablePlayer"
ADD COLUMN "userId" UUID;

-- Backfill table fields for existing rows
UPDATE "Table"
SET
  "code" = CONCAT('MESA-', SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 8)),
  "inviteToken" = REPLACE("id"::text, '-', ''),
  "accessPasswordHash" = 'TEMP_RESET_REQUIRED'
WHERE "code" IS NULL OR "inviteToken" IS NULL OR "accessPasswordHash" IS NULL;

-- Backfill player user binding using owner when possible
UPDATE "TablePlayer" tp
SET "userId" = t."ownerUserId"
FROM "Table" t
WHERE tp."tableId" = t."id" AND tp."userId" IS NULL;

-- Deduplicate legacy player rows before enforcing unique (tableId, userId)
WITH duplicated AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "tableId", "userId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "TablePlayer"
)
DELETE FROM "TablePlayer" tp
USING duplicated d
WHERE tp.id = d.id
  AND d.rn > 1;

-- Set not-null constraints
ALTER TABLE "Table"
ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "inviteToken" SET NOT NULL,
ALTER COLUMN "accessPasswordHash" SET NOT NULL;

ALTER TABLE "TablePlayer"
ALTER COLUMN "userId" SET NOT NULL;

-- Indexes and constraints
CREATE UNIQUE INDEX "Table_code_key" ON "Table"("code");
CREATE UNIQUE INDEX "Table_inviteToken_key" ON "Table"("inviteToken");
CREATE INDEX "TablePlayer_userId_idx" ON "TablePlayer"("userId");
CREATE UNIQUE INDEX "TablePlayer_tableId_userId_key" ON "TablePlayer"("tableId", "userId");

-- Foreign key
ALTER TABLE "TablePlayer"
ADD CONSTRAINT "TablePlayer_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
