/**
 * rangePresets.js — The ranges the range chart can show (ui/ranges/)
 *
 * Human ranges are written in the usual notation (shared/poker/ranges.js) and
 * are classic, rounded teaching ranges — not solver-exact. The AI's ranges
 * are read from the MCCFR strategy when it's loaded (`solver` = the spot in
 * shared/ai/preflopRanges.js).
 *
 * The heads-up ranges come from shared/theory/huRanges.js: the same ones the
 * preflop theory model uses as the opponent (one source of truth).
 *
 * To add a range: one more entry. `actions` in display order (the first one
 * wins where two notations overlap); hands in none of them get the last action.
 */

import { SB_OPEN, BB_VS_OPEN } from '../../shared/theory/huRanges.js';

/** Action look: colours stay readable with dark text on top. */
export const ACTIONS = {
  raise: { label: 'Relancer', short: 'Relance', color: '#e8503a' },
  threebet: { label: 'Sur-relancer (3-bet)', short: '3-bet', color: '#e8503a' },
  call: { label: 'Suivre', short: 'Suit', color: '#43b04a' },
  check: { label: 'Checker', short: 'Check', color: '#43b04a' },
  callcheck: { label: 'Suivre ou checker', short: 'Suit/check', color: '#43b04a' },
  limp: { label: 'Compléter (limp)', short: 'Limp', color: '#3f9fd8' },
  fold: { label: 'Se coucher', short: 'Couché', color: '#4a4f5c' },
};

/**
 * @typedef {object} RangePreset
 * @property {string} id
 * @property {string} group      — heading in the list
 * @property {string} name
 * @property {string} situation  — who, where, facing what (one line)
 * @property {string} lesson     — what to notice (a few sentences)
 * @property {string[]} actions  — ids from ACTIONS, the last = the rest
 * @property {Record<string, string>} [notation]  — action → hands
 * @property {string} [solver]   — SOLVER_SPOTS key: the AI's real range
 * @property {Record<string, string>} [solverActions]  — solver fold/call/raise → our action ids
 */

