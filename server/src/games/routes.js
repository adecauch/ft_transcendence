/**
 * routes.js — /api/games: record the player's games, hand by hand
 *
 *   POST /api/games                 { opponents, startingStack, blinds } → 201 { game }
 *   POST /api/games/:id/hands       a hand's log (src/shared/stats/handLog.js)
 *                                   → 201 { hand, game, achievements }  (new achievement ids)
 *                                   → 422 { error } the replay refused it · 409 already saved
 *   POST /api/games/:id/quit        → 204 (the game stops, counts as quit)
 *   GET  /api/games?limit&before    → { games, next } the player's games, newest first
 *   GET  /api/games/:id             → { game, hands } every hand with every action
 *
 * All reserved to logged-in players, and a player only ever sees their own
 * games (another player's id → 404, as if it didn't exist).
 */

import { requireUser } from '../auth/guard.js';
import { ReplayError } from '../../../src/shared/stats/replay.js';
import { startSchema, handSchema, listSchema, idParams } from './schemas.js';
import { startGame, saveHand, quitGame, publicGame, publicHand, HandConflict } from './service.js';
import { recordInfosets } from '../stats/infosets.js';

/** @param {import('fastify').FastifyInstance} app */
export async function gameRoutes(app) {
  const { prisma, solver, live } = app;
  app.addHook('preHandler', requireUser);

  /** The player's game, or a 404 sent. */
  const ownGame = async (req, reply) => {
    const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!game) reply.code(404).send({ error: 'Partie introuvable' });
    return game;
  };

  app.post('/', { schema: startSchema }, async (req, reply) => {
    if (req.body.blinds.big < req.body.blinds.small) {
      return reply.code(400).send({ error: 'La grosse blinde doit être au moins la petite' });
    }
    const game = await startGame(prisma, req.user, req.body);
    return reply.code(201).send({ game: publicGame(game) });
  });

  app.post('/:id/hands', { schema: handSchema }, async (req, reply) => {
    const game = await ownGame(req, reply);
    if (!game) return reply;
    // Sent twice (network retry): already there, nothing to do
    if (req.body.handNo <= game.handsPlayed) return reply.code(409).send({ error: 'Cette main a déjà été enregistrée' });
    if (game.status !== 'PLAYING') return reply.code(409).send({ error: 'Cette partie est terminée' });
    try {
      const { decisions, ...saved } = await saveHand(prisma, req.user, game, req.body);
      // The player's decisions under the solver's keys. Derived data: if it
      // fails (solver files missing…), the hand stays saved and a rebuild fixes it
      await recordInfosets(prisma, solver, req.user.id, decisions)
        .catch((err) => req.log.warn({ err }, 'player infosets not recorded'));
      live.publish(req.user.id, 'hand', { gameId: game.id, handNo: req.body.handNo }); // open dashboards reload
      return reply.code(201).send(saved);
    } catch (err) {
      if (err instanceof ReplayError) return reply.code(422).send({ error: `Main refusée : ${err.message}` });
      if (err instanceof HandConflict) return reply.code(409).send({ error: err.message });
      throw err;
    }
  });

  app.post('/:id/quit', { schema: { params: idParams } }, async (req, reply) => {
    const game = await ownGame(req, reply);
    if (!game) return reply;
    await quitGame(prisma, game);
    return reply.code(204).send();
  });

  app.get('/', { schema: listSchema }, async (req) => {
    const { limit, before } = req.query;
    const games = await prisma.game.findMany({
      where: { userId: req.user.id, ...(before && { id: { lt: before } }) },
      orderBy: { id: 'desc' },
      take: limit + 1, // one more tells whether there is a next page
    });
    const page = games.slice(0, limit);
    return { games: page.map(publicGame), next: games.length > limit ? page.at(-1).id : null };
  });

  app.get('/:id', { schema: { params: idParams } }, async (req, reply) => {
    const game = await ownGame(req, reply);
    if (!game) return reply;
    const hands = await prisma.hand.findMany({
      where: { gameId: game.id },
      orderBy: { number: 'asc' },
      include: { actions: { orderBy: { seq: 'asc' } } },
    });
    return { game: publicGame(game), hands: hands.map(publicHand) };
  });
}
