/**
 * totals.js — A player's numbers, straight from the Game and Hand tables
 *
 * One SQL query each, with PostgreSQL's COUNT(*) FILTER (WHERE …) to count
 * several things in one pass. $queryRaw with a template string sends
 * ${userId} as a parameter, never pasted into the SQL (no injection).
 */

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function playerTotals(prisma, userId) {
  const [games] = await prisma.$queryRaw`
    SELECT COUNT(*)::int                                  AS "games",
           COUNT(*) FILTER (WHERE status = 'WON')::int    AS "gamesWon",
           COUNT(*) FILTER (WHERE status = 'LOST')::int   AS "gamesLost",
           COUNT(*) FILTER (WHERE status = 'QUIT')::int   AS "gamesQuit"
    FROM "Game" WHERE "userId" = ${userId}`;

  const [hands] = await prisma.$queryRaw`
    SELECT COUNT(*)::int                                          AS "hands",
           COUNT(*) FILTER (WHERE h."heroNet" > 0)::int           AS "handsWon",
           COUNT(*) FILTER (WHERE h."heroShowdown")::int          AS "showdowns",
           COUNT(*) FILTER (WHERE h."heroShowdownWon")::int       AS "showdownsWon",
           COUNT(*) FILTER (WHERE h."heroVpip")::int              AS "vpipHands",
           COUNT(*) FILTER (WHERE h."heroPfr")::int               AS "pfrHands",
           COALESCE(SUM(h."heroNet"), 0)::int                     AS "net",
           COALESCE(MAX(h."heroCollected"), 0)::int               AS "biggestPot"
    FROM "Hand" h JOIN "Game" g ON g.id = h."gameId"
    WHERE g."userId" = ${userId}`;

  return { ...games, ...hands };
}
