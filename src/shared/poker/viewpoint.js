/**
 * viewpoint.js — A table seen from one player's seat
 *
 * Everything downstream of the engine assumes "the player is seat 0": the 3D
 * table (front/game/TableController.js), the hand recorder and its hero
 * numbers (shared/stats/handRecord.js), the statistics, the solver comparison
 * (playerInfosets: seat 0). At a shared table there are several players, so
 * the server turns the table for each of them: seat `me` becomes 0, the next
 * seat clockwise 1, and so on. Each player's browser, recorder and statistics
 * then work unchanged.
 *
 *   rotateEvent(event, me, n)   a PokerGame event, seat numbers turned
 *   viewEvent(event, me, n)     the same, minus what `me` may not see (the
 *                               other players' hole cards at the deal)
 *   rotateRequest(request, me, n)  an agent's decision request (for the solver
 *                               comparison: seat + history turned)
 *
 * `isHuman` becomes "it's me" (seat 0 after turning): the front names that
 * seat "Toi"; the other humans show as opponents, `remote: true`.
 * handEnd.gameOver is computed for `me`: 'lost' (my stack is 0), 'won' (every
 * other stack is 0), otherwise null — even while the table goes on.
 */

/** Seat `seat` as seen from `me` at a table of `n` seats. */
export function rotateSeat(seat, me, n) {
  return seat == null || seat < 0 ? seat : (seat - me + n) % n;
}

/** A per-seat array, starting at `me`. */
export function rotateArray(arr, me) {
  return [...arr.slice(me), ...arr.slice(0, me)];
}

const turnSeats = (seats, me, n) => seats.map((s) => rotateSeat(s, me, n));

/** 'lost' / 'won' / null for the player at seat 0 of turned stacks. */
export function gameOverFor(stacks) {
  if (stacks[0] <= 0) return 'lost';
  if (stacks.slice(1).every((s) => s <= 0)) return 'won';
  return null;
}

function rotatePots(pots, me, n) {
  return pots?.map((p) => ({ ...p, winners: turnSeats(p.winners, me, n), eligible: turnSeats(p.eligible, me, n) }));
}

function rotateResult(result, me, n) {
  if (!result) return result;
  if (result.type === 'uncontested') {
    return { ...result, seat: rotateSeat(result.seat, me, n), lastFold: rotateSeat(result.lastFold, me, n) };
  }
  const hands = Object.fromEntries(Object.entries(result.hands ?? {}).map(([s, h]) => [rotateSeat(Number(s), me, n), h]));
  return { ...result, pots: rotatePots(result.pots, me, n), hands };
}

/**
 * A PokerGame event with every seat number turned so that `me` is seat 0.
 * Nothing is hidden: the server's recorder for `me` uses this one.
 */
export function rotateEvent(e, me, n) {
  const seat = (s) => rotateSeat(s, me, n);
  switch (e.type) {
    case 'handStart':
      return {
        ...e,
        button: seat(e.button),
        sb: seat(e.sb),
        bb: seat(e.bb),
        seats: rotateArray(e.seats, me).map((s) => {
          const index = seat(s.index);
          return { ...s, index, isHuman: index === 0, remote: Boolean(s.isHuman) && index !== 0 };
        }),
      };
    case 'deal':
      return { ...e, hole: rotateArray(e.hole, me) };
    case 'blind':
    case 'action':
      return { ...e, seat: seat(e.seat) };
    case 'turn':
      return { ...e, seat: seat(e.seat), isHuman: seat(e.seat) === 0 };
    case 'win':
      return { ...e, seat: seat(e.seat), lastFold: seat(e.lastFold) };
    case 'showdown':
      return {
        ...e,
        reveals: e.reveals.map((r) => ({ ...r, seat: seat(r.seat) })),
        pots: rotatePots(e.pots, me, n),
        winnings: e.winnings.map((w) => ({ ...w, seat: seat(w.seat) })),
      };
    case 'handEnd': {
      const stacks = rotateArray(e.stacks, me);
      return { ...e, stacks, result: rotateResult(e.result, me, n), gameOver: gameOverFor(stacks) };
    }
    default:
      return e; // street, roundEnd: no seat
  }
}

/** What `me` may see: the turned event, the other players' hole cards hidden at the deal. */
export function viewEvent(e, me, n) {
  const turned = rotateEvent(e, me, n);
  if (turned.type !== 'deal') return turned;
  return { ...turned, hole: turned.hole.map((cards, s) => (s === 0 && cards ? [...cards] : null)) };
}

/** An agent's decision request seen from `me` (seat and history turned). */
export function rotateRequest(request, me, n) {
  return {
    ...request,
    seat: rotateSeat(request.seat, me, n),
    history: request.history.map((street) => street.map((a) => ({ ...a, seat: rotateSeat(a.seat, me, n) }))),
  };
}
