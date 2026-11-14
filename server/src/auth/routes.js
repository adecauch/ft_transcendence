/**
 * routes.js — /api/auth/*: create an account, log in, log out, who am I
 *
 *   POST /api/auth/register  { email, username, password }  → 201 { user } + cookie
 *                            user.tag = 4 random digits: "username#tag" is the friend code
 *   POST /api/auth/login     { email, password }            → 200 { user } + cookie
 *   POST /api/auth/logout                                   → 204, cookie cleared
 *   GET  /api/auth/me                                       → 200 { user }, user = null when not logged in
 *
 * Register and login are rate-limited per IP (guessing passwords takes many
 * tries). Login answers the same "Email ou mot de passe incorrect" whether
 * the email is unknown or the password wrong.
 *
 * /me answers 200 even for nobody: "not logged in" is a normal answer there,
 * and a 4xx would print a red error in the browser console on every visit.
 */

import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { RULES } from '../../../src/shared/auth/rules.js';
import { SESSION_COOKIE } from './sessions.js';
import { registerSchema, loginSchema, meSchema } from './schemas.js';

const TRY_LIMIT = { max: 10, timeWindow: '1 minute' };

/**
 * Random tags tried before giving up on a pseudo. Each is free unless that
 * pseudo already has thousands of players: 20 misses in a row only happens
 * when (almost) all 9000 numbers are taken.
 */
const TAG_TRIES = 20;
const randomTag = () => randomInt(RULES.tag.min, RULES.tag.max + 1);
const takenField = (err) => (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  ? (String(err.meta?.target ?? '').includes('email') ? 'email' : 'tag')
  : null);

/** @param {import('fastify').FastifyInstance} app */
export async function authRoutes(app) {
  const { prisma, passwords, sessions, config } = app;

  const startSession = async (reply, userId) => {
    const { token, expiresAt } = await sessions.create(userId);
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,               // unreadable from JavaScript: an XSS can't steal it
      secure: config.secureCookies, // HTTPS only (production)
      sameSite: 'strict',           // never sent by another site's page (CSRF)
      path: '/',
      expires: expiresAt,
    });
  };

  app.post('/register', { schema: registerSchema, config: { rateLimit: TRY_LIMIT } }, async (req, reply) => {
    const email = req.body.email.trim().toLowerCase();
    const username = req.body.username.trim();
    const passwordHash = await passwords.hash(req.body.password);
    // The pseudo may be taken: only (pseudo, tag) is unique. Draw a tag, and
    // another one if that pair exists already.
    for (let i = 0; i < TAG_TRIES; i++) {
      try {
        const user = await prisma.user.create({ data: { email, username, tag: randomTag(), passwordHash } });
        await startSession(reply, user.id);
        return reply.code(201).send({ user });
      } catch (err) {
        const taken = takenField(err);
        if (taken === 'email') return reply.code(409).send({ error: 'Cet email a déjà un compte', field: 'email' });
        if (taken !== 'tag') throw err;
      }
    }
    return reply.code(409).send({ error: 'Trop de joueurs portent ce pseudo : choisis-en un autre', field: 'username' });
  });

  app.post('/login', { schema: loginSchema, config: { rateLimit: TRY_LIMIT } }, async (req, reply) => {
    const email = req.body.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    const ok = await passwords.verify(user?.passwordHash, req.body.password);
    if (!user || !ok) return reply.code(401).send({ error: 'Email ou mot de passe incorrect' });
    await startSession(reply, user.id);
    return { user };
  });

  app.post('/logout', async (req, reply) => {
    await sessions.destroy(req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/me', { schema: meSchema }, async (req, reply) => {
    const user = await sessions.userFor(req.cookies[SESSION_COOKIE]);
    return { user }; // null when not logged in
  });
}
