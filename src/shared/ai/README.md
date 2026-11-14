# AI opponents — MCCFR strategy

The AI plays from the **average strategy** produced by the C++ MCCFR solver
(`../CFR`). Part of `src/shared/`: pure logic (no DOM, no Three.js), imported
unchanged by the front end and the server.

## Pipeline, for each decision

```
hole cards + board ──► bucket            mccfr/cardAbstraction.js  (buckets.txt / EHS → thresholds)
betting so far     ──► history "2c/c3///" mccfr/historyTranslator.js (real table → heads-up tree, closest size)
                                         mccfr/bettingTree.js      (the solver's sizes and nodes)
(round, player, bucket, depth, history) ──► 64-bit key mccfr/infosetKey.js  (FNV-1a, same bits as C++)
key ──► one probability per option of the node         mccfr/StrategyTable.js (strategy.bin)
blend with a simple policy by level, sample, size it on the real table   PokerBot.js
```

## The solver's betting tree (`mccfr/bettingTree.js`)

Heads-up, blinds 1/2, 400 chips (200 BB). Every node offers a fixed list of
options, and the history stores the **index** of the option taken:

| Index | Option | History char |
|-------|--------|--------------|
| 0 | fold (listed even when illegal) | `f` |
| 1 | check / call | `c` |
| 2 … n-2 | the sizes of the current raise level | `2` … |
| n-1 | all-in | last digit |

| Raise level (bets already made this street) | Preflop | Postflop |
|------|---------|----------|
| 0 | open 2 BB or 2.5 BB | ⅓, ½, ⅔, 1 pot |
| 1 | 3-bet ×3 | raise ×3 |
| 2 | 4-bet ×2.5 | all-in only |
| 3 | all-in only | all-in only |

A size is dropped if it is below the min-raise, equals the all-in, adds more
than ⅔ of the stack, or rounds to the previous size's amount. At most 4
bets per street. So `2` is "the first size of THIS node": the open preflop,
the ⅓-pot bet in a raised pot, but **½ pot in a limped pot** (⅓ of 4 chips is
under the 2-chip minimum). The strategy row has exactly as many
probabilities as the node has options; `PokerBot` checks it.

Verified: random abstract hands (tests/pokerBot.test.mjs) only ever meet
nodes present in the strategy, with the same number of options. In simulated
heads-up games every AI decision is found in the table.

## Must stay identical to the C++ solver

| What | C++ | JS |
|------|-----|----|
| Card encoding | `rank * 4 + suit` (2..A, ♠♥♦♣) | `../poker/cards.js` |
| History string | option indexes `f`/`c`/`2`..`7` + `/` per round, 4 rounds | `AbstractHand.historyString()` |
| Options of a node | `legalActions()` (abstraction/betting.cpp) | `AbstractHand.options()` |
| Size tables, cap, all-in threshold | `PREFLOP_SIZES`, `POSTFLOP_SIZES`, `MAX_BETS_PER_ROUND`, `ALLIN_THRESHOLD` | same names in `bettingTree.js` |
| Min-raise | `minRaiseTo()` : opponent's bet + max(last raise, BB) | `options()` |
| Key layout (`KEY_LAYOUT_VERSION` 2) | `[0-1] round · [2] player · [3-12] bucket · [13-21] depth (BB) · [22-63] FNV-1a(history)` | `packInfoSetKey()` (depth = `SOLVER_DEPTH`, 200) |
| Player 0 / 1 | SB acts first preflop, BB first postflop | `toAbstract()` (historyTranslator.js) |
| Preflop bucket | `buckets.txt` by hand type (169 buckets: one per hand type) | `CardAbstraction.describe()` |
| Postflop bucket | EHS (river exact, turn 45 / flop 50 rollouts) → `upper_bound` in thresholds | `mccfr/handStrength.js`, `bucketFromEHS()` |

Keys go above 2^53: they are built with `BigInt` and stored as strings.
The river EHS was checked against the C++ build (300 random spots, identical).

## The strategy file

