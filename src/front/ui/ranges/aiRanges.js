/**
 * aiRanges.js — The AI's preflop ranges for the range chart, loaded once
 *
 * The strategy stays on the server (it plays the AI there): it computes the
 * three ranges of 🔍 Explorer and the hands' equities (GET /api/ai/preflop).
 *
 *   loadAiRanges()  → Promise, resolves once loaded (or failed)
 *   aiRangesNow()   → { ranges, equity } · undefined while loading · null if unavailable
 */

import { aiApi } from '../../net/aiApi.js';

let loading = null;
let data;

/** @returns {Promise<void>} */
export function loadAiRanges() {
  if (!loading) {
    data = undefined;
    loading = aiApi.preflop().then((res) => {
      data = res.ok ? res.data : null;
      if (!res.ok) loading = null; // a later opening tries again
    });
  }
  return loading;
}

/** @returns {{ ranges: object, equity: Record<string, number> } | null | undefined} */
export function aiRangesNow() {
  return data;
}
