# Protocole WebSocket de table

## NOM

`table-websocket` — protocole version 1 entre le navigateur et une table de
poker autoritaire côté serveur.

## SYNOPSIS

```text
Navigateur  -- wss://<host>/ws/table --> Serveur
Navigateur  <-- événements JSON -------- Serveur
```

La première livraison vise une table composée d'un joueur humain et d'une ou
plusieurs IA. Le même protocole doit pouvoir être utilisé ensuite par le
salon multi-joueurs, sans déplacer la logique de `PokerGame` dans le
navigateur.

## DESCRIPTION

Le serveur est la seule source de vérité pour :

- le paquet et les cartes cachées ;
- les tapis, les mises, les pots et le bouton ;
- la légalité des actions ;
- les décisions des `PokerBot` ;
- le résultat et l'enregistrement de chaque main.

Le navigateur affiche les événements reçus et demande une action au joueur
humain. Il ne reçoit jamais la stratégie MCCFR, les cartes cachées d'un autre
siège, ni un objet `PokerGame` utilisable localement en mode distant.

## TRANSPORT

- URL de production et de développement proxifié : `wss://<host>/ws/table`.
- Format : un objet JSON par message WebSocket.
- Le cookie de session HTTP peut authentifier la connexion ; un invité utilise
  un jeton temporaire délivré par le serveur.
- Une connexion représente le joueur local et son rattachement à une table.
- Une coupure réseau détache la socket sans arrêter immédiatement la table ; le
  joueur peut reprendre la session pendant la fenêtre configurée côté serveur.
- Le serveur ferme la connexion si un message n'est pas du JSON valide ou ne
  respecte pas la forme du protocole.

Les messages serveur portent un numéro `seq` strictement croissant à partir de
`1`. Le client peut ignorer un message déjà reçu et détecter un trou de
séquence.

## ENVELOPPE DES MESSAGES

Les messages client et serveur ont un champ `type`. Les messages contenant un
événement de moteur utilisent l'enveloppe suivante :

```json
{
  "type": "event",
  "seq": 12,
  "tableId": "table-abc",
  "event": {
    "type": "action",
    "seat": 1,
    "street": 0,
    "action": { "type": "call", "amount": 2 },
    "paid": 2,
    "bet": 2,
    "stack": 198,
    "pot": 4,
    "isBet": false,
    "allIn": false
  }
}
```

Les propriétés absentes ne doivent pas être remplacées par `null` sans raison.
Les nombres sont des montants en jetons, jamais des nombres flottants.

## MESSAGES CLIENT → SERVEUR

### `joinTable`

Première demande sur une connexion. Pour le MVP, `tableId` peut être absent
afin que le serveur crée une table solo. Le lobby fournira ensuite un
`tableId` existant.

```json
{
  "type": "joinTable",
  "requestId": "join-1",
  "tableId": null,
  "config": {
    "opponents": [
      { "name": "Le Baron", "level": "medium" }
    ],
    "startingStack": 400,
    "blinds": { "small": 1, "big": 2 }
  }
}
```

Le serveur valide et limite `config`. Le client ne peut pas choisir un paquet,
les stacks des autres joueurs, une stratégie ou un résultat.

### `action`

Réponse à un `actionRequest`. `requestId` doit être celui de la demande en
cours et l'action doit appartenir au siège authentifié.

```json
{
  "type": "action",
  "requestId": "turn-27",
  "action": { "type": "raise", "to": 12 }
}
```

Actions autorisées :

```json
{ "type": "fold" }
{ "type": "check" }
{ "type": "call", "amount": 4 }
{ "type": "raise", "to": 12 }
```

Le serveur recalcule le montant de `call` à partir de son propre état. Le
champ `amount` est accepté pour conserver le contrat de `PlayerAction`, mais
une valeur incorrecte est refusée. Pour `raise`, `to` est le montant total
misé sur la rue, conformément à `shared/poker/betting.js`.

### `actionShown`

Le navigateur affiche la demande d'action (les animations des coups précédents
sont finies) : le chrono du joueur démarre à ce moment-là, pas à l'envoi de
`actionRequest`.

```json
{ "type": "actionShown", "requestId": "turn-27" }
```

