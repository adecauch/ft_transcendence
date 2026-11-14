/**
 * service.js — Starting a game, saving a hand, ending a game
 *
 * saveHand() is the heart of it:
 *   1. replay the hand's log from the game's stored state (src/shared/stats/replay.js):
 *      anything illegal → ReplayError (the route answers 422);
 *   2. in ONE transaction: move the game's state forward (only if nobody saved
 *      this hand meanwhile), store the hand and every action;
 *   3. test the achievements and store the new ones.
 * Results (stacks, winners, pot) always come from the replay, never from the browser.
 * The replay's `decisions` are returned too, for the player's infosets
 * (stats/infosets.js) — filed by the route, not here: one job per service.
 */

import { replayHand } from '../../../src/shared/stats/replay.js';
import { newlyUnlocked } from '../../../src/shared/stats/achievements.js';
import { playerTotals } from '../stats/totals.js';

export class HandConflict extends Error {}

const STATUS = { won: 'WON', lost: 'LOST' };

/** Seats as the engine sees them: the player first (named after the account), then the AIs. */
export function seatsOf(game, user) {
  return [
    { name: user.username, isHuman: true },
    ...game.opponents.map((o) => ({ name: o.name, isHuman: false, level: o.level })),
  ];
}

/** New game; a game left PLAYING (browser closed) counts as quit. */
export async function startGame(prisma, user, { opponents, startingStack, blinds }) {
  const [, game] = await prisma.$transaction([
    prisma.game.updateMany({
      where: { userId: user.id, status: 'PLAYING' },
      data: { status: 'QUIT', endedAt: new Date() },
    }),
    prisma.game.create({
      data: {
        userId: user.id,
        opponents,
        startingStack,
        smallBlind: blinds.small,
        bigBlind: blinds.big,
        stacks: Array(opponents.length + 1).fill(startingStack),
      },
    }),
  ]);
  return game;
}

/**
 * @returns {Promise<{ hand: object, game: object, achievements: string[], decisions: object[] }>}
 * @throws ReplayError (illegal log) · HandConflict (hand already saved / out of order)
 */
export async function saveHand(prisma, user, game, log) {
  const state = {
    players: seatsOf(game, user),
    blinds: { small: game.smallBlind, big: game.bigBlind },
    stacks: game.stacks,
    button: game.button,
    handNo: game.handsPlayed,
  };
  const { record, decisions, stacks, button, handNo, gameOver } = await replayHand(state, log);
  const status = STATUS[gameOver] ?? 'PLAYING';
  const ended = status !== 'PLAYING';
  const { hero } = record;

  const [updated] = await prisma.$transaction(async (tx) => {
    // Only from the state we replayed from: a hand sent twice changes nothing
    const moved = await tx.game.updateMany({
      where: { id: game.id, status: 'PLAYING', handsPlayed: game.handsPlayed },
      data: {
        stacks, button, handsPlayed: handNo, status,
        ...(ended && { endedAt: new Date(), finalStack: stacks[0] }),
      },
    });
    if (moved.count !== 1) throw new HandConflict('Cette main a déjà été enregistrée');

    await tx.hand.create({
      data: {
        gameId: game.id,
        number: record.number,
        button: record.button,
        sb: record.sb,
        bb: record.bb,
        board: record.board,
        pot: record.pot,
        result: record.result,
        players: record.players,
        heroHole: hero.hole ?? [],
        heroNet: hero.net,
        heroCollected: hero.collected,
        heroVpip: hero.vpip,
        heroPfr: hero.pfr,
        heroAllIn: hero.allIn,
        heroShowdown: hero.showdown,
        heroShowdownWon: hero.showdownWon,
        heroHandName: hero.handName,
        actions: { create: record.actions.map((a, seq) => ({ seq, ...a })) },
      },
    });
    return [await tx.game.findUnique({ where: { id: game.id } })];
  });

  const achievements = await unlockAchievements(prisma, user.id, {
    hand: record,
    game: { status, opponents: game.opponents, bigBlind: game.bigBlind },
  });

  return {
    hand: { number: record.number, net: hero.net, pot: record.pot, result: record.result },
    game: publicGame(updated),
    achievements,
    decisions,
  };
}

