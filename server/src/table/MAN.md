# server/table — transport WebSocket des tables

> **Dossier** `server/src/table/` · **Route** `/ws/table` · **Protocole** `PROTOCOL.md`

## NOM

`table` — connexion WebSocket entre le navigateur et une table de poker
autoritaire côté serveur.

## SYNOPSIS

```text
GET /ws/table (WebSocket)
  → hello
  ← joinTable / createTable / joinShared / startTable / action / actionShown / pause / resume / reconnect
  → … lobby (table partagée : salle d'attente)
  → événements publics et demandes d'action privées
```

## DESCRIPTION

Le transport est la frontière entre le navigateur et `PokerGame`. Le serveur
garde les cartes cachées, les mises, les décisions de l'IA et l'enregistrement
des mains. Les joueurs connectés ont une partie `Game` créée à l'ouverture de
la session ; chaque `HandRecorder` est persisté à `handEnd`. Les invités jouent
sans écriture en base.

## FICHIERS

| Fichier | Rôle |
|---|---|
| `routes.js` | authentifie la socket, contrôle Origin/taille/débit, envoie `hello` et transmet les messages |
| `registry.js` | conserve les tables vivantes et permet une reconnexion temporaire par token |
| `session.js` | possède `PokerGame`, les agents, la validation des actions, le filtrage, la reprise et la persistance |
| `humanAgent.js` | transforme une demande du moteur en attente d'une réponse WebSocket |
| `shared.js` | **table partagée** (mode en ligne) : code, hôte, salle d'attente, 2 à 5 joueurs humains + IA, un chrono par joueur (sans pause), départs, reconnexion, chaque main enregistrée **pour chaque joueur** |
| `channel.js` | le flux privé d'**un** joueur d'une table partagée : numéros `seq`, historique, jeton de reprise, `state` |
| `PROTOCOL.md` | contrat versionné des messages et des règles de confidentialité |

## FONCTIONS

### `tableRoutes(app)`

Entrée : instance Fastify configurée. Sortie : route WebSocket `/ws/table`.
Vérifie l'origine, la taille et le débit des messages, envoie un `hello` et
transmet les messages valides au registre ou à une `TableSession`.

### `TableRegistry`

Entrée : délai de grâce et logger. Sortie : registre en mémoire des tables
actives. Ajoute les sessions après `joinTable`, les retrouve avec
`tableId`/`playerToken` et ferme toutes les parties lors de l'arrêt du serveur.

### `TableSession`

Entrée : socket WebSocket, `SolverData`, Prisma, joueur éventuel et logger.
Sortie : une partie serveur `PokerGame` avec le siège 0 humain et les sièges
suivants contrôlés par `PokerBot`. Filtre les cartes du `deal`, attend l'action
humaine, rejette les actions illégales et sauvegarde les mains directement.

### Chrono du tour (`session.js`, `DEFAULT_TIMING`)

`actionShown(message)` → démarre les 30 s du joueur (une fois par demande) ;
`pause()` / `resume()` → gèle / relance le chrono (temps restant, au moins
`minResumeMs`) ; `sendTimer()` → `actionTimer` au navigateur ; à zéro,
`_armClock` envoie `actionExpired` puis joue `fold` ou `check` (`SharedTable._arm`
fait de même). Sans `actionExpired`, le navigateur attendrait un clic pour
toujours et n'afficherait plus la suite de la main. Réglages : `TABLE_ACTION_MS`,
`TABLE_MAX_PAUSE_MS` (`config.tableTiming`).

### `SharedTable` (`shared.js`)

| Membre | Entrée → Sortie | Rôle |
|---|---|---|
| `new SharedTable({ host, config, solver, prisma, live, registry, log, timing })` | — | `config` vérifié par `checkedSharedConfig` (tapis, blinds, 0 à 3 IA) ; code par `newTableCode()` |
| `join(user, socket, requestId)` | → `{ ok }` ou `{ ok: false, code, message }` | s'asseoir pendant l'attente ; envoie `joined` puis `lobby` à tous |
| `receive(message, { socket })` | — | `startTable`, `action`, `actionShown`, `leaveTable` ; `pause` / `resume` ignorés |
| `lobbyState()` | → `lobby` | qui est assis, l'hôte, les IA, le tapis et les blinds |
| `isPlaying(userId)` | booléen | pour la présence (« en partie ») |
| `owns` · `canReconnect` · `attach(socket, lastSeq, token)` · `detach` · `close` | — | même contrat que la table solo pour `routes.js` et `registry.js` |

À chaque événement du moteur, pour chaque joueur `i` : `rotateEvent(e, i, n)`
nourrit **son** `HandRecorder`, `viewEvent(e, i, n)` part dans **son** canal. À
`handEnd`, `saveServerHand` enregistre la main dans **son** `Game` (une ligne
`Game` par joueur, adversaires vus depuis sa place), avec ses succès, ses
décisions face au solveur (`rotateRequest`) et le flux du tableau de bord.

