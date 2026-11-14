-- Friends and table invitations (server/src/friends, server/src/lobby).
-- Written by hand (prisma migrate dev is interactive): same names as Prisma's.

-- When the player last left the room ("Vu il y a 2 h")
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- A request, then a friendship once accepted: one row per pair
CREATE TABLE "Friendship" (
    "id" SERIAL NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "addresseeId" INTEGER NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- "Come to my table", one per pair
CREATE TABLE "TableInvitation" (
    "id" SERIAL NOT NULL,
    "fromId" INTEGER NOT NULL,
    "toId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");
CREATE INDEX "Friendship_addresseeId_idx" ON "Friendship"("addresseeId");
CREATE UNIQUE INDEX "TableInvitation_fromId_toId_key" ON "TableInvitation"("fromId", "toId");
CREATE INDEX "TableInvitation_toId_idx" ON "TableInvitation"("toId");

-- Deleting an account deletes its friendships and invitations
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableInvitation" ADD CONSTRAINT "TableInvitation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableInvitation" ADD CONSTRAINT "TableInvitation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
