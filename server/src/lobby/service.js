/**
 * service.js — Table invitations in the database (TableInvitation table)
 *
 * "Come to my table": a player invites a friend who is online. One invitation
 * per pair (sending it again refreshes its time). An invitation older than
 * EXPIRE_MINUTES is stale (the table has moved on): not listed, deleted on the
 * next read.
 */

import { areFriends, FriendRefused } from '../friends/service.js';

export const EXPIRE_MINUTES = 30;
const PLAYER = { id: true, username: true, tag: true };
const cutoff = () => new Date(Date.now() - EXPIRE_MINUTES * 60_000);

/** Invitations the player received, newest first (stale ones removed). */
export async function listInvitations(prisma, me) {
  await prisma.tableInvitation.deleteMany({ where: { toId: me, createdAt: { lt: cutoff() } } });
  const rows = await prisma.tableInvitation.findMany({
    where: { toId: me },
    include: { from: { select: PLAYER } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({ id: r.id, from: r.from, tableId: r.tableId, sentAt: r.createdAt }));
}

/**
 * Invite a friend to the player's table.
 * @param {(id: number) => boolean} isOnline — presence: only someone in the room can come
 * @param {string | null} [tableId] — the shared table to join (checked by the route), or none yet
 */
export async function invite(prisma, me, userId, isOnline, tableId = null) {
  if (userId === me) throw new FriendRefused(400, 'Tu ne peux pas t’inviter toi-même');
  const friend = await prisma.user.findUnique({ where: { id: userId }, select: PLAYER });
  if (!friend || !(await areFriends(prisma, me, userId))) throw new FriendRefused(404, 'Ce joueur n’est pas dans tes amis');
  if (!isOnline(userId)) throw new FriendRefused(409, `${friend.username} n’est pas en ligne`);
  const row = await prisma.tableInvitation.upsert({
    where: { fromId_toId: { fromId: me, toId: userId } },
    create: { fromId: me, toId: userId, tableId },
    update: { createdAt: new Date(), tableId },
  });
  return { id: row.id, to: friend, tableId: row.tableId, sentAt: row.createdAt };
}

/** Decline one received, or cancel one sent → the other player's id. */
export async function deleteInvitation(prisma, me, id) {
  const row = await prisma.tableInvitation.findFirst({ where: { id, OR: [{ toId: me }, { fromId: me }] } });
  if (!row) throw new FriendRefused(404, 'Cette invitation n’existe plus');
  await prisma.tableInvitation.delete({ where: { id: row.id } });
  return row.toId === me ? row.fromId : row.toId;
}
