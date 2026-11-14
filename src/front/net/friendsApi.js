/**
 * friendsApi.js — Friends and friend requests (server/src/friends)
 *
 * Every call resolves to request()'s { ok, status, data, error? } (request.js).
 * Players are { id, username, tag }: two may share a pseudo, "username#tag"
 * (the friend code, shared/auth/rules.js) tells them apart.
 * status: 'online' (in the room) · 'playing' (at a table) · 'offline' (lastSeen)
 * relation (search): 'none' · 'friend' · 'outgoing' (asked) · 'incoming' (asks you)
 */

/** @typedef {{ id: number, username: string, tag: number, status: 'online' | 'playing' | 'offline', lastSeen: string | null }} Friend */
/** @typedef {{ id: number, user: { id: number, username: string, tag: number }, sentAt: string }} FriendRequest */

import { request } from './request.js';

export const friendsApi = {
  /** → data = { friends: Friend[] } */
  list: () => request('GET', '/api/friends'),

  /** → data = { incoming: FriendRequest[], outgoing: FriendRequest[] } */
  requests: () => request('GET', '/api/friends/requests'),

  /**
   * A full friend code ("BillyTheKid#4242") finds that one player; a piece of
   * pseudo (2 letters at least) finds everyone whose pseudo contains it.
   * → data = { players: [{ id, username, tag, relation }] } (at most 20)
   */
  search: (query) => request('GET', `/api/friends/search?q=${encodeURIComponent(query.trim())}`),

  /** → 201 data = { request } · 200 data = { friend } (they had asked you: now friends) */
  add: (userId) => request('POST', '/api/friends/requests', { userId }),

  /** → data = { friend } */
  accept: (requestId) => request('POST', `/api/friends/requests/${requestId}/accept`),

  /** Refuse one received, or cancel one sent */
  decline: (requestId) => request('DELETE', `/api/friends/requests/${requestId}`),

  remove: (friendId) => request('DELETE', `/api/friends/${friendId}`),
};
