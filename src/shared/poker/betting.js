/**
 * betting.js — No-limit Hold'em betting rules for one player's turn
 *
 * Pure functions, no DOM: shared by the action bar and (later) the engine.
 *
 * Amounts are chips. A raise is expressed as the TOTAL the player will have
 * put in on this street ("raise to"), not the increment.
 *
 * @typedef {object} TurnState
 * @property {number} stack       — chips the player still has behind
 * @property {number} playerBet   — chips the player already put in this street
 * @property {number} currentBet  — highest total bet on this street
 * @property {number} lastRaise   — size of the last bet/raise increment this street (0 if none)
 * @property {number} bigBlind
 * @property {number} pot         — every chip in the middle, bets of this street included
 * @property {boolean} [preflop]  — first betting round (sizes the quick raise amounts)
 * @property {string} [street]    — display only, e.g. 'Flop'
 * @property {string} [note]      — display only: what the others just did
 *
 * @typedef {{ type: 'fold' } | { type: 'check' } | { type: 'call', amount: number } | { type: 'raise', to: number }} PlayerAction
 */

/** Chips needed to call (capped at the player's stack). */
export function toCall(s) {
  return Math.min(Math.max(0, s.currentBet - s.playerBet), s.stack);
}

/** Largest "raise to": everything the player has. */
export function maxRaiseTo(s) {
  return s.playerBet + s.stack;
}

/**
 * Smallest legal "raise to". The increment must be at least the previous
 * bet/raise on this street, and at least the big blind. If the player can't
 * reach it, going all-in is the only raise left.
 */
export function minRaiseTo(s) {
  const increment = Math.max(s.lastRaise, s.bigBlind);
  return Math.min(s.currentBet + increment, maxRaiseTo(s));
}

/** Which buttons are available, and with which amounts. */
export function legalActions(s) {
  const call = toCall(s);
  const canRaise = s.stack > call; // must have chips left after calling
  return {
    fold:  true,
    check: call === 0,
    call:  call > 0 ? call : null,
    callIsAllIn: call > 0 && call === s.stack,
    raise: canRaise ? { min: minRaiseTo(s), max: maxRaiseTo(s) } : null,
    isBet: s.currentBet === 0, // first chips of the street: "Miser" rather than "Relancer"
  };
}

/**
 * Check a "raise to" amount typed by the player.
 * @param {TurnState} s
 * @param {string|number} input — chips (a number is used as is)
 * @param {(n: number) => string} [format] — how the error messages write amounts
 * @returns {{ ok: true, to: number } | { ok: false, error: string }}
 */
export function validateRaise(s, input, format = fmt) {
  const raw = typeof input === 'number' ? String(input) : String(input ?? '').trim().replace(/\s/g, '');

  if (raw === '') return { ok: false, error: 'Entre un montant.' };
  if (!/^\d+$/.test(raw)) return { ok: false, error: 'Le montant doit être un nombre entier de jetons.' };

  const to  = Number(raw);
  const min = minRaiseTo(s);
  const max = maxRaiseTo(s);
  const verb = s.currentBet === 0 ? 'mise' : 'relance';

  if (s.stack <= toCall(s)) {
    return { ok: false, error: 'Tu n\'as pas assez de jetons pour relancer.' };
  }
  if (to > max) {
    return { ok: false, error: `Tu ne peux pas miser plus que ton tapis (${format(max)}).` };
  }
  if (to < min) {
    return { ok: false, error: `La ${verb} minimum est de ${format(min)}.` };
  }
  return { ok: true, to };
}

/**
 * Quick amounts for the raise panel, the usual sizings for the situation:
 *  - preflop, nobody raised yet: 2 / 2,5 / 3 / 4 big blinds
 *  - facing a raise (any street): 2,5 / 3 / 4 times the current bet
 *  - postflop, first bet: ⅓ / ½ / ⅔ / ¾ / 1 / 1,5 pot
 * plus "Pot" when facing a bet, with "Min" first and "Tapis" last. Sizes
 * outside the legal range are dropped (not clamped, so a label never lies),
 * then everything is sorted by amount and deduplicated.
 * @param {TurnState} s
 * @returns {{ label: string, to: number }[]}
 */
