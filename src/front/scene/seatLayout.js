/**
 * seatLayout.js — Where each player's things go on the felt
 *
 * Seat 0 is the player (far end, facing the dealer); the AIs follow
 * clockwise, starting on the player's left. Coordinates are (x, z) on the
 * felt; Y comes from the table's felt height.
 */

// Hand-placed on the felt (a stadium of about x ±3.1, z ±0.98, round ends).
//   cards    — hole cards, facing the centre
//   stack    — the seat's chips; piles line up along stackDir
//   bet      — chips put in this betting round
//   chair    — the chair on the floor (room/Chairs.js places them all), where
//              the opponent's character sits; rot = its yaw (front = local +z).
//              Side chairs are spread out so, from the player's seat, the near
//              ones don't hide the middle ones.
const PLAYER_SEAT = {
  cards: { x: 0.0, z: -0.75 },
  stack: { x: -0.62, z: -0.78 }, stackDir: { x: -1, z: 0 },
  bet:   { x: 0.0, z: -0.38 },
  chair: { x: 0.0, z: -3.4, rot: 0 },
};

// Opponent seats, clockwise from the player's left (+x).
const OPPONENT_SEATS = {
  nearLeft:  { cards: { x:  2.0,  z: -0.6  }, stack: { x:  1.2,  z: -0.8  }, stackDir: { x:  1, z: 0 }, bet: { x:  1.57, z: -0.45 }, chair: { x:  4.1, z: -2.3, rot: -1.06 } },
  midLeft:   { cards: { x:  2.65, z:  0.15 }, stack: { x:  2.25, z:  0.66 }, stackDir: { x:  1, z: 0 }, bet: { x:  2.2,  z:  0.08 }, chair: { x:  4.4, z:  1.0, rot: -1.75 } },
  midRight:  { cards: { x: -2.65, z:  0.15 }, stack: { x: -2.25, z:  0.66 }, stackDir: { x: -1, z: 0 }, bet: { x: -2.2,  z:  0.08 }, chair: { x: -4.4, z:  1.0, rot:  1.75 } },
  nearRight: { cards: { x: -2.0,  z: -0.6  }, stack: { x: -1.3,  z: -0.8  }, stackDir: { x: -1, z: 0 }, bet: { x: -1.57, z: -0.45 }, chair: { x: -4.1, z: -2.3, rot:  1.06 } },
};

export const PLAYER_SPOT = PLAYER_SEAT.cards;

/** Every chair around the table: the player's, then the four opponent seats. */
export const CHAIRS = [PLAYER_SEAT.chair, ...Object.values(OPPONENT_SEATS).map((s) => s.chair)];

// Which chairs are used for 1..4 opponents (kept in clockwise order).
const SEATS_BY_COUNT = {
  1: ['midLeft'],
  2: ['midLeft', 'midRight'],
  3: ['nearLeft', 'midLeft', 'midRight'],
  4: ['nearLeft', 'midLeft', 'midRight', 'nearRight'],
};

export const DECK_SPOT = { x: 0.9, z: 0.75 };  // dealer's right, in front of the tray
export const POT_SPOT  = { x: -0.35, z: 0.5 }; // dealer's left, behind the board

/** Card spots for the player and `opponentCount` AIs, in seat order. */
export function seatSpots(opponentCount) {
  return seatLayouts(opponentCount).map((l) => l.cards);
}

/** Full layout (cards, stack, bet) of the player and `opponentCount` AIs, in seat order. */
export function seatLayouts(opponentCount) {
  const opponents = (SEATS_BY_COUNT[opponentCount] ?? []).map((k) => OPPONENT_SEATS[k]);
  return [PLAYER_SEAT, ...opponents].map((l) => ({ ...l, yaw: yawTowardCentre(l.cards) }));
}

/** Yaw that points an object's top from `spot` toward the table centre. */
export function yawTowardCentre({ x, z }) {
  return Math.atan2(x, z);
}

/**
 * Directions for a seat, as unit (x, z) vectors.
 *   toCentre — from the seat toward the middle of the table
 *   left     — the seated player's left
 */
export function seatFrame({ x, z }) {
  const len = Math.hypot(x, z) || 1;
  const toCentre = { x: -x / len, z: -z / len };
  const left = { x: toCentre.z, z: -toCentre.x };
  return { toCentre, left };
}