Un seul compte par demande : le renvoyer (après une reconnexion) ne remet pas
le chrono à zéro, le serveur répond seulement un nouvel `actionTimer`.

### `pause` et `resume`

Le menu pause est ouvert / fermé. Contre l'IA, un seul humain attend : le
serveur gèle le chrono pendant la pause, puis le relance avec le temps restant,
jamais moins de 5 secondes. Une pause de plus de 10 minutes ferme la table
(`gameEnd`, raison `idle`), pour ne pas garder une partie ouverte sans fin.
Le navigateur renvoie l'état (`pause` ou `resume`) après chaque reconnexion.

```json
{ "type": "pause" }
{ "type": "resume" }
```

Une future table à plusieurs humains ne pourra pas geler le chrono des
autres : la pause n'y fera que masquer l'écran.

### `reconnect`

Rejoint une table après une coupure avec le jeton attribué par `joined`.

```json
{
  "type": "reconnect",
  "requestId": "reconnect-1",
  "tableId": "table-abc",
  "playerToken": "temporary-player-token",
  "lastSeq": 12
}
```

Le serveur vérifie le token, l'utilisateur associé et la séquence demandée,
puis renvoie les messages manquants suivis de `reconnected`. Si l'historique
conservé ne suffit plus, il envoie `state` avec les événements publics de la
main courante et la demande d'action éventuelle. Le token ne donne accès qu'au
siège qui lui est associé.

### `reconnected`

Confirmation de reprise. Les événements manquants peuvent être envoyés avant
ce message afin de conserver leur ordre de séquence.

```json
{
  "type": "reconnected",
  "seq": 27,
  "tableId": "table-abc",
  "seat": 0,
  "playerToken": "temporary-player-token"
}
```

### `leaveTable`

```json
{
  "type": "leaveTable",
  "requestId": "leave-1"
}
```

Le serveur arrête la partie de ce joueur proprement. Une déconnexion réseau
est traitée comme une absence temporaire jusqu'à l'expiration du délai prévu.

### Tables partagées : `createTable`, `joinShared`, `startTable`

Un compte ne peut occuper qu'une table vivante à la fois (solo ou partagée,
coupure temporaire comprise). Une seconde table est refusée avec
`ALREADY_IN_TABLE` ; il faut quitter la première ou s'y reconnecter.
Un départ volontaire invalide la reprise de ce siège. Pour une table partagée,
`lastSeq` est vérifié contre la séquence propre au joueur, jamais celle d'un
autre siège. Un échec de démarrage ferme la table avec `gameEnd: serverError`.

Mode en ligne (`shared.js`), **joueurs connectés seulement** (sinon `error`
`LOGIN_REQUIRED`). Premier message de la socket, à la place de `joinTable` :

```json
{ "type": "createTable", "requestId": "join-1", "config": { "startingStack": 1000, "blinds": { "small": 10, "big": 20 }, "bots": 1 } }
{ "type": "joinShared",  "requestId": "join-1", "tableId": "K7QX2M" }
{ "type": "startTable",  "requestId": "start-1" }
```

- `createTable` ouvre une table dont le joueur est l'**hôte** ; `bots` = IA qui
  compléteront la table (0 à 3). Le serveur choisit le **code** : 6 lettres ou
  chiffres, sans 0/O ni 1/I (faciles à dicter).
- `joinShared` s'assoit à une table qui attend, par son code (majuscules ou
  non). Refus : `UNKNOWN_TABLE`, `TABLE_STARTED`, `TABLE_FULL` (5 places, IA
  comprises), `ALREADY_SEATED`. S'asseoir efface les invitations reçues pour
  cette table.
- `startTable` (hôte seulement, `NOT_HOST` sinon) lance la partie : 2 joueurs au
  moins (`NOT_ENOUGH_PLAYERS`), tous connectés (`PLAYER_AWAY`).

La réponse est `joined` (avec `shared: true`), puis des `lobby`. Ensuite, mêmes
messages que la table solo (`event`, `actionRequest`, `action`, `actionShown`,
`actionTimer`, `actionExpired`, `reconnect`, `leaveTable`, `gameEnd`), avec trois différences :

