/**
 * lobbyApi.js — Table invitations (server/src/lobby)
 *
 * Every call resolves to request()'s { ok, status, data, error? } (request.js).
 * An invitation carries the friend's table code (tableId) when they wait at one:
 * « Rejoindre » sits there (RemoteGame, shared: { join }).
 */

/** @typedef {{ id: number, from: { id: number, username: string, tag: number }, tableId: string | null, sentAt: string }} Invitation */

import { request } from './request.js';

export const lobbyApi = {
  /** Invitations received → data = { invitations: Invitation[] } */
  invitations: () => request('GET', '/api/lobby/invitations'),

  /**
   * Invite a friend who is online, to the shared table the player waits at
   * (tableId, its code) or to none yet → 201 data = { invitation } · 409 not online
   */
  invite: (userId, tableId) => request('POST', '/api/lobby/invitations', tableId ? { userId, tableId } : { userId }),

  /** Decline one received (or cancel one sent) */
  decline: (id) => request('DELETE', `/api/lobby/invitations/${id}`),
};
