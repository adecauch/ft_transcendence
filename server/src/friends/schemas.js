/**
 * schemas.js — What /api/friends accepts and returns (JSON Schema, checked by Fastify)
 *
 * Responses are filtered too: a player is only { id, username, tag } (never an
 * email), whatever the service returns.
 */

const id = { type: 'integer', minimum: 1 };
const idParams = { type: 'object', required: ['id'], properties: { id } };
const player = {
  type: 'object',
  properties: { id: { type: 'integer' }, username: { type: 'string' }, tag: { type: 'integer' } },
};
const friend = {
  type: 'object',
  properties: {
    ...player.properties,
    status: { type: 'string', enum: ['online', 'playing', 'offline'] },
    lastSeen: { type: 'string', format: 'date-time', nullable: true },
  },
};
const request = {
  type: 'object',
  properties: { id: { type: 'integer' }, user: player, sentAt: { type: 'string', format: 'date-time' } },
};
const error = { type: 'object', properties: { error: { type: 'string' } } };

export const listSchema = {
  response: { 200: { type: 'object', properties: { friends: { type: 'array', items: friend } } } },
};

export const requestsSchema = {
  response: { 200: { type: 'object', properties: { incoming: { type: 'array', items: request }, outgoing: { type: 'array', items: request } } } },
};

export const searchSchema = {
  querystring: { type: 'object', required: ['q'], properties: { q: { type: 'string', minLength: 2, maxLength: 40 } } },
  response: {
    200: {
      type: 'object',
      properties: {
        players: {
          type: 'array',
          items: { type: 'object', properties: { ...player.properties, relation: { type: 'string', enum: ['none', 'friend', 'outgoing', 'incoming'] } } },
        },
      },
    },
  },
};

export const sendSchema = {
  body: { type: 'object', required: ['userId'], additionalProperties: false, properties: { userId: id } },
  response: { 200: { type: 'object', properties: { friend: player } }, 201: { type: 'object', properties: { request } }, 400: error, 404: error, 409: error },
};

export const acceptSchema = {
  params: idParams,
  response: { 200: { type: 'object', properties: { friend: player } }, 404: error },
};

export const idSchema = { params: idParams };
