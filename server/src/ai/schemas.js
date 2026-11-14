/**
 * schemas.js — What /api/ai sends back (JSON Schema, checked by Fastify)
 *
 * The response is checked too: only the three preflop grids and the equities
 * can leave, whatever preflop.js computes.
 */

import { SOLVER_SPOTS } from '../../../src/shared/ai/preflopRanges.js';

const probability = { type: 'number', minimum: 0, maximum: 1 };
const range = {
  type: ['object', 'null'],
  maxProperties: 169,
  additionalProperties: {
    type: 'object',
    required: ['fold', 'call', 'raise'],
    additionalProperties: false,
    properties: { fold: probability, call: probability, raise: probability },
  },
};

export const preflopSchema = {
  response: {
    200: {
      type: 'object',
      required: ['ranges', 'equity'],
      additionalProperties: false,
      properties: {
        ranges: {
          type: 'object',
          required: Object.keys(SOLVER_SPOTS),
          additionalProperties: false,
          properties: Object.fromEntries(Object.keys(SOLVER_SPOTS).map((spot) => [spot, range])),
        },
        equity: { type: 'object', maxProperties: 169, additionalProperties: probability },
      },
    },
  },
};
