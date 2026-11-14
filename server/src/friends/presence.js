/**
 * presence.js — Who is online, who is at a table, and live news for each player
 *
 * A logged-in page keeps GET /api/friends/live open (Server-Sent Events, like
 * stats/liveFeed.js): while at least one of the player's pages is open, they
 * are "online". Sitting at a server table (table/registry.js) makes them
 * "playing". When their last page closes, User.lastSeenAt is written: friends
 * read "Vu il y a 2 h".
 *
 * The same stream carries the news a player must see without reloading:
 *   friends       a friend's status changed, a request arrived / was accepted…
 *   invitations   a table invitation arrived or went away
 * (only "something changed": the page asks the routes again for the details).
 *
 * In memory, one process (same limit as LiveFeed).
 */

import { LiveFeed } from '../stats/liveFeed.js';
import { friendIds } from './service.js';

export class Presence {
  /**
   * @param {{ prisma: object, tables: import('../table/registry.js').TableRegistry, log?: object }} deps
   */
  constructor({ prisma, tables, log }) {
    this.prisma = prisma;
    this.tables = tables;
    this.log = log;
    this.feed = new LiveFeed();
  }

  /** Keep the stream open for this player; online until their last page closes. */
  open(userId, req, res) {
    const wasOnline = this.isOnline(userId);
    this.feed.open(userId, req, res);
    if (!wasOnline) this.changed(userId);
    req.on('close', () => {
      if (this.isOnline(userId)) return; // another page is still open
      this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
        .catch((err) => this.log?.warn({ err }, 'lastSeenAt not saved'))
        .finally(() => this.changed(userId));
    });
  }

  isOnline(userId) {
    return this.feed.clients.has(userId);
  }

  /** At a server table right now? */
  isPlaying(userId) {
    for (const table of this.tables.tables.values()) {
      // A shared table knows its players (shared.js); a solo table has one
      if (table.isPlaying ? table.isPlaying(userId) : !table.closed && table.user?.id === userId) return true;
    }
    return false;
  }

  /** A player's status for their friends: { status, lastSeen }. */
  statusOf({ id, lastSeenAt }) {
    if (this.isPlaying(id)) return { status: 'playing', lastSeen: null };
    if (this.isOnline(id)) return { status: 'online', lastSeen: null };
    return { status: 'offline', lastSeen: lastSeenAt ?? null };
  }

  /** Tell one player that something changed (`friends` or `invitations`). */
  notify(userId, event) {
    this.feed.publish(userId, event);
  }

  /** This player's status changed: tell their friends who are online. */
  changed(userId) {
    if (!userId) return;
    friendIds(this.prisma, userId)
      .then((ids) => ids.forEach((id) => this.notify(id, 'friends')))
      .catch((err) => this.log?.warn({ err }, 'friends not told of a status change'));
  }

  closeAll() {
    this.feed.closeAll();
  }
}
