/**
 * StrategyTable.js — The MCCFR average strategy
 *
 * The solver writes one line per infoset (CFRSolver::saveStrategy):
 *   <key> <p_0> <p_1> … <p_(n-1)>      one probability per option of the node
 * (fold, call, the sizes, all-in — see bettingTree.js), n between 2 and 7.
 *
 * That text is ~60 MB for 1.5 M infosets: too big for the browser. It is
 * packed once (`npm run ai:sync` → scripts/pack-strategy.mjs) into
 * strategy.bin, ~17 MB, read here without any parsing:
 *
 *   header   16 bytes: "MCFR", format version (u32), infosets (u32), options (u32)
 *   keys     count × u64, sorted (binary search)
 *   counts   count × u8   options of each infoset
 *   probs    options × u8 each row quantised to sum to 255
 * Little-endian (every browser and Node on x86 / ARM).
 *
 * Keys are 64-bit: they are compared as BigInt, and passed around as decimal strings.
 */

const MAGIC = 0x5246434d; // "MCFR" read as a little-endian u32
const FORMAT = 1;
const HEADER = 16;
const SCALE = 255;

export class StrategyTable {
  /** @param {ArrayBuffer | Uint8Array} buffer — a strategy.bin (a Node Buffer works too) */
  constructor(buffer) {
    // A view (Node's readFile) may sit anywhere in a shared buffer: copy it, 8-byte aligned
    if (ArrayBuffer.isView(buffer)) buffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const head = new DataView(buffer, 0, HEADER);
    if (head.getUint32(0, true) !== MAGIC || head.getUint32(4, true) !== FORMAT) {
      throw new Error('[AI] strategy.bin: unknown format (run npm run ai:sync)');
    }
    const count = head.getUint32(8, true);
    this.keys = new BigUint64Array(buffer, HEADER, count);
    this.counts = new Uint8Array(buffer, HEADER + 8 * count, count);
    this.probs = new Uint8Array(buffer, HEADER + 9 * count, head.getUint32(12, true));
    this.offsets = new Uint32Array(count);
    for (let i = 1; i < count; i++) this.offsets[i] = this.offsets[i - 1] + this.counts[i - 1];
  }

  static async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[AI] Missing strategy ${url} (${res.status})`);
    return new StrategyTable(await res.arrayBuffer());
  }

  get size() {
    return this.keys.length;
  }

  /**
   * @param {string} key — decimal string (infosetKey.js)
   * @returns {number[] | undefined} one probability per option of the node
   */
  get(key) {
    const k = BigInt(key);
    let lo = 0;
    let hi = this.keys.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const v = this.keys[mid];
      if (v === k) {
        const at = this.offsets[mid];
        return Array.from(this.probs.subarray(at, at + this.counts[mid]), (q) => q / SCALE);
      }
      if (v < k) lo = mid + 1;
      else hi = mid - 1;
    }
    return undefined;
  }
}

/**
 * The solver's text → strategy.bin (used by scripts/pack-strategy.mjs).
 * @param {string} text — strategy.txt
 * @returns {{ buffer: ArrayBuffer, count: number, options: number }}
 */
export function packStrategy(text) {
  const rows = [];
  let options = 0;
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const probs = parts.slice(1).map(Number);
    if (probs.length > 8 || probs.some((p) => !Number.isFinite(p) || p < 0)) {
      throw new Error(`Bad strategy line: ${line}`);
    }
    rows.push({ key: BigInt(parts[0]), probs });
    options += probs.length;
  }
  rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const count = rows.length;
  const buffer = new ArrayBuffer(HEADER + 9 * count + options);
  const head = new DataView(buffer, 0, HEADER);
  head.setUint32(0, MAGIC, true);
  head.setUint32(4, FORMAT, true);
  head.setUint32(8, count, true);
  head.setUint32(12, options, true);
  const keys = new BigUint64Array(buffer, HEADER, count);
  const counts = new Uint8Array(buffer, HEADER + 8 * count, count);
  const probs = new Uint8Array(buffer, HEADER + 9 * count, options);
  let at = 0;
  rows.forEach((row, i) => {
    keys[i] = row.key;
    counts[i] = row.probs.length;
    probs.set(quantise(row.probs), at);
    at += row.probs.length;
  });
  return { buffer, count, options };
}

/** Probabilities → integers summing to 255 (largest remainders). */
function quantise(p) {
  const sum = p.reduce((a, b) => a + b, 0) || 1;
  const exact = p.map((x) => (x / sum) * SCALE);
  const q = exact.map(Math.floor);
  let left = SCALE - q.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => [x - q[i], i]).sort((a, b) => b[0] - a[0]);
  for (let j = 0; left > 0; j++, left--) q[order[j % order.length][1]]++;
  return q;
}
