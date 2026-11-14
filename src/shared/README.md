# shared/ — pure game logic shared by the front end and server

Pure JavaScript: **no DOM, no Three.js, no timers**. Everything here can run
in Node (the tests do). The front end and server both import from here — never
the other way around.

```
poker/
  cards.js          card codes ('AS'), deck + shuffle, encoding shared with the C++ solver
  handEvaluator.js  best 5-card hand of 5–7 cards → comparable score
  betting.js        No-Limit rules for one decision: legal actions, min/max raise, validation
  ranges.js         preflop ranges: 13×13 grid of the 169 hand types, combos (6/4/12 → 1326),
                    notation parser ('QQ+, ATs+, A5s-A2s'), stats, French hand names
  showdown.js       main & side pots, winners, split pots, French hand names
  PokerGame.js      a whole table: stacks, button, blinds, deal, betting rounds, showdown;
                    emits events for the front and asks each seat's agent for decisions
stats/            (the saved games — see server/STATS.md)
  handLog.js        HandLogger: game events → a hand's log (cards + decisions), sent by the browser
  handRecord.js     HandRecorder: game events → the full record (every move, per-seat results, player stats)
  replay.js         replayHand(): the server replays a log with PokerGame and refuses anything illegal
  achievements.js   the achievements and their unlock tests (server + stats menu)
  playerInfosets.js the player's decisions filed under the solver's infoset keys + strategyGap()
  savedHand.js      a hand from the database → replayHand()'s inputs (rebuilds derived data)
  rangeAnalysis.js  the range a player really played (first preflop decision per hand type),
                    clear-cut preflop mistakes, biggest losses (GET /api/stats/range)
theory/           (teaching model for the range chart, "Mon historique")
  equityMatrix.js   preflop equity hand vs hand / hand vs range (public/ai/equity169.json,
                    made by `npm run ai:equity`)
  huRanges.js       reference heads-up ranges (rounded, teaching), the opponent of the model
  preflopModel.js   what each preflop action is worth in BB against those ranges (explainable EV)
auth/
  rules.js          account rules (lengths, allowed characters) + French error messages,
                    shared by the login screen and the server's validation
ai/
  mccfr/infoset.js  describeInfoset(): THE decision → solver key chain (bot and stats share it)
  mccfr/historyWords.js  an abstract history ('2c/c3///') in plain French, with the sizes
  preflopRanges.js  the AI's real preflop ranges, read from the MCCFR strategy (range chart)
  PokerBot.js       an AI seat: MCCFR strategy lookup + fallback policy (see ai/README.md)
  mccfr/
    infosetKey.js         64-bit infoset keys, identical to the C++ solver
    bettingTree.js        the solver's bet sizes and nodes (mirror of ../CFR betting.cpp)
    historyTranslator.js  real betting → the solver's heads-up history (closest size, off-tree)
    cardAbstraction.js    hole cards + board → bucket (buckets.txt / EHS thresholds)
    handStrength.js       EHS, same estimators as the solver
    StrategyTable.js      strategy.bin reader (packed from the solver's text)
```

`PokerGame` is the entry point: see its header for the list of events and the
`agent.decide(request)` contract. Tests: `npm run test:ai`.
