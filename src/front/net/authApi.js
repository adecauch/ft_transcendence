/**
 * authApi.js — Talks to the back-end's /api/auth routes (server/)
 *
 * The session lives in an httpOnly cookie that this code never sees: the
 * browser stores it and sends it back on its own.
 *
 * Every call resolves (never throws) to:
 *   { ok: true,  user }                  — user = { id, email, username, tag, createdAt } (friend code: username#tag)
 *                                          (me(): user = null when not logged in)
 *   { ok: false, error, field? }         — error in French; field = the input it's about
 */

import { request } from './request.js';

async function call(method, path, body) {
  const res = await request(method, `/api/auth${path}`, body);
  return res.ok ? { ok: true, user: res.data?.user } : res;
}

export const authApi = {
  /** Who is logged in (from the cookie), if anyone. */
  me: () => call('GET', '/me'),
  /** @param {{ email: string, password: string }} credentials */
  login: (credentials) => call('POST', '/login', credentials),
  /** @param {{ email: string, username: string, password: string }} account */
  register: (account) => call('POST', '/register', account),
  logout: () => call('POST', '/logout'),
};
