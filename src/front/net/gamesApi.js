/**
 * gamesApi.js — Games, hands, statistics and leaderboard (server/src/games, server/src/stats)
 *
 * Every call resolves to request()'s { ok, status, data, error? } (request.js).
 */

import { request } from './request.js';

export const gamesApi = {
  /** @param {{ opponents: object[], startingStack: number, blinds: object }} config → data.game */
  start: (config) => request('POST', '/api/games', config),
  /** A hand's log (shared/stats/handLog.js) → data = { hand, game, achievements } */
  sendHand: (gameId, log) => request('POST', `/api/games/${gameId}/hands`, log),
  quit: (gameId) => request('POST', `/api/games/${gameId}/quit`),
  /** → data = { games, next } ; pass `next` as `before` for the following page */
  list: (before) => request('GET', `/api/games${before ? `?before=${before}` : ''}`),
  /** → data = { game, hands } */
  get: (gameId) => request('GET', `/api/games/${gameId}`),
  /** → data = { totals, achievements } */
  stats: () => request('GET', '/api/stats/me'),
  /** The player vs the solver, infoset by infoset (server/src/stats/solverReport.js) */
  solverReport: () => request('GET', '/api/stats/solver'),
  /** The range really played + mistakes + losses (shared/stats/rangeAnalysis.js) */
  rangeHistory: () => request('GET', '/api/stats/range'),
  /** The dashboard's numbers; `query` = filters as a query string (ui/dashboard/filters.js) */
  dashboard: (query) => request('GET', `/api/stats/dashboard?${query}`),
  /** Link of the CSV file of the same hands (downloaded by the browser, not fetched) */
  exportCsvUrl: (query) => `/api/stats/export.csv?${query}`,
  /** → data = { players, me } */
  leaderboard: () => request('GET', '/api/leaderboard'),
};