- **chacun voit la table depuis sa place** : les numéros de siège sont tournés
  pour que le joueur soit toujours le siège 0 (`src/shared/poker/viewpoint.js`),
  `isHuman` veut dire « c'est moi », les autres humains ont `remote: true` ;
- **pas de pause** : `pause` / `resume` sont ignorés (un joueur ne gèle pas les
  autres). À zéro, le serveur joue `fold` ou `check` ;
- `leaveTable` en cours de partie : la place reste (couchée à chaque tour), la
  partie continue pour les autres. Si plus personne n'est connecté pendant le
  délai de grâce, la table ferme.

## MESSAGES SERVEUR → CLIENT

### `hello`

Premier message après l'ouverture de la connexion.

```json
{
  "type": "hello",
  "protocol": "table-websocket",
  "version": 1,
  "connectionId": "connection-abc"
}
```

### `joined`

Confirmation du rattachement à une table.

```json
{
  "type": "joined",
  "seq": 1,
  "requestId": "join-1",
  "tableId": "table-abc",
  "seat": 0,
  "playerToken": "temporary-player-token"
}
```

Le `playerToken` est renvoyé uniquement à son joueur. Pour un utilisateur
connecté, le serveur peut préférer la session HTTP et ne pas créer de token
persistant.

### `event`

Relaye un événement public de `PokerGame`, après filtrage. Les types existants
sont :

```text
handStart  blind  deal  street  turn  action  roundEnd  win  showdown  handEnd
```

Les champs des événements suivent le contrat documenté dans
`src/shared/poker/PokerGame.js`, avec les règles de confidentialité suivantes :

- `handStart.seats` contient les informations publiques des sièges, jamais les
  cartes ou les décisions internes ;
- `deal.hole` contient les cartes du joueur connecté à son index et `null` pour
  les autres sièges ;
- `street` contient les cartes communes déjà révélées ;
- `turn` indique le siège et la rue, mais pas les cartes adverses ;
- `action`, `blind`, `roundEnd`, `win` et `handEnd` sont publics ;
- `showdown.reveals` ne contient que les mains arrivées à l'abattage ;
- aucun événement ne contient `debug`, une clé MCCFR, un bucket ou une
  probabilité de stratégie.

### `actionRequest`

Message privé envoyé uniquement lorsque le siège connecté doit jouer.

```json
{
  "type": "actionRequest",
  "seq": 14,
  "tableId": "table-abc",
  "requestId": "turn-27",
  "seat": 0,
  "round": 0,
  "hole": ["AS", "KD"],
  "board": [],
  "turn": {
    "stack": 398,
    "playerBet": 0,
    "currentBet": 2,
    "lastRaise": 2,
    "bigBlind": 2,
    "pot": 3,
    "preflop": true
  }
}
```

Le serveur attend une action valide avant de reprendre `PokerGame`. Le joueur
a 30 secondes (`TABLE_ACTION_MS`) à partir de `actionShown`, gelées pendant une
pause. Si `actionShown` n'arrive jamais, le serveur laisse 60 secondes
d'affichage. À expiration, le serveur envoie `actionExpired`, puis joue
automatiquement `fold` si le joueur doit payer, sinon `check`.

### `actionTimer`

Temps restant pour la demande en cours, envoyé quand le chrono démarre
(`actionShown`), se gèle (`pause`) ou repart (`resume`). Le navigateur affiche
le compte à rebours à partir de `remainingMs`.

```json
{
  "type": "actionTimer",
  "seq": 15,
  "tableId": "table-abc",
  "requestId": "turn-27",
  "remainingMs": 30000,
  "running": true
}
```

### `actionExpired`

