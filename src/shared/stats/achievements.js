/**
 * achievements.js — The achievements ("succès") and when they unlock
 *
 * Shared: the server tests them after every saved hand (server/src/games/),
 * the front lists them (locked ones greyed out) with these names and icons.
 *
 * Each `test(ctx)` gets:
 *   totals — the player's running totals, this hand included:
 *            { games, gamesWon, hands, handsWon, showdownsWon }
 *   hand   — the hand just played (handRecord.js), `hand.hero` = the player's facts
 *   game   — { status: 'PLAYING' | 'WON' | 'LOST', opponents: [{ name, level }], bigBlind }
 * An achievement unlocks once, the first time its test passes.
 */

const won = (hand) => hand.hero.net > 0;

/** @type {{ id: string, icon: string, name: string, description: string, test: (ctx: object) => boolean }[]} */
export const ACHIEVEMENTS = [
  {
    id: 'first_game', icon: '🃏', name: 'Premier pas',
    description: 'Jouer ta première partie',
    test: ({ totals }) => totals.games >= 1,
  },
  {
    id: 'first_pot', icon: '💰', name: 'Premier pot',
    description: 'Remporter une main',
    test: ({ totals }) => totals.handsWon >= 1,
  },
  {
    id: 'cool_head', icon: '🧊', name: 'Sang-froid',
    description: 'Gagner un abattage',
    test: ({ totals }) => totals.showdownsWon >= 1,
  },
  {
    id: 'bluffer', icon: '🎭', name: 'Bluffeur',
    description: 'Miser à la river et voir tout le monde se coucher',
    test: ({ hand }) => hand.result === 'uncontested' && won(hand)
      && hand.actions.some((a) => a.seat === 0 && a.street === 3 && (a.type === 'bet' || a.type === 'raise')),
  },
  {
    id: 'all_in', icon: '🔥', name: 'Tapis !',
    description: 'Faire tapis et remporter la main',
    test: ({ hand }) => hand.hero.allIn && won(hand),
  },
  {
    id: 'big_pot', icon: '🏦', name: 'Gros coup',
    description: "Remporter un pot d'au moins 50 grosses blindes",
    test: ({ hand, game }) => hand.hero.collected >= 50 * game.bigBlind,
  },
  {
    id: 'monster', icon: '👑', name: 'Main de monstre',
    description: 'Gagner un abattage avec un carré ou mieux',
    test: ({ hand }) => hand.hero.showdownWon && hand.hero.handCategory >= 7,
  },
  {
    id: 'sheriff', icon: '⭐', name: 'Shérif',
    description: 'Gagner une partie',
    test: ({ totals }) => totals.gamesWon >= 1,
  },
  {
    id: 'bounty_hunter', icon: '🎯', name: 'Chasseur de primes',
    description: 'Gagner une partie contre une IA Expert',
    test: ({ game }) => game.status === 'WON' && game.opponents.some((o) => o.level === 'expert'),
  },
  {
    id: 'full_table', icon: '🪑', name: 'Table pleine',
    description: 'Gagner une partie contre 4 IA',
    test: ({ game }) => game.status === 'WON' && game.opponents.length >= 4,
  },
  {
    id: 'regular', icon: '🍺', name: 'Habitué du saloon',
    description: 'Jouer 100 mains',
    test: ({ totals }) => totals.hands >= 100,
  },
  {
    id: 'legend', icon: '🤠', name: "Légende de l'Ouest",
    description: 'Gagner 10 parties',
    test: ({ totals }) => totals.gamesWon >= 10,
  },
];

/** Ids of the achievements whose test passes now and that weren't unlocked yet. */
export function newlyUnlocked(ctx, alreadyUnlocked) {
  const have = new Set(alreadyUnlocked);
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.test(ctx)).map((a) => a.id);
}
