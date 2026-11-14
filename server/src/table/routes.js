/**
 * routes.js — WebSocket transport for authoritative poker tables.
 *
 * The route authenticates the optional HTTP session, validates the transport,
 * and hands messages to the in-memory table registry/session.
 */

import { randomUUID } from 'node:crypto';
import { TableSession } from './session.js';
import { SharedTable } from './shared.js';

const PROTOCOL = 'table-websocket';
const VERSION = 1;

/** @param {import('fastify').FastifyInstance} app */
export async function tableRoutes(app) {
  app.get('/table', { websocket: true }, async (socket, request) => {
    const origin = request.headers.origin;
    const forwardedProtocol = request.headers['x-forwarded-proto']?.split(',')[0]?.trim();
    const expectedOrigin = `${forwardedProtocol || (app.config.production ? 'https' : 'http')}://${request.headers.host}`;
    const originAllowed = origin && (origin === expectedOrigin || app.config.wsAllowedOrigins.includes(origin));
    if ((app.config.production && !origin) || (origin && !originAllowed)) {
      socket.close(1008, 'Origin not allowed');
      return;
    }
    // Listen before awaiting anything: the browser sends its first message as
    // soon as the socket opens, and a message arriving while the session lookup
    // below still waits for the database would be lost (no listener yet).
    // Kept here, then handled in order once the listener is in place.
    const early = [];
    const keep = (raw) => early.push(raw);
    socket.on('message', keep);
    const user = await app.sessions.userFor(request.cookies?.sid);
    // The table this socket talks to: a fresh one, until a reconnect hands the
    // socket over to the live table it belonged to.
    let table = new TableSession({
      socket,
      solver: app.solver,
      prisma: app.prisma,
      user,
      live: app.live,
      registry: app.tables,
      log: app.log,
      timing: app.config.tableTiming,
    });
    const received = [];
    // An error for this socket. A shared table has one stream per player: before
    // the player sits there (or for transport errors) the error goes unnumbered.
    const sendError = (code, message, requestId) => (typeof table.sendError === 'function'
      ? table.sendError(code, message, requestId)
      : socket.send(JSON.stringify({ type: 'error', code, message, ...(requestId ? { requestId } : {}) })));
    socket.send(JSON.stringify({
      type: 'hello',
      protocol: PROTOCOL,
      version: VERSION,
      connectionId: randomUUID(),
    }));

    const handle = (raw) => {
      if (Buffer.byteLength(raw) > app.config.wsMaxMessageBytes) {
        sendError('BAD_MESSAGE', 'Le message est trop volumineux.');
        socket.close(1009, 'Message too large');
        return;
      }
      const now = Date.now();
      received.push(now);
      while (received.length && received[0] <= now - 60_000) received.shift();
      if (received.length > app.config.wsMaxMessagesPerMinute) {
        sendError('RATE_LIMITED', 'Trop de messages sur cette connexion.');
        socket.close(1008, 'Rate limited');
        return;
      }
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        sendError('BAD_MESSAGE', 'Le message doit être un JSON valide.');
        socket.close(1003, 'Invalid JSON');
        return;
      }

      if (!message || Array.isArray(message) || typeof message !== 'object' || typeof message.type !== 'string') {
        sendError('BAD_MESSAGE', 'Le message doit contenir un type.');
        socket.close(1003, 'Invalid message');
        return;
      }
      // Online mode: create a shared table, or sit at one with its code (shared.js)
      if (message.type === 'createTable' || message.type === 'joinShared') {
        if (!user) return sendError('LOGIN_REQUIRED', 'Connecte-toi pour jouer en ligne.', message.requestId);
        if (table instanceof SharedTable || table.joined || table._joining) return sendError('BAD_MESSAGE', 'Cette connexion est déjà rattachée à une table.', message.requestId);
        const existing = app.tables.tableForUser(user.id);
        if (existing && (message.type === 'createTable' || existing.tableId !== String(message.tableId ?? '').toUpperCase())) {
          return sendError('ALREADY_IN_TABLE', 'Tu es déjà à une autre table. Quitte-la avant d’en rejoindre une nouvelle.', message.requestId);
        }
        let shared;
        if (message.type === 'createTable') {
          try {
            shared = new SharedTable({
              host: user, config: message.config, solver: app.solver, prisma: app.prisma, live: app.live,
              registry: app.tables, log: app.log, timing: app.config.tableTiming,
            });
          } catch (err) {
            return sendError('BAD_CONFIG', err.message, message.requestId);
          }
          app.tables.add(shared);
        } else {
          shared = app.tables.get(String(message.tableId ?? '').toUpperCase());
          if (!(shared instanceof SharedTable)) return sendError('UNKNOWN_TABLE', 'Aucune table ouverte avec ce code.', message.requestId);
        }
        const joined = shared.join(user, socket, message.requestId);
        if (!joined.ok) return sendError(joined.code, joined.message, message.requestId);
        table = shared;
        // Sitting down answers the invitations to this table
        app.prisma.tableInvitation.deleteMany({ where: { toId: user.id, tableId: shared.tableId } })
          .then(({ count }) => count && app.presence.notify(user.id, 'invitations'))
          .catch((err) => app.log.warn({ err }, 'invitations not cleared'));
        return undefined;
      }
      if (message.type === 'joinTable' && user && app.tables.tableForUser(user.id)) {
        return sendError('ALREADY_IN_TABLE', 'Tu es déjà à une table. Quitte-la avant de lancer une autre partie.', message.requestId);
      }
      const result = table.receive(message, { socket, user });
      if (result?.catch) result.catch((err) => {
        app.log.error({ err }, 'table message failed');
        sendError('SERVER_ERROR', 'Impossible de traiter cette demande.', message.requestId);
      });
      if (message.type === 'reconnect' && result?.ok) table = result.table;
      return undefined;
    };
    socket.off('message', keep);
    socket.on('message', handle);
    early.splice(0).forEach(handle);

    socket.on('error', (err) => {
      app.log.warn({ err }, 'table WebSocket error');
    });
    socket.on('close', () => {
      if (table.owns ? table.owns(socket) : table.socket === socket) table.detach(socket);
    });
  });
}
