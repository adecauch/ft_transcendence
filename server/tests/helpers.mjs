/**
 * helpers.mjs — Shared by the server tests: an app on the real database,
 * logged-in test players, and whole games played locally by random agents.
 *
 * Every test file gets its own random suffix; its players (…@test.invalid)
 * are deleted when it ends, with everything that belongs to them.
 */

import { randomBytes } from 'node:crypto';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { PokerGame } from '../../src/shared/poker/PokerGame.js';
import { legalActions, toCall } from '../../src/shared/poker/betting.js';
import { HandLogger } from '../../src/shared/stats/handLog.js';

export const CONFIG = { opponents: [{ name: 'Le Baron', level: 'expert' }], startingStack: 300, blinds: { small: 10, big: 20 } };

/** The app + a way to make players; call close() in after(). */
export async function testApp() {
  const run = randomBytes(4).toString('hex');
  const suffix = `-${run}@test.invalid`;
  const app = await buildApp(loadConfig(), { logger: false });

  /** A logged-in player: request helpers carrying their session cookie. */
  async function player(name) {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: `${name}${suffix}`, username: `${name}_${run}`, password: 'un-bon-mot-de-passe' },
    });
    const sid = res.cookies.find((c) => c.name === 'sid').value;
    const send = (method) => (url, payload) => app.inject({ method, url, payload, cookies: { sid } });
    const me = (await send('GET')('/api/auth/me')).json().user;
    return { id: me.id, username: me.username, tag: me.tag, sid, get: send('GET'), post: send('POST'), put: send('PUT'), del: send('DELETE') };
  }

  async function close() {
    await app.prisma.user.deleteMany({ where: { email: { endsWith: suffix } } });
    await app.close();
  }

  return { app, player, close, run };
}

/** A random but legal player (sometimes shoves). */
const randomAgent = {
  decide({ turn }) {
    const legal = legalActions(turn);
    const r = Math.random();
    if (legal.raise && r < 0.3) return { type: 'raise', to: Math.random() < 0.3 ? legal.raise.max : legal.raise.min };
    if (!legal.check && r < 0.4) return { type: 'fold' };
    return legal.check ? { type: 'check' } : { type: 'call', amount: toCall(turn) };
  },
};

/** Play a whole game locally, collecting every hand's log (as the browser sends them). */
export async function playGame(maxHands = 300, config = CONFIG) {
  const logger = new HandLogger();
  const logs = [];
  const game = new PokerGame({
    players: [{ name: 'me', isHuman: true, agent: randomAgent }, ...config.opponents.map((o) => ({ ...o, isHuman: false, agent: randomAgent }))],
    startingStack: config.startingStack,
    blinds: config.blinds,
    onEvent: (e) => { const log = logger.event(e); if (log) logs.push(log); },
  });
  for (let h = 0; h < maxHands && !game.gameOver; h++) await game.playHand();
  return { logs, stacks: game.stacks, over: game.gameOver };
}
