/**
 * registry.js — In-memory registry of live authoritative tables.
 *
 * A table outlives a socket for a short grace period so a browser can reconnect
 * without creating a second PokerGame or recording the same hand twice.
 */

export class TableRegistry {
  /** @param {{ reconnectMs?: number, log?: object }} [options] */
  constructor({ reconnectMs = 30_000, log = console } = {}) {
    this.reconnectMs = reconnectMs;
    this.log = log;
    this.tables = new Map();
    /** @type {((userId: number) => void) | null} a player sat down or left (friends/presence.js) */
    this.onChange = null;
  }

  add(table) {
    this.tables.set(table.tableId, table);
    if (table.user) this.onChange?.(table.user.id);
  }

  remove(table) {
    if (this.tables.get(table.tableId) !== table) return;
    this.tables.delete(table.tableId);
    if (table.user) this.onChange?.(table.user.id);
  }

  get(tableId) {
    return this.tables.get(tableId) ?? null;
  }

  /** Include disconnected seats: their game is still alive during reconnection. */
  tableForUser(userId) {
    return [...this.tables.values()].find((table) => !table.closed && (
      table.user?.id === userId || table.seats?.some((s) => s.user.id === userId && !s.left)
    )) ?? null;
  }

  /** @param {object} options */
  reconnect({ tableId, playerToken, lastSeq, socket, user }) {
    const table = this.get(tableId);
    if (!table) return { ok: false, code: 'UNKNOWN_TABLE', message: 'Cette table n’existe plus.' };
    if (!table.canReconnect(playerToken, user)) {
      return { ok: false, code: 'PLAYER_NOT_FOUND', message: 'Le jeton de reconnexion est invalide.' };
    }
    const sequence = table.sequenceFor?.(playerToken) ?? table.sequence;
    if (!Number.isSafeInteger(lastSeq) || lastSeq < 0 || !Number.isSafeInteger(sequence) || lastSeq > sequence) {
      return { ok: false, code: 'BAD_MESSAGE', message: 'La séquence de reconnexion est invalide.' };
    }
    table.attach(socket, lastSeq, playerToken); // a shared table finds the player by token
    return { ok: true, table };
  }

  closeAll() {
    for (const table of this.tables.values()) table.close('aborted');
    this.tables.clear();
  }
}
