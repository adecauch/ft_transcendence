# 🖥️ server — le back-end (démarrage, configuration, base de données)

> **Dossier** `server/` · **Stack** Node + Fastify 5 + Prisma 6 + PostgreSQL 17 (Docker) · **Port** 3100
> **Testé par** `npm run test:server` (base lancée)

## NOM

Commandes à la racine : `make` reconstruit et démarre le déploiement HTTPS ;
`make fclean` enlève conteneurs, images locales des services et `dist/` en
conservant PostgreSQL ; `make fclean-db` efface aussi toutes les données du
volume PostgreSQL. `make re` enchaîne `fclean` puis `make` séquentiellement.
Le serveur applique les migrations au lancement, y compris sur une base vide.

`server` — l'API HTTP du jeu : comptes, parties enregistrées et **rejouées**,
statistiques, ranges. Cette page couvre ce qui est **commun** : démarrage,
configuration, fichiers du solveur, schéma de la base. Chaque service a sa page.

## SYNOPSIS

```bash
make postgres-up                # PostgreSQL
npm run server                   # http://127.0.0.1:3100 (recharge à chaque sauvegarde)
curl http://127.0.0.1:3100/api/health        # { "ok": true }
```

```js
// dans un test : l'application sans ouvrir de port
const app = await buildApp(loadConfig(), { logger: false });
const res = await app.inject({ method: 'GET', url: '/api/health' });
```

## DESCRIPTION

Chaque service est découpé de la même façon, **un fichier par rôle** :

| Fichier | Rôle | Il ne fait **pas** |
|---|---|---|
| `schemas.js` | la forme des requêtes et des réponses (JSON Schema, vérifiée par Fastify **avant** le code) | de base de données |
| `service.js` | la logique et la base (Prisma) | de HTTP |
| `routes.js` | le HTTP : lire la requête, appeler le service, répondre | de SQL |

La logique du poker n'est **pas** ici : le serveur importe `src/shared/` (même
moteur que le navigateur).

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `src/index.js` | lance le serveur, ferme proprement sur Ctrl+C / `docker stop` |
| `src/app.js` | `buildApp()` construit l'application **sans ouvrir de port** (les tests l'utilisent) |
| `src/config.js` | lit le `.env` une fois ; une valeur obligatoire manquante arrête tout de suite |
| `src/ai/solverData.js` | lit les fichiers du solveur **une seule fois**, à la demande |
| `src/ai/preflop.js` · `schemas.js` · `routes.js` | `GET /api/ai/preflop` (public) : les 3 ranges préflop de l'IA et les équités, pour le tableau des ranges |
| `prisma/schema.prisma` | les tables ; `prisma/migrations/` = leurs versions successives |
| `scripts/rebuild-infosets.js` | `npm run db:rebuild-infosets` |
| `src/auth/` · `src/games/` · `src/stats/` · `src/ranges/` · `src/friends/` · `src/lobby/` | les services, voir leurs pages |
| `tests/` | voir [tests](../tests/MAN.md) |

## FONCTIONS

### 📄 `src/app.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `buildApp(config, { logger?, prisma?, solver? })` | → `Promise<FastifyInstance>` | crée l'app, ses **décorations** et ses routes ; on peut injecter une autre base ou d'autres fichiers du solveur |

Décorations disponibles dans toutes les routes (`app.xxx`) :

| Nom | Contenu |
|---|---|
| `app.config` | la configuration |
| `app.prisma` | le client de base de données |
| `app.passwords` | `Passwords` (Argon2id) |
| `app.sessions` | `Sessions` (cookies de connexion) |
| `app.solver` | `SolverData` (buckets + stratégie, lus au premier usage) |
| `app.live` | `LiveFeed` (temps réel du tableau de bord) |

Routes montées : `/api/auth`, `/api/games`, `/api` (stats + classement),
`/api/ranges`, et `GET /api/health`. Les logs **masquent** le cookie, le
mot de passe et `set-cookie`.

### 📄 `src/config.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `loadConfig(env = process.env)` | → `{ production, port, databaseUrl, sessionDays, pepper, secureCookies }` | lit l'environnement ; lève une erreur si `DATABASE_URL` manque |

| Variable | Défaut | Sens |
|---|---|---|
| `DATABASE_URL` | **obligatoire** | adresse PostgreSQL |
| `SERVER_PORT` | 3100 | port d'écoute |
| `SESSION_DAYS` | 7 | durée d'une connexion |
| `PASSWORD_PEPPER` | vide = pas de poivre | secret mêlé aux mots de passe (le changer les invalide tous) |
| `NODE_ENV=production` | — | cookie `secure` (HTTPS) et écoute sur `0.0.0.0` |
| `MCCFR_DIR` | `public/ai/mccfr/` | où lire les fichiers d'abstraction ; si défini, `strategy.bin` est lu dans ce dossier |
| `MCCFR_BOT_STRATEGY` | `server/data/strategy.bin` | chemin privé de la stratégie du bot |

