/**
 * sessions.js — Who is logged in
 *
 * Logging in creates a session: a random token (32 bytes, unguessable) sent
 * to the browser in an httpOnly cookie, and a row in the Session table. The
 * row keeps only the SHA-256 of the token: someone reading the database can't
 * rebuild a valid cookie. (A fast hash is fine here, unlike for passwords: the
 * token is random, there is nothing to guess.)
 *
 * On each request, the cookie's token is hashed and looked up. Logging out
 * deletes the row, so the cookie is dead at once, even if copied elsewhere.
 */

import { randomBytes, createHash } from 'node:crypto';

export const SESSION_COOKIE = 'sid';

const sha256 = (token) => createHash('sha256').update(token).digest('hex');

export class Sessions {
  /**
   * @param {import('@prisma/client').PrismaClient} prisma
   * @param {{ sessionDays: number }} config
   */
  constructor(prisma, { sessionDays }) {
    this.prisma = prisma;
    this.maxAgeMs = sessionDays * 24 * 3600 * 1000;
  }

  /** New session for a user. @returns {Promise<{ token: string, expiresAt: Date }>} */
  async create(userId) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.maxAgeMs);
    // Housekeeping: this user's expired sessions are useless
    await this.prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
    await this.prisma.session.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
    return { token, expiresAt };
  }

  /** The user behind a cookie token, or null (unknown, or expired). */
  async userFor(token) {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }
    return session.user;
  }

  /** Log out: that cookie stops working. */
  async destroy(token) {
    if (!token) return;
    await this.prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
}
