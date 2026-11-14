/**
 * rangesApi.js — The player's saved ranges (server/src/ranges, SavedRange table)
 *
 * Every call resolves to request()'s { ok, status, data, error? } (request.js).
 * range = { "AKs": { "raise": 1 }, "77": { "call": 1 }, … } — missing hand = fold.
 */

import { request } from './request.js';

export const rangesApi = {
  /** → data = { ranges: [{ id, name, range, createdAt, updatedAt }] } */
  list: () => request('GET', '/api/ranges'),
  /** → data = { range } */
  create: (name, range) => request('POST', '/api/ranges', { name, range }),
  /** changes = { name?, range? } → data = { range } */
  update: (id, changes) => request('PUT', `/api/ranges/${id}`, changes),
  remove: (id) => request('DELETE', `/api/ranges/${id}`),
};
