#!/usr/bin/env bash
# Copy the MCCFR abstraction files into public/ai/mccfr/ and pack the strategy
# into the server-only server/data/strategy.bin.
# Usage: npm run ai:sync                                   (solver in ../CFR)
#        MCCFR_DIR=/path/to/solver npm run ai:sync
#        MCCFR_STRATEGY=data/strategy_50M.txt npm run ai:sync   (a given run)
# Without MCCFR_STRATEGY, the most recent data/strategy*.txt is taken.
set -euo pipefail

SRC="${MCCFR_DIR:-../CFR}"
DEST="public/ai/mccfr"
STRATEGY_DEST="server/data/strategy.bin"
mkdir -p "$DEST" "$(dirname "$STRATEGY_DEST")"

for f in buckets.txt equity_table.txt flop_thresholds.txt turn_thresholds.txt river_thresholds.txt; do
  cp "$SRC/data/$f" "$DEST/$f"
done

if [ -n "${MCCFR_STRATEGY:-}" ]; then
  STRATEGY="$SRC/$MCCFR_STRATEGY"
else
  STRATEGY="$(ls -t "$SRC"/data/strategy*.txt 2>/dev/null | head -n 1 || true)"
fi
if [ -z "$STRATEGY" ] || [ ! -f "$STRATEGY" ]; then
  echo "No strategy found in $SRC/data — train the solver first" >&2
  exit 1
fi

node scripts/pack-strategy.mjs "$STRATEGY" "$STRATEGY_DEST"
rm -f "$DEST/strategy.bin" "$DEST/strategy.txt" # never serve the strategy
echo "MCCFR abstraction synced from $SRC → $DEST"
echo "MCCFR strategy packed for the server → $STRATEGY_DEST"
