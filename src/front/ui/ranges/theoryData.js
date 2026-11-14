/**
 * theoryData.js — The preflop theory model, loaded once for the range chart
 *
 * Fetches the 169 × 169 equity table (public/ai/equity169.json, made by
 * `npm run ai:equity`) and builds the heads-up EV model on it
 * (shared/theory/preflopModel.js). Resolves to null if the file is missing.
 */

import { EquityMatrix } from '../../../shared/theory/equityMatrix.js';
import { PreflopModel } from '../../../shared/theory/preflopModel.js';

let loading = null;

/** @returns {Promise<PreflopModel | null>} */
export function loadTheory() {
  loading ??= fetch('/ai/equity169.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data ? new PreflopModel(new EquityMatrix(data)) : null))
    .catch(() => null);
  return loading;
}
