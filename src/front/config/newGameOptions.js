/**
 * newGameOptions.js — Game configuration
 *
 * @typedef {{ id: string, label: string, icon: string, data: object }} Section
 * @typedef {{ id: string, label: string, hint: string }} Level
 * @typedef {{ name: string, level: string }} OpponentConfig
 * @typedef {{ opponents: OpponentConfig[], startingStack: number, blinds: { small: number, big: number } }} GameConfig
 */

/** AI difficulty levels, from easiest to hardest. */
export const LEVELS = [
  { id: 'beginner', label: 'Débutant', hint: 'Joue beaucoup de mains, bluffe rarement' },
  { id: 'regular',  label: 'Confirmé', hint: 'Solide, suit les cotes du pot' },
  { id: 'expert',   label: 'Expert',   hint: 'Agressif, lit les mises et bluffe' },
];

/** Seats around the table minus the player's and the dealer's (see Chairs.js). */
export const MAX_OPPONENTS = 4;

/** AI names, assigned to seats in order. */
export const OPPONENT_NAMES = ['Le Baron', 'Lucky Lou', 'Madame Rouge', 'Doc Holliday'];

export const STACK_OPTIONS = [500, 1000, 2000, 5000];

export const BLIND_OPTIONS = [
  { small: 5,  big: 10 },
  { small: 10, big: 20 },
  { small: 25, big: 50 },
];

/** @type {GameConfig} */
export const DEFAULT_CONFIG = {
  // Heads-up by default: the MCCFR strategy was trained for one opponent
  opponents: OPPONENT_NAMES.slice(0, 1).map((name) => ({ name, level: 'regular' })),
  startingStack: 1000,
  blinds: BLIND_OPTIONS[1],
};

/** The single card on the table: clicking it opens the new-game menu. */
export const START_SECTION = {
  id:    'start',
  label: 'Nouvelle partie',
  icon:  '♠',
  data:  {},
};

/** The invitation card next to it: playing against other players. */
export const ONLINE_SECTION = {
  id:    'online',
  label: 'Table en ligne',
  icon:  '✉️',
  data:  {},
};
