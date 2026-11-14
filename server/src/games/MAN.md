# 🎲 server/games — les parties enregistrées coup par coup

> **Dossier** `server/src/games/` · **Routes** `/api/games/*` (connecté) · **Testé par** `server/tests/games.test.mjs`

## NOM

`games` — ouvrir une partie, recevoir le **journal** de chaque main, le
**rejouer**, l'enregistrer, débloquer les succès ; lister et relire ses parties.

## SYNOPSIS

```http
POST /api/games                { opponents, startingStack, blinds }  → 201 { game }
POST /api/games/:id/hands      journal d'une main                    → 201 { hand, game, achievements }
                                                                      → 422 refusée · 409 déjà enregistrée
POST /api/games/:id/quit                                              → 204
GET  /api/games?limit&before                                          → { games, next }
GET  /api/games/:id                                                   → { game, hands }
```

## DESCRIPTION

Le cœur est `saveHand()` :

1. **rejouer** le journal depuis l'état **stocké** de la partie (`replayHand`) ;
   tout coup illégal → `ReplayError` → `422` ;
2. dans **une transaction** : avancer l'état de la partie (seulement s'il n'a pas
   bougé entre-temps), créer la `Hand` et chaque `Action` ;
3. tester les succès et enregistrer les nouveaux.

Tapis, pots et gagnants viennent **toujours** du rejeu, jamais du navigateur.
Un joueur ne voit que **ses** parties (l'id d'un autre → `404`, comme si elle n'existait pas).

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `schemas.js` | forme d'une nouvelle partie, d'un journal de main, de la pagination |
| `service.js` | démarrer, enregistrer une main par rejeu ou directement depuis le moteur serveur, quitter ; forme publique d'une partie et d'une main |
| `routes.js` | les 5 routes HTTP, toutes réservées aux joueurs connectés |

## FONCTIONS

### 📄 `schemas.js`

| Schéma | Vérifie |
|---|---|
| `startSchema` | 1 à 4 adversaires `{ name, level }` (`beginner/regular/expert`), tapis 10 – 1 000 000, blindes |
| `handSchema` | `handNo`, `hole` (2 à 5 sièges, `null` = éliminé), `board` ≤ 5, `actions` ≤ 500 (`fold/check/call/raise`, `to`) ; cartes `^[2-9TJQKA][SHDC]$` |
| `listSchema` | `limit` 1–50 (20 par défaut), `before` (page suivante) |
| `idParams` | `id` entier ≥ 1 |

### 📄 `service.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `startGame(prisma, user, { opponents, startingStack, blinds })` | → `Game` | crée la partie ; une ancienne partie restée `PLAYING` (onglet fermé) devient `QUIT` |
| `saveHand(prisma, user, game, log)` | → `{ hand, game, achievements, decisions }` | les 3 étapes ci-dessus ; lève `ReplayError` ou `HandConflict` |
| `saveServerHand(prisma, user, game, record, state)` | → `{ hand, game, achievements, dbGame }` | enregistre un `HandRecorder.record` produit par le `PokerGame` serveur, sans rejeu client |
| `quitGame(prisma, game)` | → `void` | `QUIT`, tapis final gardé |
| `seatsOf(game, user)` | → sièges | le joueur (nommé comme son compte) puis les IA, comme les voit le moteur |
| `publicGame(g)` | → objet | la partie telle que l'API la montre (`net`, `stack`, blindes…) |
| `publicHand(h)` | → objet | une main pour l'historique : les cartes des IA **cachées** sauf si montrées à l'abattage |
| `HandConflict` | classe d'erreur | main déjà enregistrée ou hors d'ordre |
| `unlockAchievements(…)` | → `string[]` | totaux + succès déjà eus → `newlyUnlocked` → `createMany` |

### 📄 `routes.js`

| Route | Codes | Détail |
|---|---|---|
| `POST /` | 201, 400 | `400` si grosse blinde < petite |
| `POST /:id/hands` | 201, 404, 409, 422 | `handNo ≤ handsPlayed` → `409` (renvoi réseau) ; après l'enregistrement : classe les décisions (`recordInfosets`) et prévient les tableaux de bord ouverts (`live.publish`) |
| `POST /:id/quit` | 204, 404 | — |
| `GET /` | 200 | plus récentes d'abord ; `next` = id pour la page suivante (on lit `limit + 1` lignes pour le savoir) |
| `GET /:id` | 200, 404 | la partie et **toutes** ses mains avec tous leurs coups |

## EXEMPLE

```js
// ce que fait GameRecorder dans le navigateur
const { data } = await request('POST', '/api/games', { opponents: [{ name: 'Doc', level: 'expert' }],
                                                       startingStack: 2000, blinds: { small: 10, big: 20 } });
await request('POST', `/api/games/${data.game.id}/hands`, log);  // un journal par main, dans l'ordre
```

## POURQUOI / PIÈGES

- **Concurrence** : la mise à jour de la partie a pour condition
  `handsPlayed = <celui du rejeu>`. Deux envois simultanés de la même main :
  un seul réussit, l'autre reçoit `409`.
- Le classement des décisions (`PlayerInfoset`) est **hors transaction** : s'il
  échoue (fichiers du solveur absents), la main reste enregistrée et
  `db:rebuild-infosets` réparera.
- L'historique ne montre pas les cartes que le joueur n'a pas vues.

## VOIR AUSSI

[stats (shared)](../../../src/shared/stats/MAN.md) (`replayHand`, `HandRecorder`, succès) ·
[server/stats](../stats/MAN.md) (`recordInfosets`, `liveFeed`) · [game (front)](../../../src/front/game/MAN.md) (`GameRecorder`) ·
`server/STATS.md`
