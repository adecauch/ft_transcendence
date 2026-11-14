/**
 * replay.js — Replay a logged hand with the real engine, refusing anything illegal
 *
 * The server can't trust results sent by a browser: it receives only the
 * hand's log (handLog.js) and plays it again through PokerGame, from the
 * stacks and button IT stored after the previous hand:
 *
 *  - the recorded cards are dealt in the engine's own order (a stacked deck);
 *    they must be valid, all different, and as many as the hand needed;
 *  - each recorded decision must come from the seat whose turn it is, on the
 *    right street, and be legal right then (betting.js: can't check facing a
 *    bet, a raise within min / max…);
 *  - no decision may be missing or left over.
 *
 * Stacks, pots, winners and the HandRecorder's record then come from the
 * engine, not from the log. What this can't catch: a browser choosing its own
 * cards. That goes away once the game itself runs on the server.
 *
 *   const { record, decisions, stacks, button, gameOver } = await replayHand(state, log);
 *   // state = { players, blinds, stacks, button, handNo } after the previous hand
 *   // decisions = what each seat knew at each decision, and what it did
 *   //             (for the player's infosets: shared/stats/playerInfosets.js)
 */

import { PokerGame } from '../poker/PokerGame.js';
import { createDeck } from '../poker/cards.js';
import { legalActions } from '../poker/betting.js';
import { HandRecorder } from './handRecord.js';

/** The log doesn't describe a legal hand. The message says why (French, shown in the API's answer). */
export class ReplayError extends Error {}

const BOARD_SIZES = [0, 3, 4, 5];
const ALL_CARDS = new Set(createDeck());

/**
 * @param {{ players: { name: string, isHuman: boolean, level?: string }[],
 *           blinds: { small: number, big: number }, stacks: number[], button: number, handNo: number }} state
 * @param {{ handNo: number, hole: (string[] | null)[], board: string[], actions: object[] }} log
 */
export async function replayHand(state, log) {
  const n = state.players.length;
  const fail = (message) => { throw new ReplayError(message); };

  if (log.handNo !== state.handNo + 1) fail(`Main n° ${log.handNo} reçue, n° ${state.handNo + 1} attendue`);
  if (state.stacks[0] <= 0 || state.stacks.slice(1).every((s) => s <= 0)) fail('La partie est déjà terminée');

  // ── Cards ──
  if (!Array.isArray(log.hole) || log.hole.length !== n) fail(`Il faut les cartes des ${n} sièges`);
  log.hole.forEach((h, seat) => {
    const inGame = state.stacks[seat] > 0;
    if (inGame && !(Array.isArray(h) && h.length === 2)) fail(`Le siège ${seat} doit avoir 2 cartes`);
    if (!inGame && h !== null) fail(`Le siège ${seat} est éliminé : pas de cartes`);
  });
  if (!BOARD_SIZES.includes(log.board.length)) fail('Le board doit avoir 0, 3, 4 ou 5 cartes');
  const dealt = [...log.hole.flat().filter(Boolean), ...log.board];
  if (dealt.some((c) => !ALL_CARDS.has(c))) fail('Carte inconnue');
  if (new Set(dealt).size !== dealt.length) fail('Une même carte apparaît deux fois');

  // The engine asks for the deck once the button is known (handStart comes first)
  let button = null;
  const deck = () => stackedDeck(log, button, n);

  // ── Decisions ──
  let next = 0;
  const decisions = [];
  const agent = {
    decide(req) {
      const a = log.actions[next++];
      if (a) {
        // What the seat knew, copied: the engine keeps adding to `history`
        decisions.push({
          seat: req.seat, round: req.round, hole: req.hole, board: [...req.board],
          history: structuredClone(req.history), type: a.type,
        });
      }
      const where = `coup ${next}`;
      if (!a) fail(`Coup manquant : c'était au siège ${req.seat} de jouer (${where})`);
      if (a.seat !== req.seat || a.street !== req.round) {
        fail(`${where} : c'était au siège ${req.seat} de jouer (tour ${req.round}), pas au siège ${a.seat} (tour ${a.street})`);
      }
      const legal = legalActions(req.turn);
      switch (a.type) {
        case 'fold':
          return { type: 'fold' };
        case 'check':
          if (!legal.check) fail(`${where} : impossible de checker face à une mise`);
          return { type: 'check' };
        case 'call':
          if (legal.call === null) fail(`${where} : rien à suivre`);
          return { type: 'call', amount: legal.call };
        case 'raise':
          if (!legal.raise) fail(`${where} : relance impossible`);
          if (!Number.isInteger(a.to) || a.to < legal.raise.min || a.to > legal.raise.max) {
            fail(`${where} : relance à ${a.to} hors limites (${legal.raise.min} à ${legal.raise.max})`);
          }
          return { type: 'raise', to: a.to };
        default:
          return fail(`${where} : action inconnue « ${a.type} »`);
      }
    },
  };

  const recorder = new HandRecorder();
  const game = new PokerGame({
    players: state.players.map((p) => ({ ...p, agent })),
    startingStack: 0,
    blinds: state.blinds,
    deck,
    onEvent: (e) => {
      if (e.type === 'handStart') button = e.button;
      // More board cards than the hand dealt, or fewer
      if (e.type === 'street' && e.board.length > log.board.length) fail('Il manque des cartes au board');
      recorder.event(e);
    },
  });
  game.stacks = [...state.stacks];
  game.button = state.button;
  game.handNo = state.handNo;

  await game.playHand();
  if (next !== log.actions.length) fail(`${log.actions.length - next} coup(s) en trop après la fin de la main`);
  if (recorder.record.board.length !== log.board.length) fail('Le board a plus de cartes que la main n\'en a distribué');

  return {
    record: recorder.record, decisions,
    stacks: game.stacks, button: game.button, handNo: game.handNo, gameOver: game.gameOver,
  };
}

/**
 * A deck whose pop() order gives the logged cards where the engine deals
 * them: hole cards one at a time from the left of the button (two rounds),
 * then burn + flop, burn + turn, burn + river. Burns and cards the hand never
 * reached are unused cards.
 */
function stackedDeck(log, button, n) {
  const used = new Set([...log.hole.flat().filter(Boolean), ...log.board]);
  const spare = [...ALL_CARDS].filter((c) => !used.has(c));
  const order = [];
  for (let round = 0; round < 2; round++) {
    for (let k = 1; k <= n; k++) {
      const h = log.hole[(button + k) % n];
      if (h) order.push(h[round]);
    }
  }
  const board = [...log.board];
  for (const count of [3, 1, 1]) {
    order.push(spare.pop()); // burn
    for (let i = 0; i < count; i++) order.push(board.length ? board.shift() : spare.pop());
  }
  // pop() takes from the end: the first card to deal goes last
  return [...spare, ...order.reverse()];
}
