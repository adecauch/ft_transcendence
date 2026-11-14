/**
 * schemas.js — What the dashboard routes accept (JSON Schema, checked by Fastify)
 *
 * The same filters for the dashboard and the CSV export:
 *   from, to    ISO date-times (the browser sends the start / end of the chosen
 *               days in its own time zone); `to` is excluded
 *   level       the AIs' level: beginner | regular | expert, or mixed (several levels)
 *   opponents   number of AIs at the start of the game (1 to 4)
 *   tz          the browser's time zone (IANA name), to cut the time line into
 *               ITS days; checked against the list Node knows (dashboard.js)
 */

export const LEVELS = ['beginner', 'regular', 'expert', 'mixed'];

const filters = {
  type: 'object',
  additionalProperties: false,
  properties: {
    from: { type: 'string', format: 'date-time' },
    to: { type: 'string', format: 'date-time' },
    level: { enum: LEVELS },
    opponents: { type: 'integer', minimum: 1, maximum: 4 },
    tz: { type: 'string', maxLength: 64 },
  },
};

export const dashboardSchema = { querystring: filters };
export const exportSchema = { querystring: filters };
