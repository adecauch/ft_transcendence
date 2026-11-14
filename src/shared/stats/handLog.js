/**
 * handLog.js — The short log of a hand: what's needed to replay it
 *
 * The browser plays the game (for now) and sends this log to the server after
 * each hand. It holds only the inputs of the hand — the cards dealt and each
 * decision — never results: the server replays the hand with the same engine
 * (replay.js) and computes stacks, pots and winners itself.
 *
 *   {
 *     handNo: 3,
 *     hole:  [['AS','KD'], ['7H','7C'], null],   // per seat, null = seat out
 *     board: ['2S','9D','TC','QH'],              // cards dealt, 0 / 3 / 4 / 5
 *     actions: [                                 // in order, blinds excluded
 *       { seat: 1, street: 0, type: 'raise', to: 60 },
 *       { seat: 0, street: 0, type: 'call' },
 *       { seat: 0, street: 1, type: 'check' },
 *       …                                        // type: fold | check | call | raise
 *     ],
 *   }
 *
 *   const logger = new HandLogger();
 *   onEvent: (e) => { const log = logger.event(e); if (log) send(log); }
 */

export class HandLogger {
  constructor() {
    /** The hand in progress */
    this.log = null;
  }

  /**
   * Feed every PokerGame event, in order.
   * @returns {object | null} the finished log on `handEnd`, otherwise null
   */
  event(e) {
    switch (e.type) {
      case 'handStart':
        this.log = { handNo: e.handNo, hole: [], board: [], actions: [] };
        break;
      case 'deal':
        this.log.hole = e.hole.map((h) => (h ? [...h] : null));
        break;
      case 'street':
        this.log.board.push(...e.cards);
        break;
      case 'action': {
        // A call of nothing is a check
        const type = e.action.type === 'call' && e.paid === 0 ? 'check' : e.action.type;
        const action = { seat: e.seat, street: e.street, type };
        if (type === 'raise') action.to = e.action.to;
        this.log.actions.push(action);
        break;
      }
      case 'handEnd': {
        const log = this.log;
        this.log = null;
        return log;
      }
      default:
        break;
    }
    return null;
  }
}
