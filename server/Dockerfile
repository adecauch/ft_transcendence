FROM docker.io/library/node:22-bookworm-slim

ENV NODE_ENV=production
ENV SERVER_PORT=3100

WORKDIR /app/server

# Prisma needs OpenSSL to select the correct query engine.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Keep the Prisma CLI available because the container applies migrations.
COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/prisma ./prisma
RUN npx prisma generate

# The backend imports shared logic and reads the solver data from the repo root.
COPY server/src ./src
COPY server/scripts ./scripts
COPY server/data/strategy.bin ./data/strategy.bin
COPY src/shared /app/src/shared
COPY public/ai /app/public/ai

USER node

EXPOSE 3100

CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
