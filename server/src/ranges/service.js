/**
 * service.js — The player's saved ranges (SavedRange table)
 *
 * Each player sees and changes only their own ranges: every query filters on
 * userId, so another player's id behaves as if it didn't exist.
 * Names are unique per player; at most MAX_RANGES ranges each.
 */

import { Prisma } from '@prisma/client';
import { cleanRange } from '../../../src/shared/poker/ranges.js';

export const MAX_RANGES = 50;

/** A refusal the route turns into an HTTP answer: `status` + French `message`. */
export class RangeRefused extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const NOT_FOUND = () => new RangeRefused(404, 'Range introuvable');

const publicRange = ({ id, name, range, createdAt, updatedAt }) => ({ id, name, range, createdAt, updatedAt });

/** cleanRange with the refusal the route understands. */
function checked(range) {
  try {
    return cleanRange(range);
  } catch (err) {
    throw new RangeRefused(400, err.message);
  }
}

/** Unique name per player: the database refuses, we explain. */
async function unique(write) {
  try {
    return await write();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new RangeRefused(409, 'Tu as déjà une range avec ce nom');
    }
    throw err;
  }
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function listRanges(prisma, userId) {
  const rows = await prisma.savedRange.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  return rows.map(publicRange);
}

export async function createRange(prisma, userId, { name, range }) {
  const count = await prisma.savedRange.count({ where: { userId } });
  if (count >= MAX_RANGES) throw new RangeRefused(409, `Tu as déjà ${MAX_RANGES} ranges : supprimes-en une`);
  const row = await unique(() => prisma.savedRange.create({ data: { userId, name: name.trim(), range: checked(range) } }));
  return publicRange(row);
}

export async function updateRange(prisma, userId, id, { name, range }) {
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (range !== undefined) data.range = checked(range);
  const res = await unique(() => prisma.savedRange.updateMany({ where: { id, userId }, data }));
  if (res.count !== 1) throw NOT_FOUND();
  return publicRange(await prisma.savedRange.findUnique({ where: { id } }));
}

export async function deleteRange(prisma, userId, id) {
  const res = await prisma.savedRange.deleteMany({ where: { id, userId } });
  if (res.count !== 1) throw NOT_FOUND();
}
