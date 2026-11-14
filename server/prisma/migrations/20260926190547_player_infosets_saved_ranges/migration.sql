-- CreateTable
CREATE TABLE "PlayerInfoset" (
    "userId" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "player" INTEGER NOT NULL,
    "bucket" INTEGER NOT NULL,
    "history" TEXT NOT NULL,
    "folds" INTEGER NOT NULL DEFAULT 0,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "raises" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerInfoset_pkey" PRIMARY KEY ("userId","version","key")
);

-- CreateTable
CREATE TABLE "SavedRange" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "range" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedRange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedRange_userId_name_key" ON "SavedRange"("userId", "name");

-- AddForeignKey
ALTER TABLE "PlayerInfoset" ADD CONSTRAINT "PlayerInfoset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedRange" ADD CONSTRAINT "SavedRange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
