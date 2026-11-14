/**
 * bettingTree.js — The solver's betting abstraction (mirror of ../CFR's
 * abstraction/betting.cpp and the betting part of game/gamestate.cpp)
 *
 * The solver plays heads-up, blinds 1/2, 400 chips each (200 BB). In every
 * node the player to act has a FIXED list of options, and the history stores
 * the INDEX of the option taken:
 *   [0] fold 'f' (always listed, legal only when facing a bet)
 *   [1] check / call 'c'
 *   [2..] the bet sizes of the current raise level '2', '3', …
 *   [n-1] all-in (last digit)
 * So '2' means "the first size of THIS node": a ⅓-pot bet on the flop, a
 * 2 BB open preflop ('3' = the 2.5 BB open), a ×3 raise facing a bet… The list must be computed
 * exactly like the C++ or the keys point to the wrong nodes: amounts are in
 * solver chips and rounded like std::lround.
 *
 * AbstractHand replays a history inside that game (the solver's amounts,
 * never the real ones): it is what tells which sizes exist in a node.
 */

export const FOLD = 0;
export const CALL = 1;
export const FIRST_RAISE_OPTION = 2;

/** The solver's game: GameState(1, 2, 400) in CFRSolver::train (defines.hpp). */
export const SOLVER_SB = 1;
export const SOLVER_BB = 2;
export const SOLVER_STACK = 400;
/** Stack depth in big blinds: part of the infoset key (infosetKey.js). */
export const SOLVER_DEPTH = SOLVER_STACK / SOLVER_BB;

/**
 * How a size is expressed (SizeKind in betting.cpp):
 *   bb   — multiple of the big blind          (preflop open: 2 → 2 BB)
 *   bet  — multiple of the opponent's bet     (raise: 3 → ×3)
 *   pot  — fraction of the pot after calling  (postflop: 0.5 → ½ pot)
 *   allin
 * @typedef {{ kind: 'bb'|'bet'|'pot'|'allin', value?: number }} SizeSpec
 */

/** Indexed by raise level = bets/raises already made this street (the big blind is not one). */
export const PREFLOP_SIZES = [
  [{ kind: 'bb', value: 2 }, { kind: 'bb', value: 2.5 }], // level 0: small blind open (2 BB = Slumbot's size)
  [{ kind: 'bet', value: 3 }],   // level 1: 3-bet
  [{ kind: 'bet', value: 2.5 }], // level 2: 4-bet
];
export const POSTFLOP_SIZES = [
  [{ kind: 'pot', value: 1 / 3 }, { kind: 'pot', value: 1 / 2 }, { kind: 'pot', value: 2 / 3 }, { kind: 'pot', value: 1 }], // first bet
  [{ kind: 'bet', value: 3 }], // raise
];
/** Bets + raises per street, all-in included. */
export const MAX_BETS_PER_ROUND = 4;
/** A size that adds more than 2/3 of the stack is dropped: the all-in replaces it. */
export const ALLIN_THRESHOLD = 2 / 3;

/**
 * The betting abstraction as text: part of the abstraction's identity (the
 * server's `version` of PlayerInfoset rows), since the same history string
 * means other bets under other sizes.
 */
export const BETTING_ID = JSON.stringify({
  PREFLOP_SIZES, POSTFLOP_SIZES, MAX_BETS_PER_ROUND, ALLIN_THRESHOLD, SOLVER_SB, SOLVER_BB, SOLVER_STACK,
});

/** std::lround for the positive amounts we use (half away from zero). */
const lround = (x) => Math.round(x);

/**
 * Total bet on the street a size goes to — the solver's formula, used both in
 * the abstract game and on the real table (same fields as betting.js TurnState).
 * @param {SizeSpec} spec
 * @param {{ currentBet: number, toCall: number, pot: number, bigBlind: number, maxTo: number }} s
 */
export function sizeTo(spec, { currentBet, toCall, pot, bigBlind, maxTo }) {
  switch (spec.kind) {
    case 'bb':  return lround(spec.value * bigBlind);
    case 'bet': return lround(spec.value * currentBet);
    case 'pot': return currentBet + lround(spec.value * (pot + toCall));
    default:    return maxTo;
  }
}

/**
 * One node of the abstract game. `options[i]` = { type, spec?, to?, legal }.
 * Mirrors GameState: player 0 is the small blind (acts first preflop),
 * player 1 the big blind (first after the flop).
 */
export class AbstractHand {
  constructor() {
    this.stacks = [SOLVER_STACK - SOLVER_SB, SOLVER_STACK - SOLVER_BB];
    this.bets = [SOLVER_SB, SOLVER_BB];
    this.pot = SOLVER_SB + SOLVER_BB;
    this.lastRaise = SOLVER_BB; // preflop, the big blind counts as the opening bet
    this.round = 0;
    this.player = 0;
    /** @type {number[][]} option indexes per round */
    this.history = [[], [], [], []];
  }