Le chrono de la demande en cours est arrivé à zéro : le serveur joue `action`
à la place du joueur (l'événement `action` suit). Le navigateur ferme la barre
d'actions sans rien envoyer ; une action envoyée ensuite avec ce `requestId`
serait refusée (`STALE_REQUEST` ou `NOT_YOUR_TURN`).

```json
{
  "type": "actionExpired",
  "seq": 16,
  "tableId": "table-abc",
  "requestId": "turn-27",
  "action": { "type": "fold" }
}
```

### `actionRejected`

```json
{
  "type": "actionRejected",
  "seq": 15,
  "requestId": "turn-27",
  "code": "ILLEGAL_ACTION",
  "message": "Cette action n'est pas légale dans la situation actuelle."
}
```

Une action rejetée ne termine pas le tour : le serveur conserve la demande
en cours et le client peut répondre à nouveau avec le même `requestId`.

### `achievements`

Envoyé après l'enregistrement d'une main lorsqu'un ou plusieurs succès viennent
d'être débloqués par le joueur connecté. Un invité ne reçoit jamais ce message.

```json
{
  "type": "achievements",
  "seq": 16,
  "ids": ["first_game", "first_pot"]
}
```

Codes initiaux :

```text
BAD_MESSAGE
NOT_JOINED
NOT_YOUR_TURN
STALE_REQUEST
ILLEGAL_ACTION
UNKNOWN_TABLE
PLAYER_NOT_FOUND
TABLE_FULL
NOT_IMPLEMENTED
SERVER_ERROR
```

### `state`

Utilisé après `reconnect` ou lorsqu'un client détecte un trou de séquence.
Il contient les événements publics de la main courante, les cartes privées du
joueur et, si c'est son tour, la demande d'action courante. Il ne contient
jamais l'état interne des bots.

```json
{
  "type": "state",
  "seq": 28,
  "tableId": "table-abc",
  "events": [{ "type": "handStart", "handNo": 3 }],
  "actionRequest": null
}
```

### `lobby` (table partagée)

La salle d'attente, envoyée à chaque changement (arrivée, départ, coupure,
lancement) ; `you` = l'id du destinataire (suis-je l'hôte ?).

```json
{
  "type": "lobby", "seq": 3, "tableId": "K7QX2M", "status": "waiting",
  "host": { "id": 7, "username": "Bot0", "tag": 7257 }, "you": 8,
  "players": [{ "id": 7, "username": "Bot0", "tag": 7257, "connected": true, "left": false }],
  "bots": 1, "maxSeats": 5, "minPlayers": 2,
  "config": { "startingStack": 1000, "blinds": { "small": 10, "big": 20 } }
}
```

`status` : `waiting`, puis `playing` au lancement (le navigateur ferme la salle
d'attente).

### `handEnd` et `gameEnd`

`handEnd` est normalement transmis comme événement de moteur. `gameEnd` est
un message serveur distinct lorsque la partie ne peut plus continuer.

```json
{
  "type": "gameEnd",
  "seq": 80,
  "tableId": "table-abc",
  "reason": "won"
}
```

Raisons : `won`, `lost`, `left`, `aborted`, `serverError`, `idle` (pause trop longue),
`over` (table partagée : fin de partie sans que ce joueur gagne ni soit éliminé).
À une table partagée, `handEnd.gameOver` est calculé **pour chaque joueur** :
`lost` quand il n'a plus de jetons (il regarde la suite), `won` quand il a tout.

## CONFIDENTIALITE

Le serveur ne doit jamais :

- envoyer les cartes privées d'un autre siège ;
- envoyer le paquet restant ;
- envoyer la stratégie MCCFR ou son fichier compacté ;
- envoyer les probabilités de décision ou les infosets ;
- accepter une action qui ne correspond pas à la demande courante ;
- faire confiance aux montants ou aux stacks transmis par le client.

Les logs serveur ne doivent pas contenir le token de reconnexion, le cookie de
session ou le mot de passe.

## COMPATIBILITE ET EVOLUTION

La version du protocole est `1`. Toute modification incompatible exige une
nouvelle version. Une nouvelle propriété optionnelle peut être ajoutée sans
changer la version ; un changement de type, de sémantique ou de confidentialité
doit être documenté ici avant le code.

Le lobby pourra utiliser les mêmes messages avec une table créée auparavant.
Il ne doit pas créer un second protocole pour les places, les actions ou les
reconnexions.

## HORS PERIMETRE DE LA VERSION 1

- salon public et matchmaking (on rejoint par invitation ou par code) ;
- spectateurs ;
- reprise exacte d'une main pendant une panne serveur ;
- synchronisation entre plusieurs onglets du même joueur.

Ces fonctionnalités pourront s'appuyer sur le protocole sans modifier le
principe fondamental : le serveur possède l'état et le navigateur ne fait que
l'afficher et proposer l'action du joueur.