The solver writes `<key> <p_0> … <p_(n-1)>` per line: ~170 MB of text for
4.16 M infosets (50 M iterations, strategy `97272ca04d`). `npm run ai:sync` packs it into
`server/data/strategy.bin` (~49 MB, `scripts/pack-strategy.mjs`): sorted
64-bit keys (binary search), the option count per row, and the probabilities
on one byte each (sum 255 per row, precision 0.4 %). No parsing at load time,
only the server reads this private file. The packer refuses a file
where every row has 3 probabilities (the old single-size format).

## Approximations

- **Action translation**: a real bet becomes the solver size closest to it,
  both measured as "raise to / pot before" on a log scale. The abstract hand
  then continues with the **solver's** amount, so the next nodes are ones it
  knows. A real all-in may map to any size (a 10 BB shove is closer to the
  open than to a 200 BB all-in); a real raise that is not all-in never maps to
  the solver's all-in unless nothing else is offered. Real stacks deeper or
  shorter than 200 BB are still read as 200 BB (the game starts at 50 BB):
  the key's depth is always `SOLVER_DEPTH`, the only depth trained.
- **The bot's own bets** use the solver's formula on the **real** table (½ of
  the real pot, ×3 the real bet, 2.5 real big blinds…), clamped to the legal range.
- **Multiway**: the bot sees "me vs the field" — opponents' consecutive
  actions merge into one (their biggest raise), their folds are dropped; once
  a call closes the round heads-up, later checks / calls are dropped. Lines
  the heads-up solver never saw simply miss the table (about 1 decision in 7
  at three players): the fallback plays them.
- **Off-tree** (`toAbstract().offTree`): a raise where the abstract node has
  none (5th bet of a street, abstract stacks already all-in). The strategy is
  not looked up for the rest of the hand.
- **Fallback** (`simplePolicy()`): strength vs pot odds. Facing an off-tree
  bet it's call or fold: call an all-in with preflop equity ≥
  `CALL_SHOVE_PREFLOP` (0.62) or postflop EHS ≥ `CALL_SHOVE_POSTFLOP` (0.75),
  another bet with odds + 0.10. Its "raise" share is split between the node's sizes.

## Levels

> For now `USE_LEVELS = false` in `PokerBot.js`: every level plays the pure
> solver strategy (Expert row). Flip it to enable the blends below.

| Level | Follows the solver | Notes |
|-------|--------------------|-------|
| Expert | 100 % | actions under 3 % are dropped (strategy noise) |
| Confirmé | 70 % | slightly flattened (temperature 1.3) |
| Débutant | 35 % | flattened, calls more, folds less |

## Updating the strategy after training

```bash
npm run ai:sync                     # buckets → public/ai/mccfr/, strategy*.txt → server/data/strategy.bin
MCCFR_STRATEGY=data/backup_50M_97272ca04d/strategy.txt npm run ai:sync   # a given run (the one in the game)
MCCFR_DIR=/path/to/solver npm run ai:sync
npm run test:ai                     # keys, betting tree vs strategy, legality checks
npm --prefix server run db:rebuild-infosets   # re-file the players' decisions (new version)
```

Take a **finished** strategy: while the solver trains, `data/strategy.txt` is
rewritten every 5 M iterations.

The Slumbot benchmark now lives in the solver's repository
(`../CFR/tests/slumbot/`, `make slumbot`): the C++ solver plays itself, not
this `PokerBot`.

If the solver's sizes, stack or key layout change (abstraction/betting.cpp,
defines.hpp, utils/key_utils.cpp), change `bettingTree.js` / `infosetKey.js` the same way: the test "the betting tree is the solver's"
fails until they match.

`npm run debug_ia` starts the game with the AIs' cards face up and a large
debug panel (src/front/ui/AiDebugPanel.js) showing every AI decision.

In dev, every AI decision is logged in the console:
`[AI] Le Baron (expert) → call · solver · Préflop 23////`, then the full
debug object (key, bucket, strength, history, `fromSolver`, `offTree`,
`facing`, `options` labels and their probabilities).