### 📄 `src/ai/solverData.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new SolverData(dir?, analysis?)` | — | rien n'est lu tant qu'on ne demande pas ; `analysis` = `server/data/analysis.bin` ou `MCCFR_ANALYSIS` |
| `abstraction()` | → `Promise<{ abstraction, version }>` | les buckets, et la **version d'abstraction** = SHA-256 (16 caractères) des fichiers de buckets **et** de `BETTING_ID` |
| `strategy()` | → `Promise<StrategyTable>` | la **référence** pour comparer le joueur (49 Mo) : `analysis.bin` s'il existe (stratégie plus entraînée, lue par le serveur seulement), sinon la stratégie privée du bot |
| `reference` | → `{ kind: 'analysis' \| 'bot', id }` ou `null` | laquelle a été chargée, et son empreinte (SHA-256, 10 caractères) ; rempli après `strategy()` |

La promesse est gardée : les fichiers sont lus **une seule fois** par processus.

### 📄 `src/ai/preflop.js`, `schemas.js`, `routes.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `aiPreflop(solver)` | → `Promise<{ ranges: { sbOpen, bbVsLimp, bbVsRaise }, equity }>` | les 3 ranges préflop de l'IA (`solverPreflopRange`, arrondies au millième) et l'équité de chaque main contre une main au hasard |
| `GET /api/ai/preflop` | → `200 { ranges, equity }` · `503` si la stratégie manque | public (invités compris), calculé **une fois** puis gardé en mémoire ; le schéma de réponse empêche toute autre donnée de sortir |

Pourquoi : la stratégie ne part plus au navigateur (elle donnerait la bonne
décision en pleine partie). Le tableau des ranges en a besoin pour trois
situations préflop seulement : le serveur les calcule et n'envoie que ça. Ces
tableaux préflop sont publics partout, ils n'aident pas à tricher.

### 📄 `prisma/schema.prisma` — les tables

```
User ─┬─< Session
      ├─< Game ─< Hand ─< Action
      ├─< UserAchievement
      ├─< PlayerInfoset
      └─< SavedRange              (tout en onDelete: Cascade depuis User)
```

| Table | Contenu | Remarques |
|---|---|---|
| `User` | email (minuscules, unique), pseudo (unique), `passwordHash` | le hash n'est **jamais** renvoyé (schémas de réponse) |
| `Session` | `tokenHash` (SHA-256 du cookie), `expiresAt` | déconnexion = ligne supprimée |
| `Game` | adversaires (JSON), tapis de départ, blindes, **état** (`stacks`, `button`, `handsPlayed`), `status` | `PLAYING / WON / LOST / QUIT` ; l'état est celui depuis lequel le serveur rejoue |
| `Hand` | numéro, positions, board, pot, résultat, joueurs (JSON), colonnes `hero…` | les colonnes `hero…` permettent des stats en SQL simple |
| `Action` | `seq, street, seat, type, amount, betTo, potAfter, allIn` | **tous** les coups, blindes comprises |
| `UserAchievement` | `(userId, code)`, `unlockedAt` | un succès une seule fois |
| `PlayerInfoset` | `(userId, version, key)`, `round, player, bucket, history, folds, calls, raises` | donnée **dérivée** ; clé en texte (dépasse le `bigint` signé) |
| `SavedRange` | nom (unique par joueur), `range` (JSON) | 50 max par joueur |

Migrations : `init_auth`, `games_hands_stats`, `player_infosets_saved_ranges`.
Après un changement : `npm --prefix server run db:migrate -- --name xxx`.

### 📄 `scripts/rebuild-infosets.js`

`npm --prefix server run db:rebuild-infosets [-- <userId>]` : vide puis
reconstruit `PlayerInfoset` depuis l'historique (tous les joueurs ou un seul)
avec l'abstraction **actuelle**. À lancer après un réentraînement du solveur.

## COMMANDES

| Commande | Effet |
|---|---|
| `npm run server` / `npm --prefix server run dev` | serveur avec `node --watch` |
| `npm --prefix server start` | serveur sans rechargement (production) |
| `npm --prefix server run db:deploy` | applique les migrations (base neuve) |
| `npm --prefix server run db:generate` | régénère le client Prisma |
| `npm --prefix server run db:studio` | explorer la base dans le navigateur |
| `npm run test:server` | les tests contre la vraie base |

## POURQUOI / PIÈGES

- **Prisma 6, pas 7** : Prisma 7 refuse Node 23 (celui du Mac).
- Base absente : le serveur démarre, `/api/health` répond, mais toute route qui lit la base échoue.
- `EADDRINUSE` sur 3100 : un ancien serveur tourne encore (`pkill -f "src/index.js"`).

## VOIR AUSSI

[auth](src/auth/MAN.md) · [games](src/games/MAN.md) · [stats](src/stats/MAN.md) ·
[ranges](src/ranges/MAN.md) · [friends](src/friends/MAN.md) · [lobby](src/lobby/MAN.md) · [tests](../tests/MAN.md) · `server/README.md` · `server/STATS.md`
