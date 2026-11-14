# ✉️ server/lobby — invitations à une table

> **Dossier** `server/src/lobby/` · **Routes** `/api/lobby` (connecté) · **Table** `TableInvitation` · **Testé par** `server/tests/friends.test.mjs`

## NOM

`lobby` — inviter un ami **en ligne** à sa table, voir les invitations reçues,
les refuser. Première brique du salon du mode en ligne.

## SYNOPSIS

```http
GET    /api/lobby/invitations             → { invitations: [{ id, from: { id, username, tag }, sentAt }] }
POST   /api/lobby/invitations  { userId } → 201 { invitation }
DELETE /api/lobby/invitations/:id         → 204
```

## DESCRIPTION

Une invitation par paire (`@@unique([fromId, toId])`) : la renvoyer remet son
heure à maintenant. Le destinataire est prévenu à l'instant (`invitations` sur
son flux, `friends/presence.js`) : la carte « Table en ligne · n » de sa salle se
met à jour. Une invitation de plus de **30 minutes** (`EXPIRE_MINUTES`) n'est
plus listée et est effacée à la lecture suivante.

Une invitation porte le **code de la table** (`tableId`) quand l'expéditeur attend
à une table partagée (il doit y être assis et la partie pas lancée, sinon `409`) :
« Rejoindre » s'y assoit (WebSocket `joinShared`), ce qui efface l'invitation.
Sans code, l'ami n'a pas encore ouvert de table.

## FICHIERS

| Fichier | Rôle |
|---|---|
| `service.js` | `listInvitations`, `invite`, `deleteInvitation` (base `TableInvitation`) |
| `schemas.js` | forme des requêtes et des réponses |
| `routes.js` | HTTP seulement ; prévient l'autre joueur |

## FONCTIONS

| Fonction | Entrée → Sortie | Rôle |
|---|---|---|
| `listInvitations(prisma, me)` | → `[{ id, from, sentAt }]` | reçues, les plus récentes d'abord ; efface d'abord les périmées |
| `invite(prisma, me, userId, isOnline)` | → `{ id, to, sentAt }` | `400` soi-même · `404` pas ami · `409` pas en ligne ; crée ou rafraîchit |
| `deleteInvitation(prisma, me, id)` | → id de l'autre joueur | refuser (destinataire) ou annuler (expéditeur) |

## POURQUOI / PIÈGES

- **Seulement un ami en ligne** : inviter quelqu'un qui n'est pas dans la salle
  ne servirait à rien (il ne verrait pas l'invitation à temps).
- Les refus réutilisent `FriendRefused` (même forme d'erreur, même gestionnaire).
- 30 envois / minute au plus : pas de harcèlement d'un ami.

## VOIR AUSSI

[server/friends](../friends/MAN.md) (amitiés, présence, flux) · [ui/online](../../../src/front/ui/online/MAN.md) · [scene/start](../../../src/front/scene/start/MAN.md) (la carte d'invitation)
