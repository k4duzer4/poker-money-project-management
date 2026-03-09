-- Add table rule fields
ALTER TABLE "Table"
  ADD COLUMN "valorFichaCents" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "buyInMinimoCents" INTEGER NOT NULL DEFAULT 5000,
  ADD COLUMN "buyInMaximoCents" INTEGER,
  ADD COLUMN "permitirRebuy" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "limiteRebuys" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalMesaCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ajusteProporcionalAplicado" BOOLEAN NOT NULL DEFAULT false;

-- Migrate player status enum LEFT -> CASHOUT
ALTER TYPE "PlayerStatus" RENAME TO "PlayerStatus_old";
CREATE TYPE "PlayerStatus" AS ENUM ('ACTIVE', 'CASHOUT');
ALTER TABLE "TablePlayer" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TablePlayer"
  ALTER COLUMN "status" TYPE "PlayerStatus"
  USING (CASE WHEN "status"::text = 'LEFT' THEN 'CASHOUT' ELSE "status"::text END)::"PlayerStatus";
ALTER TABLE "TablePlayer" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
DROP TYPE "PlayerStatus_old";

-- Add player accounting fields
ALTER TABLE "TablePlayer"
  ADD COLUMN "buyInInicialCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalInvestidoCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "valorFinalCents" INTEGER,
  ADD COLUMN "resultadoCents" INTEGER,
  ADD COLUMN "cashoutAt" TIMESTAMP(3);

-- Allow removing player with its transactions
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_tablePlayerId_fkey";
ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_tablePlayerId_fkey"
  FOREIGN KEY ("tablePlayerId") REFERENCES "TablePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ranking table
CREATE TABLE "Ranking" (
  "id" UUID NOT NULL,
  "ownerUserId" UUID NOT NULL,
  "tableId" UUID NOT NULL,
  "playerName" TEXT NOT NULL,
  "totalLucroCents" INTEGER NOT NULL DEFAULT 0,
  "partidasJogadas" INTEGER NOT NULL DEFAULT 0,
  "partidasGanhas" INTEGER NOT NULL DEFAULT 0,
  "partidasPerdidas" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Ranking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Ranking_ownerUserId_idx" ON "Ranking"("ownerUserId");
CREATE INDEX "Ranking_tableId_idx" ON "Ranking"("tableId");
CREATE UNIQUE INDEX "Ranking_ownerUserId_playerName_key" ON "Ranking"("ownerUserId", "playerName");

ALTER TABLE "Ranking"
  ADD CONSTRAINT "Ranking_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;
