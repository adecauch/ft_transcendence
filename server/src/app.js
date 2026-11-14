/**
 * app.js — Builds the Fastify application (without starting it)
 *
 * Kept apart from index.js so the tests can build an app and send it requests
 * directly (app.inject), without opening a port.
 */

import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { PrismaClient } from '@prisma/client';
import { Passwords } from './auth/password.js';
import { Sessions } from './auth/sessions.js';
import { authRoutes } from './auth/routes.js';
import { gameRoutes } from './games/routes.js';
import { statsRoutes } from './stats/routes.js';
import { rangeRoutes } from './ranges/routes.js';
import { tableRoutes } from './table/routes.js';
import { aiRoutes } from './ai/routes.js';
import { friendRoutes } from './friends/routes.js';
import { lobbyRoutes } from './lobby/routes.js';
import { Presence } from './friends/presence.js';
import { SolverData } from './ai/solverData.js';
import { LiveFeed } from './stats/liveFeed.js';
import { TableRegistry } from './table/registry.js';

/**
 * @param {ReturnType<import('./config.js').loadConfig>} config
 * @param {{ logger?: boolean | object, prisma?: PrismaClient, solver?: SolverData }} [options]
 */
export async function buildApp(config, { logger = true, prisma, solver } = {}) {
  const app = Fastify({
    logger: logger && {
      // Never write passwords or session cookies to the logs
      redact: ['req.headers.cookie', 'req.body.password', 'res.headers["set-cookie"]'],
    },
  });

  const db = prisma ?? new PrismaClient({ datasourceUrl: config.databaseUrl });
  app.decorate('config', config);
  app.decorate('prisma', db);
  app.decorate('passwords', new Passwords(config));
  app.decorate('sessions', new Sessions(db, config));
  app.decorate('solver', solver ?? new SolverData()); // the MCCFR files, loaded on first use
  app.decorate('live', new LiveFeed()); // real-time dashboard updates (SSE)
  app.decorate('tables', new TableRegistry({ reconnectMs: config.tableReconnectMs, log: app.log }));
  // Who is online / at a table, and live news for each player (friends/presence.js)
  app.decorate('presence', new Presence({ prisma: db, tables: app.tables, log: app.log }));
  app.tables.onChange = (userId) => app.presence.changed(userId); // sat down / left: friends see it
  if (!prisma) app.addHook('onClose', () => db.$disconnect());
  app.addHook('preClose', () => app.live.closeAll());
  app.addHook('preClose', () => app.tables.closeAll());
  app.addHook('preClose', () => app.presence.closeAll());

  await app.register(cookie);
  await app.register(websocket);
  // Limits apply only to routes that ask for one (config.rateLimit)
  await app.register(rateLimit, { global: false });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(gameRoutes, { prefix: '/api/games' });
  await app.register(statsRoutes, { prefix: '/api' });
  await app.register(rangeRoutes, { prefix: '/api/ranges' });
  await app.register(tableRoutes, { prefix: '/ws' });
  await app.register(aiRoutes, { prefix: '/api/ai' });
  await app.register(friendRoutes, { prefix: '/api/friends' });
  await app.register(lobbyRoutes, { prefix: '/api/lobby' });
  app.get('/api/health', async () => ({ ok: true }));

  return app;
}
