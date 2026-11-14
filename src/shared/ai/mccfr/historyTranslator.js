/**
 * historyTranslator.js — Real table → the solver's heads-up abstract game
 *
 * The MCCFR was trained heads-up, 200 BB deep, with a fixed menu of bet sizes
 * per node (bettingTree.js). A real hand can have up to 5 players and any
 * bet size, so the bot sees it as "me vs the field":
 *
 *  - every action becomes an OPTION of the abstract node: fold 'f',
 *    check/call 'c', a bet/raise → the solver size closest to it ('2'..'7')
 *  - consecutive opponent actions merge into one: their biggest raise if any
 *    of them raised, otherwise 'c'. Opponent folds are dropped
 *  - abstract player 0 = the one who acts first preflop (the small blind
 *    heads-up), player 1 acts first after the flop — same as GameState
 *  - if the real order doesn't fit that alternation (multiway, all-in
 *    players who can't act…), a virtual check/call is inserted for the missing side
 *  - once a call closes the round heads-up (both acted, bets equal), later
 *    checks / calls of that round are dropped (a third player limping or
 *    checking behind). A raise after that is still applied: the solver never
 *    saw that line, the key is simply missing and the bot uses its fallback
 *
 * Action translation — which solver size a real raise becomes: both are
 * measured as "raise to / pot before the action" and the closest in log scale
 * wins (a ×2 difference weighs the same up or down). The abstract hand then
 * goes on with the SOLVER's amount, never the real one, so every following
 * node is exactly one the solver visited. A real all-in may become any size
 * (a 10 BB shove is closer to a 2.5 BB open than to a 200 BB all-in); a real
 * raise that is not all-in never becomes the solver's all-in unless nothing
 * else is offered — otherwise the solver would think the stacks are empty.
 *
 * Off-tree: a raise where the abstract node offers none (5th bet of a street,
 * or the abstract stacks are already all-in). From then on the key means
 * nothing and the caller must not look the strategy up.
 */

import { AbstractHand, CALL, FOLD, optionChar } from './bettingTree.js';

/**
 * @typedef {object} SeatAction
 * @property {number} seat
 * @property {'fold'|'check'|'call'|'raise'} type
 * @property {number} [to]         — raise / all-in call: the seat's total bet on the street after the action
 * @property {number} [potBefore]  — pot right before the action (street bets included, like TurnState.pot)
 * @property {boolean} [allIn]     — the seat has no chips left after the action
 */

/**
 * Which option of the node a real raise becomes.
 * @param {object[]} options — AbstractHand.options()
 * @param {number} pot — abstract pot before the action
 * @param {SeatAction} action
 * @returns {number} option index, or -1 if the node has no raise
 */
export function mapRaise(options, pot, action) {
  const raises = options.map((o, i) => ({ ...o, index: i })).filter((o) => o.type === 'raise');
  if (!raises.length) return -1;
  const allIn = raises[raises.length - 1];
  const sized = raises.slice(0, -1);
  // Sizes unknown (older callers, tests): the first size, or the all-in
  if (!action.to || !action.potBefore) return action.allIn || !sized.length ? allIn.index : sized[0].index;

  const candidates = action.allIn || !sized.length ? raises : sized;
  const real = Math.log(action.to / action.potBefore);
  let best = candidates[0];
  for (const o of candidates) {
    if (Math.abs(Math.log(o.to / pot) - real) < Math.abs(Math.log(best.to / pot) - real)) best = o;
  }
  return best.index;
}

/**
 * @param {SeatAction[][]} rounds — voluntary actions per round, in order (blinds excluded)
 * @param {number} me — the bot's seat
 * @param {number} round — current round (0..3)
 * @returns {{
 *   player: 0|1,
 *   rounds: string[][],
 *   options: object[],
 *   offTree: string|null,
 *   facing: { allIn: boolean } | null
 * }}
 *   rounds  — option characters per round ("2", "c", …), for historyString()
 *   options — the options of the node where the bot decides (bettingTree.js)
 *   offTree — null if the whole hand so far is inside the solver's game
 *   facing  — the off-tree raise the bot must answer right now, or null
 */
export function toAbstract(rounds, me, round) {
  // -- Compress each round into alternating bot / villain actions --
  const compressed = [];
  for (let r = 0; r <= round; r++) {
    const seq = [];
    for (const action of rounds[r] ?? []) {
      const owner = action.seat === me ? 'me' : 'vil';
      if (owner === 'vil' && action.type === 'fold') continue;
      const last = seq[seq.length - 1];
      if (last && last.owner === 'vil' && owner === 'vil') {
        // Several opponents in a row: the biggest raise speaks for them
        if (action.type === 'raise') last.action = action;
        continue;
      }
      seq.push({ owner, action });
    }
    compressed.push(seq);
  }

  // -- Who is abstract player 0: whoever acts first preflop --
  // If the bot hasn't acted preflop and nobody has either, it's first to act.
  const pre = compressed[0];
  const player = pre.length === 0 || pre[0].owner === 'me' ? 0 : 1;

  // -- Replay it in the solver's game, round by round --
  const hand = new AbstractHand();
  let offTree = null;
  let facing = null;
  for (let r = 0; r <= round; r++) {
    if (r > 0) hand.startRound(r);
    const firstOwner = (r === 0) === (player === 0) ? 'me' : 'vil';
    let expected = firstOwner;
    const closed = () => hand.history[r].length >= 2 && hand.bets[0] === hand.bets[1];
    for (const { owner, action } of compressed[r]) {
      if (closed() && action.type !== 'raise') continue;
      if (owner !== expected) hand.apply(CALL); // virtual check / call for the side that didn't act
      let index = action.type === 'fold' ? FOLD : action.type === 'raise' ? mapRaise(hand.options(), hand.pot, action) : CALL;
      if (index < 0) {
        offTree ??= 'raise beyond the solver\'s tree';
        index = CALL;
        if (r === round && owner === 'vil') facing = { allIn: !!action.allIn };
      } else if (r === round && action.type === 'raise') {
        facing = null; // a later raise inside the tree replaces an off-tree one
      }
      hand.apply(index);
      expected = owner === 'me' ? 'vil' : 'me';
    }
    // It's the bot's turn now: if the sequence says otherwise, the other side checked
    if (r === round && expected !== 'me' && !closed()) hand.apply(CALL);
  }

  return {
    player,
    rounds: hand.history.map((r) => r.map(optionChar)),
    options: hand.options(),
    offTree,
    facing,
  };
}
