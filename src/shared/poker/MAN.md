# 🃏 poker — les règles du Texas Hold'em No-Limit

> **Dossier** `src/shared/poker/` · **Couche** logique pure (`shared`) · **Utilisé par** le jeu (navigateur), le rejeu du serveur, l'IA
> **Testé par** `tests/pokerGame.test.mjs`, `tests/betting.test.mjs`, `tests/showdown.test.mjs`, `tests/ranges.test.mjs`

## NOM

`poker` — la table de poker **sans aucun affichage** : paquet, force des mains,
règles de mise, pots secondaires, ranges, et la partie entière (`PokerGame`).

## SYNOPSIS

```js
import { PokerGame } from '../shared/poker/PokerGame.js';
import { legalActions, validateRaise } from '../shared/poker/betting.js';

const game = new PokerGame({ players, startingStack: 2000, blinds: { small: 10, big: 20 }, onEvent });
const { result, stacks, gameOver } = await game.playHand();
```

## DESCRIPTION

Tout ce qui décide **qui gagne combien** vit ici, et nulle part ailleurs. Le
même code tourne dans le navigateur (pour jouer) et sur le serveur (pour
**rejouer** chaque main et refuser la triche). Rien ici ne touche au DOM, à
Three.js ni aux minuteries : tout se teste directement dans Node.

`PokerGame` ne dessine rien : il **émet des événements** (le front les anime)
et **demande** chaque décision à l'`agent` du siège (joueur, IA ou journal de
rejeu). Les autres fichiers sont des fonctions pures qu'il utilise.

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `cards.js` | codes de cartes, paquet, mélange, codage du solveur C++ |
| `handEvaluator.js` | meilleure main de 5 cartes parmi 5 à 7 → un nombre comparable |
| `betting.js` | ce qui est légal pour **une** décision, raccourcis de relance, montants en BB |
| `showdown.js` | pots principal et secondaires, partage, nom français de la main |
| `ranges.js` | grille 13 × 13, notation `QQ+, ATs+`, stats, nettoyage d'une range |
| `PokerGame.js` | la table entière : tapis, bouton, blindes, donne, tours d'enchères, abattage |
| `viewpoint.js` | la table **vue depuis un siège** : numéros de siège tournés pour que ce joueur soit le siège 0 (tables partagées en ligne) |

## FONCTIONS

### 📄 `cards.js`

Deux écritures d'une carte : le **code** texte `'AS'` (rang + couleur `S H D C`,
aussi le nom de la texture) et le **nombre** du solveur C++ `rang × 4 + couleur`
(rang 0 = deux … 12 = as).

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `createDeck()` | → `string[52]` | les 52 codes dans l'ordre |
| `shuffle(cards)` | tableau → le même tableau | mélange de Fisher–Yates, **sur place** |
| `rankOf(card)` / `suitOf(card)` | `48` → `12` / `0` | rang et couleur d'une carte du solveur |
| `codeToCard(code)` | `'AS'` → `48` | code texte → nombre (lève une erreur si code inconnu) |
| `handType([c1, c2])` | 2 nombres → `'AKs'`, `'T9o'`, `'QQ'` | type préflop, comme dans `buckets.txt` du solveur |

### 📄 `handEvaluator.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `evaluate(cards)` | 5 à 7 nombres → `number` | **score** de la meilleure main : plus grand = meilleur |
| `compareHands(a, b)` | deux mains → `-1 \| 0 \| 1` | comme `compareHands()` du solveur C++ |

Le score est `catégorie × 13⁵ + départage` : catégorie 8 = quinte flush … 0 =
carte haute, puis 5 rangs du plus important au moins important. Deux mains se
comparent donc par une simple soustraction. La roue `A-2-3-4-5` est une quinte
hauteur cinq.

### 📄 `betting.js`

Toutes les fonctions reçoivent un `TurnState` :
`{ stack, playerBet, currentBet, lastRaise, bigBlind, pot, preflop? }`.
Une relance s'écrit toujours en **« relancer à »** (total misé sur le tour),
jamais en supplément.

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `toCall(s)` | → jetons | ce qu'il faut pour suivre (plafonné au tapis) |
| `minRaiseTo(s)` | → jetons | relance minimum : `currentBet + max(dernière relance, BB)`, ou le tapis s'il ne l'atteint pas |
| `maxRaiseTo(s)` | → jetons | relance maximum : tout le tapis |
| `legalActions(s)` | → `{ fold, check, call, callIsAllIn, raise: {min,max}\|null, isBet }` | quels boutons afficher, avec quels montants |
| `validateRaise(s, input, format?)` | texte ou nombre → `{ ok, to }` ou `{ ok: false, error }` | vérifie un montant tapé ; message d'erreur **en français** |
| `raisePresets(s)` | → `[{ label, to }]` | les raccourcis de relance du panneau (voir ci-dessous) |
| `quickBets(s)` | → `[{ label, to }]` (vide si relancer est impossible) | les **mises en un clic** de la barre d'actions : 2 / 2,5 / 3 BB, ou ×2,5 / ×3 / Pot, ou ⅓ / ½ / ⅔ / Pot, puis Tapis ; « Min » si aucune taille n'est légale |
| `fmt(n)` | `1234` → `"1 234"` | nombre à la française |
| `fmtBB(n, bb)` | `1234, 20` → `"61,7 BB"` | jetons → grosses blindes (1 décimale max) |
| `parseBB(input, bb)` | `"2,5"` → `50` | montant tapé en BB → jetons (`null` si illisible) |

