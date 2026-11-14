/**
 * aiApi.js — What the browser may know about the AI (server/src/ai)
 *
 * Resolves to request()'s { ok, status, data, error? } (request.js).
 */

import { request } from './request.js';

export const aiApi = {
  /** → data = { ranges: { sbOpen, bbVsLimp, bbVsRaise }, equity: { "AKs": 0.67, … } } */
  preflop: () => request('GET', '/api/ai/preflop'),
};
