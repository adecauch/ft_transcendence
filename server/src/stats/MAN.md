# 📈 server/stats — statistiques, tableau de bord, solveur, classement

> **Dossier** `server/src/stats/` · **Routes** `/api/stats/*`, `/api/leaderboard` · **Testé par** `server/tests/dashboard.test.mjs`, `infosets.test.mjs`, `games.test.mjs`

## NOM

`stats` — tout ce qu'on **lit** dans les mains enregistrées : totaux, tableau
de bord filtré, export CSV, temps réel, décisions comparées au solveur, range
jouée, classement.

## SYNOPSIS

```http
GET /api/stats/me                                 → { totals, achievements }
GET /api/stats/dashboard?from&to&level&opponents&tz → { summary, curve, timeline, byLevel, byPosition, byOpponents, actions }
GET /api/stats/export.csv?mêmes filtres           → fichier CSV
GET /api/stats/live                               → flux SSE, un événement « hand » par main enregistrée
GET /api/stats/solver                             → le joueur comparé au solveur
GET /api/stats/range                              → range jouée, erreurs, pertes
GET /api/leaderboard                              → { players, me }     (public)
```

## DESCRIPTION

Les chiffres sont calculés **en SQL** directement sur `Hand` / `Game` / `Action`
(colonnes `hero…`, `COUNT(*) FILTER`). Tous les montants du tableau de bord
sont en **grosses blindes** (`heroNet / bigBlind`) : on peut additionner des
parties aux blindes différentes. Les valeurs passent par les gabarits
`$queryRaw` de Prisma : **toujours envoyées en paramètres**, jamais collées dans le SQL.

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `totals.js` | les totaux du joueur (deux requêtes) |
| `dashboard.js` | les chiffres du tableau de bord, tous sur **le même** ensemble filtré |
| `exportCsv.js` | les mains filtrées en CSV |
| `liveFeed.js` | temps réel (Server-Sent Events) |
| `infosets.js` | après chaque main, compte les décisions du joueur par clé du solveur |
| `rebuildInfosets.js` | reconstruit `PlayerInfoset` depuis l'historique |
| `solverReport.js` | le joueur comparé au solveur, situation par situation |
| `schemas.js` | les filtres du tableau de bord et du CSV |
| `routes.js` | les 7 routes |

## FONCTIONS

### 📄 `totals.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `playerTotals(prisma, userId)` | → `{ games, gamesWon, gamesLost, gamesQuit, hands, handsWon, showdowns, showdownsWon, vpipHands, pfrHands, net, biggestPot }` | onglet Statistiques, et les succès (`totals`) |

### 📄 `dashboard.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `filteredHands(userId, { from, to, level, opponents })` | → fragment SQL `(…) f` | **un seul** filtre partagé par toutes les requêtes et le CSV ; `level` = le niveau des IA de la partie, ou `mixed` |
| `dashboard(prisma, userId, query)` | → objet (voir ci-dessous) | 7 requêtes en parallèle |
| `sampleCurve(rows)` | → ≤ 300 points | courbe allégée, la dernière main toujours incluse |
| `safeZone(tz)` | → fuseau connu ou `'UTC'` | fuseau du navigateur vérifié |

| Clé de la réponse | Contenu |
|---|---|
| `summary` | mains, parties, résultat en BB, BB/100, mains gagnées, VPIP, PFR, abattages |
| `curve` | résultat cumulé main après main |
| `timeline` | par **jour** (par **semaine** au-delà de 90 jours) dans le fuseau du navigateur : mains, BB, VPIP, PFR |
| `byLevel`, `byPosition`, `byOpponents` | BB/100 par niveau d'IA, par position (bouton / SB / BB / autre), par nombre d'IA |
| `actions` | les coups du joueur (fold, check, call, bet, raise) par tour |