/** @type {RangePreset[]} */
export const RANGE_PRESETS = [
  {
    id: 'premium',
    group: 'Pour commencer',
    name: 'Les mains premium',
    situation: 'Les meilleures mains du poker, jouables de n’importe quelle place.',
    lesson: 'Seulement 5 types de mains, soit 2,6 % des donnes : tu les recevras environ une fois toutes les 39 mains. '
      + 'Avec elles, on relance presque toujours. Remarque que AKo pèse 3 fois plus que AKs : il y a 12 façons de '
      + 'l’avoir dépareillé, contre 4 assorti.',
    actions: ['raise', 'fold'],
    notation: { raise: 'QQ+, AK' },
  },
  {
    id: 'utg',
    group: 'Ouvrir le pot (6 joueurs)',
    name: 'Premier de parole (UTG)',
    situation: 'Table de 6, tu parles en premier avant le flop : 5 joueurs parlent après toi.',
    lesson: 'Avec autant de monde derrière, quelqu’un a souvent une grosse main : on ouvre serré, environ 14 % des mains. '
      + 'On garde les paires, les as assortis (pour la couleur), les grosses cartes, et quelques connecteurs assortis.',
    actions: ['raise', 'fold'],
    notation: { raise: '55+, A2s+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo' },
  },
  {
    id: 'button',
    group: 'Ouvrir le pot (6 joueurs)',
    name: 'Au bouton',
    situation: 'Table de 6, tout le monde s’est couché jusqu’à toi, au bouton : seules les deux blindes restent.',
    lesson: 'Le bouton parle en dernier après le flop : c’est la meilleure place. On ouvre donc un peu plus de 40 % des mains. '
      + 'Compare avec « Premier de parole » : même joueur, mêmes cartes, mais la position change tout.',
    actions: ['raise', 'fold'],
    notation: {
      raise: '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 86s+, 75s+, 64s+, 54s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o',
    },
  },
  {
    id: 'bb-defense',
    group: 'Répondre à une relance',
    name: 'Grosse blinde contre le bouton',
    situation: 'Le bouton relance à 2,5 grosses blindes, la petite blinde se couche. Tu es grosse blinde.',
    lesson: 'Trois choix. Tu as déjà mis 1 grosse blinde et le bouton relance souvent avec des mains faibles : '
      + 'on défend beaucoup en suivant. On sur-relance les très grosses mains, et aussi quelques petites mains '
      + 'assorties (A5s, 76s…) pour ne pas être prévisible : si on ne sur-relançait qu’avec des monstres, '
      + 'l’adversaire le saurait.',
    actions: ['threebet', 'call', 'fold'],
    notation: {
      threebet: 'TT+, AQs+, AKo, A5s-A4s, K9s, 76s, 65s',
      call: '22-99, A2s-AJs, K2s-KTs, Q6s+, J7s+, T7s+, 97s+, 86s+, 75s+, 64s+, 53s+, 43s, A2o-AQo, K7o+, Q8o+, J8o+, T8o+, 98o, 87o',
    },
  },
  {
    id: 'hu-sb',
    group: 'Tête-à-tête (comme dans le jeu)',
    name: 'Petite blinde en tête-à-tête',
    situation: 'À deux joueurs, tu es au bouton, donc petite blinde, et tu parles en premier avant le flop.',
    lesson: 'À deux, n’importe quelle main moyenne a de bonnes chances d’être meilleure que celle de l’adversaire. '
      + 'Les joueurs forts ouvrent donc les trois quarts des mains, voire plus. Seules les pires mains dépareillées se couchent.',
    actions: ['raise', 'fold'],
    notation: SB_OPEN,
  },
  {
    id: 'hu-bb-defense',
    group: 'Tête-à-tête (comme dans le jeu)',
    name: 'Grosse blinde en tête-à-tête face à une relance',
    situation: 'À deux joueurs, la petite blinde (au bouton) relance à 2,5 grosses blindes. Tu es grosse blinde.',
    lesson: 'Tu as déjà mis 1 grosse blinde et l’adversaire ouvre très large : il ne reste que 1,5 BB à payer '
      + 'pour un pot de 5 BB. On défend donc environ deux mains sur trois, surtout en suivant. On sur-relance les '
      + 'grosses mains et quelques petites mains assorties (A5s, 76s…) pour rester imprévisible. Seules les pires '
      + 'mains dépareillées se couchent.',
    actions: ['threebet', 'call', 'fold'],
    notation: BB_VS_OPEN,
  },
  {
    id: 'ai-sb',
    group: 'La vraie range de notre IA',
    name: 'IA en petite blinde',
    situation: 'Notre IA (MCCFR), petite blinde, parle la première avant le flop.',
    lesson: 'Voici ce que le solveur a appris. Les couleurs mélangées sont des fréquences : '
      + 'avec la même main, l’IA choisit au hasard, dans ces proportions, pour rester imprévisible. '
      + 'Elle ouvre à 2 ou 2,5 grosses blindes (les deux tailles additionnées en « relancer ») ou complète (limp) : '
      + 'compléter ne coûte qu’une petite blinde pour un pot de 3, alors elle se couche rarement et joue ses mains faibles en limp. '
      + 'Compare avec « Petite blinde en tête-à-tête ».',
    actions: ['raise', 'limp', 'fold'],
    solver: 'sbOpen',
    solverActions: { raise: 'raise', call: 'limp', fold: 'fold' },
  },
  {
    id: 'ai-bb-limp',
    group: 'La vraie range de notre IA',
    name: 'IA en grosse blinde face à un limp',
    situation: 'La petite blinde a seulement complété (limp). Notre IA, grosse blinde, peut checker ou relancer.',
    lesson: 'Se coucher n’a aucun sens ici (checker est gratuit), donc pas de gris. L’IA relance ses bonnes mains '
      + 'pour grossir le pot et checke les mauvaises pour voir le flop gratuitement.',
    actions: ['raise', 'check', 'fold'],
    solver: 'bbVsLimp',
    solverActions: { raise: 'raise', call: 'check', fold: 'fold' },
  },
  {
    id: 'ai-bb-raise',
    group: 'La vraie range de notre IA',
    name: 'IA en grosse blinde face à une relance',
    situation: 'La petite blinde a relancé à 2,5 grosses blindes. Notre IA, grosse blinde, peut se coucher, suivre ou sur-relancer.',
    lesson: 'Elle défend beaucoup de mains en suivant (le prix est bon : 1,5 grosse blinde de plus pour un pot de 5), '
      + 'se couche avec les pires, et sur-relance ses meilleures. Regarde lesquelles elle mélange.',
    actions: ['threebet', 'call', 'fold'],
    solver: 'bbVsRaise',
    solverActions: { raise: 'threebet', call: 'call', fold: 'fold' },
  },
];
