/**
 * routes.js — Statistics, achievements and the leaderboard
 *
 *   GET /api/stats/me       → { totals, achievements: [{ id, unlockedAt }] }   (logged in)
 *   GET /api/stats/solver   → the player compared with the solver, infoset by infoset
 *                             (stats/solverReport.js)                             (logged in)
 *   GET /api/stats/range    → the range the player really played + mistakes + biggest losses
 *                             (src/shared/stats/rangeAnalysis.js)                  (logged in)
 *   GET /api/stats/dashboard?from&to&level&opponents&tz
 *                           → the dashboard's numbers (stats/dashboard.js)       (logged in)
 *   GET /api/stats/export.csv?same filters
 *                           → the same hands as a CSV file (stats/exportCsv.js)  (logged in)
 *   GET /api/stats/live     → event stream, an event per saved hand (stats/liveFeed.js) (logged in)
 *   GET /api/leaderboard    → { players: [{ rank, username, tag, games, wins, winRate, hands }], me }
 *
 * The leaderboard ranks by games won, then win rate, then hands played. Only
 * finished games count (won, lost or quit). `me` = the logged-in player's row
 * even outside the top 20 (null for a guest or someone without a finished game).
 */

import { requireUser } from '../auth/guard.js';
import { SESSION_COOKIE } from '../auth/sessions.js';
import { playerTotals } from './totals.js';
import { solverReport } from './solverReport.js';
import { dashboard } from './dashboard.js';
import { exportCsv } from './exportCsv.js';
import { dashboardSchema, exportSchema } from './schemas.js';
import { analyseHands } from '../../../src/shared/stats/rangeAnalysis.js';

const TOP = 20;
const MAX_HANDS = 5000; // the most recent ones

/** @param {import('fastify').FastifyInstance} app */
export async function statsRoutes(app) {
  const { prisma, sessions, solver, live } = app;

  app.get('/stats/me', { preHandler: requireUser }, async (req) => {
    const [totals, achievements] = await Promise.all([
      playerTotals(prisma, req.user.id),
      prisma.userAchievement.findMany({ where: { userId: req.user.id }, orderBy: { unlockedAt: 'asc' } }),
    ]);
    return { totals, achievements: achievements.map((a) => ({ id: a.code, unlockedAt: a.unlockedAt })) };
  });

  app.get('/stats/solver', { preHandler: requireUser }, async (req) => solverReport(prisma, solver, req.user.id));

  app.get('/stats/range', { preHandler: requireUser }, async (req) => {
    const rows = await prisma.hand.findMany({
      where: { game: { userId: req.user.id } },
      orderBy: { id: 'desc' },
      take: MAX_HANDS,
      select: {
        number: true, playedAt: true, bb: true, heroHole: true, heroNet: true, board: true,
        result: true, heroHandName: true, players: true,
        game: { select: { id: true, bigBlind: true } },
        actions: { where: { street: 0 }, orderBy: { seq: 'asc' }, select: { seat: true, type: true } },
      },
    });
    const hands = rows.map(({ game, actions, ...h }) => ({ ...h, gameId: game.id, bigBlind: game.bigBlind, preflop: actions }));
    // Equity of each hand type vs a random hand: the solver's own table. Missing
    // solver files: the range still shows, without equity-based mistakes
    const equity = await solver.abstraction().then(({ abstraction }) => abstraction.equity, () => null);
    return analyseHands(hands, equity);
  });

  app.get('/stats/dashboard', { preHandler: requireUser, schema: dashboardSchema }, async (req) => dashboard(prisma, req.user.id, req.query));

  app.get('/stats/export.csv', { preHandler: requireUser, schema: exportSchema }, async (req, reply) => {
    const day = new Date().toISOString().slice(0, 10);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="poker-mains-${day}.csv"`)
      .send(await exportCsv(prisma, req.user.id, req.query));
  });

  // The stream stays open: Fastify hands the raw response over (hijack)
  app.get('/stats/live', { preHandler: requireUser }, (req, reply) => {
    reply.hijack();
    live.open(req.user.id, req.raw, reply.raw);
  });

  app.get('/leaderboard', async (req) => {
    const user = await sessions.userFor(req.cookies[SESSION_COOKIE]);
    const me = user?.id ?? -1;
    // RANK() gives equal players the same rank (1, 2, 2, 4…)
    const rows = await prisma.$queryRaw`
      WITH per_player AS (
        SELECT u.id, u.username, u.tag,
               COUNT(g.id)::int                                AS games,
               COUNT(g.id) FILTER (WHERE g.status = 'WON')::int AS wins,
               COALESCE(SUM(g."handsPlayed"), 0)::int          AS hands
        FROM "User" u JOIN "Game" g ON g."userId" = u.id
        WHERE g.status <> 'PLAYING'
        GROUP BY u.id
      ), ranked AS (
        SELECT *, wins::float / games AS "winRate",
               RANK() OVER (ORDER BY wins DESC, wins::float / games DESC, hands DESC)::int AS rank
        FROM per_player
      )
      SELECT * FROM ranked WHERE rank <= ${TOP} OR id = ${me} ORDER BY rank, username, tag`;

    const row = ({ id, rank, username, tag, games, wins, winRate, hands }) => ({ rank, username, tag, games, wins, winRate, hands, isMe: id === me });
    const players = rows.filter((r) => r.rank <= TOP).map(row);
    const mine = rows.find((r) => r.id === me);
    return { players, me: mine ? row(mine) : null };
  });
}
