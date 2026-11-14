/**
 * service.js — Friends in the database (Friendship table)
 *
 * One row per pair of players: PENDING (a request, requester → addressee), then
 * ACCEPTED (friends, whoever asked). Every query filters on the logged-in
 * player: someone else's request or friendship behaves as if it didn't exist.
 *
 * Statuses (online / at a table / offline) are not here: they live in memory
 * (presence.js) and are added by the caller through `statusOf`.
 */

import { Prisma } from '@prisma/client';
import { parseFriendCode } from '../../../src/shared/auth/rules.js';

export const SEARCH_MAX = 20;

/** A refusal the route turns into an HTTP answer: `status` + French `message`. */
export class FriendRefused extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const PLAYER = { id: true, username: true, tag: true };
const player = ({ id, username, tag }) => ({ id, username, tag });

/** The row linking two players, whichever asked (or null). */
function pairRow(prisma, a, b) {
  return prisma.friendship.findFirst({
    where: { OR: [{ requesterId: a, addresseeId: b }, { requesterId: b, addresseeId: a }] },
  });
}

/** Ids of the player's friends (accepted). */
export async function friendIds(prisma, me) {
  const rows = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: me }, { addresseeId: me }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === me ? r.addresseeId : r.requesterId));
}

/**
 * The player's friends with their status.
 * @param {(user: { id: number, lastSeenAt: Date | null }) => { status: string, lastSeen: Date | null }} statusOf
 */
export async function listFriends(prisma, me, statusOf) {
  const rows = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: me }, { addresseeId: me }] },
    include: { requester: { select: { ...PLAYER, lastSeenAt: true } }, addressee: { select: { ...PLAYER, lastSeenAt: true } } },
  });
  return rows.map((r) => {
    const friend = r.requesterId === me ? r.addressee : r.requester;
    return { ...player(friend), ...statusOf(friend) };
  });
}

/** Requests received (to answer) and sent (waiting). */
export async function listRequests(prisma, me) {
  const [incoming, outgoing] = await Promise.all([
    prisma.friendship.findMany({ where: { status: 'PENDING', addresseeId: me }, include: { requester: { select: PLAYER } }, orderBy: { createdAt: 'desc' } }),
    prisma.friendship.findMany({ where: { status: 'PENDING', requesterId: me }, include: { addressee: { select: PLAYER } }, orderBy: { createdAt: 'desc' } }),
  ]);
  return {
    incoming: incoming.map((r) => ({ id: r.id, user: player(r.requester), sentAt: r.createdAt })),
    outgoing: outgoing.map((r) => ({ id: r.id, user: player(r.addressee), sentAt: r.createdAt })),
  };
}

/**
 * Players matching a friend code ("Pseudo#1234": exactly that one) or a piece
 * of pseudo (case ignored), the player excluded, each with the relation.
 */
export async function searchPlayers(prisma, me, query) {
  const code = parseFriendCode(query);
  const where = code
    ? { username: { equals: code.username, mode: 'insensitive' }, tag: code.tag }
    : { username: { contains: query.trim(), mode: 'insensitive' } };
  const players = await prisma.user.findMany({
    where: { ...where, id: { not: me } },
    select: PLAYER,
    orderBy: [{ username: 'asc' }, { tag: 'asc' }],
    take: SEARCH_MAX,
  });
  if (!players.length) return [];
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: me, addresseeId: { in: players.map((p) => p.id) } }, { addresseeId: me, requesterId: { in: players.map((p) => p.id) } }] },
  });
  const relation = (id) => {
    const r = rows.find((x) => x.requesterId === id || x.addresseeId === id);
    if (!r) return 'none';
    if (r.status === 'ACCEPTED') return 'friend';
    return r.requesterId === me ? 'outgoing' : 'incoming';
  };
  return players.map((p) => ({ ...player(p), relation: relation(p.id) }));
}

/**
 * Ask a player to be friends. If they had already asked the player, that
 * request is accepted instead (both want it): → { friend }. Otherwise → { request }.
 */
export async function sendRequest(prisma, me, userId) {
  if (userId === me) throw new FriendRefused(400, 'Tu ne peux pas t’ajouter toi-même');
  const other = await prisma.user.findUnique({ where: { id: userId }, select: PLAYER });
  if (!other) throw new FriendRefused(404, 'Joueur introuvable');

  const existing = await pairRow(prisma, me, userId);
  if (existing?.status === 'ACCEPTED') throw new FriendRefused(409, `${other.username} est déjà ton ami`);
  if (existing?.requesterId === me) throw new FriendRefused(409, `Demande déjà envoyée à ${other.username}`);
  if (existing) {
    await prisma.friendship.update({ where: { id: existing.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
    return { friend: player(other) };
  }
  try {
    const row = await prisma.friendship.create({ data: { requesterId: me, addresseeId: userId } });
    return { request: { id: row.id, user: player(other), sentAt: row.createdAt } };
  } catch (err) {
    // Same request twice at the same moment (double click): the first one won
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new FriendRefused(409, `Demande déjà envoyée à ${other.username}`);
    }
    throw err;
  }
}

/** Accept a request received → { friend }. */
export async function acceptRequest(prisma, me, requestId) {
  const row = await prisma.friendship.findFirst({
    where: { id: requestId, addresseeId: me, status: 'PENDING' },
    include: { requester: { select: PLAYER } },
  });
  if (!row) throw new FriendRefused(404, 'Cette demande n’existe plus');
  await prisma.friendship.update({ where: { id: row.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
  return { friend: player(row.requester) };
}

/** Refuse a request received, or cancel one sent → the other player's id. */
export async function deleteRequest(prisma, me, requestId) {
  const row = await prisma.friendship.findFirst({
    where: { id: requestId, status: 'PENDING', OR: [{ requesterId: me }, { addresseeId: me }] },
  });
  if (!row) throw new FriendRefused(404, 'Cette demande n’existe plus');
  await prisma.friendship.delete({ where: { id: row.id } });
  return row.requesterId === me ? row.addresseeId : row.requesterId;
}

/** Stop being friends (either side may). */
export async function removeFriend(prisma, me, friendId) {
  const row = await pairRow(prisma, me, friendId);
  if (row?.status !== 'ACCEPTED') throw new FriendRefused(404, 'Ce joueur n’est pas dans tes amis');
  await prisma.friendship.delete({ where: { id: row.id } });
}

/** Are these two players friends? */
export async function areFriends(prisma, a, b) {
  return (await pairRow(prisma, a, b))?.status === 'ACCEPTED';
}
