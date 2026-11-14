/**
 * handHtml.js — One saved hand, told street by street (history tab)
 *
 * The summary line: hand number, the player's cards, the board, the pot and
 * the result. Opened (<details>): every move in French ("Tu relances à 60",
 * "Le Baron suit 60"), the cards the AIs showed, who won what.
 * The data is publicHand() of server/src/games/service.js.
 */

import { esc, fmt, signed, netClass, cardsHtml, STREETS } from '../format.js';

/**
 * @param {object} h — one hand from GET /api/games/:id
 * @param {string[]} names — by seat: 'Toi', then the AIs
 */
export function handHtml(h, names) {
  const hero = h.players[0];
  const outcome = h.handName ? ` · ${esc(h.handName)}` : hero.folded ? ' · couché' : '';
  const who = (seat) => esc(names[seat] ?? `Siège ${seat}`);
  return `
    <details class="row hand">
      <summary>
        <span class="row-main">
          <span class="row-title">Main ${h.number}</span> ${cardsHtml(hero.hole)}
          <span class="dim">board</span> ${cardsHtml(h.board)}<br>
          <span class="row-sub">Pot ${fmt(h.pot)}${outcome}</span>
        </span>
        <span class="row-net ${netClass(h.net)}">${signed(h.net)}</span>
      </summary>
      <div class="moves">
        ${streetsHtml(h, who)}
        ${showdownHtml(h, who)}
      </div>
    </details>`;
}

/** The moves, grouped by street, with the board cards dealt on that street. */
function streetsHtml(h, who) {
  const byStreet = STREETS.map(() => []);
  for (const a of h.actions) byStreet[a.street].push(a);
  const boardAt = [[], h.board.slice(0, 3), h.board.slice(3, 4), h.board.slice(4, 5)];
  return byStreet.map((moves, s) => (moves.length || boardAt[s].length ? `
    <div>
      <div class="moves-street">${STREETS[s]} ${s ? cardsHtml(boardAt[s]) : ''}</div>
      <ul class="moves-list">${moves.map((a) => `<li>${moveText(a, h, who)}</li>`).join('')}</ul>
    </div>` : '')).join('');
}

/** One move in words: the player is "Tu" (tu paies, tu suis…), an AI by name (il paie…). */
function moveText(a, h, who) {
  const me = a.seat === 0;
  const v = (tu, il) => `${me ? 'Tu' : who(a.seat)} ${me ? tu : il}`;
  const allIn = a.allIn ? ' (tapis)' : '';
  switch (a.type) {
    case 'blind': return `${v('paies', 'paie')} la ${a.seat === h.sb ? 'petite' : 'grosse'} blinde : ${fmt(a.amount)}${allIn}`;
    case 'fold': return v('te couches', 'se couche');
    case 'check': return v('checkes', 'checke');
    case 'call': return `${v('suis', 'suit')} ${fmt(a.amount)}${allIn}`;
    case 'bet': return `${v('mises', 'mise')} ${fmt(a.betTo)}${allIn}`;
    default: return `${v('relances', 'relance')} à ${fmt(a.betTo)}${allIn}`;
  }
}

/** The AIs' cards shown at showdown, then who collected what. */
function showdownHtml(h, who) {
  const shown = h.players.filter((p) => p.seat > 0 && p.hole)
    .map((p) => `${who(p.seat)} montre ${cardsHtml(p.hole)}${p.handName ? ` (${esc(p.handName.toLowerCase())})` : ''}`);
  const winners = h.players.filter((p) => p.collected > 0)
    .map((p) => (p.seat === 0 ? `Tu remportes ${fmt(p.collected)}` : `${who(p.seat)} remporte ${fmt(p.collected)}`));
  return `${shown.length ? `<div>${shown.join('<br>')}</div>` : ''}
    <div class="moves-end">${winners.join(' · ')}</div>`;
}
