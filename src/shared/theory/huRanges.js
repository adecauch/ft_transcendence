/**
 * huRanges.js — Reference heads-up preflop ranges (teaching, rounded)
 *
 * How a solid opponent plays heads-up, in the usual notation
 * (poker/ranges.js). Used twice:
 *   - by the preflop theory model (preflopModel.js) as the OPPONENT's answers;
 *   - as example ranges in the range chart (front/config/rangePresets.js).
 * Classic rounded ranges, not solver output: good enough to show where the
 * chips are won and lost.
 */

/** Small blind (= button), first to act: open-raise to 2.5 BB, fold the rest. */
export const SB_OPEN = {
  raise: '22+, A2+, K2+, Q2s+, Q4o+, J2s+, J6o+, T2s+, T6o+, 92s+, 96o+, 82s+, 86o+, 72s+, 75o+, 62s+, 65o, 52s+, 54o, 42s+, 32s',
};

/** Small blind facing a 3-bet: 4-bets (re-raises to 22 BB) with these… */
export const SB_4BET = {
  raise: 'TT+, AQs+, AKo, A5s-A4s',
};

/** …and otherwise, facing a 3-bet after opening: continues (calls or 4-bets) with these, folds the rest (it keeps about 60 % of its opens). */
export const SB_VS_3BET = {
  call: '22+, A2+, K2s+, K7o+, Q5s+, Q9o+, J7s+, J9o+, T7s+, T9o, 96s+, 98o, 85s+, 75s+, 64s+, 54s',
};

/** Big blind facing a 2.5 BB open from the small blind. */
export const BB_VS_OPEN = {
  threebet: '88+, A9s+, AJo+, KTs+, KQo, QJs, A5s-A2s, 76s, 65s, 54s',
  call: '22-77, A2s-A8s, K2s-K9s, Q2s-QTs, J2s+, T2s+, 92s+, 84s+, 74s+, 63s+, 53s+, 43s, A2o-ATo, K2o-KJo, Q5o+, J7o+, T7o+, 97o+, 86o+, 76o, 65o',
};

/** Big blind after the small blind only called (limped): raise (to 4 BB) with these, check the rest. */
export const BB_VS_LIMP = {
  raise: '22+, A2s+, A7o+, K7s+, KTo+, Q9s+, QJo, J9s+, T8s+, 98s, 87s, 76s',
};
