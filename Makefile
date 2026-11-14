# **************************************************************************** #
#                                                                              #
#                                                         :::      ::::::::    #
#    Makefile                                           :+:      :+:    :+:    #
#                                                     +:+ +:+         +:+      #
#    By: adecauch <adecauch@student.42.fr>          +#+  +:+       +#+         #
#                                                 +#+#+#+#+#+   +#+            #
#    Created: 2026/10/06 16:41:12 by adecauch          #+#    #+#              #
#    Updated: 2026/10/07 14:55:54 by adecauch         ###   ########.fr        #
#                                                                              #
# **************************************************************************** #

# Project commands use Podman on Linux and macOS.
PODMAN ?= podman
COMPOSE ?= $(PODMAN) compose
DEV_COMPOSE = $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
.DEFAULT_GOAL := all

.PHONY: all help install podman-check compose-config up down restart ps logs \
	postgres-up postgres-down postgres-reset postgres-logs server-build server-up server-logs frontend-build frontend-up frontend-logs certs migrate generate \
	dev dev-front server build test test-ai test-server clean fclean fclean-db re

all: up

help:
	@printf '%s\n' \
		'Usage: make [target] (default: rebuild and start the HTTPS application)' \
		'  fclean           Remove containers, local service images and dist; keep the database' \
		'  fclean-db        Same cleanup AND erase PostgreSQL data (users, games, friends)' \
		'  re               fclean then rebuild and start (database kept)' \
		'' \
		'Podman:' \
		'  podman-check     Check Podman and the Compose provider' \
		'  compose-config   Validate the Compose configuration' \
		'  up               Rebuild images and recreate the Compose services' \
		'  down             Stop the Compose services' \
		'  restart          Restart the Compose services' \
		'  ps               Show Compose containers' \
		'  logs             Follow Compose logs' \
		'' \
		'Database:' \
		'  postgres-up      Start PostgreSQL' \
		'  postgres-down    Stop PostgreSQL' \
		'  postgres-reset   Stop PostgreSQL and delete its volume' \
		'  postgres-logs    Follow PostgreSQL logs' \
		'  server-build     Build the backend image' \
		'  server-up        Start PostgreSQL and the backend' \
		'  server-logs      Follow backend logs' \
		'  frontend-build   Build the frontend and nginx image' \
		'  frontend-up      Start the complete HTTPS application' \
		'  frontend-logs    Follow nginx logs' \
		'  migrate          Apply Prisma migrations' \
		'  generate         Generate the Prisma client' \
		'' \
		'Application:' \
		'  install          Install frontend and server dependencies' \
		'  dev              Start frontend and backend development servers' \
		'  dev-front        Start the frontend development server' \
		'  server           Start the backend development server' \
		'  build            Build the frontend' \
		'  test             Run all project tests' \
		'  test-ai          Run pure logic and AI tests' \
		'  test-server      Run backend integration tests'

podman-check:
	$(PODMAN) --version
	$(PODMAN) info
	$(COMPOSE) version

compose-config:
	$(COMPOSE) config

up: certs
	$(COMPOSE) build server nginx
	$(COMPOSE) up -d --force-recreate

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) down
	$(MAKE) up

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f

postgres-up:
	$(DEV_COMPOSE) up -d db

postgres-down:
	$(DEV_COMPOSE) stop db

postgres-reset:
	$(DEV_COMPOSE) down -v

postgres-logs:
	$(COMPOSE) logs -f db

server-build:
	$(COMPOSE) build server

server-up:
	$(DEV_COMPOSE) up -d server

server-logs:
	$(COMPOSE) logs -f server

frontend-build:
	$(COMPOSE) build nginx

frontend-up: certs
	$(COMPOSE) up -d nginx

frontend-logs:
	$(COMPOSE) logs -f nginx

certs:
	sh scripts/generate-dev-cert.sh

migrate: postgres-up
	npm --prefix server run db:deploy

generate:
	npm --prefix server run db:generate

install:
	npm install
	npm --prefix server install
	$(MAKE) generate

dev:
	npm run dev

dev-front:
	npm run dev:front

server:
	npm run server

build:
	npm run build

test: test-ai test-server

test-ai:
	npm run test:ai

test-server: postgres-up
	npm run test:server

clean:
	rm -rf dist

# Keep PostgreSQL's named volume, .env and development certificates.
fclean:
	$(COMPOSE) down --remove-orphans --rmi local
	$(MAKE) clean

# Explicit database reset: the next `make` applies migrations to the empty volume.
fclean-db:
	$(COMPOSE) down --remove-orphans --rmi local --volumes
	$(MAKE) clean

# Keep the steps sequential even when invoked with make -j.
re: fclean
	$(MAKE) all
