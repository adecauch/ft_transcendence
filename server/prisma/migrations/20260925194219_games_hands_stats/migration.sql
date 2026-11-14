-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('PLAYING', 'WON', 'LOST', 'QUIT');

-- CreateTable
CREATE TABLE "Game" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'PLAYING',
    "opponents" JSONB NOT NULL,
    "startingStack" INTEGER NOT NULL,
    "smallBlind" INTEGER NOT NULL,
    "bigBlind" INTEGER NOT NULL,
    "stacks" INTEGER[],
    "button" INTEGER NOT NULL DEFAULT -1,
    "handsPlayed" INTEGER NOT NULL DEFAULT 0,
    "finalStack" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hand" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "button" INTEGER NOT NULL,
    "sb" INTEGER NOT NULL,
    "bb" INTEGER NOT NULL,
    "board" TEXT[],
    "pot" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "players" JSONB NOT NULL,
    "heroHole" TEXT[],
    "heroNet" INTEGER NOT NULL,
    "heroCollected" INTEGER NOT NULL,
    "heroVpip" BOOLEAN NOT NULL,
    "heroPfr" BOOLEAN NOT NULL,
    "heroAllIn" BOOLEAN NOT NULL,
    "heroShowdown" BOOLEAN NOT NULL,
    "heroShowdownWon" BOOLEAN NOT NULL,
    "heroHandName" TEXT,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" SERIAL NOT NULL,
    "handId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "street" INTEGER NOT NULL,
    "seat" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "betTo" INTEGER NOT NULL,
    "potAfter" INTEGER NOT NULL,
    "allIn" BOOLEAN NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "userId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("userId","code")
);

-- CreateIndex
CREATE INDEX "Game_userId_startedAt_idx" ON "Game"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Hand_gameId_number_key" ON "Hand"("gameId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Action_handId_seq_key" ON "Action"("handId", "seq");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hand" ADD CONSTRAINT "Hand_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_handId_fkey" FOREIGN KEY ("handId") REFERENCES "Hand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
