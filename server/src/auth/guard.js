/**
 * guard.js — Routes reserved to logged-in players
 *
 *   app.get('/x', { preHandler: requireUser }, async (req) => req.user.id)
 *
 * Reads the session cookie; no valid session → 401 and the route never runs.
 */

import { SESSION_COOKIE } from './sessions.js';

export async function requireUser(req, reply) {
  const user = await this.sessions.userFor(req.cookies[SESSION_COOKIE]);
  if (!user) return reply.code(401).send({ error: 'Connecte-toi pour accéder à cette page' });
  req.user = user;
}
