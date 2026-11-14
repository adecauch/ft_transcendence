/**
 * humanAgent.js — Bridges PokerGame's async agent contract and a WebSocket.
 */

export class HumanAgent {
  /** @param {import('./session.js').TableSession} table */
  constructor(table) {
    this.table = table;
  }

  /** @param {object} request */
  decide(request) {
    return this.table.waitForAction(request);
  }
}
