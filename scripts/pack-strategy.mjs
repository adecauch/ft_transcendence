// Pack the solver's strategy text into the caller-provided private output,
// normally server/data/strategy.bin (never public/).
// (format: src/shared/ai/mccfr/StrategyTable.js). Called by scripts/sync-mccfr.sh.
// Usage: node scripts/pack-strategy.mjs <strategy.txt> <strategy.bin>

import fs from 'node:fs';
import { packStrategy } from '../src/shared/ai/mccfr/StrategyTable.js';

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error('Usage: node scripts/pack-strategy.mjs <strategy.txt> <strategy.bin>');
  process.exit(1);
}

const text = fs.readFileSync(src, 'utf8');
const { buffer, count, options } = packStrategy(text);

// The old solver wrote exactly 3 probabilities (fold / call / raise) on every
// line; the multi-size one writes 2 to 7. A file with only 3s is the old format.
if (options === 3 * count) {
  console.error(`${src}: every line has 3 probabilities — old single-size strategy? Refusing to pack it.`);
  process.exit(1);
}

fs.writeFileSync(dest, Buffer.from(buffer));
console.log(`${src} → ${dest}: ${count} infosets, ${options} options, ${(buffer.byteLength / 1e6).toFixed(1)} MB`);
