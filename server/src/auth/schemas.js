/**
 * schemas.js — What the auth routes accept and return (JSON Schema)
 *
 * Fastify checks every request body against these before the handler runs:
 * a wrong or missing field → 400, the handler never sees it. The front will
 * check the same rules to give instant feedback, but only this check counts
 * (anyone can send a request without the front).
 *
 * Responses are filtered through their schema too: a field not listed (like
 * passwordHash) can't leak into a reply, even by mistake.
 *
 * The numbers (lengths, allowed characters) live in src/shared/auth/rules.js,
 * shared with the front's login screen.
 */

import { RULES } from '../../../src/shared/auth/rules.js';

const email    = { type: 'string', format: 'email', maxLength: RULES.emailMax };
const password = { type: 'string', minLength: RULES.password.min, maxLength: RULES.password.max };
const username = {
  type: 'string',
  minLength: RULES.username.min,
  maxLength: RULES.username.max,
  pattern: RULES.username.pattern,
};

const publicUser = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    email: { type: 'string' },
    username: { type: 'string' },
    tag: { type: 'integer' },       // friend code: username#tag
    createdAt: { type: 'string', format: 'date-time' },
  },
};
const userReply = { type: 'object', properties: { user: publicUser } };
const maybeUser = { type: 'object', properties: { user: { ...publicUser, nullable: true } } };
const error = { type: 'object', properties: { error: { type: 'string' }, field: { type: 'string' } } };

export const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'username', 'password'],
    additionalProperties: false,
    properties: { email, username, password },
  },
  response: { 201: userReply, 409: error },
};

export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
    // No length rules on a login password: just "not absurdly long"
    properties: { email: { type: 'string', maxLength: RULES.emailMax }, password: { type: 'string', maxLength: 1024 } },
  },
  response: { 200: userReply, 401: error },
};

export const meSchema = { response: { 200: maybeUser } };
