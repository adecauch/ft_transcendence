# 👥 server/friends — amis, demandes et présence

> **Dossier** `server/src/friends/` · **Routes** `/api/friends` (connecté) · **Tables** `Friendship`, `User.lastSeenAt` · **Testé par** `server/tests/friends.test.mjs`

## NOM

`friends` — demander un joueur en ami, accepter, refuser, retirer, chercher un
joueur par son **code ami** (`Pseudo#1234`), savoir qui est **en ligne**, **en
partie** ou **hors ligne**, et prévenir chaque joueur **en direct** quand
quelque chose change pour lui.

## SYNOPSIS

```http
GET    /api/friends                       → { friends: [{ id, username, tag, status, lastSeen }] }
GET    /api/friends/requests              → { incoming, outgoing }: [{ id, user, sentAt }]
GET    /api/friends/search?q=Bart#4733    → { players: [{ id, username, tag, relation }] }
POST   /api/friends/requests  { userId }  → 201 { request } · 200 { friend } (il t'avait demandé)
POST   /api/friends/requests/:id/accept   → { friend }
DELETE /api/friends/requests/:id          → 204 (refuser une reçue / annuler une envoyée)
DELETE /api/friends/:id                   → 204 (plus amis)
GET    /api/friends/live                  → flux SSE : `friends`, `invitations`
```

## DESCRIPTION

**Une ligne par paire de joueurs** dans `Friendship` : `PENDING` (une demande,
de `requester` vers `addressee`), puis `ACCEPTED` (amis, peu importe qui a
demandé). Si B demande A alors que A avait déjà demandé B, la demande de A est
acceptée : ils voulaient tous les deux.

**La présence** (`presence.js`) vit en mémoire :

| Statut | Quand | Comment on le sait |
|---|---|---|
| `online` | une page connectée est ouverte | le flux `GET /api/friends/live` de ce joueur est ouvert (`LiveFeed`) |
| `playing` | assis à une table serveur | `TableRegistry` (`table/registry.js`) contient une table de ce joueur |
| `offline` | sinon | `lastSeen` = `User.lastSeenAt`, écrit quand sa **dernière** page se ferme |

**Le temps réel** : le même flux porte des nouvelles sans détail (`friends`,
`invitations`) ; la page redemande les routes. Chaque changement prévient
l'autre joueur (`presence.notify`), et un changement de statut prévient tous
ses amis (`presence.changed`, appelé à la connexion, à la déconnexion, et par
`TableRegistry.onChange` quand il s'assoit ou se lève).

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `service.js` | la base (`Friendship`) : lister, chercher, demander, accepter, refuser, retirer ; `FriendRefused` |
| `presence.js` | en ligne / en partie / hors ligne, `lastSeenAt`, nouvelles en direct |
| `schemas.js` | forme des requêtes **et des réponses** (un joueur = `{ id, username, tag }`, jamais d'email) |
| `routes.js` | HTTP seulement : appelle le service, prévient l'autre joueur |

## FONCTIONS

### 📄 `service.js`

| Fonction | Entrée → Sortie | Rôle |
|---|---|---|
| `listFriends(prisma, me, statusOf)` | → `[{ id, username, tag, status, lastSeen }]` | les amis, avec le statut donné par la présence |
| `listRequests(prisma, me)` | → `{ incoming, outgoing }` | demandes reçues / envoyées, les plus récentes d'abord |
| `searchPlayers(prisma, me, q)` | → `[{ …, relation }]` (20 max) | code ami complet = ce joueur seul ; sinon pseudo qui **contient** `q` (casse ignorée) ; jamais soi-même |
| `sendRequest(prisma, me, userId)` | → `{ request }` ou `{ friend }` | `400` soi-même, `404` inconnu, `409` déjà ami / déjà demandé ; demande croisée → amis |
| `acceptRequest(prisma, me, id)` | → `{ friend }` | seul le destinataire accepte (`404` sinon) |
| `deleteRequest(prisma, me, id)` | → id de l'autre joueur | refuser (destinataire) ou annuler (demandeur) |
| `removeFriend(prisma, me, friendId)` | — | l'un ou l'autre peut |
| `friendIds(prisma, me)` · `areFriends(prisma, a, b)` | ids · booléen | pour la présence et les invitations |

### 📄 `presence.js` — `Presence`

| Membre | Entrée → Sortie | Rôle |
|---|---|---|
| `open(userId, req, res)` | — | garde le flux ouvert ; première page → amis prévenus ; dernière page fermée → `lastSeenAt`, amis prévenus |
| `isOnline(id)` · `isPlaying(id)` | booléen | page ouverte · table serveur ouverte |
| `statusOf({ id, lastSeenAt })` | → `{ status, lastSeen }` | `playing` > `online` > `offline` |
| `notify(userId, event)` | — | `friends` ou `invitations` sur ses pages ouvertes |
| `changed(userId)` | — | son statut a changé : prévient ses amis |

## POURQUOI / PIÈGES

- **La présence par le flux SSE** plutôt qu'un « dernier signe de vie » en base :
  pas d'écriture à chaque minute, et le statut change à l'instant où la page se
  ferme. Plusieurs onglets : en ligne jusqu'au dernier fermé.
- **En mémoire, un seul processus** (comme `stats/liveFeed.js`) : plusieurs
  serveurs demanderaient un canal partagé (PostgreSQL LISTEN / NOTIFY, Redis).
- Le flux ne transporte **que « quelque chose a changé »** : rien de privé ne
  part par lui, et la page relit des routes déjà validées par leurs schémas.
- Recherche et demandes limitées à **30 / minute** : pas d'aspiration de la
  liste des joueurs. La réponse ne contient jamais d'email.
- Deux demandes croisées **au même instant** pourraient créer deux lignes (A→B et
  B→A) : rare, sans danger (le service accepte la première qu'il trouve).
- Un invité n'ouvre jamais ces routes côté front (elles répondraient `401`, en
  rouge dans la console).

## VOIR AUSSI

[server/lobby](../lobby/MAN.md) (invitations) · [server/table](../table/MAN.md) (`TableRegistry.onChange`) · [ui/friends](../../../src/front/ui/friends/MAN.md) · [net](../../../src/front/net/MAN.md) (`friendsApi`, `socialLive`) · [shared/auth](../../../src/shared/auth/MAN.md) (`parseFriendCode`)
