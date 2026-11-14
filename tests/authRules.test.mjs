/**
 * authRules.test.mjs — Friend codes (src/shared/auth/rules.js): "Pseudo#1234"
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { friendCode, parseFriendCode } from '../src/shared/auth/rules.js';

test('a friend code is written and read back', () => {
  assert.equal(friendCode({ username: 'LuckyLuke', tag: 4821 }), 'LuckyLuke#4821');
  assert.deepEqual(parseFriendCode('  LuckyLuke#4821 '), { username: 'LuckyLuke', tag: 4821 });
  assert.deepEqual(parseFriendCode('jo_e-1#1000'), { username: 'jo_e-1', tag: 1000 });
});

test('anything else is not a friend code', () => {
  for (const text of ['LuckyLuke', 'LuckyLuke#', 'Lucky Luke#4821', 'ab#1234', 'Bob#0999', 'Bob#12345', '#4821', 'Bob#12a4']) {
    assert.equal(parseFriendCode(text), null, text);
  }
});
