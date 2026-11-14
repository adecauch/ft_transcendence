/**
 * panels.js — Re-exports all section renderers
 *
 * Each export is a function: (section) => HTMLElement
 * The key must match the section `id` in config/newGameOptions.js.
 */

export { renderNewGameMenu as start } from '../newGame/NewGameMenu.js';
export { renderOnlineMenu as online } from '../online/OnlineMenu.js';
