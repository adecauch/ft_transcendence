/**
 * routes.js — /api/friends: friends, requests, search, live news (logged in)
 *
 *   GET    /api/friends                       → { friends: [{ id, username, tag, status, lastSeen }] }
 *   GET    /api/friends/requests              → { incoming, outgoing }: [{ id, user, sentAt }]
 *   GET    /api/friends/search?q=…            → { players: [{ id, username, tag, relation }] }
 *          q = a friend code (Pseudo#1234: exactly that player) or a piece of pseudo
 *   POST   /api/friends/requests  { userId }  → 201 { request } · 200 { friend } (they had asked you)
 *   POST   /api/friends/requests/:id/accept   → { friend }
 *   DELETE /api/friends/requests/:id          → 204 (refuse one received / cancel one sent)
 *   DELETE /api/friends/:id                   → 204 (no longer friends)
 *   GET    /api/friends/live                  → event stream: `friends`, `invitations` (presence.js);
 *                                               open = the player is online
 *
 * Every change tells the other player at once (presence.notify): their page
 * refreshes its counts without polling.
 */

import { requireUser } from '../auth/guard.js';
import { listSchema, requestsSchema, searchSchema, sendSchema, acceptSchema, idSchema } from './schemas.js';
import {
  FriendRefused, listFriends, listRequests, searchPlayers, sendRequest, acceptRequest, deleteRequest, removeFriend,
} from './service.js';

const TRY_LIMIT = { max: 30, timeWindow: '1 minute' }; // search and requests: no scraping of the player list

/** @param {import('fastify').FastifyInstance} app */
export async function friendRoutes(app) {
  const { prisma, presence } = app;
  app.addHook('preHandler', requireUser);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof FriendRefused) return reply.code(err.status).send({ error: err.message });
    return reply.send(err);
  });

  app.get('/', { schema: listSchema }, async (req) => ({
    friends: await listFriends(prisma, req.user.id, (u) => presence.statusOf(u)),
  }));

  app.get('/requests', { schema: requestsSchema }, async (req) => listRequests(prisma, req.user.id));

  app.get('/search', { schema: searchSchema, config: { rateLimit: TRY_LIMIT } }, async (req) => ({
    players: await searchPlayers(prisma, req.user.id, req.query.q),
  }));

  app.post('/requests', { schema: sendSchema, config: { rateLimit: TRY_LIMIT } }, async (req, reply) => {
    const result = await sendRequest(prisma, req.user.id, req.body.userId);
    presence.notify(req.body.userId, 'friends');
    return reply.code(result.friend ? 200 : 201).send(result);
  });

  app.post('/requests/:id/accept', { schema: acceptSchema }, async (req) => {
    const result = await acceptRequest(prisma, req.user.id, req.params.id);
    presence.notify(result.friend.id, 'friends');
    return result;
  });

  app.delete('/requests/:id', { schema: idSchema }, async (req, reply) => {
    const other = await deleteRequest(prisma, req.user.id, req.params.id);
    presence.notify(other, 'friends');
    return reply.code(204).send();
  });

  app.delete('/:id', { schema: idSchema }, async (req, reply) => {
    await removeFriend(prisma, req.user.id, req.params.id);
    presence.notify(req.params.id, 'friends');
    return reply.code(204).send();
  });

  // The stream stays open: Fastify hands the raw response over (hijack)
  app.get('/live', (req, reply) => {
    reply.hijack();
    presence.open(req.user.id, req.raw, reply.raw);
  });
}
