-- A table invitation points at the shared table to join (its 6-letter code),
-- or nowhere yet (null). Written by hand (prisma migrate dev is interactive).
ALTER TABLE "TableInvitation" ADD COLUMN "tableId" TEXT;