### 📄 `exportCsv.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `exportCsv(prisma, userId, query)` | → texte CSV | une ligne par main (100 000 max), jetons **et** BB, 17 colonnes en français |
| `csvCell(value)` | → cellule | guillemets si besoin ; une cellule texte qui commence par `= + - @` reçoit une apostrophe (**injection CSV**) |

BOM UTF-8 en tête : sans lui, Excel affiche « Ã© » au lieu de « é ».

### 📄 `liveFeed.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new LiveFeed()` | — | les flux ouverts, par joueur (`app.live`) |
| `open(userId, req, res)` | — | garde la réponse ouverte en `text/event-stream` ; `retry: 5000` ; un ping toutes les 25 s |
| `publish(userId, event, data)` | — | envoie l'événement à **tous** les onglets ouverts de ce joueur |
| `closeAll()` | — | arrêt du serveur : ferme tous les flux |

**Pourquoi SSE et pas WebSocket** : le serveur parle dans un seul sens, SSE
est du HTTP normal (passe par le proxy Vite et nginx, garde le cookie) et le
navigateur se reconnecte tout seul. En mémoire, un seul processus.

### 📄 `infosets.js` et `rebuildInfosets.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `recordInfosets(prisma, solver, userId, decisions)` | → nombre classé | décisions → clés (`playerInfosets`) → `upsert` (+1 à `folds/calls/raises`) avec la version d'abstraction |
| `rebuildInfosets(prisma, solver, { userId?, onProgress? })` | → `{ users, hands, decisions, failed }` | efface puis rejoue **toutes** les mains enregistrées (`replayInputs` + `replayHand`) |

### 📄 `solverReport.js`

| Nom | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `solverReport(prisma, solver, userId)` | → `{ version, reference, decisions, infosets, compared, averageGap, spots }` (`reference` : stratégie comparée, voir `solverData.js`) | pour chaque situation vue au moins `MIN_SAMPLES` fois : fréquences du joueur, du solveur, écart |
| `MIN_SAMPLES` | 4 | en dessous, pas assez d'exemples |
| `FROM_ROUND` | 0 | tous les tours, préflop compris |

Chaque `spot` : `round, player, bucket, strength` (fourchette d'EHS après le
flop) ou `hands` (mains du bucket préflop), `history, n, you, solver, gap`.
L'écart moyen est **pondéré** par la fréquence ; les 8 situations affichées sont
triées par `écart × √n`.

### 📄 `schemas.js`

`from`, `to` (dates ISO, `to` exclu), `level` (`beginner | regular | expert | mixed`),
`opponents` (1–4), `tz` (nom IANA, 64 caractères max). `LEVELS` exporté.

### 📄 `routes.js`

| Route | Garde | Détail |
|---|---|---|
| `GET /stats/me` | connecté | totaux + succès (`id`, `unlockedAt`) |
| `GET /stats/solver` | connecté | `solverReport` |
| `GET /stats/range` | connecté | les 5 000 mains les plus récentes → `analyseHands` (sans fichiers du solveur : pas d'erreurs d'équité) |
| `GET /stats/dashboard` | connecté | `dashboard` |
| `GET /stats/export.csv` | connecté | fichier `poker-mains-AAAA-MM-JJ.csv` |
| `GET /stats/live` | connecté | `reply.hijack()` puis `live.open` |
| `GET /leaderboard` | public | top 20 par parties gagnées, puis taux, puis mains (`RANK()` : ex æquo = même rang) ; `me` = la ligne du joueur même hors du top |

## POURQUOI / PIÈGES

- **Une seule définition du filtre** (`filteredHands`) : tuiles, graphiques et
  CSV ne peuvent pas se contredire.
- Seules les parties **terminées** comptent au classement.
- `PlayerInfoset` n'est lu que pour la **version** d'abstraction courante.

## VOIR AUSSI

[stats (shared)](../../../src/shared/stats/MAN.md) · [games](../games/MAN.md) ·
[ui/stats](../../../src/front/ui/stats/MAN.md) · [dashboard](../../../src/front/ui/stats/dashboard/MAN.md) · `server/STATS.md`
