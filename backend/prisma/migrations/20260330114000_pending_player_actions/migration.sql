-- CreateEnum
CREATE TYPE "PendingPlayerActionType" AS ENUM ('REBUY', 'CASH_OUT');

-- CreateEnum
CREATE TYPE "PendingPlayerActionStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateTable
CREATE TABLE "PendingPlayerAction" (
  "id" UUID NOT NULL,
  "tableId" UUID NOT NULL,
  "tablePlayerId" UUID NOT NULL,
  "requesterUserId" UUID NOT NULL,
  "approverUserId" UUID NOT NULL,
  "decidedByUserId" UUID,
  "type" "PendingPlayerActionType" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" "PendingPlayerActionStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),

  CONSTRAINT "PendingPlayerAction_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "PendingPlayerAction_tableId_idx" ON "PendingPlayerAction"("tableId");
CREATE INDEX "PendingPlayerAction_approverUserId_status_idx" ON "PendingPlayerAction"("approverUserId", "status");
CREATE INDEX "PendingPlayerAction_tablePlayerId_type_status_idx" ON "PendingPlayerAction"("tablePlayerId", "type", "status");

-- Foreign keys
ALTER TABLE "PendingPlayerAction"
ADD CONSTRAINT "PendingPlayerAction_tableId_fkey"
FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PendingPlayerAction"
ADD CONSTRAINT "PendingPlayerAction_tablePlayerId_fkey"
FOREIGN KEY ("tablePlayerId") REFERENCES "TablePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PendingPlayerAction"
ADD CONSTRAINT "PendingPlayerAction_requesterUserId_fkey"
FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PendingPlayerAction"
ADD CONSTRAINT "PendingPlayerAction_approverUserId_fkey"
FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PendingPlayerAction"
ADD CONSTRAINT "PendingPlayerAction_decidedByUserId_fkey"
FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
