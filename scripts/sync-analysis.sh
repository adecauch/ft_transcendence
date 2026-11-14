#!/usr/bin/env bash
# Pack a solver strategy into server/data/analysis.bin: the reference the
# players' decisions are compared with ("Face au solveur"), read by the server
# only. The bot strategy is private in server/data/strategy.bin (npm run ai:sync).
# Usage: npm run ai:analysis                                         (../CFR/data/strategy.txt)
#        MCCFR_STRATEGY=data/strategy_100M.txt npm run ai:analysis   (a given run)
#        MCCFR_DIR=/path/to/solver npm run ai:analysis
# Refuses a solver whose abstraction files differ from the game's: the
# players' decisions are filed under the game's keys, which must exist in both.
set -euo pipefail

SRC="${MCCFR_DIR:-../CFR}"
STRATEGY="$SRC/${MCCFR_STRATEGY:-data/strategy.txt}"
DEST="server/data/analysis.bin"

for f in buckets.txt flop_thresholds.txt turn_thresholds.txt river_thresholds.txt; do
  if ! cmp -s "$SRC/data/$f" "public/ai/mccfr/$f"; then
    echo "$SRC/data/$f differs from public/ai/mccfr/$f: not the game's abstraction (npm run ai:sync first?)" >&2
    exit 1
  fi
done
# While the solver trains, data/strategy.txt is a save from the middle of the run
if [ -z "${MCCFR_STRATEGY:-}" ] && pgrep -f "holdem_solver" >/dev/null; then
  echo "The solver is still training: $STRATEGY is a mid-run save. Wait for the end, or set MCCFR_STRATEGY." >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
node scripts/pack-strategy.mjs "$STRATEGY" "$DEST"
echo "Analysis strategy: $STRATEGY → $DEST (restart the server to load it)"
