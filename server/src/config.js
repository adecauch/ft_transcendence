/**
 * config.js — Settings read from the environment (the .env file at the repo root)
 *
 * Read once at start-up; a missing required value stops the server right away
 * rather than failing on the first request.
 */

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const allowedOrigins = (env.WS_ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  return {
    production,
    port: Number(env.SERVER_PORT ?? 3100),
    databaseUrl: required('DATABASE_URL'),
    sessionDays: Number(env.SESSION_DAYS ?? 7),
    // Optional: an empty pepper means "no pepper"
    pepper: env.PASSWORD_PEPPER || null,
    // Cookies only over HTTPS in production (nginx); plain http://localhost in dev
    secureCookies: production,
    tableReconnectMs: Number(env.TABLE_RECONNECT_MS ?? 30_000),
    // Turn clock of a server table (see table/session.js); unset = its defaults
    tableTiming: {
      ...(env.TABLE_ACTION_MS && { actionMs: Number(env.TABLE_ACTION_MS) }),
      ...(env.TABLE_MAX_PAUSE_MS && { maxPauseMs: Number(env.TABLE_MAX_PAUSE_MS) }),
    },
    wsMaxMessageBytes: Number(env.WS_MAX_MESSAGE_BYTES ?? 16_384),
    wsMaxMessagesPerMinute: Number(env.WS_MAX_MESSAGES_PER_MINUTE ?? 120),
    wsAllowedOrigins: allowedOrigins,
  };
}
