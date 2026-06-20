-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('SETUP', 'PLAYING', 'FINISHED');

-- CreateEnum
CREATE TYPE "BetMode" AS ENUM ('TEAM', 'MATCH', 'STROKE', 'HIGHLOW');

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "holeCount" INTEGER NOT NULL DEFAULT 18,
    "status" "RoundStatus" NOT NULL DEFAULT 'SETUP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hole" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "par" INTEGER NOT NULL DEFAULT 4,
    "turboAllowed" BOOLEAN NOT NULL DEFAULT false,
    "turboOn" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Hole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#1B5E20',
    "hcpPar3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hcpPar4" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hcpPar5" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "holeId" TEXT NOT NULL,
    "strokes" INTEGER NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "mode" "BetMode" NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "config" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#1B5E20',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetPlayer" (
    "id" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT,
    "side" TEXT,

    CONSTRAINT "BetPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Round_accessToken_key" ON "Round"("accessToken");

-- CreateIndex
CREATE INDEX "Round_accessToken_idx" ON "Round"("accessToken");

-- CreateIndex
CREATE INDEX "Hole_roundId_idx" ON "Hole"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "Hole_roundId_index_key" ON "Hole"("roundId", "index");

-- CreateIndex
CREATE INDEX "Player_roundId_idx" ON "Player"("roundId");

-- CreateIndex
CREATE INDEX "Score_roundId_idx" ON "Score"("roundId");

-- CreateIndex
CREATE INDEX "Score_holeId_idx" ON "Score"("holeId");

-- CreateIndex
CREATE UNIQUE INDEX "Score_playerId_holeId_key" ON "Score"("playerId", "holeId");

-- CreateIndex
CREATE INDEX "Bet_roundId_idx" ON "Bet"("roundId");

-- CreateIndex
CREATE INDEX "Team_betId_idx" ON "Team"("betId");

-- CreateIndex
CREATE INDEX "BetPlayer_betId_idx" ON "BetPlayer"("betId");

-- CreateIndex
CREATE INDEX "BetPlayer_playerId_idx" ON "BetPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "BetPlayer_betId_playerId_key" ON "BetPlayer"("betId", "playerId");

-- AddForeignKey
ALTER TABLE "Hole" ADD CONSTRAINT "Hole_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_holeId_fkey" FOREIGN KEY ("holeId") REFERENCES "Hole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetPlayer" ADD CONSTRAINT "BetPlayer_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetPlayer" ADD CONSTRAINT "BetPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetPlayer" ADD CONSTRAINT "BetPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