  /** GameState::nextRound: bets reset, the big blind speaks first. */
  startRound(round) {
    this.round = round;
    this.bets = [0, 0];
    this.lastRaise = 0;
    this.player = 1;
  }

  raisesThisRound() {
    return this.history[this.round].filter((o) => o >= FIRST_RAISE_OPTION).length;
  }

  /** legalActions() of betting.cpp, for the player to act. */
  options() {
    const me = this.player;
    const opp = 1 - me;
    const toCall = this.bets[opp] - this.bets[me];
    const level = this.raisesThisRound();
    const out = [
      { type: 'fold', legal: toCall > 0 },
      { type: 'call', legal: true },
    ];
    if (level >= MAX_BETS_PER_ROUND || this.stacks[me] <= toCall) return out;

    const table = this.round === 0 ? PREFLOP_SIZES : POSTFLOP_SIZES;
    const sizes = table[level] ?? [];
    const minTo = this.bets[opp] + Math.max(this.lastRaise, SOLVER_BB);
    const maxTo = this.bets[me] + this.stacks[me];
    const ctx = { currentBet: this.bets[opp], toCall, pot: this.pot, bigBlind: SOLVER_BB, maxTo };
    let lastTo = -1;
    for (const spec of sizes) {
      const to = sizeTo(spec, ctx);
      const added = to - this.bets[me];
      if (to < minTo || to >= maxTo) continue;              // below the min-raise, or it IS the all-in
      if (added > ALLIN_THRESHOLD * this.stacks[me]) continue; // too committed: the all-in covers it
      if (to === lastTo) continue;                           // same amount after rounding
      out.push({ type: 'raise', spec, to, legal: true });
      lastTo = to;
    }
    out.push({ type: 'raise', spec: { kind: 'allin' }, to: maxTo, legal: true });
    return out;
  }

  /** GameState::applyAction, without the automatic end of round (the caller drives rounds). */
  apply(index) {
    const option = this.options()[index];
    if (!option) throw new Error(`No option ${index} in this node`);
    const me = this.player;
    const opp = 1 - me;
    this.history[this.round].push(index);
    if (option.type === 'call') {
      const toCall = Math.min(this.bets[opp] - this.bets[me], this.stacks[me]);
      this.stacks[me] -= toCall;
      this.bets[me] += toCall;
      this.pot += toCall;
    } else if (option.type === 'raise') {
      const toAdd = Math.min(option.to - this.bets[me], this.stacks[me]);
      this.stacks[me] -= toAdd;
      this.bets[me] += toAdd;
      this.pot += toAdd;
      this.lastRaise = Math.max(this.lastRaise, this.bets[me] - this.bets[opp]);
    }
    this.player = opp;
    return option;
  }

  /** The history string of the key: option characters + '/' per round ("25c/3///"). */
  historyString() {
    return this.history.map((r) => r.map(optionChar).join('')).join('/') + '/';
  }
}

/** 'f', 'c', then '2'..'7' (optionChar in defines.hpp). */
export function optionChar(index) {
  return index === FOLD ? 'f' : index === CALL ? 'c' : String(index);
}

/** The inverse, for a history string. */
export function charOption(ch) {
  return ch === 'f' ? FOLD : ch === 'c' ? CALL : Number(ch);
}

/**
 * Replay a history string, action by action.
 * @param {string} history — e.g. "2c/c3///"
 * @returns {{ round: number, player: 0|1, index: number, option: object, facing: boolean }[]}
 *   facing = there was a bet to answer when the action was taken
 */
export function replayHistory(history) {
  const hand = new AbstractHand();
  const steps = [];
  history.split('/').slice(0, 4).forEach((chars, round) => {
    if (round > 0) hand.startRound(round);
    for (const ch of chars) {
      const index = charOption(ch);
      const facing = hand.bets[1 - hand.player] > hand.bets[hand.player];
      const player = hand.player;
      const option = hand.apply(index);
      steps.push({ round, player, index, option, facing });
    }
  });
  return steps;
}

const FRACTIONS = new Map([[1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾']]);
const frNum = (n) => String(n).replace('.', ',');

/** Short French label of an option: 'Se coucher', '½ pot', '×3', 'Tapis'… */
export function optionLabel(option, facing = true) {
  if (option.type === 'fold') return 'Se coucher';
  if (option.type === 'call') return facing ? 'Suivre' : 'Checker';
  const { kind, value } = option.spec;
  if (kind === 'allin') return 'Tapis';
  if (kind === 'bb') return `${frNum(value)} BB`;
  if (kind === 'bet') return `×${frNum(value)}`;
  if (value === 1) return 'Pot';
  return `${FRACTIONS.get(value) ?? frNum(value)} pot`;
}
