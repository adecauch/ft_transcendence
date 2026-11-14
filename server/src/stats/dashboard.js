/**
 * dashboard.js — The numbers of the dashboard, straight from Hand / Game / Action
 *
 * Every query reads the same filtered set of hands (filteredHands): the
 * player's hands, in the chosen period, against the chosen AI level and
 * number of AIs. Amounts are in big blinds (heroNet / the game's big blind):
 * games with different blinds can be added up.
 *
 *   summary    hands, games, result, VPIP / PFR, showdowns
 *   curve      cumulative result, hand after hand (≤ CURVE_POINTS points)
 *   timeline   per day (per week beyond TIMELINE_WEEKS_AFTER days): hands,
 *              result, VPIP, PFR — cut in the browser's time zone
 *   byLevel    result per AI level (bb/100)
 *   byPosition result per seat of the player: button, small blind, big blind, other
 *   byOpponents result per number of AIs at the table (bb/100)
 *   actions    the player's moves (fold, check, call, bet, raise) per street
 *
 * Values go through $queryRaw template strings: always sent as parameters,
 * never pasted into the SQL (no injection).
 */

import { Prisma } from '@prisma/client';

const CURVE_POINTS = 300;
const TIMELINE_WEEKS_AFTER = 90; // days

/** IANA time zones Node knows (+ UTC): anything else falls back to UTC. */
const ZONES = new Set([...Intl.supportedValuesOf('timeZone'), 'UTC']);
export const safeZone = (tz) => (tz && ZONES.has(tz) ? tz : 'UTC');

/**
 * The player's hands matching the filters, as a sub-query aliased `f`.
 * `level` = the game's AI level, or 'mixed' when its AIs had several.
 */
export function filteredHands(userId, { from, to, level, opponents } = {}) {
  const gameWhere = [Prisma.sql`g."userId" = ${userId}`];
  if (from) gameWhere.push(Prisma.sql`h."playedAt" >= ${new Date(from)}`);
  if (to) gameWhere.push(Prisma.sql`h."playedAt" < ${new Date(to)}`);
  const outerWhere = [Prisma.sql`TRUE`];
  if (level) outerWhere.push(Prisma.sql`level = ${level}`);
  if (opponents) outerWhere.push(Prisma.sql`nopp = ${opponents}`);

  return Prisma.sql`(
    SELECT * FROM (
      SELECT h.*, g."bigBlind" AS big,
             jsonb_array_length(g.opponents)::int AS nopp,
             (SELECT CASE WHEN COUNT(DISTINCT o->>'level') = 1 THEN MIN(o->>'level') ELSE 'mixed' END
              FROM jsonb_array_elements(g.opponents) o) AS level
      FROM "Hand" h JOIN "Game" g ON g.id = h."gameId"
      WHERE ${Prisma.join(gameWhere, ' AND ')}
    ) x
    WHERE ${Prisma.join(outerWhere, ' AND ')}
  ) f`;
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function dashboard(prisma, userId, query = {}) {
  const f = filteredHands(userId, query);
  const tz = safeZone(query.tz);
  const net = Prisma.sql`COALESCE(SUM(f."heroNet"::float / f.big), 0)`;

  const [[summary], curveRows, levels, positions, tables, actions] = await Promise.all([
    prisma.$queryRaw`
      SELECT COUNT(*)::int                                     AS hands,
             COUNT(DISTINCT f."gameId")::int                   AS games,
             ${net}                                            AS "netBB",
             COUNT(*) FILTER (WHERE f."heroNet" > 0)::int      AS "handsWon",
             COUNT(*) FILTER (WHERE f."heroVpip")::int         AS vpip,
             COUNT(*) FILTER (WHERE f."heroPfr")::int          AS pfr,
             COUNT(*) FILTER (WHERE f."heroShowdown")::int     AS showdowns,
             COUNT(*) FILTER (WHERE f."heroShowdownWon")::int  AS "showdownsWon",
             MIN(f."playedAt")                                 AS first,
             MAX(f."playedAt")                                 AS last
      FROM ${f}`,
    prisma.$queryRaw`
      SELECT f."playedAt" AS at,
             SUM(f."heroNet"::float / f.big) OVER (ORDER BY f."playedAt", f.id) AS total
      FROM ${f} ORDER BY f."playedAt", f.id`,
    prisma.$queryRaw`
      SELECT f.level AS key, COUNT(*)::int AS hands, ${net} AS "netBB"
      FROM ${f} GROUP BY f.level`,
    prisma.$queryRaw`
      SELECT CASE WHEN f.button = 0 THEN 'button' WHEN f.sb = 0 THEN 'sb'
                  WHEN f.bb = 0 THEN 'bb' ELSE 'other' END AS key,
             COUNT(*)::int AS hands, ${net} AS "netBB"
      FROM ${f} GROUP BY 1`,
    prisma.$queryRaw`
      SELECT f.nopp::text AS key, COUNT(*)::int AS hands, ${net} AS "netBB"
      FROM ${f} GROUP BY f.nopp`,
    prisma.$queryRaw`
      SELECT a.street, a.type, COUNT(*)::int AS count
      FROM "Action" a JOIN ${f} ON f.id = a."handId"
      WHERE a.seat = 0 AND a.type <> 'blind'
      GROUP BY a.street, a.type`,
  ]);

  // Day or week steps, from the span of the hands found
  const span = summary.hands ? (summary.last - summary.first) / 86400000 : 0;
  const unit = span > TIMELINE_WEEKS_AFTER ? 'week' : 'day';
  const timeline = await prisma.$queryRaw`
    SELECT to_char(date_trunc(${unit}, (f."playedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS hands, ${net} AS "netBB",
           COUNT(*) FILTER (WHERE f."heroVpip")::int AS vpip,
           COUNT(*) FILTER (WHERE f."heroPfr")::int AS pfr
    FROM ${f} GROUP BY 1 ORDER BY 1`;

  return {
    summary: { ...summary, bbPer100: summary.hands ? (100 * summary.netBB) / summary.hands : 0 },
    curve: sampleCurve(curveRows),
    timeline: { unit, points: timeline },
    byLevel: levels.map(withRate),
    byPosition: positions.map(withRate),
    byOpponents: tables.map(withRate),
    actions,
  };
}

const withRate = (row) => ({ ...row, bbPer100: row.hands ? (100 * row.netBB) / row.hands : 0 });

/**
 * At most CURVE_POINTS points, evenly spread, the last hand always included:
 * enough for the chart, whatever the number of hands.
 * @returns {{ hand: number, at: Date, total: number }[]} hand = its rank in the set (1…)
 */
export function sampleCurve(rows) {
  const step = Math.max(1, Math.ceil(rows.length / CURVE_POINTS));
  const out = [];
  rows.forEach((r, i) => {
    if (i % step === step - 1 || i === rows.length - 1) out.push({ hand: i + 1, at: r.at, total: r.total });
  });
  return out;
}
