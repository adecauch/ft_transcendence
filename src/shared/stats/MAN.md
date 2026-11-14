# 📊 stats — ce que deviennent les mains jouées

> **Dossier** `src/shared/stats/` · **Couche** logique pure (`shared`) · **Utilisé par** `GameRecorder` (navigateur), `server/src/games/` et `server/src/stats/`, le front (succès)
> **Testé par** `tests/replay.test.mjs`, `tests/ranges.test.mjs`, et côté serveur `server/tests/games`, `infosets`

## NOM

`stats` — du **journal** d'une main envoyé par le navigateur jusqu'aux
chiffres du joueur : rejeu vérifié, enregistrement complet, succès, décisions
face au solveur, range vraiment jouée.

## SYNOPSIS

```js
// navigateur : noter la main
const logger = new HandLogger();
onEvent: (e) => { const log = logger.event(e); if (log) send(log); }

// serveur : la rejouer et l'enregistrer
const { record, decisions, stacks, button, gameOver } = await replayHand(state, log);
const unlocked = newlyUnlocked({ totals, hand: record, game }, alreadyUnlocked);
```

## DESCRIPTION

Le serveur **ne croit pas** le navigateur. Le navigateur envoie seulement les
**entrées** de la main (cartes et décisions) ; le serveur la **rejoue** avec le
même `PokerGame` et calcule lui-même tapis, pots et gagnants.

```
PokerGame (navigateur) ─events─► HandLogger ─► journal ──HTTP──► replayHand (serveur)
                                                                    │ PokerGame + paquet arrangé
                                                                    ├─► HandRecorder ─► Hand / Action en base
                                                                    ├─► decisions ─► playerInfosets ─► PlayerInfoset
                                                                    └─► newlyUnlocked ─► UserAchievement
```

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `handLog.js` | le **journal** d'une main : cartes + décisions, jamais de résultats |
| `replay.js` | rejoue un journal avec le vrai moteur, refuse tout coup illégal |
| `handRecord.js` | tout ce qui s'est passé dans la main, pour la base (et les chiffres du joueur) |
| `achievements.js` | les 12 succès et leur condition |
| `playerInfosets.js` | les décisions du joueur classées sous les clés du solveur ; écart joueur / solveur |
| `rangeAnalysis.js` | la range vraiment jouée, les erreurs préflop nettes, les plus grosses pertes |
| `savedHand.js` | une main lue en base → les entrées de `replayHand` (reconstruire les données dérivées) |

## FONCTIONS

### 📄 `handLog.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new HandLogger()` | — | un carnet vide |
| `event(e)` | un événement de `PokerGame` → le journal sur `handEnd`, sinon `null` | à brancher sur `onEvent` |

Forme du journal :

```js
{ handNo: 3,
  hole:  [['AS','KD'], ['7H','7C'], null],        // null = siège éliminé
  board: ['2S','9D','TC','QH'],                   // 0, 3, 4 ou 5 cartes
  actions: [{ seat: 1, street: 0, type: 'raise', to: 60 }, { seat: 0, street: 0, type: 'call' }, …] }
```

Un `call` de 0 jeton est noté `check`. Les blindes ne sont pas dans le journal
(le moteur les pose tout seul).

### 📄 `replay.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `replayHand(state, log)` | état **du serveur** + journal → `Promise<{ record, decisions, stacks, button, handNo, gameOver }>` | rejoue la main ; lève `ReplayError` au moindre problème |
| `ReplayError` | classe d'erreur | message **en français**, renvoyé tel quel dans la réponse `422` |
| `stackedDeck(log, button, n)` *(interne)* | → paquet | range les cartes du journal pour que `pop()` les donne **là où le moteur les distribue** (deux tours à gauche du bouton, brûle + flop, brûle + turn, brûle + river) |

`state = { players, blinds, stacks, button, handNo }` : ce que le serveur a
gardé **après la main précédente**. `decisions` = ce que chaque siège savait à
chaque décision, et ce qu'il a fait (pour `playerInfosets`).

Ce qui est refusé : mauvais numéro de main, partie finie, cartes inconnues ou
en double, board de mauvaise taille, coup du mauvais siège ou du mauvais tour,
check face à une mise, relance hors limites, coup manquant ou en trop.

### 📄 `handRecord.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new HandRecorder()` | — | un enregistrement vide |
| `event(e)` | événements de `PokerGame` | remplit `record` au fil de la main |
| `record` | objet | voir ci-dessous |

`record` = `{ number, button, sb, bb, board, pot, result, players[], actions[], hero }` :

- `players[]` : par siège, nom, tapis avant / après, cartes, couché, montré, nom de la main, catégorie, gains ;
- `actions[]` : **tous** les mouvements, blindes comprises : `{ street, seat, type, amount, betTo, potAfter, allIn }`
  avec `type` = `blind | fold | check | call | bet | raise` (une première mise est un `bet`) ;
