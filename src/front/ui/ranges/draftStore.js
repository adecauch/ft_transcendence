/**
 * draftStore.js — The range being painted, kept in this browser
 *
 * The working copy of « Construire » survives a reload (localStorage), for
 * guests and players alike. Saving it to the account is another thing
 * (net/rangesApi.js → SavedRange table). Storage can be missing (private
 * mode…): then the draft just lives until the page closes.
 */

const KEY = 'poker.customRange';

/** @returns {{ range: object, savedId: number | null }} */
export function loadDraft() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    // Older format: the range alone
    if (data && typeof data === 'object' && 'range' in data) return { range: data.range ?? {}, savedId: data.savedId ?? null };
    if (data && typeof data === 'object') return { range: data, savedId: null };
  } catch { /* no storage or bad data: start empty */ }
  return { range: {}, savedId: null };
}

/** @param {{ range: object, savedId: number | null }} draft */
export function saveDraft(draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch { /* not kept, still works */ }
}
