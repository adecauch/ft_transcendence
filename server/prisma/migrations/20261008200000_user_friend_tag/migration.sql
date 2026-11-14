-- Friend code (src/shared/auth/rules.js): two players may now share a pseudo;
-- the pair (username, tag) is unique and "username#tag" is the friend code.

-- 1. The column, empty for now
ALTER TABLE "User" ADD COLUMN "tag" INTEGER;

-- 2. Existing accounts get 4 random digits. Their pseudos were unique until
--    now, so no two of them can end up with the same (username, tag).
UPDATE "User" SET "tag" = 1000 + floor(random() * 9000)::int;

-- 3. Required from now on; the pseudo alone is no longer unique
ALTER TABLE "User" ALTER COLUMN "tag" SET NOT NULL;
DROP INDEX "User_username_key";
CREATE UNIQUE INDEX "User_username_tag_key" ON "User"("username", "tag");
