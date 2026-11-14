/**
 * statsLive.js — Real-time updates of the dashboard (server/src/stats/liveFeed.js)
 *
 * An EventSource on /api/stats/live: the server sends a `hand` event each time
 * one of the player's hands is saved (from any tab or device). The browser
 * reconnects by itself if the connection drops. Logged-in players only: a
 * guest never opens it (a 401 would show in red in the console).
 *
 *   const live = watchHands({ onHand, onStatus });   …   live.close();
 */

/**
 * @param {{ onHand: (data: { gameId: number, handNo: number }) => void,
 *           onStatus?: (connected: boolean) => void }} handlers
 */
export function watchHands({ onHand, onStatus }) {
  const source = new EventSource('/api/stats/live');
  source.addEventListener('hand', (e) => onHand(JSON.parse(e.data)));
  source.addEventListener('open', () => onStatus?.(true));
  source.addEventListener('error', () => onStatus?.(false));
  return { close: () => source.close() };
}
