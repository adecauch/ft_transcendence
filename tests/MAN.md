# ✅ tests — les tests automatiques

> **Dossiers** `tests/` (logique pure, 64 tests) et `server/tests/` (routes contre la vraie base, 41 tests) · **Outil** `node --test` (aucune bibliothèque)

## NOM

`tests` — ce qui prouve que les règles, l'IA, le rejeu et l'API font ce qu'on dit.

## SYNOPSIS

```bash
npm run test:ai          # tests/*.test.mjs — rapide, pas besoin de base
make postgres-up
npm run test:server      # server/tests/*.test.mjs — contre PostgreSQL
node --test tests/showdown.test.mjs     # un seul fichier
```

## DESCRIPTION

`src/shared/` ne touche jamais l'écran : il se teste **directement dans Node**.
Les tests du serveur construisent l'application **sans ouvrir de port**
(`buildApp` + `app.inject`) et parlent à la **vraie** base ; chaque fichier crée
ses comptes `…@test.invalid` et les **supprime** à la fin.

## `tests/` — logique pure (64)

| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| `pokerGame.test.mjs` | 6 | parties complètes : aucun jeton créé ni perdu, cartes toutes différentes, en tête-à-tête le bouton est la petite blinde et avance, fin de partie, `abort()` |
| `betting.test.mjs` | 7 | raccourcis de relance (préflop, face à une relance, postflop, tapis court), mises en un clic, montants en BB |
| `showdown.test.mjs` | 7 | pots secondaires, jetons des couchés, mise non suivie rendue, partage et jeton impair, noms français |
| `pokerBot.test.mjs` | 14 | FNV-1a = valeurs de référence, clés présentes dans la stratégie privée, `strategy.bin`, **arbre JS = solveur** (mains abstraites au hasard : chaque nœud existe avec le même nombre d'options), tailles jouées, évaluateur, buckets, traduction de l'historique, décisions toujours légales, face à un tapis |
| `replay.test.mjs` | 5 | chaque journal se rejoue aux mêmes tapis (2 à 5 joueurs), reprise depuis l'état du serveur, **triche refusée**, succès, décisions → clés |
| `ranges.test.mjs` | 9 | grille (169 mains, 1 326 combinaisons), notation, ranges de l'IA, range jouée et erreurs, `cleanRange`, **même clé pour le bot et les stats**, historiques en français |
| `theory.test.mjs` | 4 | table d'équités (duels connus, symétrie), le modèle joue les mains évidentes comme il faut |
| `authRules.test.mjs` | 2 | code ami `Pseudo#1234` : écrit, relu, et tout le reste refusé |
| `remoteGame.test.mjs` | 5 | connexion WebSocket distante, événements ordonnés, action humaine, protocole incompatible, reconnexion, chrono / pause, **table partagée** (créer, rejoindre, salle d'attente, lancer) |
| `viewpoint.test.mjs` | 5 | la table vue depuis chaque siège : sièges tournés, fin de partie « dernier en jeu », **à 3 joueurs sur 20 parties, chacun retrouve par ses événements tournés les chiffres de son vrai siège**, cartes des autres cachées, demandes de décision tournées |

## `server/tests/` — l'API (41)

| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| `auth.test.mjs` | 7 | inscription (mot de passe stocké **seulement** en hash Argon2id), connexion, même `401` pour les deux erreurs, déconnexion côté serveur, validation avant la base, doublons `409`, `/me` sans cookie, limite d'essais |
| `games.test.mjs` | 4 | une partie entière enregistrée main par main puis visible dans l'historique, les stats et le classement ; mains illégales / répétées / d'un autre refusées ; abandon ; invités |
| `infosets.test.mjs` | 3 | décisions classées sous les clés du solveur, rapport sur tous les tours, invités |
| `ranges.test.mjs` | 3 | enregistrer, lister, renommer, modifier, supprimer ; refus ; invités |
| `shared.test.mjs` | 5 | **tables partagées** : invités refusés, codes, seul l'hôte lance (2 joueurs min.) ; à 2, chacun voit sa table et jamais les cartes de l'autre, mains enregistrées pour les deux (gains opposés), `WON` / `LOST` ; à 3 + 1 IA, un départ n'arrête pas la partie ; coupure en salle d'attente et reprise par jeton ; invitation avec code effacée en s'asseyant |
| `table.test.mjs` | 7 | table serveur par WebSocket : cartes adverses cachées, action illégale refusée, partie enregistrée, **reprise après coupure** (l'action après reconnexion est bien jouée), chrono du tour gelé en pause, **message envoyé dès l'ouverture non perdu** (session lente) |
| `ai.test.mjs` | 1 | `GET /api/ai/preflop` : public, seulement les 3 grilles préflop et les équités |
| `friends.test.mjs` | 5 | invités refusés ; demande → acceptation → amis ; recherche par code ami (jamais d'email, jamais soi-même) ; demandes croisées ; **présence** (en ligne tant que le flux est ouvert, en partie à une table, « vu » après) ; invitations (ami en ligne seulement, prévenu en direct, refus) |
| `dashboard.test.mjs` | 6 | totaux en BB, filtres, réservé au joueur, CSV (formules neutralisées), échantillonnage de la courbe, **flux temps réel** |

### 📄 `server/tests/helpers.mjs`

| Nom | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `testApp()` | → `{ app, player, close, run }` | une app sur la vraie base, un suffixe aléatoire par fichier |
| `player(name)` | → `{ id, username, tag, sid, get, post, put, del }` | un joueur **inscrit et connecté** ; chaque requête porte son cookie (`sid` : pour ouvrir un flux SSE avec `fetch`) |
| `close()` | — | supprime les comptes `…@test.invalid` du fichier (et tout ce qui leur appartient, en cascade), ferme l'app |
| `playGame(maxHands, config)` | → `{ logs, stacks, over }` | une partie jouée **localement** par des agents au hasard (mais légaux), avec les journaux tels que le navigateur les enverrait |
| `CONFIG` | — | 1 IA Expert, 300 jetons, 10/20 |

## POURQUOI / PIÈGES

- **Tests contre la vraie base** : c'est là que se cachent les vraies erreurs
  (contraintes uniques, SQL, transactions). La base doit tourner.
- Le compte réel de l'utilisateur n'est jamais touché : seuls les `…@test.invalid` sont supprimés.

## VOIR AUSSI

[shared/poker](../src/shared/poker/MAN.md) · [shared/ai](../src/shared/ai/MAN.md) · [shared/stats](../src/shared/stats/MAN.md) · [server](../server/MAN.md)
