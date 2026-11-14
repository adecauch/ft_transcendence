/**
 * routes.js — /api/ai: what the browser may know about the AI (public, guests too)
 *
 *   GET /api/ai/preflop → { ranges: { sbOpen, bbVsLimp, bbVsRaise }, equity }
 *     ranges[spot] = { "AKs": { fold, call, raise }, … } (null: spot not in the strategy)
 *     equity = { "AKs": 0.67, … } — vs a random hand
 *   503 when the strategy files are missing (`npm run ai:sync`).
 *
 * Computed once (preflop.js), then served from memory.
 */

import { preflopSchema } from './schemas.js';
import { aiPreflop } from './preflop.js';

/** @param {import('fastify').FastifyInstance} app */
export async function aiRoutes(app) {
  let preflop = null;

  app.get('/preflop', { schema: preflopSchema }, async (req, reply) => {
    preflop ??= aiPreflop(app.solver);
    try {
      return await preflop;
    } catch (err) {
      preflop = null; // try again next time (files added since)
      req.log.warn({ err }, 'AI preflop ranges unavailable');
      return reply.code(503).send({ error: 'La stratégie de l’IA est absente du serveur.' });
    }
  });
}
