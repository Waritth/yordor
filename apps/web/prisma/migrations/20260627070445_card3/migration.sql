-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('GOLF', 'CARD3');

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "gameType" "GameType" NOT NULL DEFAULT 'GOLF';

-- CreateTable
CREATE TABLE "CardHand" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardHand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardScore" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "CardScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardHand_roundId_idx" ON "CardHand"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "CardHand_roundId_index_key" ON "CardHand"("roundId", "index");

-- CreateIndex
CREATE INDEX "CardScore_roundId_idx" ON "CardScore"("roundId");

-- CreateIndex
CREATE INDEX "CardScore_handId_idx" ON "CardScore"("handId");

-- CreateIndex
CREATE UNIQUE INDEX "CardScore_handId_playerId_key" ON "CardScore"("handId", "playerId");

-- AddForeignKey
ALTER TABLE "CardHand" ADD CONSTRAINT "CardHand_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardScore" ADD CONSTRAINT "CardScore_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardScore" ADD CONSTRAINT "CardScore_handId_fkey" FOREIGN KEY ("handId") REFERENCES "CardHand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardScore" ADD CONSTRAINT "CardScore_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