- `hero` (siège 0) : `net, collected, vpip, pfr, allIn, showdown, showdownWon, handName, handCategory` —
  recopiés dans les colonnes `hero…` de `Hand` pour des stats en SQL simple.

**VPIP** = a mis des jetons préflop **par choix** (les blindes ne comptent pas) ;
**PFR** = a relancé préflop.

### 📄 `achievements.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `ACHIEVEMENTS` | `[{ id, icon, name, description, test(ctx) }]` | la liste des 12 succès (le front l'affiche, le serveur la teste) |
| `newlyUnlocked(ctx, alreadyUnlocked)` | → `string[]` | ids des succès dont le test passe **maintenant** et pas encore débloqués |

`ctx = { totals, hand, game }` : totaux du joueur (cette main comprise), la
main (`record`), la partie (`status`, `opponents`, `bigBlind`).

| Icône | Nom | Condition |
|---|---|---|
| 🃏 | Premier pas | jouer une partie |
| 💰 | Premier pot | remporter une main |
| 🧊 | Sang-froid | gagner un abattage |
| 🎭 | Bluffeur | miser à la river et voir tout le monde se coucher |
| 🔥 | Tapis ! | faire tapis et gagner la main |
| 🏦 | Gros coup | un pot d'au moins 50 BB |
| 👑 | Main de monstre | gagner un abattage avec un carré ou mieux |
| ⭐ | Shérif | gagner une partie |
| 🎯 | Chasseur de primes | gagner une partie contre une IA Expert |
| 🪑 | Table pleine | gagner une partie contre 4 IA |
| 🍺 | Habitué du saloon | jouer 100 mains |
| 🤠 | Légende de l'Ouest | gagner 10 parties |

### 📄 `playerInfosets.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `playerInfosets(decisions, abstraction, seat = 0)` | décisions du rejeu → `[{ key, round, player, bucket, history, action }]` | chaque décision du joueur passe par **la même chaîne que le bot** (`describeInfoset`) ; `action` = `fold \| call \| raise` (un check est un call de rien) ; hors abstraction = ignorée |
| `foldCallRaise(probs)` | ligne du solveur → `[fold, call, raise]` | additionne toutes les tailles et le tapis en `raise` |
| `strategyGap(counts, probs)` | `{ fold, call, raise }` + ligne du solveur → 0..1 | écart = ½ × somme des différences absolues (0 = identique, 1 = opposé) |

### 📄 `rangeAnalysis.js`

| Nom | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `analyseHands(hands, equity)` | mains enregistrées + `Map` équité → `{ hands, situations, mistakes, losses }` | la range vraiment jouée, les 6 erreurs principales, les 5 plus grosses pertes |
| `STRONG_FOLD` | 0.64 | se coucher avec une main ≥ 64 % d'équité (77+, AK, AQ, AJs, ATs) = erreur |
| `WEAK_CALL` | 0.38 | payer une relance avec < 38 % (72o, 83o…) = erreur |

- Seule la **première décision préflop** compte ; trois situations :
  `open` (personne n'est entré), `vsLimp` (quelqu'un a juste suivi), `vsRaise` (quelqu'un a relancé).
- `situations[s].hands[main] = { n, raise, call, fold, netBB }`.
- Trois règles d'erreur, simples exprès pour qu'un débutant comprenne :
  `fold-free` (couché en grosse blinde alors que checker était gratuit),
  `fold-strong`, `call-trash`. Même règle + même main = regroupées (« 3 fois avec JJ »),
  classées par poids × nombre + coût.

### 📄 `savedHand.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `replayInputs(hand, seats, blinds)` | main lue en base → `{ state, log }` | les arguments de `replayHand` ; le bouton est reculé d'un siège (le moteur l'avance), `bet` redevient `raise` |

## POURQUOI / PIÈGES

- **Jamais de résultat dans le journal** : impossible de s'attribuer un pot.
- **Limite connue** : c'est encore le navigateur qui **choisit les cartes**. Le
  rejeu vérifie tout le reste ; la fin de cette limite = moteur côté serveur.
- `Hand` / `Action` sont la **source de vérité** ; `PlayerInfoset` n'est qu'une
  donnée dérivée, reconstruite par `savedHand` + `replayHand` après un
  réentraînement du solveur.

## VOIR AUSSI

[poker](../poker/MAN.md) (`PokerGame`) · [mccfr](../ai/mccfr/MAN.md) (`describeInfoset`) ·
[server/games](../../../server/src/games/MAN.md) · [server/stats](../../../server/src/stats/MAN.md) ·
`server/STATS.md`
