# 🌐 net — parler au serveur

> **Dossier** `src/front/net/` · **Couche** front · **Parle à** `/api/*` (même origine : proxy Vite en dev, nginx en production)

## NOM

`net` — **une** fonction `fetch` qui ne lève jamais d'erreur, et une petite
API par service du serveur.

## SYNOPSIS

```js
import { gamesApi } from './net/gamesApi.js';

const res = await gamesApi.stats();
if (res.ok) show(res.data.totals);
else showError(res.error);          // déjà en français
```

## DESCRIPTION

Chaque appel **se résout toujours** (jamais d'exception) en :

```js
{ ok: true,  status, data }
{ ok: false, status, data?, error, field? }        // error en français, field = le champ concerné
{ ok: false, status: 0, offline: true, error }     // serveur injoignable
```

Le cookie de session est `httpOnly` : ce code ne le voit **jamais**, le
navigateur l'envoie tout seul (même origine).

## FICHIERS ET FONCTIONS

### 📄 `request.js`

| Nom | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `request(method, url, body?)` | → `Promise<{ ok, status, data, error?, field?, offline? }>` | le seul `fetch` du front ; `204` → `data: null` |
| `OFFLINE` | texte | « Serveur injoignable : le back-end est-il lancé ? (npm run server) » |

Messages : on garde **nos** messages français (`data.error`) sauf pour les
`400` de validation de Fastify (en anglais), remplacés par « Certaines
informations ne sont pas valides ». `502–504` (Vite quand le serveur est
arrêté) = hors ligne.

### 📄 `authApi.js`

| Fonction | Route | Résultat |
|---|---|---|
| `authApi.me()` | `GET /api/auth/me` | `{ ok, user }` (`user = null` si personne) |
| `authApi.login({ email, password })` | `POST /login` | `{ ok, user }` |
| `authApi.register({ email, username, password })` | `POST /register` | `{ ok, user }` ou `{ ok: false, error, field }` |
| `authApi.logout()` | `POST /logout` | `{ ok }` |

### 📄 `gamesApi.js`

| Fonction | Route | `data` |
|---|---|---|
| `start(config)` | `POST /api/games` | `{ game }` |
| `sendHand(gameId, log)` | `POST /api/games/:id/hands` | `{ hand, game, achievements }` |
| `quit(gameId)` | `POST /api/games/:id/quit` | — |
| `list(before?)` | `GET /api/games` | `{ games, next }` |
| `get(gameId)` | `GET /api/games/:id` | `{ game, hands }` |
| `stats()` | `GET /api/stats/me` | `{ totals, achievements }` |
| `solverReport()` | `GET /api/stats/solver` | rapport face au solveur |
| `rangeHistory()` | `GET /api/stats/range` | range jouée, erreurs, pertes |
| `dashboard(query)` | `GET /api/stats/dashboard?…` | chiffres du tableau de bord |
| `exportCsvUrl(query)` | — | **un lien** (le navigateur télécharge le fichier lui-même) |
| `leaderboard()` | `GET /api/leaderboard` | `{ players, me }` |

### 📄 `rangesApi.js`

| Fonction | Route | `data` |
|---|---|---|
| `list()` | `GET /api/ranges` | `{ ranges }` |
| `create(name, range)` | `POST /api/ranges` | `{ range }` |
| `update(id, { name?, range? })` | `PUT /api/ranges/:id` | `{ range }` |
| `remove(id)` | `DELETE /api/ranges/:id` | — |

### 📄 `friendsApi.js` — amis (`server/src/friends`)

| Fonction | Route | `data` |
|---|---|---|
| `list()` | `GET /api/friends` | `{ friends: [{ id, username, tag, status: 'online' \| 'playing' \| 'offline', lastSeen }] }` |
| `requests()` | `GET /api/friends/requests` | `{ incoming, outgoing }` : `[{ id, user: { id, username, tag }, sentAt }]` |
| `search(query)` | `GET /api/friends/search?q=` (code ami complet = ce joueur seul) | `{ players: [{ id, username, tag, relation: 'none' \| 'friend' \| 'outgoing' \| 'incoming' }] }` |
| `add(userId)` | `POST /api/friends/requests` | `201 { request }` · `200 { friend }` (il t'avait demandé) · `409` déjà ami / déjà demandé |
| `accept(requestId)` | `POST /api/friends/requests/:id/accept` | `{ friend }` |
| `decline(requestId)` | `DELETE /api/friends/requests/:id` | — (refuser une reçue ou annuler une envoyée) |
| `remove(friendId)` | `DELETE /api/friends/:id` | — |

### 📄 `lobbyApi.js` — invitations à une table (`server/src/lobby`)

| Fonction | Route | `data` |
|---|---|---|
| `invitations()` | `GET /api/lobby/invitations` | `{ invitations: [{ id, from: { id, username, tag }, sentAt }] }` |
| `invite(userId)` | `POST /api/lobby/invitations` | `201 { invitation }` · `409` pas en ligne · `404` pas ami |
| `decline(id)` | `DELETE /api/lobby/invitations/:id` | — |

### 📄 `socialLive.js` — le flux du joueur connecté

| Fonction | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `watchSocial({ onFriends, onInvitations })` | → `{ close() }` | un `EventSource` sur `/api/friends/live`, ouvert tant que le joueur est connecté (`main.js`) : c'est **ce qui le rend « en ligne »** pour ses amis ; `friends` → recompter / redessiner les amis, `invitations` → `lobby:changed` |

### 📄 `aiApi.js`

| Fonction | Route | `data` |
|---|---|---|
| `preflop()` | `GET /api/ai/preflop` (public) | `{ ranges: { sbOpen, bbVsLimp, bbVsRaise }, equity }` : les ranges préflop de l'IA, calculées par le serveur (la stratégie n'en sort pas) |

### 📄 `statsLive.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `watchHands({ onHand, onStatus? })` | → `{ close() }` | un `EventSource` sur `/api/stats/live` : `onHand({ gameId, handNo })` à chaque main enregistrée, `onStatus(true/false)` connecté ou non ; le navigateur se reconnecte seul |

### 📄 `RemoteGame.js`

| Fonction | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `connect(config)` | → `Promise<joined>` | ouvre `/ws/table`, rejoint une table et conserve son identifiant ; `config.shared = { create: true, bots }` ouvre une **table partagée**, `{ join: 'K7QX2M' }` s'y assoit |
| `startTable()` | → `void` | table partagée, hôte : lance la partie |
| `playHand()` | → `Promise<{ result, stacks, gameOver }>` | attend le prochain événement `handEnd` |
| `sendAction(action, requestId)` | → `void` | répond à une demande d'action du serveur |
| `pause()` / `resume()` | → `void` | menu pause ouvert / fermé : le serveur gèle / relance le chrono du tour |
| `stop()` | → `void` | quitte la table et ferme le WebSocket |

`onEvent` reçoit les événements publics dans l'ordre. `onLobby(state)` reçoit la salle
d'attente d'une table partagée (`lobby` : qui est assis, l'hôte, `you`). `onActionRequest` reçoit
une demande privée ; sa réponse est envoyée automatiquement au serveur.
Juste avant d'appeler `onActionRequest` (les coups précédents sont animés),
`RemoteGame` envoie `actionShown` : le chrono de 30 s du serveur part à ce
moment-là. `onTimer({ remainingMs, running })` reçoit chaque `actionTimer`
(compte à rebours de la barre d'actions). `onActionExpired({ requestId, action })`
est appelé quand le chrono atteint zéro et que le serveur a joué à la place du joueur :
il doit résoudre la demande en cours avec `null` (rien n'est envoyé). Ce message est
traité **hors de la file** : la demande affichée bloque la file, sans lui les
événements suivants attendraient pour toujours. Une demande expirée avant d'être
affichée (animations encore en cours) est sautée.
`onAchievements` reçoit les succès débloqués par l'enregistrement serveur.
Après une coupure, `RemoteGame` reprend automatiquement la table avec le
`playerToken`, le `tableId` et le dernier `seq` reçu ; les messages manquants
sont rejoués par le serveur.
`RemoteGame` ne contient aucune règle de poker et ne reçoit jamais la stratégie
de l'IA.

## POURQUOI / PIÈGES

- Chrome affiche **toute réponse 4xx en rouge** dans la console : un invité ne
  doit pas lancer de requête vouée au `401` (on ne l'ouvre même pas).
- Ne jamais écrire un `fetch` ailleurs : les messages d'erreur et le mode hors
  ligne seraient à refaire.

## VOIR AUSSI

[server](../../../server/MAN.md) · [server/auth](../../../server/src/auth/MAN.md) · [server/games](../../../server/src/games/MAN.md) ·
[server/stats](../../../server/src/stats/MAN.md) · [server/ranges](../../../server/src/ranges/MAN.md)
