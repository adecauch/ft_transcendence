/**
 * ranges.js — Preflop ranges: the 13×13 grid, combos, and the usual notation
 *
 * A "range" is the set of starting hands a player plays a given way. There
 * are 1326 two-card combinations but only 169 hand TYPES, drawn as a 13×13 grid:
 *
 *        A    K    Q   …
 *   A   AA   AKs  AQs       diagonal        = pairs      (6 combos each)
 *   K   AKo  KK   KQs       above the diag. = suited 's' (4 combos each)
 *   Q   AQo  KQo  QQ        below the diag. = offsuit 'o' (12 combos each)
 *
 * A range here maps each hand type to the frequency of each action, e.g.
 *   { AA: { raise: 1 }, AJs: { raise: 0.6, call: 0.4 }, … }  (missing = the
 *   rest, usually fold). Frequencies let a range be "mixed", like a solver's.
 *
 * Notation (what poker books and tools write), parsed by parseRange():
 *   'QQ+'  = QQ, KK, AA          '55-22' = 55, 44, 33, 22
 *   'ATs+' = ATs, AJs, AQs, AKs  'A5s-A2s' = A5s, A4s, A3s, A2s
 *   'KQo'  = offsuit only        'KQ'    = KQs and KQo
 */

export const RANKS = 'AKQJT98765432'; // grid order: strongest first
export const TOTAL_COMBOS = 1326;

const RANK_NAMES = {
  A: 'As', K: 'Roi', Q: 'Dame', J: 'Valet', T: 'Dix',
  9: 'Neuf', 8: 'Huit', 7: 'Sept', 6: 'Six', 5: 'Cinq', 4: 'Quatre', 3: 'Trois', 2: 'Deux',
};
const PAIR_NAMES = {
  A: 'Paire d’as', K: 'Paire de rois', Q: 'Paire de dames', J: 'Paire de valets', T: 'Paire de dix',
  9: 'Paire de neuf', 8: 'Paire de huit', 7: 'Paire de sept', 6: 'Paire de six', 5: 'Paire de cinq',
  4: 'Paire de quatre', 3: 'Paire de trois', 2: 'Paire de deux',
};

/** Hand type in the grid cell (row, col): 'AA', 'AKs' (above the diagonal), 'AKo' (below). */
export function cellHand(row, col) {
  const a = RANKS[row];
  const b = RANKS[col];
  if (row === col) return a + b;
  return row < col ? a + b + 's' : b + a + 'o';
}

/** The 169 hand types, row by row. */
export const ALL_HANDS = Array.from({ length: 169 }, (_, i) => cellHand(Math.floor(i / 13), i % 13));

/** 'pair' | 'suited' | 'offsuit' */
export function handKind(hand) {
  return hand.length === 2 ? 'pair' : hand[2] === 's' ? 'suited' : 'offsuit';
}

/** Two-card combinations of a hand type: pairs 6, suited 4, offsuit 12. */
export function combos(hand) {
  return { pair: 6, suited: 4, offsuit: 12 }[handKind(hand)];
}

/** French name: 'Paire de dames', 'As-Roi assortis', 'Dame-Valet dépareillés'. */
export function handLabel(hand) {
  const kind = handKind(hand);
  if (kind === 'pair') return PAIR_NAMES[hand[0]];
  return `${RANK_NAMES[hand[0]]}-${RANK_NAMES[hand[1]]} ${kind === 'suited' ? 'assortis' : 'dépareillés'}`;
}

/** One example of real cards for a hand type: 'AKs' → ['AS', 'KS']. */
export function exampleCards(hand) {
  const kind = handKind(hand);
  if (kind === 'pair') return [`${hand[0]}S`, `${hand[1]}H`];
  return kind === 'suited' ? [`${hand[0]}S`, `${hand[1]}S`] : [`${hand[0]}S`, `${hand[1]}H`];
}

/** Hand type of two card codes: ['KD', 'AS'] → 'AKo'. */
export function typeOfCards([c1, c2]) {
  let [a, b] = [c1, c2];
  if (RANKS.indexOf(a[0]) > RANKS.indexOf(b[0])) [a, b] = [b, a];
  if (a[0] === b[0]) return a[0] + b[0];
  return a[0] + b[0] + (a[1] === b[1] ? 's' : 'o');
}

// ── Notation ─────────────────────────────────────────────────────────────────

const rankIndex = (r) => {
  const i = RANKS.indexOf(r);
  if (i < 0) throw new Error(`Rang inconnu « ${r} »`);
  return i;
};

