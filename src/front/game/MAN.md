# 🎬 game — le pont entre les règles et l'écran

> **Dossier** `src/front/game/` · **Couche** front · **Relie** `PokerGame` + `PokerBot` (shared) ↔ cartes, jetons, barre d'actions, adversaires (front) ↔ serveur

## NOM

`game` — `TableController` fait jouer une partie sur la table 3D ;
`GameRecorder` l'envoie au serveur, main par main.

## SYNOPSIS

```js
const tableController = new TableController({ cards: tableCards, chips: tableChips, actionBar, remote: true });
tableController.opponents = opponents;     // personnages 3D
tableController.recorder  = recorder;      // enregistrement (si connecté)
tableController.bot       = await PokerBot.load('/ai/mccfr/');
tableController.start({ opponents: [{ name: 'Le Baron', level: 'regular' }], startingStack: 1000, blinds: { small: 10, big: 20 } });
```

## DESCRIPTION

`TableController` :

1. en mode local, crée la `PokerGame` à partir de la config du menu, avec **un
   agent par siège** ; en mode distant, branche `RemoteGame` sur le serveur ;
2. en mode local, le joueur répond par l'`ActionBar`, les IA par `PokerBot` ;
   en mode distant, l'`ActionBar` répond aux demandes du serveur ;
3. transforme **chaque événement** en animation et **l'attend** : la partie va
   au rythme des animations ;
4. écrit en français ce qui s'est passé (notes des IA, résultat) ;
5. enchaîne les mains : le résultat reste 3,5 s, puis la main suivante ; en fin
   de partie, un bouton « Rejouer ».

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `TableController.js` | fait jouer `PokerGame` en local ou `RemoteGame` sur la table 3D |
| `GameRecorder.js` | envoie le journal des parties locales au serveur (connecté seulement) ; le mode distant est enregistré par `TableSession` |

## FONCTIONS

### 📄 `TableController.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new TableController({ cards, chips, actionBar, remote? })` | — | pièces obligatoires ; `remote` active le serveur |
| `start(config)` | config du menu | arrête la partie en cours, règle la grosse blinde de l'affichage (`setBigBlind`), assied les adversaires, crée le moteur local ou `RemoteGame`, puis lance la boucle ; `config.shared` = table en ligne (créer / rejoindre) : les adversaires ne sont connus qu'au lancement |
| `shared` · `tableId` · `startShared()` · `onLobby` · `lobby` | — | table en ligne : son code (invitations), lancer (hôte), la salle d'attente (`main.js` → `WaitingRoom`) |
| `_seatOpponents(names)` | noms | un personnage par adversaire, **seulement si les noms changent** : appelé au démarrage puis à chaque `handStart` (les joueurs d'une table en ligne arrivent avec la première main) |
| `stop()` | — | quitter : `abort()` en local ou `RemoteGame.stop()` à distance, vide la table, cache la barre |
| `pause()` / `resume()` | — | appelés par `main.js` sur `game:pause` / `game:resume` : à distance, gèle / relance le chrono du serveur (en local, les `wait()` figés suffisent) ; `actionTimer` → `actionBar.countdown()` ; une table fermée pour pause trop longue (`idle`) propose « Rejouer » |
| `bot`, `opponents`, `recorder` | propriétés | branchées par `main.js` ; sans `bot`, les IA checkent / suivent |
| `onAllIn` | `async () => …` | attendu à chaque tapis (le show du croupier) |
| `onAiDecision(seat, action, debug, street)` | rappel | chaque décision d'IA (panneau `debug_ia`) |
| `current` | `{ id, seats }` | la main en cours, pour les outils de debug |

**Méthodes internes** :

| Méthode | Rôle |
|---|---|
| `_loop(game, run)` | joue les mains l'une après l'autre ; `run` change à chaque `start` / `stop`, ce qui arrête une ancienne boucle |
| `_onEvent(e)` | l'aiguillage des événements (tableau ci-dessous) ; passe les événements au `recorder` seulement en local |
| `_askPlayer(request)` | `actionBar.ask({ ...turn, street: 'Flop · Grosse blinde', note: 'Le Baron relance à 60' })`, puis `RemoteGame` transmet la réponse si besoin |
| `_askBot(request)` | `bot.decide(request)` → l'action seule ; en dev, une ligne `[AI]` dans la console |
| `_note(seat, text)`, `_positionName(seat)`, `_resultText(result)` | les textes français (partage, « au kicker », pots secondaires, mises non suivies rendues) |

| Événement | Animation |
|---|---|
| `handStart` | `chips.reset` (tapis et positions des sièges, `seatLayouts`) |
| `blind` | `chips.bet` ; tapis → `onAllIn` |
| `deal` | `cards.newHand` (le croupier distribue) |
| `street` | `cards.dealStreet` |
| `turn` (IA) | attente de 0,5 à 1,3 s (« l'IA réfléchit ») |
| `action` | fold → réaction, `chips.fold`, `cards.foldSeat` ; mise → `chips.bet`, réaction |
| `roundEnd` | `chips.collect` (les mises vont au pot) |
| `win` | le pot glisse vers le gagnant |
| `showdown` | `cards.reveal`, noms des mains, 1,2 s de lecture, réactions, `chips.payout` |
| `handEnd` | les IA à 0 s'affaissent sur leur chaise |

**Constantes** : `AI_THINK` [0.5, 1.3] s · `NEXT_HAND_DELAY` 3.5 s · `SHOWDOWN_READ` 1.2 s.

### 📄 `GameRecorder.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new GameRecorder({ onAchievements? })` | — | `onAchievements(ids)` reçoit les nouveaux succès (le toast) |
| `user` | le joueur connecté ou `null` | réglé par `UserBadge` ; `null` = rien n'est enregistré |
| `start(config)` | — | `POST /api/games` |
| `event(e)` | événement de `PokerGame` | passe au `HandLogger` ; à `handEnd`, envoie le journal |
| `stop()` | — | `POST /api/games/:id/quit` |

Les envois passent par **une file** (`_queue`) : une main à la fois, dans
l'ordre (le serveur attend la main n+1 après la n). Si le serveur refuse une
main (autre que `409`) ou ne répond pas, l'enregistrement s'arrête pour cette
partie — **la partie, elle, continue**.

## POURQUOI / PIÈGES

- À une **table en ligne**, le serveur envoie la table tournée vers ce joueur (siège 0 =
  lui, `isHuman` = lui) : le contrôleur n'a rien de spécial à faire, il affiche les autres
  humains comme des adversaires. Fin de partie : « Quitter la table » au lieu de « Rejouer »
  (on ne rejoue pas seul une table à plusieurs). Un refus du serveur (code inconnu…)
  s'affiche avec « Retour à la salle ».

- **Tous les délais** passent par `chips.wait()`, liée à la boucle de rendu :
  le menu pause fige vraiment tout… en local. Une partie serveur continue sans
  attendre l'écran : `pause()` prévient le serveur, sinon son chrono de 30 s
  couchait le joueur pendant la pause.
- Le joueur s'appelle « Toi » à la table, mais le serveur le nomme d'après son compte.
- `PokerBot.decide()` renvoie `{ action, debug }` ; le moteur ne reçoit que `action`.

## VOIR AUSSI

[shared/poker](../../shared/poker/MAN.md) (`PokerGame`, événements) · [shared/stats](../../shared/stats/MAN.md) (`HandLogger`) ·
[scene/cards](../scene/cards/MAN.md) · [scene/chips](../scene/chips/MAN.md) · [ui/actionBar](../ui/actionBar/MAN.md) ·
[server/games](../../../server/src/games/MAN.md)
