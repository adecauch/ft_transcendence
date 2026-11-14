/**
 * Auth routes against the real database (PostgreSQL must be running:
 * `make postgres-up` at the repo root). Each run uses fresh random
 * accounts and deletes them at the end.
 *
 *   npm test
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';

const run = randomBytes(4).toString('hex');
const EMAIL_SUFFIX = `-${run}@test.invalid`;
const account = (name) => ({ email: `${name}${EMAIL_SUFFIX}`, username: `${name}_${run}`, password: 'un-bon-mot-de-passe' });

let app;
before(async () => { app = await buildApp(loadConfig(), { logger: false }); });
after(async () => {
  await app.prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } });
  await app.close();
});

const post = (url, payload, cookies) => app.inject({ method: 'POST', url, payload, cookies });
const me = (cookies) => app.inject({ method: 'GET', url: '/api/auth/me', cookies });
const sid = (res) => res.cookies.find((c) => c.name === 'sid');

test('register → logged in, password stored as an Argon2id hash only', async () => {
  const a = account('alice');
  const res = await post('/api/auth/register', a);
  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.equal(body.user.username, a.username);
  assert.ok(Number.isInteger(body.user.tag) && body.user.tag >= 1000 && body.user.tag <= 9999, 'friend code tag');
  assert.equal(body.user.passwordHash, undefined, 'never sent back');

  const cookie = sid(res);
  assert.ok(cookie?.httpOnly, 'httpOnly session cookie');
  assert.equal(cookie.sameSite, 'Strict');

  const row = await app.prisma.user.findUnique({ where: { email: a.email } });
  assert.match(row.passwordHash, /^\$argon2id\$/);
  assert.ok(!row.passwordHash.includes(a.password));

  // The database keeps a hash of the cookie token, not the token
  const sessions = await app.prisma.session.findMany({ where: { userId: row.id } });
  assert.equal(sessions.length, 1);
  assert.notEqual(sessions[0].tokenHash, cookie.value);

  assert.equal((await me({ sid: cookie.value })).json().user.email, a.email);
});

test('login: right password → session; wrong password or unknown email → same 401', async () => {
  const b = account('bob');
  await post('/api/auth/register', b);

  const ok = await post('/api/auth/login', { email: b.email.toUpperCase(), password: b.password });
  assert.equal(ok.statusCode, 200, 'email is case-insensitive');
  assert.ok(sid(ok));

  const wrong = await post('/api/auth/login', { email: b.email, password: 'pas-le-bon' });
  const unknown = await post('/api/auth/login', { email: `nobody${EMAIL_SUFFIX}`, password: b.password });
  assert.equal(wrong.statusCode, 401);
  assert.equal(unknown.statusCode, 401);
  assert.deepEqual(wrong.json(), unknown.json(), "doesn't reveal which emails exist");
  assert.equal(sid(wrong), undefined);
});

test('logout kills the session server-side', async () => {
  const c = account('carol');
  const token = sid(await post('/api/auth/register', c)).value;
  assert.equal((await me({ sid: token })).statusCode, 200);

  const out = await post('/api/auth/logout', undefined, { sid: token });
  assert.equal(out.statusCode, 204);
  assert.equal((await me({ sid: token })).json().user, null, 'the old cookie no longer works');
});

test('validation: bad input rejected before touching the database', async () => {
  const bad = [
    { ...account('d1'), email: 'pas-un-email' },
    { ...account('d2'), password: 'court' },
    { ...account('d3'), username: 'a b' },
    { email: `d4${EMAIL_SUFFIX}`, password: 'un-bon-mot-de-passe' }, // no username
  ];
  for (const payload of bad) {
    assert.equal((await post('/api/auth/register', payload)).statusCode, 400, JSON.stringify(payload));
  }
});

test('same email → 409; same pseudo → allowed, told apart by the tag', async () => {
  const e = account('erin');
  const first = await post('/api/auth/register', e);
  const sameEmail = await post('/api/auth/register', { ...account('erin2'), email: e.email });
  assert.equal(sameEmail.statusCode, 409);
  assert.equal(sameEmail.json().field, 'email');

  const sameName = await post('/api/auth/register', { ...account('erin3'), username: e.username });
  assert.equal(sameName.statusCode, 201);
  assert.equal(sameName.json().user.username, e.username);
  assert.notEqual(sameName.json().user.tag, first.json().user.tag, 'two friend codes');
});

test('me without a cookie, or with a made-up one → 200, user null', async () => {
  for (const res of [await me(), await me({ sid: 'invente' })]) {
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().user, null);
  }
});

test('login is rate-limited per IP', async () => {
  let last;
  for (let i = 0; i < 12; i++) {
    last = await app.inject({
      method: 'POST', url: '/api/auth/login', remoteAddress: '10.9.8.7',
      payload: { email: `x${EMAIL_SUFFIX}`, password: 'nope' },
    });
  }
  assert.equal(last.statusCode, 429);
});
