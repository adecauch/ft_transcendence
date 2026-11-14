/**
 * channel.js — One player's connection to a shared table (shared.js)
 *
 * A shared table talks to several browsers, each with its own private stream:
 * its numbered messages (`seq`), what it may see, its reconnection token. This
 * is that stream, the same contract as the solo table (session.js, PROTOCOL.md):
 *  - every message gets the next `seq` and is kept (bounded) for a reconnection;
 *  - after a network cut, attach() replays the messages the browser missed, or
 *    sends `state` (the current hand's public events) if too many were missed.
 */

import { randomBytes } from 'node:crypto';

const OPEN = 1;
const HISTORY_MAX = 2048;

export class PlayerChannel {
  /** @param {{ socket: import('ws'), tableId: string }} options */
  constructor({ socket, tableId }) {
    this.socket = socket;
    this.tableId = tableId;
    this.playerToken = randomBytes(24).toString('base64url');
    this.sequence = 0;
    this._history = [];
    /** The current hand's events as this player saw them (for `state`) */
    this.handEvents = [];
  }

  get connected() {
    return this.socket?.readyState === OPEN;
  }

  /** Number, keep and send a message (kept even while disconnected). */
  send(message) {
    const payload = { ...message, seq: ++this.sequence };
    const raw = JSON.stringify(payload);
    this._history.push({ seq: payload.seq, raw });
    if (this._history.length > HISTORY_MAX) this._history.shift();
    if (this.connected) this.socket.send(raw);
  }

  sendError(code, message, requestId) {
    this.send({ type: 'error', code, message, ...(requestId ? { requestId } : {}) });
  }

  /**
   * A new socket for this player (reconnection): replay what it missed.
   * @param {object|null} actionRequest — the turn waiting for this player, if any
   */
  attach(socket, lastSeq, actionRequest) {
    if (this.socket && this.socket !== socket && this.connected) this.socket.close(4000, 'Replaced by a newer connection');
    this.socket = socket;
    const missed = this._history.filter((m) => m.seq > lastSeq);
    if (!missed.length || missed[0].seq === lastSeq + 1) {
      for (const m of missed) socket.send(m.raw);
    } else {
      this.send({ type: 'state', tableId: this.tableId, events: this.handEvents, actionRequest });
    }
  }

  detach() {
    this.socket = null;
  }

  close(code, reason) {
    if (this.connected) this.socket.close(code, reason);
    this.socket = null;
  }
}