export function raisePresets(s) {
  const min  = minRaiseTo(s);
  const max  = maxRaiseTo(s);
  // Pot-sized raise: call first, then raise by the size of the pot after the call.
  const potAfterCall = s.pot + toCall(s);
  const potFraction = (f) => s.currentBet + potAfterCall * f;

  let sizes;
  if (s.preflop && s.currentBet <= s.bigBlind) {
    sizes = [2, 2.5, 3, 4].map((k) => ({ label: `${frNum(k)} BB`, to: k * s.bigBlind }));
  } else if (s.currentBet > 0) {
    sizes = [2.5, 3, 4].map((k) => ({ label: `×${frNum(k)}`, to: k * s.currentBet }));
  } else {
    sizes = [];
  }
  if (s.currentBet === 0) {
    sizes.push(
      { label: '⅓ pot', to: potFraction(1 / 3) },
      { label: '½ pot', to: potFraction(1 / 2) },
      { label: '⅔ pot', to: potFraction(2 / 3) },
      { label: '¾ pot', to: potFraction(3 / 4) },
      { label: 'Pot',   to: potFraction(1) },
      { label: '1,5 pot', to: potFraction(1.5) },
    );
  } else {
    sizes.push({ label: 'Pot', to: potFraction(1) });
  }

  const presets = [
    { label: 'Min', to: min },
    ...sizes
      .map((p) => ({ ...p, to: Math.round(p.to) }))
      .filter((p) => p.to > min && p.to < max)
      .sort((a, b) => a.to - b.to),
    { label: 'Tapis', to: max },
  ];
  // Same amount twice: keep the first label, except that "Tapis" always wins.
  return presets.filter((p, i) =>
    p.label === 'Tapis' ? true : presets.findIndex((q) => q.to === p.to) === i && p.to !== max);
}

/**
 * One-click bets shown right on the action bar (like Winamax): a short row,
 * one click = the action is played. Fewer sizes than raisePresets(), the ones
 * that matter, matching the solver's menu where it can:
 *  - preflop, nobody raised yet: 2 / 2,5 / 3 big blinds
 *  - facing a bet or a raise: ×2,5 / ×3 / Pot
 *  - postflop, first bet: ⅓ / ½ / ⅔ / Pot
 * then "Tapis". A size below the min-raise or at / above the stack is dropped
 * (a label never lies); when none is left, "Min" stands in. Same amount twice
 * = one button. Any other amount: the raise panel.
 * @param {TurnState} s
 * @returns {{ label: string, to: number }[]} empty when raising is impossible
 */
export function quickBets(s) {
  if (s.stack <= toCall(s)) return [];
  const min = minRaiseTo(s);
  const max = maxRaiseTo(s);
  const potAfterCall = s.pot + toCall(s);
  const potFraction = (f) => s.currentBet + potAfterCall * f;

  let sizes;
  if (s.preflop && s.currentBet <= s.bigBlind) {
    sizes = [2, 2.5, 3].map((k) => ({ label: `${frNum(k)} BB`, to: k * s.bigBlind }));
  } else if (s.currentBet > 0) {
    sizes = [
      ...[2.5, 3].map((k) => ({ label: `×${frNum(k)}`, to: k * s.currentBet })),
      { label: 'Pot', to: potFraction(1) },
    ];
  } else {
    sizes = [
      { label: '⅓ pot', to: potFraction(1 / 3) },
      { label: '½ pot', to: potFraction(1 / 2) },
      { label: '⅔ pot', to: potFraction(2 / 3) },
      { label: 'Pot', to: potFraction(1) },
    ];
  }

  const bets = [];
  for (const p of sizes) {
    const to = Math.round(p.to);
    if (to < min || to >= max || bets.some((b) => b.to === to)) continue;
    bets.push({ label: p.label, to });
  }
  if (!bets.length && min < max) bets.push({ label: 'Min', to: min });
  bets.push({ label: 'Tapis', to: max });
  return bets;
}

/** 2.5 → "2,5" */
function frNum(n) {
  return String(n).replace('.', ',');
}

export function fmt(n) {
  return n.toLocaleString('fr-FR');
}

/** Chips as big blinds, one decimal at most: 1234 with a 20 big blind → "61,7 BB" */
export function fmtBB(n, bigBlind) {
  return `${(n / bigBlind).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} BB`;
}

/**
 * An amount typed in big blinds ("2,5", "2.5", "3 BB") → chips, rounded to
 * the chip. null if it isn't a number.
 */
export function parseBB(input, bigBlind) {
  const raw = String(input ?? '').replace(/\s/g, '').replace(/bb$/i, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  return Math.round(Number(raw) * bigBlind);
}
