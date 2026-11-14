/**
 * savedHand.js — A hand as stored in the database → what replayHand() needs
 *
 * The Hand / Action tables hold everything to replay a hand again: the stacks
 * before it (players[].stackStart), the button, the cards and every move.
 * Used to rebuild data derived from the history (e.g. the player's infosets,
 * server/src/stats/rebuildInfosets.js) without keeping the browsers' logs.
 */

/** Stored action types → the log's (handLog.js): a bet is a raise from 0. */
const LOG_TYPE = { fold: 'fold', check: 'check', call: 'call', bet: 'raise', raise: 'raise' };

/**
 * @param {{ number: number, button: number, board: string[], players: object[],
 *           actions: { street: number, seat: number, type: string, betTo: number }[] }} hand
 * @param {{ name: string, isHuman: boolean, level?: string }[]} seats — the game's seats
 * @param {{ small: number, big: number }} blinds
 * @returns {{ state: object, log: object }} the arguments of replayHand(state, log)
 */
export function replayInputs(hand, seats, blinds) {
  const n = seats.length;
  const state = {
    players: seats,
    blinds,
    stacks: hand.players.map((p) => p.stackStart),
    // The engine moves the button to the next seat in play: start one seat before it
    button: (hand.button - 1 + n) % n,
    handNo: hand.number - 1,
  };
  const log = {
    handNo: hand.number,
    hole: hand.players.map((p) => (p.out ? null : p.hole)),
    board: hand.board,
    actions: hand.actions
      .filter((a) => a.type !== 'blind')
      .map((a) => {
        const type = LOG_TYPE[a.type];
        return type === 'raise' ? { seat: a.seat, street: a.street, type, to: a.betTo } : { seat: a.seat, street: a.street, type };
      }),
  };
  return { state, log };
}
