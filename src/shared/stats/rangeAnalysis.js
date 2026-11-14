/**
 * rangeAnalysis.js — The range a player really played, and their biggest mistakes
 *
 * From the saved hands (server/src/stats/routes.js → GET /api/stats/range),
 * looking only at the player's FIRST decision before the flop:
 *
 *  - situation, like the preflop theory model (theory/preflopModel.js):
 *    'open'    nobody entered the pot before them (open, limp, or fold),
 *    'vsLimp'  someone only called (the big blind can check, raise or fold),
 *    'vsRaise' someone raised (3-bet, call or fold);
 *  - per hand type (AKo, 77…): how many times they got it and what they did
 *    (raise / call-or-check / fold), and the chips it won or lost overall.
 *
 * Mistakes are clear-cut preflop errors, judged with the hand's equity against
 * a random hand (equity_table.txt, the solver's own table). Deliberately
 * simple rules, so a beginner understands each one:
 *   fold-free     folded when checking was free (big blind, nobody raised)
 *   fold-strong   folded a very strong hand (equity ≥ STRONG_FOLD)
 *   call-trash    paid a raise with a very weak hand (equity < WEAK_CALL)
 * Same rule + same hand type are grouped ("3 fois avec JJ").
 *
 * Biggest losses: the hands that cost the most big blinds, whatever the reason.
 *
 * @typedef {object} SavedHand
 * @property {number} gameId
 * @property {number} number       — hand number in its game
 * @property {string|Date} playedAt
 * @property {number} bb           — big blind's seat
 * @property {number} bigBlind     — chips
 * @property {string[]} heroHole
 * @property {number} heroNet
 * @property {string[]} board
 * @property {string} result       — 'uncontested' | 'showdown'
 * @property {string|null} heroHandName
 * @property {object[]} players    — per seat (handRecord.js): name, showed, handName, folded…
 * @property {{ seat: number, type: string }[]} preflop — preflop actions in order, blinds included
 */

import { typeOfCards } from '../poker/ranges.js';

export const STRONG_FOLD = 0.64; // 77+, AK, AQ, AJs, ATs (equity vs a random hand)
export const WEAK_CALL = 0.38;   // 72o, 83o, 54o, 32s… the bottom right corner of the grid
const HERO = 0;

const RULES = {
  'fold-free': {
    title: 'Couché alors que checker était gratuit',
    explain: 'En grosse blinde, personne n’avait relancé : checker ne coûtait rien et te montrait le flop. '
      + 'Se coucher sans avoir à payer, c’est abandonner une chance de gagner pour rien.',
    weight: 3,
  },
  'fold-strong': {
    title: 'Couché avec une très grosse main',
    explain: 'Elle fait partie des 14 meilleures mains du tableau (77 et plus, AK, AQ, AJs, ATs). '
      + 'Se coucher avant le flop avec elle laisse le pot à l’adversaire, même face à une relance.',
    weight: 2,
  },
  'call-trash': {
    title: 'Payé une relance avec une main très faible',
    explain: 'C’est l’une des pires mains du tableau, et elle est encore plus faible contre une main qui relance. '
      + 'Payer, c’est souvent perdre des jetons après le flop.',
    weight: 1,
  },
};

const firstDecision = (hand) => {
  const acts = hand.preflop.filter((a) => a.type !== 'blind');
  const i = acts.findIndex((a) => a.seat === HERO);
  if (i < 0) return null; // everyone folded to the player: no decision
  const before = acts.slice(0, i);
  const raised = before.some((a) => a.type === 'raise' || a.type === 'bet');
  const limped = before.some((a) => a.type === 'call');
  const t = acts[i].type;
  const did = t === 'fold' ? 'fold' : t === 'raise' || t === 'bet' ? 'raise' : 'call';
  return { situation: raised ? 'vsRaise' : limped ? 'vsLimp' : 'open', did };
};

/**
 * @param {SavedHand[]} hands
 * @param {Map<string, number> | null} equity — hand type → equity vs a random hand
 */
export function analyseHands(hands, equity) {
  const situations = {
    open: { total: 0, hands: {} },
    vsLimp: { total: 0, hands: {} },
    vsRaise: { total: 0, hands: {} },
  };
  const mistakes = new Map();
  const losses = [];

  for (const hand of hands) {
    if (!hand.heroHole?.length) continue;
    const type = typeOfCards(hand.heroHole);
    const bbs = hand.heroNet / hand.bigBlind;
    const where = { gameId: hand.gameId, number: hand.number, playedAt: hand.playedAt };

    const d = firstDecision(hand);
    if (d) {
      const s = situations[d.situation];
      s.total++;
      const cell = (s.hands[type] ??= { n: 0, raise: 0, call: 0, fold: 0, netBB: 0 });
      cell.n++;
      cell[d.did]++;
      cell.netBB += bbs;

      // ── Mistakes ──
      const eq = equity?.get(type);
      let rule = null;
      if (d.did === 'fold' && d.situation !== 'vsRaise' && hand.bb === HERO) rule = 'fold-free';
      else if (eq !== undefined && d.did === 'fold' && eq >= STRONG_FOLD) rule = 'fold-strong';
      else if (eq !== undefined && d.did !== 'fold' && d.situation === 'vsRaise' && eq < WEAK_CALL) rule = 'call-trash';
      if (rule) {
        const key = `${rule}:${type}`;
        const m = mistakes.get(key) ?? { rule, type, count: 0, costBB: 0, equity: eq ?? null, example: null };
        m.count++;
        if (d.did !== 'fold') m.costBB += Math.min(0, bbs); // what paying cost
        m.example ??= { ...where, cards: hand.heroHole };
        mistakes.set(key, m);
      }
    }

    // ── Losses ──
    if (hand.heroNet < 0) {
      const shown = hand.players.filter((p) => p.seat !== HERO && p.showed)
        .map((p) => ({ name: p.name, hole: p.hole, handName: p.handName }));
      losses.push({
        ...where, bbs, chips: hand.heroNet, cards: hand.heroHole, board: hand.board,
        result: hand.result, handName: hand.heroHandName, folded: hand.players[HERO]?.folded ?? false, shown,
      });
    }
  }

  const ranked = [...mistakes.values()]
    .map((m) => ({ ...m, ...RULES[m.rule], score: RULES[m.rule].weight * m.count + Math.abs(m.costBB) / 10 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ weight, score, ...m }) => m);

  losses.sort((a, b) => a.bbs - b.bbs);
  return { hands: hands.length, situations, mistakes: ranked, losses: losses.slice(0, 5) };
}
