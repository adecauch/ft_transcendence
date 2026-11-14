/**
 * preferences.js — The player's display options (pause menu → Options)
 *
 * Adding an option = adding an entry here: the Options page draws one row of
 * buttons per entry (ui/pause/OptionsPanel.js), the choice is remembered in the
 * browser (ui/preferences.js), and the code that needs it reads it with
 * getPref(id) / onPrefChange().
 *
 * @typedef {object} Preference
 * @property {string} id
 * @property {string} label       — row title
 * @property {string} [hint]      — one line under the buttons
 * @property {string} [key]       — in-game keyboard shortcut: next choice
 * @property {{ value: string, label: string }[]} choices — the first one is the default
 */

/** @type {Preference[]} */
export const PREFERENCES = [
  {
    id: 'chipUnit',
    label: 'Montants',
    hint: 'Tapis, mises, pot et relances.',
    key: 'B',
    choices: [
      { value: 'chips', label: 'En jetons' },
      { value: 'bb',    label: 'En grosses blindes (BB)' },
    ],
  },
];
