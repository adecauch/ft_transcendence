/**
 * schemas.js — What /api/lobby accepts and returns (JSON Schema, checked by Fastify)
 */

const player = {
  type: 'object',
  properties: { id: { type: 'integer' }, username: { type: 'string' }, tag: { type: 'integer' } },
};
const error = { type: 'object', properties: { error: { type: 'string' } } };

export const listSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        invitations: {
          type: 'array',
          items: { type: 'object', properties: { id: { type: 'integer' }, from: player, tableId: { type: 'string', nullable: true }, sentAt: { type: 'string', format: 'date-time' } } },
        },
      },
    },
  },
};

export const inviteSchema = {
  body: {
    type: 'object', required: ['userId'], additionalProperties: false,
    // tableId: the code of the shared table the player sits at (table/shared.js)
    properties: { userId: { type: 'integer', minimum: 1 }, tableId: { type: 'string', pattern: '^[A-Z0-9]{6}$' } },
  },
  response: {
    201: { type: 'object', properties: { invitation: { type: 'object', properties: { id: { type: 'integer' }, to: player, tableId: { type: 'string', nullable: true }, sentAt: { type: 'string', format: 'date-time' } } } } },
    400: error, 404: error, 409: error,
  },
};

export const idSchema = { params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } } };
