/**
 * handRecord.js — Everything that happened in a hand, for the database
 *
 * Built from the PokerGame events while the server replays a hand
 * (replay.js). This is what the history shows and what the statistics and
 * achievements are computed from:
 *
 *   number, button, sb, bb      hand number, positions (seat indexes)
 *   board                       community cards
 *   pot                         every chip put in
 *   result                      'uncontested' (all folded) | 'showdown'
 *   players[]                   per seat: name, stacks before / after, hole
 *                               cards, folded, showed, hand name, collected
 *   actions[]                   every chip move and decision, blinds included:
 *                               { street, seat, type, amount, betTo, potAfter, allIn }
 *                               type: blind | fold | check | call | bet | raise
 *   hero                        the player's (seat 0) numbers for the stats:
 *                               net, collected, vpip, pfr, allIn, showdown,
 *                               showdownWon, handName, handCategory
 *
 * Hand categories (handEvaluator.js): 0 high card … 7 quads, 8 straight flush.
 */

const CATEGORY = 13 ** 5; // score = category * 13^5 + tie-breakers
const HERO = 0;

export class HandRecorder {
  constructor() {
    this.record = null;
  }

  /** Feed every PokerGame event, in order. */
  event(e) {
    const r = this.record;
    switch (e.type) {
      case 'handStart':
        this.record = {
          number: e.handNo, button: e.button, sb: e.sb, bb: e.bb,
          board: [], pot: 0, result: null, actions: [], hero: null,
          players: e.seats.map((s) => ({
            seat: s.index, name: s.name, isHuman: s.isHuman, out: s.out,
            stackStart: s.stack, stackEnd: s.stack, hole: null,
            folded: s.out, showed: false, handName: null, handCategory: null, collected: 0,
          })),
        };
        break;

      case 'blind':
        r.actions.push({ street: 0, seat: e.seat, type: 'blind', amount: e.amount, betTo: e.bet, potAfter: e.pot, allIn: e.allIn });
        r.pot = e.pot;
        break;

      case 'deal':
        e.hole.forEach((h, seat) => { r.players[seat].hole = h ? [...h] : null; });
        break;

      case 'street':
        r.board = [...e.board];
        break;

      case 'action': {
        let type = e.action.type;
        if (type === 'call' && e.paid === 0) type = 'check';
        if (type === 'raise' && e.isBet) type = 'bet';
        if (type === 'fold') r.players[e.seat].folded = true;
        r.actions.push({ street: e.street, seat: e.seat, type, amount: e.paid, betTo: e.bet, potAfter: e.pot, allIn: e.allIn });
        r.pot = e.pot;
        break;
      }

      case 'win':
        r.result = 'uncontested';
        r.players[e.seat].collected += e.amount;
        break;

      case 'showdown':
        r.result = 'showdown';
        for (const rev of e.reveals) {
          const p = r.players[rev.seat];
          p.showed = true;
          p.handName = rev.hand;
          p.handCategory = Math.floor(rev.score / CATEGORY);
        }
        for (const w of e.winnings) r.players[w.seat].collected += w.amount;
        break;

      case 'handEnd':
        e.stacks.forEach((stack, seat) => { r.players[seat].stackEnd = stack; });
        r.hero = heroFacts(r);
        break;

      default:
        break;
    }
  }
}

/** The player's numbers in a finished hand. */
function heroFacts(r) {
  const p = r.players[HERO];
  const mine = r.actions.filter((a) => a.seat === HERO);
  const preflop = mine.filter((a) => a.street === 0);
  return {
    hole: p.hole,
    net: p.stackEnd - p.stackStart,
    collected: p.collected,
    // Put chips in preflop by choice (blinds don't count)
    vpip: preflop.some((a) => a.type === 'call' || a.type === 'raise' || a.type === 'bet'),
    pfr: preflop.some((a) => a.type === 'raise' || a.type === 'bet'),
    allIn: mine.some((a) => a.allIn),
    showdown: p.showed,
    showdownWon: p.showed && p.collected > 0,
    handName: p.handName,
    handCategory: p.handCategory,
  };
}
