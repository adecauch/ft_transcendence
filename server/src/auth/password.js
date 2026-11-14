/**
 * password.js — Hashing and checking passwords (Argon2id)
 *
 * The password itself is never stored nor logged: only the string returned by
 * hashPassword(), which contains the algorithm, its settings, a random salt
 * and the hash:
 *
 *   $argon2id$v=19$m=19456,t=2,p=1$<salt, base64>$<hash, base64>
 *
 * A hash cannot be turned back into the password. To check a login, the typed
 * password is hashed again with the salt and settings read from that string,
 * and the results are compared (argon2.verify does it, in constant time).
 *
 * Argon2id is slow and memory-hungry on purpose (≈ 50 ms, 19 MiB per hash):
 * harmless for one login, ruinous for someone trying billions of guesses on a
 * stolen database. Settings: OWASP's minimum for Argon2id.
 *
 * The optional pepper (PASSWORD_PEPPER) is a secret kept out of the database
 * and mixed into every hash: a stolen database alone is then not even enough
 * to start guessing. Changing it invalidates every password.
 */

import argon2 from 'argon2';

const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // KiB = 19 MiB
  timeCost: 2,       // passes over the memory
  parallelism: 1,
};

export class Passwords {
  /** @param {{ pepper: string | null }} config */
  constructor({ pepper }) {
    const secret = pepper ? { secret: Buffer.from(pepper) } : {};
    this._options = { ...OPTIONS, ...secret };
    this._verifyOptions = secret; // the rest is read from the stored string
    // A real hash of nothing in particular: see verify()
    this._dummy = null;
  }

  /** @param {string} password @returns {Promise<string>} the string to store */
  hash(password) {
    return argon2.hash(password, this._options);
  }

  /**
   * @param {string | null | undefined} stored — the user's passwordHash, or
   *   nothing when no account has that email
   * @param {string} password — as typed
   */
  async verify(stored, password) {
    // No account (or an OAuth-only one): still spend the time of a real check,
    // so the response time doesn't tell which emails have an account.
    if (!stored) {
      this._dummy ??= await this.hash('not-a-real-password');
      await argon2.verify(this._dummy, password, this._verifyOptions).catch(() => false);
      return false;
    }
    try {
      return await argon2.verify(stored, password, this._verifyOptions);
    } catch {
      return false; // malformed hash in the database
    }
  }
}
