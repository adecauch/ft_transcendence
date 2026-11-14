/**
 * liveFeed.js — Real-time updates of the dashboard (Server-Sent Events)
 *
 * The dashboard opens GET /api/stats/live (an EventSource in the browser):
 * the connection stays open and the server writes an event each time one of
 * the player's hands is saved (games/routes.js → publish). The dashboard then
 * reloads its numbers: play in one tab, watch the charts move in another.
 *
 * Why SSE rather than WebSocket: the server only talks one way, SSE is plain
 * HTTP (goes through the Vite proxy and nginx, keeps the session cookie) and
 * the browser reconnects by itself (`retry`).
 *
 * In memory, one process: enough for this server. Several processes would
 * need a shared channel (PostgreSQL LISTEN / NOTIFY, Redis…).
 */

const PING_MS = 25000; // a comment line now and then: proxies don't drop an idle connection

export class LiveFeed {
  constructor() {
    /** @type {Map<number, Set<import('node:http').ServerResponse>>} */
    this.clients = new Map();
  }

  /** Keep `res` open as an event stream for this player, until the browser leaves. */
  open(userId, req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx: don't buffer the stream
    });
    res.write('retry: 5000\n\n');
    const set = this.clients.get(userId) ?? this.clients.set(userId, new Set()).get(userId);
    set.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), PING_MS);
    req.on('close', () => {
      clearInterval(ping);
      set.delete(res);
      if (!set.size) this.clients.delete(userId);
    });
  }

  /** Send an event to every open dashboard of this player. */
  publish(userId, event, data = {}) {
    for (const res of this.clients.get(userId) ?? []) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }

  /** Server shutting down: end every stream (otherwise close() waits for them). */
  closeAll() {
    for (const set of this.clients.values()) for (const res of set) res.end();
    this.clients.clear();
  }
}
