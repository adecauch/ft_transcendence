/**
 * historyWords.js — An abstract history ('2c/c3///') in plain French
 *
 * Heads-up, as in the solver: preflop the small blind (player 0) speaks
 * first, after the flop the big blind (player 1). Each character is an option
 * of its node (bettingTree.js): the history is replayed in the solver's game
 * to know which size a digit was.
 *
 *   describeHistory('c/c3///', 1, 1) → 'Au flop, tu checkes, l’adversaire mise ½ pot.'
 */

import { replayHistory } from './bettingTree.js';

const STREETS = ['Avant le flop', 'Au flop', 'Au turn', 'À la river'];

/** '½ pot', '×3', '2,5 BB' or 'tapis' — the size of a bet in words. */
function sizeWords({ kind, value }) {
  if (kind === 'allin') return null;
  if (kind === 'bb') return `à ${String(value).replace('.', ',')} grosses blindes`;
  if (kind === 'bet') return `×${String(value).replace('.', ',')}`;
  if (value === 1) return 'la taille du pot';
  return `${{ [1 / 3]: '⅓', [1 / 2]: '½', [2 / 3]: '⅔' }[value] ?? value} pot`;
}

/**
 * @param {string} history — historyString() of infosetKey.js
 * @param {number} round — the round of the decision
 * @param {0|1} player — who decides
 * @returns {string} what happened this round before the decision
 */
export function describeHistory(history, round, player) {
  const said = replayHistory(history)
    .filter((step) => step.round === round)
    .map(({ player: p, option, facing }) => {
      const me = p === player;
      const who = me ? 'tu' : 'l’adversaire';
      let verb;
      if (option.type === 'fold') verb = me ? 'te couches' : 'se couche';
      else if (option.type === 'call') verb = facing ? (me ? 'suis' : 'suit') : (me ? 'checkes' : 'checke');
      else {
        const size = sizeWords(option.spec);
        if (!size) verb = me ? 'fais tapis' : 'fait tapis';
        else if (facing && !(round === 0 && option.spec.kind === 'bb')) verb = `${me ? 'relances' : 'relance'} ${size}`;
        else verb = `${round === 0 ? (me ? 'relances' : 'relance') : (me ? 'mises' : 'mise')} ${size}`;
      }
      return `${who} ${verb}`;
    });
  if (!said.length) return `${STREETS[round]}, tu parles en premier.`;
  return `${STREETS[round]}, ${said.join(', ')}.`;
}
