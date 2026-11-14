/**
 * socialLive.js — The logged-in player's live stream (server/src/friends/presence.js)
 *
 * An EventSource on /api/friends/live, open while the player is logged in:
 * keeping it open is what makes them "online" for their friends. The server
 * writes an event when something changed for them:
 *   friends       a friend's status, a request received or accepted, a friend removed
 *   invitations   a table invitation arrived or went away
 * The page then asks the routes again (friendsApi, lobbyApi). The browser
 * reconnects by itself if the connection drops. A guest never opens it (a 401
 * would show in red in the console).
 *
 *   const live = watchSocial({ onFriends, onInvitations });   …   live.close();
 */

/** @param {{ onFriends?: () => void, onInvitations?: () => void }} handlers */
export function watchSocial({ onFriends, onInvitations }) {
  const source = new EventSource('/api/friends/live');
  source.addEventListener('friends', () => onFriends?.());
  source.addEventListener('invitations', () => onInvitations?.());
  return { close: () => source.close() };
}