**Raccourcis (`raisePresets`)** : préflop sans relance 2 / 2,5 / 3 / 4 BB ;
face à une mise ×2,5 / ×3 / ×4 + Pot ; première mise postflop ⅓ / ½ / ⅔ / ¾ /
1 / 1,5 pot ; toujours **Min** en premier et **Tapis** en dernier. Un montant
hors bornes est **retiré, pas ramené** (une étiquette ne ment jamais), les
doublons sont fusionnés et « Tapis » gagne toujours.

### 📄 `showdown.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `buildPots(contributions, folded)` | jetons mis par siège, sièges couchés → `[{ amount, eligible }]` | pot principal puis pots secondaires ; les jetons d'un siège couché restent dans le pot mais il ne peut pas gagner |
| `splitPots(pots, scores, order)` | pots, `Map` siège → score, ordre après le bouton → `{ winnings, pots }` | qui gagne quoi ; égalité = partage, jeton impair au premier gagnant après le bouton |
| `scoreHand(codes)` | codes texte → score | `evaluate()` à partir des codes `'AS'` |
| `handName(codes)` | 5 à 7 codes → `"Full aux dames par les dix"` | nom français de la main, affiché à l'abattage |

Un pot avec un seul siège éligible, c'est une mise que personne n'a pu suivre :
elle revient à son auteur.

### 📄 `ranges.js`

Une **range** = `{ main → { action → fréquence } }`, par exemple
`{ AA: { raise: 1 }, AJs: { raise: 0.6, call: 0.4 } }`. Une main absente =
le reste (en général se coucher).

| Fonction / constante | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `RANKS`, `ALL_HANDS`, `TOTAL_COMBOS` | — | ordre de la grille (`AKQ…2`), les 169 mains, 1 326 combinaisons |
| `cellHand(row, col)` | case → `'AKs'` | au-dessus de la diagonale = assortie, en dessous = dépareillée |
| `handKind(hand)` | → `'pair' \| 'suited' \| 'offsuit'` | le genre de main |
| `combos(hand)` | → 6, 4 ou 12 | nombre de combinaisons de cartes |
| `handLabel(hand)` | `'AKs'` → `"As-Roi assortis"` | nom français |
| `exampleCards(hand)` | `'AKs'` → `['AS','KS']` | de vraies cartes pour dessiner la main |
| `typeOfCards([c1, c2])` | `['KD','AS']` → `'AKo'` | deux codes → type de main |
| `parseRange(text)` | `'QQ+, A5s-A2s'` → `Set` de mains | lit la notation des livres de poker ; erreur **en français** sinon |
| `rangeFromNotation(byAction, rest?)` | `{ raise: 'TT+', call: '22-99' }` → range | une notation par action ; la première gagne les chevauchements |
| `rangeStats(range, actionIds)` | → `{ action: { combos, share } }` | part de chaque action sur les 1 326 combinaisons |
| `cleanRange(data)` | objet quelconque → range propre | vérifie une range envoyée au serveur (vraies mains, `raise`/`call` seulement, fréquences 0–1 de somme ≤ 1) |
| `SAVED_RANGE_ACTIONS`, `RANGE_NAME_MAX` | — | `['raise','call']`, nom de 40 caractères max |

Notation reconnue : `QQ+` (QQ à AA), `55-22`, `ATs+` (ATs à AKs), `A5s-A2s`,
`KQo` (dépareillée seulement), `KQ` (les deux).

### 📄 `PokerGame.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new PokerGame({ players, startingStack, blinds, onEvent?, deck?, endWhen? })` | — | crée la table ; `players[i] = { name, isHuman, level?, agent }` ; `endWhen` : `'hero'` (défaut) ou `'lastStanding'` (table partagée) |
| `playHand()` | → `Promise<{ result, stacks, gameOver }>` | joue **une** main entière |
| `abort()` | — | arrête à la prochaine étape : `playHand()` lève alors `GameAborted` |
| `gameOver` (getter) | → `'lost' \| 'won' \| 'over' \| null` | le joueur (siège 0) est éliminé, ou toutes les IA ; avec `endWhen: 'lastStanding'` : `'over'` quand un seul siège a encore des jetons |

### 📄 `viewpoint.js`

