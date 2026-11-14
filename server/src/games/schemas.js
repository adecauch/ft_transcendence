/**
 * schemas.js — What the game routes accept (JSON Schema, checked by Fastify)
 */

const card = { type: 'string', pattern: '^[2-9TJQKA][SHDC]$' };
const LEVELS = ['beginner', 'regular', 'expert'];

export const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'integer', minimum: 1 } },
};

export const startSchema = {
  body: {
    type: 'object',
    required: ['opponents', 'startingStack', 'blinds'],
    additionalProperties: false,
    properties: {
      opponents: {
        type: 'array', minItems: 1, maxItems: 4,
        items: {
          type: 'object', required: ['name', 'level'], additionalProperties: false,
          properties: { name: { type: 'string', minLength: 1, maxLength: 30 }, level: { enum: LEVELS } },
        },
      },
      startingStack: { type: 'integer', minimum: 10, maximum: 1000000 },
      blinds: {
        type: 'object', required: ['small', 'big'], additionalProperties: false,
        properties: { small: { type: 'integer', minimum: 1 }, big: { type: 'integer', minimum: 2 } },
      },
    },
  },
};

/** A hand's log (src/shared/stats/handLog.js) — the server replays it. */
export const handSchema = {
  params: idParams,
  body: {
    type: 'object',
    required: ['handNo', 'hole', 'board', 'actions'],
    additionalProperties: false,
    properties: {
      handNo: { type: 'integer', minimum: 1 },
      hole: {
        type: 'array', minItems: 2, maxItems: 5,
        items: { anyOf: [{ type: 'null' }, { type: 'array', minItems: 2, maxItems: 2, items: card }] },
      },
      board: { type: 'array', maxItems: 5, items: card },
      actions: {
        type: 'array', maxItems: 500,
        items: {
          type: 'object', required: ['seat', 'street', 'type'], additionalProperties: false,
          properties: {
            seat: { type: 'integer', minimum: 0, maximum: 4 },
            street: { type: 'integer', minimum: 0, maximum: 3 },
            type: { enum: ['fold', 'check', 'call', 'raise'] },
            to: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
  },
};

export const listSchema = {
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      before: { type: 'integer', minimum: 1 }, // next page: games with a smaller id
    },
  },
};
