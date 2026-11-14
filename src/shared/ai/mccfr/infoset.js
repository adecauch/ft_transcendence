/**
 * infoset.js — One decision → the solver's infoset (the key into the strategy)
 *
 * THE single place where a real decision is turned into the solver's terms:
 *   cards   → bucket         (cardAbstraction.js: preflop table, or EHS thresholds)
 *   betting → f / c / 2..7   (historyTranslator.js: heads-up history, closest
 *                             solver size for each bet, off-tree check)
 *   both    → 64-bit key     (infosetKey.js: identical to the C++ solver)
 * Used by the bot to look its strategy up (PokerBot.js) and by the stats to
 * file the player's own decisions under the same keys (shared/stats/playerInfosets.js),
 * so the two always agree.
 *
 * Postflop buckets come from an EHS estimated with random rollouts on the flop
 * and the turn: a hand right on a bucket boundary may land on either side.
 */

import { packInfoSetKey, historyString } from './infosetKey.js';
import { toAbstract } from './historyTranslator.js';
import { codeToCard } from '../../poker/cards.js';

/**
 * @param {import('./cardAbstraction.js').CardAbstraction} abstraction
 * @param {{ round: number, seat: number, hole: string[], board: string[],
 *           history: import('./historyTranslator.js').SeatAction[][] }} view
 *   what the deciding seat knew (the `request` PokerGame gives its agent)
 * @returns {{ key: string, round: number, player: 0|1, bucket: number, strength: number,
 *             history: string, options: object[], offTree: string|null, facing: object|null }}
 *   options — the node's options (bettingTree.js), one per probability of the strategy row
 *   key is meaningless when offTree is set: the solver never saw that node
 */
export function describeInfoset(abstraction, { round, seat, hole, board, history }) {
  const { bucket, strength } = abstraction.describe(round, hole.map(codeToCard), board.map(codeToCard));
  const abstract = toAbstract(history, seat, round);
  const h = historyString(abstract.rounds);
  return {
    key: packInfoSetKey(round, abstract.player, bucket, h),
    round,
    player: abstract.player,
    bucket,
    strength,
    history: h,
    options: abstract.options,
    offTree: abstract.offTree,
    facing: abstract.facing,
  };
}
