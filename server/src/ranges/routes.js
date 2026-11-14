/**
 * routes.js — /api/ranges: the ranges a player built and saved (logged in)
 *
 *   GET    /api/ranges          → { ranges: [{ id, name, range, createdAt, updatedAt }] }
 *   POST   /api/ranges          { name, range }    → 201 { range }
 *   PUT    /api/ranges/:id      { name?, range? }  → { range }
 *   DELETE /api/ranges/:id                         → 204
 *
 * range = { "AKs": { "raise": 1 }, "77": { "call": 0.5 }, … } — missing hand = fold.
 * Refusals: 400 bad range · 404 not theirs / unknown · 409 name taken or too many.
 */

import { requireUser } from '../auth/guard.js';
import { createSchema, updateSchema, idSchema } from './schemas.js';
import { listRanges, createRange, updateRange, deleteRange, RangeRefused } from './service.js';

/** @param {import('fastify').FastifyInstance} app */
export async function rangeRoutes(app) {
  const { prisma } = app;
  app.addHook('preHandler', requireUser);

  // A refusal from the service → its status and message
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof RangeRefused) return reply.code(err.status).send({ error: err.message });
    return reply.send(err);
  });

  app.get('/', async (req) => ({ ranges: await listRanges(prisma, req.user.id) }));

  app.post('/', { schema: createSchema }, async (req, reply) => {
    const range = await createRange(prisma, req.user.id, req.body);
    return reply.code(201).send({ range });
  });

  app.put('/:id', { schema: updateSchema }, async (req) => ({
    range: await updateRange(prisma, req.user.id, req.params.id, req.body),
  }));

  app.delete('/:id', { schema: idSchema }, async (req, reply) => {
    await deleteRange(prisma, req.user.id, req.params.id);
    return reply.code(204).send();
  });
}