/**
 * Save a hand that was played by the server's own PokerGame.
 *
 * Unlike saveHand(), this path does not replay a client log: `record`, stacks,
 * button and gameOver all come from the authoritative engine session.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} user
 * @param {object} game
 * @param {object} record HandRecorder.record
 * @param {{ stacks: number[], button: number, gameOver: string|null }} state
 * @returns {Promise<{ hand: object, game: object, achievements: string[], dbGame: object }>}
 */
export async function saveServerHand(prisma, user, game, record, { stacks, button, gameOver }) {
  const status = STATUS[gameOver] ?? 'PLAYING';
  const ended = status !== 'PLAYING';
  const { hero } = record;
  const [updated] = await prisma.$transaction(async (tx) => {
    const moved = await tx.game.updateMany({
      where: { id: game.id, status: 'PLAYING', handsPlayed: game.handsPlayed },
      data: {
        stacks, button, handsPlayed: record.number, status,
        ...(ended && { endedAt: new Date(), finalStack: stacks[0] }),
      },
    });
    if (moved.count !== 1) throw new HandConflict('Cette main a déjà été enregistrée');

    await tx.hand.create({
      data: {
        gameId: game.id,
        number: record.number,
        button: record.button,
        sb: record.sb,
        bb: record.bb,
        board: record.board,
        pot: record.pot,
        result: record.result,
        players: record.players,
        heroHole: hero.hole ?? [],
        heroNet: hero.net,
        heroCollected: hero.collected,
        heroVpip: hero.vpip,
        heroPfr: hero.pfr,
        heroAllIn: hero.allIn,
        heroShowdown: hero.showdown,
        heroShowdownWon: hero.showdownWon,
        heroHandName: hero.handName,
        actions: { create: record.actions.map((action, seq) => ({ seq, ...action })) },
      },
    });
    return [await tx.game.findUnique({ where: { id: game.id } })];
  });

  const achievements = await unlockAchievements(prisma, user.id, {
    hand: record,
    game: { status, opponents: game.opponents, bigBlind: game.bigBlind },
  });
  return {
    hand: { number: record.number, net: hero.net, pot: record.pot, result: record.result },
    game: publicGame(updated),
    achievements,
    dbGame: updated,
  };
}

/** Test every achievement not yet unlocked; store and return the new ones' ids. */
export async function unlockAchievements(prisma, userId, { hand, game }) {
  const [totals, have] = await Promise.all([
    playerTotals(prisma, userId),
    prisma.userAchievement.findMany({ where: { userId }, select: { code: true } }),
  ]);
  const fresh = newlyUnlocked({ totals, hand, game }, have.map((a) => a.code));
  if (fresh.length) {
    await prisma.userAchievement.createMany({ data: fresh.map((code) => ({ userId, code })), skipDuplicates: true });
  }
  return fresh;
}

export async function quitGame(prisma, game) {
  await prisma.game.updateMany({
    where: { id: game.id, status: 'PLAYING' },
    data: { status: 'QUIT', endedAt: new Date(), finalStack: game.stacks[0] },
  });
}

/** A game as the API shows it. */
export function publicGame(g) {
  const finalStack = g.finalStack ?? g.stacks[0];
  return {
    id: g.id,
    status: g.status,
    opponents: g.opponents,
    startingStack: g.startingStack,
    blinds: { small: g.smallBlind, big: g.bigBlind },
    handsPlayed: g.handsPlayed,
    stack: finalStack,
    net: finalStack - g.startingStack,
    startedAt: g.startedAt,
    endedAt: g.endedAt,
  };
}

/**
 * A hand as the history shows it. The AIs' cards are hidden unless they were
 * shown at the showdown: the history doesn't reveal what the player couldn't see.
 */
export function publicHand(h) {
  return {
    number: h.number,
    button: h.button,
    sb: h.sb,
    bb: h.bb,
    board: h.board,
    pot: h.pot,
    result: h.result,
    net: h.heroNet,
    handName: h.heroHandName,
    playedAt: h.playedAt,
    players: h.players.map((p) => ({ ...p, hole: p.seat === 0 || p.showed ? p.hole : null })),
    actions: h.actions.map(({ street, seat, type, amount, betTo, potAfter, allIn }) => ({ street, seat, type, amount, betTo, potAfter, allIn })),
  };
}
