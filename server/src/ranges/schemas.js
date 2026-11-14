/**
 * schemas.js — What /api/ranges accepts (JSON Schema, checked by Fastify)
 *
 * The shape only; the content (real hand types, frequencies summing to at
 * most 1) is checked by cleanRange() (src/shared/poker/ranges.js) in the service.
 */

import { RANGE_NAME_MAX } from '../../../src/shared/poker/ranges.js';

const name = { type: 'string', minLength: 1, maxLength: RANGE_NAME_MAX };
const range = {
  type: 'object',
  maxProperties: 169,
  additionalProperties: {
    type: 'object',
    additionalProperties: { type: 'number', minimum: 0, maximum: 1 },
  },
};
const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } };

export const createSchema = {
  body: { type: 'object', required: ['name', 'range'], additionalProperties: false, properties: { name, range } },
};

export const updateSchema = {
  params: idParams,
  body: { type: 'object', minProperties: 1, additionalProperties: false, properties: { name, range } },
};

export const idSchema = { params: idParams };
