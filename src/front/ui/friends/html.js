/**
 * html.js — Small pieces shared by the friends tabs: a player's status,
 * "il y a 2 h", one player row.
 */

import { esc } from '../stats/format.js';

export { esc };

/** Status → [dot class, French label] */
export const STATUS = {
  online:  ['online', 'En ligne'],
  playing: ['playing', 'En partie'],
  offline: ['offline', 'Hors ligne'],
};

/** "à l'instant", "il y a 5 min", "il y a 2 h", "il y a 3 j" */
export function ago(iso) {
  const minutes = Math.round((Date.now() - new Date(iso)) / 60_000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 24 * 60) return `il y a ${Math.round(minutes / 60)} h`;
  return `il y a ${Math.round(minutes / (24 * 60))} j`;
}

/** A friend's status line: "En ligne", "En partie", "Vu il y a 2 h". */
export function statusText(friend) {
  if (friend.status !== 'offline') return STATUS[friend.status][1];
  return friend.lastSeen ? `Vu ${ago(friend.lastSeen)}` : 'Hors ligne';
}

/**
 * One row: dot + name#tag + line under it, buttons on the right.
 * @param {{ name: string, tag?: number, sub: string, dot?: string, buttons: string, cls?: string }} row
 */
export function rowHtml({ name, tag, sub, dot = '', buttons, cls = '' }) {
  return `
    <li class="friend-row ${cls}">
      ${dot ? `<span class="friend-dot friend-dot--${dot}" aria-hidden="true"></span>` : ''}
      <span class="friend-who">
        <span class="friend-name">${esc(name)}${tag ? `<span class="friend-tag">#${tag}</span>` : ''}</span>
        <span class="friend-sub">${esc(sub)}</span>
      </span>
      <span class="friend-actions">${buttons}</span>
    </li>`;
}

/** A section title with its count. */
export const sectionHtml = (title, n) => `<h3>${esc(title)} <span class="dim">(${n})</span></h3>`;