/** Every hand type of one token: 'QQ+', '55-22', 'ATs+', 'A5s-A2s', 'KQo', 'KQ'. */
function expandToken(token) {
  const t = token.trim().toUpperCase().replace(/S/g, 's').replace(/O/g, 'o');
  if (!t) return [];
  const m = /^([AKQJT2-9])([AKQJT2-9])([so]?)(\+?)(?:-([AKQJT2-9])([AKQJT2-9])([so]?))?$/.exec(t);
  if (!m) throw new Error(`Notation inconnue « ${token.trim()} »`);
  const [, a, b, suit, plus, a2, b2, suit2] = m;
  const suits = suit ? [suit] : ['s', 'o'];
  const out = [];

  if (a === b) {
    // Pairs: QQ, QQ+ (up to AA), QQ-88
    const top = rankIndex(a);
    let from = top;
    let to = top;
    if (plus) from = 0;
    if (a2) {
      if (a2 !== b2) throw new Error(`« ${token.trim()} » : une plage de paires s'écrit comme 99-66`);
      to = rankIndex(a2);
    }
    for (let i = Math.min(from, to); i <= Math.max(from, to); i++) out.push(RANKS[i] + RANKS[i]);
    return out;
  }

  // Non-pairs: the first rank stays, the kicker moves
  const hi = rankIndex(a);
  const lo = rankIndex(b);
  if (lo < hi) return expandToken(b + a + suit + plus + (a2 ? `-${a2}${b2}${suit2}` : ''));
  let kickers = [lo];
  if (plus) kickers = Array.from({ length: lo - hi }, (_, k) => hi + 1 + k); // up to just below the first rank
  if (a2) {
    if (a2 !== a || (suit2 || suit) !== suit) throw new Error(`« ${token.trim()} » : une plage s'écrit comme A5s-A2s`);
    const end = rankIndex(b2);
    kickers = [];
    for (let k = Math.min(lo, end); k <= Math.max(lo, end); k++) kickers.push(k);
  }
  for (const k of kickers) for (const s of suits) out.push(a + RANKS[k] + s);
  return out;
}

/**
 * Hand types of a notation string ('QQ+, AKs, A5s-A2s'), separated by commas or spaces.
 * @throws Error (French message) on something it can't read
 */
export function parseRange(text) {
  const hands = new Set();
  for (const token of text.split(/[,\s]+/)) for (const h of expandToken(token)) hands.add(h);
  return hands;
}

/**
 * A range from notation, one string per action. An action listed first wins
 * where two overlap. Hands in none of them get `rest` (usually 'fold').
 * @param {Record<string, string>} byAction  e.g. { raise: 'TT+, AQs+', call: '22-99, A2s-AJs' }
 * @param {string | null} [rest]
 * @returns {Record<string, Record<string, number>>}
 */
export function rangeFromNotation(byAction, rest = 'fold') {
  const range = {};
  for (const [action, text] of Object.entries(byAction)) {
    for (const h of parseRange(text)) range[h] ??= { [action]: 1 };
  }
  if (rest) for (const h of ALL_HANDS) range[h] ??= { [rest]: 1 };
  return range;
}

/**
 * How much of all 1326 combos each action takes.
 * @returns {Record<string, { combos: number, share: number }>} share in 0..1
 */
export function rangeStats(range, actionIds) {
  const out = Object.fromEntries(actionIds.map((id) => [id, { combos: 0, share: 0 }]));
  for (const h of ALL_HANDS) {
    const mix = range[h] ?? {};
    for (const id of actionIds) out[id].combos += (mix[id] ?? 0) * combos(h);
  }
  for (const id of actionIds) out[id].share = out[id].combos / TOTAL_COMBOS;
  return out;
}

// ── Saved ranges ─────────────────────────────────────────────────────────────

/** Actions a player's own range can use (anything else is fold). */
export const SAVED_RANGE_ACTIONS = ['raise', 'call'];
export const RANGE_NAME_MAX = 40;

/**
 * Check a range sent to be saved and return a clean copy: only real hand
 * types, only raise / call, frequencies between 0 and 1 summing to at most 1,
 * zeros dropped (a missing hand = fold).
 * @param {unknown} data
 * @returns {Record<string, { raise?: number, call?: number }>}
 * @throws Error (French message) when something doesn't fit
 */
export function cleanRange(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('La range doit être un objet { main: { action: fréquence } }');
  const hands = new Set(ALL_HANDS);
  const clean = {};
  for (const [hand, mix] of Object.entries(data)) {
    if (!hands.has(hand)) throw new Error(`« ${hand} » n’est pas une main du tableau`);
    if (!mix || typeof mix !== 'object') throw new Error(`${hand} : fréquences manquantes`);
    const out = {};
    let sum = 0;
    for (const [action, f] of Object.entries(mix)) {
      if (!SAVED_RANGE_ACTIONS.includes(action)) throw new Error(`${hand} : action inconnue « ${action} »`);
      if (typeof f !== 'number' || !(f >= 0 && f <= 1)) throw new Error(`${hand} : une fréquence va de 0 à 1`);
      if (f > 0) out[action] = f;
      sum += f;
    }
    if (sum > 1.000001) throw new Error(`${hand} : les fréquences dépassent 100 %`);
    if (Object.keys(out).length) clean[hand] = out;
  }
  return clean;
}
