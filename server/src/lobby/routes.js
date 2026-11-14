/**
 * routes.js — /api/lobby: table invitations (logged in)
 *
 *   GET    /api/lobby/invitations             → { invitations: [{ id, from: { id, username, tag }, tableId, sentAt }] }
 *   POST   /api/lobby/invitations  { userId, tableId? } → 201 { invitation }   a friend who is online;
 *          tableId = the shared table the player waits at (they must be sitting there, not started)
 *   DELETE /api/lobby/invitations/:id         → 204 (decline one received / cancel one sent)
 *
 * The other player is told at once (`invitations` on their live stream,
 * friends/presence.js). The friend joins with the table code (WebSocket
 * `joinShared`, table/routes.js), which clears the invitation.
 */

import { requireUser } from '../auth/guard.js';
import { FriendRefused } from '../friends/service.js';
import { listSchema, inviteSchema, idSchema } from './schemas.js';
import { listInvitations, invite, deleteInvitation } from './service.js';
import { SharedTable } from '../table/shared.js';

const TRY_LIMIT = { max: 30, timeWindow: '1 minute' };

/** @param {import('fastify').FastifyInstance} app */
export async function lobbyRoutes(app) {
  const { prisma, presence } = app;
  app.addHook('preHandler', requireUser);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof FriendRefused) return reply.code(err.status).send({ error: err.message });
    return reply.send(err);
  });

  app.get('/invitations', { schema: listSchema }, async (req) => ({ invitations: await listInvitations(prisma, req.user.id) }));

  app.post('/invitations', { schema: inviteSchema, config: { rateLimit: TRY_LIMIT } }, async (req, reply) => {
    const { tableId } = req.body;
    if (tableId) {
      const table = app.tables.get(tableId);
      const seated = table instanceof SharedTable && table.status === 'waiting' && table.seats.some((s) => s.user.id === req.user.id);
      if (!seated) return reply.code(409).send({ error: 'Ta table n’est plus ouverte : crée-en une autre' });
    }
    const invitation = await invite(prisma, req.user.id, req.body.userId, (id) => presence.isOnline(id), tableId ?? null);
    presence.notify(req.body.userId, 'invitations');
    return reply.code(201).send({ invitation });
  });

  app.delete('/invitations/:id', { schema: idSchema }, async (req, reply) => {
    const other = await deleteInvitation(prisma, req.user.id, req.params.id);
    presence.notify(other, 'invitations');
    return reply.code(204).send();
  });
}
