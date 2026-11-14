/**
 * index.js — Starts the server: `npm run dev` (reloads on save) or `npm start`
 */

import { loadConfig } from './config.js';
import { buildApp } from './app.js';

const config = loadConfig();
const app = await buildApp(config);

// Stop cleanly on Ctrl+C / container stop (closes the database connections)
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

await app.listen({ port: config.port, host: config.production ? '0.0.0.0' : '127.0.0.1' });
