# ft_transcendence

Poker Transcendence is a 3D Texas Hold'em No-Limit poker game. The player
faces AI opponents whose decisions are driven by a C++ MCCFR solver strategy.
The project also provides accounts, saved games, statistics, achievements,
leaderboards and an educational range explorer.

The game is built with Vanilla JavaScript and Three.js. The backend uses
Fastify, Prisma and PostgreSQL. Podman Compose runs the complete application
with nginx as the HTTPS entry point.

## Quick Start

### Containerized application

Requirements:

- Podman;
- a Podman Compose provider;
- OpenSSL for the local development certificate.

On macOS, start the Podman machine first:

```bash
podman machine start
```

On Fedora, Podman runs natively. Then start the application:

```bash
cp .env.example .env
make
```

Open <https://localhost:8443>. nginx redirects HTTP on port `8080` to HTTPS.
The certificate is self-signed and intended for local development, so the
browser will ask for confirmation the first time.

`make` (or `make up`) builds the application images, then recreates the
containers so the latest code is actually running. Database migrations are
applied automatically by the server at startup.

```bash
make fclean     # Remove containers, local service images and dist; keep the database
make            # Rebuild and start
make re         # Shortcut for the two commands above
```

For a fresh test database, use `make fclean-db` followed by `make`.
**This deletes all users, games, friendships and saved data.**
Both cleanup targets keep `.env` and the local HTTPS certificates. Build cache
and host-side `node_modules` are retained.

Stop the application without deleting the database volume:

```bash
make down
```

On macOS, stop the Podman machine when it is no longer needed:

```bash
podman machine stop
```

Only nginx publishes host ports in the main Compose file. PostgreSQL and
Fastify communicate through the private Compose network. Commands that need
host access for development or integration tests use
`docker-compose.dev.yml` automatically through the Makefile.

### Local development

Install dependencies and generate the Prisma client:

```bash
make install
```

Start PostgreSQL for host-side development commands:

```bash
make postgres-up
make migrate
```

Run the Vite frontend and the Fastify server together:

```bash
npm run dev
```

The frontend runs on <http://localhost:3000> and proxies `/api` to the local
backend on port `3100`.

## Tests and Build

```bash
npm run test:ai       # Pure poker, betting and MCCFR tests
make test-server      # Backend integration tests and database fixtures
npm run build         # Production frontend build
make compose-config   # Validate the main Compose configuration
```

The full test target is also available:

```bash
make test
```

The debug mode displays AI cards and a large decision panel:

```bash
npm run debug_ia
```

## Architecture

The project separates pure game logic from presentation:

```text
src/shared/      Pure logic shared by the frontend and server
src/front/       Three.js scene, input, UI, networking and animations
server/          Fastify routes, Prisma services, authentication and statistics
nginx/           Frontend image and HTTPS reverse proxy
tests/           Shared logic tests
```

The front end and backend may import `src/shared/`; shared logic must not depend
on the DOM, Three.js, timers or server-specific APIs.

Important backend documentation is available in:

- `server/README.md`: accounts, sessions, local backend commands;
- `server/STATS.md`: recorded hands, replay validation and statistics;
- `src/shared/README.md`: pure game and AI logic;
- `src/front/README.md`: frontend structure and rendering responsibilities;
- `docs/project/ROADMAP.md`: project roadmap and Transcendence requirements.
- `MAN.md` in each code folder: files, functions and design notes;
  `npm run docs:man` gathers them into `docs/man/index.html`.

## Main Features

- 3D saloon table with a cowboy dealer and seated AI opponents;
- Texas Hold'em betting, side pots, showdown and persistent stacks;
- MCCFR strategy lookup with solver-compatible information-set keys;
- account registration, login and secure sessions;
- server-side replay validation for recorded hands;
- statistics, achievements, history and leaderboard;
- range explorer, range builder and played-range history;
- pause menu, camera close-ups and an AI debugging mode.

## Makefile Commands

```text
make up              Start the complete HTTPS application
make down            Stop the containers and keep PostgreSQL data
make restart         Restart the complete application
make ps              Show container status
make logs            Follow all container logs
make postgres-up     Start PostgreSQL with host access for development
make server-up       Start the backend with host access for development
make frontend-build  Build the nginx image
make test            Run the AI and server test suites
make postgres-reset  Delete the PostgreSQL volume and all local data
```

## Credits

- Card faces: RevK SVG playing cards, CC0.
- Dealer and weapons: Quaternius, CC0.
- Table: Pieter Ferreira, CC BY 4.0, modified for this project.
- Fonts: Rye, Lilita One and Nunito, SIL Open Font License.

See the asset credits in the source documentation for the original links and
the exact files used.
