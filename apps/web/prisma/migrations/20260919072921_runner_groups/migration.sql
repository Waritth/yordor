-- CreateEnum
CREATE TYPE "MainRole" AS ENUM ('MEMBER', 'RUNNER', 'OFF');

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "mainRole" "MainRole" NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE "RunnerSegment" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "fromHole" INTEGER NOT NULL,
    "toHole" INTEGER NOT NULL,

    CONSTRAINT "RunnerSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupPlayer" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "hcpPar3" DOUBLE PRECISION,
    "hcpPar4" DOUBLE PRECISION,
    "hcpPar5" DOUBLE PRECISION,

    CONSTRAINT "GroupPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RunnerSegment_roundId_idx" ON "RunnerSegment"("roundId");

-- CreateIndex
CREATE INDEX "RunnerSegment_playerId_idx" ON "RunnerSegment"("playerId");

-- CreateIndex
CREATE INDEX "Group_roundId_idx" ON "Group"("roundId");

-- CreateIndex
CREATE INDEX "GroupPlayer_groupId_idx" ON "GroupPlayer"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupPlayer_groupId_playerId_key" ON "GroupPlayer"("groupId", "playerId");

-- AddForeignKey
ALTER TABLE "RunnerSegment" ADD CONSTRAINT "RunnerSegment_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunnerSegment" ADD CONSTRAINT "RunnerSegment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunnerSegment" ADD CONSTRAINT "RunnerSegment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPlayer" ADD CONSTRAINT "GroupPlayer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPlayer" ADD CONSTRAINT "GroupPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