| Fonction | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `rotateSeat(seat, me, n)` · `rotateArray(arr, me)` | siège / tableau par siège | `me` devient 0, le suivant dans le sens horaire 1… |
| `rotateEvent(e, me, n)` | événement → événement tourné | tous les champs de siège (`seat`, `button`, `seats`, `hole`, `pots`, `winnings`, `result`…) ; `isHuman` = « c'est moi », `remote` = un autre humain ; `handEnd.gameOver` calculé pour `me` |
| `viewEvent(e, me, n)` | → ce que `me` a le droit de voir | `rotateEvent` + cartes des autres cachées à la donne |
| `rotateRequest(request, me, n)` | demande de décision → tournée | pour classer les décisions face au solveur (siège + historique) |
| `gameOverFor(stacks)` | tapis tournés → `'lost' \| 'won' \| null` | fin de partie du point de vue du siège 0 |

Pourquoi : tout ce qui suit le moteur (table 3D, `HandRecorder`, stats, solveur)
suppose « le joueur est au siège 0 ». À une table partagée, le serveur tourne la
table pour chaque joueur au lieu de réécrire tout ce code ; `tests/viewpoint.test.mjs`
vérifie sur des parties entières que chacun retrouve les chiffres de son vrai siège.
| `stacks`, `button`, `handNo`, `seats` | — | état courant (lecture seule pour les outils de debug) |
| `GameAborted` | classe d'erreur | le joueur a quitté la partie |

**Événements émis** (chacun est **attendu** avant de continuer) :

| Événement | Contenu |
|---|---|
| `handStart` | `handNo, seats, button, sb, bb` |
| `blind` | `seat, amount, bet, stack, pot, allIn` |
| `deal` | `hole[seat] = ['AS','KD']` ou `null` (siège éliminé) |
| `street` | `street` (1 à 3), `cards` (les nouvelles), `board` |
| `turn` | `seat, street, isHuman` — avant chaque décision |
| `action` | `seat, street, action, paid, bet, stack, pot, isBet, allIn` |
| `roundEnd` | `street, pot` — les mises vont au pot |
| `win` | `seat, amount, stack, lastFold` — tous les autres se sont couchés |
| `showdown` | `reveals [{ seat, cards, hand }], pots, winnings` |
| `handEnd` | `result, stacks, gameOver` |

**La requête envoyée à `agent.decide(request)`** :
`{ seat, level, round, hole, board, opponents, history, turn, button, sb, bb }`
— exactement ce qu'attend `PokerBot.decide()`. La réponse est une action
`{ type: 'fold' | 'check' } | { type: 'call', amount } | { type: 'raise', to }`.

`history[street]` note chaque décision `{ seat, type }` et, pour une relance
ou un call à tapis, `to`, `potBefore`, `allIn` : c'est l'historique que l'IA
traduit dans l'arbre du solveur.

## EXEMPLE

```js
const always = (type) => ({ decide: ({ turn }) =>
  type === 'call' && toCall(turn) === 0 ? { type: 'check' } : { type, amount: toCall(turn) } });

const game = new PokerGame({
  players: [
    { name: 'Moi', isHuman: true,  agent: always('call') },
    { name: 'IA',  isHuman: false, agent: always('call') },
  ],
  startingStack: 2000,
  blinds: { small: 10, big: 20 },
  onEvent: (e) => console.log(e.type),
});
await game.playHand(); // handStart, blind, blind, deal, turn, action, … handEnd
```

## RÈGLES APPLIQUÉES

- le bouton avance au prochain siège encore en jeu ; **en tête-à-tête, le
  bouton est la petite blinde** (parle en premier préflop, en dernier ensuite) ;
- une relance **rouvre** l'action pour tous les autres ;
- tous les autres couchés → le dernier prend le pot sans abattage ;
- abattage → pots secondaires, partages, jeton impair après le bouton ;
- les tapis sont conservés ; un siège à 0 est éliminé.

## POURQUOI / PIÈGES

- **Option `deck`** : une fonction qui rend les cartes de la main (tirées avec
  `pop()`). Le serveur y passe les cartes enregistrées pour **rejouer** une
  main à l'identique (`shared/stats/replay.js`).
- **Une seule règle de relance** : la barre d'actions (`RaisePanel`) et le
  moteur utilisent tous deux `validateRaise()` / `legalActions()`. Impossible
  qu'un bouton propose un coup que le moteur refuserait.
- `shuffle` utilise `Math.random()` : c'est encore le **navigateur** qui mélange
  (limite anti-triche connue, voir `docs/project/ROADMAP.md`).

## VOIR AUSSI

[ai](../ai/MAN.md) (l'IA qui joue un siège) · [stats](../stats/MAN.md) (rejeu du
serveur) · [game](../../front/game/MAN.md) (`TableController`, qui anime les
événements) · `docs/project/CODE.md` §5 (le trajet d'une main)
