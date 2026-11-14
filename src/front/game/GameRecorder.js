/**
 * GameRecorder.js — Sends the player's games to the server, hand by hand
 *
 * Only when logged in (`user` set by main.js): a guest's games aren't saved.
 *
 *   start(config)  new game → POST /api/games
 *   event(e)       every PokerGame event; at each handEnd the hand's log
 *                  (shared/stats/handLog.js) is sent → the server replays it
 *   stop()         the player quits → POST /api/games/:id/quit
 *
 * Sends one at a time, in order (the server expects hand n+1 after hand n).
 * If the server refuses a hand or can't be reached, recording stops for this
 * game — the game itself goes on. New achievements (in the server's answer)
 * go to `onAchievements(ids)` for the toast.
 */

import { HandLogger } from '../../shared/stats/handLog.js';
import { gamesApi } from '../net/gamesApi.js';

export class GameRecorder {
  /** @param {{ onAchievements?: (ids: string[]) => void }} [options] */
  constructor({ onAchievements } = {}) {
    this.onAchievements = onAchievements;
    /** @type {object | null} the logged-in player */
    this.user = null;
    this._logger = null;
    this._gameId = null;   // Promise<number | null>
    this._queue = Promise.resolve();
    this._broken = false;
  }

  start(config) {
    this._logger = null;
    if (!this.user) return;
    this._logger = new HandLogger();
    this._broken = false;
    // After the previous game's last hands: starting a game closes any open one
    this._gameId = this._queue.then(() => gamesApi.start(config)).then((res) => (res.ok ? res.data.game.id : null));
    this._queue = this._gameId;
  }

  event(e) {
    const log = this._logger?.event(e);
    if (log) this._send(log);
  }

  stop() {
    if (!this._logger) return;
    this._logger = null;
    const gameId = this._gameId;
    // After the hands already on their way; the server ignores it if the game is over
    this._queue = this._queue.then(async () => {
      const id = await gameId;
      if (id) await gamesApi.quit(id);
    });
  }

  _send(log) {
    const gameId = this._gameId;
    this._queue = this._queue.then(async () => {
      const id = await gameId;
      if (!id || this._broken) return;
      const res = await gamesApi.sendHand(id, log);
      if (res.ok) {
        if (res.data.achievements.length) this.onAchievements?.(res.data.achievements);
      } else if (res.status !== 409) {
        this._broken = true; // refused or offline: the next hands would be refused too
      }
    });
  }
}