## POURQUOI / PIÈGES

- **Un compte, une table vivante** : `TableRegistry.tableForUser(userId)` renvoie
  sa table solo ou partagée, y compris pendant une coupure réseau. Une seconde
  création/adhésion est refusée (`ALREADY_IN_TABLE`), car `startGame()` clôture
  les anciennes parties en base. Le solo réserve sa place avant les attentes
  asynchrones ; quitter volontairement libère la place.
- `SharedTable.sequenceFor(token)` → dernier numéro du **canal de ce joueur**.
  Le registre authentifie le token avant de contrôler `lastSeq` ; un siège
  `left` n'est plus reconnectable. `attach()` annule le délai de départ de la
  salle d'attente.
- `_start()` capture les erreurs de `_initialize()` et ferme la table avec
  `serverError`. La création des parties attend toutes les écritures, même si
  une échoue, avant de clôturer les parties déjà créées. Une fermeture pendant
  le démarrage ne doit pas laisser une écriture tardive en `PLAYING`.
- Régressions : `server/tests/sharedLifecycle.test.mjs` (séquence par joueur,
  départ/coupure, deuxième table, échec solveur et écriture DB partielle).

- **Tourner la table plutôt que tout réécrire** : le navigateur, l'enregistreur,
  les stats et la comparaison au solveur supposent tous « le joueur est au siège 0 ».
  Chaque joueur reçoit la table tournée vers lui : aucun de ces codes ne change, et
  un test (`tests/viewpoint.test.mjs`) vérifie sur des parties entières que chacun
  retrouve exactement les chiffres de son vrai siège.
- **Écouter avant d'attendre** (`routes.js`) : le navigateur envoie son premier
  message dès l'ouverture ; si l'écoute ne commençait qu'après la recherche de la
  session en base, un message arrivé pendant cette attente était **perdu** (le
  joueur restait bloqué, vu sous charge). Les messages sont gardés puis traités
  dans l'ordre (test « a message sent the instant the socket opens is not lost »).
- Une table partagée ne connaît pas la pause : un joueur ne peut pas geler les autres.
- Les humains sont assis d'abord, les IA ensuite : le siège `i` d'un humain est
  son rang d'arrivée.
- Un joueur éliminé (`lost`) reste connecté et regarde la suite ; on n'enregistre
  plus rien pour lui (sa partie est finie : `LOST`).
- Les tables vivent **en mémoire** : un redémarrage du serveur les ferme (les
  parties en cours passent à `QUIT` au prochain lancement).

- Le plugin WebSocket doit être enregistré avant les routes WebSocket.
- Le message `hello` n'a pas de numéro `seq` ; les messages suivants en ont un.
- Le MVP ne crée qu'une table par connexion ; le lobby ajoutera le partage d'une
-  table entre plusieurs connexions. Une reconnexion remplace toutefois la
  socket de la même table, sans créer de seconde partie.
- Chaque nouvelle socket commence avec sa propre `TableSession` vide. Après un
  `reconnect` réussi, `routes.js` doit envoyer la suite des messages (actions,
  fermeture) à la table retrouvée (`result.table`), pas à cette session vide :
  sinon les actions du joueur sont perdues et la table ne voit jamais la
  coupure suivante (elle ne se ferme plus).
- Le chrono part à `actionShown`, pas à l'envoi : le serveur joue les IA
  instantanément alors que le navigateur anime encore leurs coups ; partir à
  l'envoi mangeait une partie des 30 s. Le serveur ne connaît pas le menu pause
  du navigateur : sans `pause`, le joueur était couché d'office pendant sa pause.
- Une pause gèle le chrono mais pas indéfiniment (`maxPauseMs`, 10 min) : la
  table est fermée avec la raison `idle`.
- Une coupure réseau donne une fenêtre de grâce ; `leaveTable` et l'expiration
  de cette fenêtre ferment réellement la partie.
- L'historique WebSocket est borné ; si le client est trop en retard, `state`
  renvoie les événements publics de la main courante au lieu de rejouer des
  messages potentiellement trop anciens.
- `HandRecorder` reçoit les événements internes avant leur filtrage WebSocket :
  les cartes adverses sont donc enregistrées pour l'historique mais ne sont
  jamais envoyées au joueur avant l'abattage.
- Aucune carte, stratégie, clé MCCFR ou décision de bot ne passe par ce fichier.

## VOIR AUSSI

[`PROTOCOL.md`](./PROTOCOL.md) · [PokerGame](../../../src/shared/poker/PokerGame.js) ·
[TableController](../../../src/front/game/TableController.js)
