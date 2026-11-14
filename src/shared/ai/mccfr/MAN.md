# 🧠 mccfr — traduire une vraie main dans le jeu du solveur

> **Dossier** `src/shared/ai/mccfr/` · **Couche** logique pure (`shared`) · **Utilisé par** `PokerBot`, les stats du serveur (`PlayerInfoset`), `preflopRanges`
> **Testé par** `tests/pokerBot.test.mjs` (arbre JS = solveur, clés, tailles), `tests/replay.test.mjs`, `tests/ranges.test.mjs`

## NOM

`mccfr` — tout ce qui doit être **identique au solveur C++** : buckets de
cartes, force EHS, arbre des tailles de mise, traduction de l'historique,
clé 64 bits, lecture de `strategy.bin`.

## SYNOPSIS

```js
import { describeInfoset } from '../shared/ai/mccfr/infoset.js';

const info = describeInfoset(abstraction, request);
// { key: '8431…', round: 1, player: 1, bucket: 37, strength: 0.71,
//   history: '2c/c///', options: [...], offTree: null, facing: null }
const probs = strategy.get(info.key);   // [p_fold, p_call, p_⅓, p_½, p_⅔, p_pot, p_tapis]
```

## DESCRIPTION

Le solveur a été entraîné en **tête-à-tête, blindes 1/2, tapis de 400 (200 BB)**,
avec une liste fixe de tailles de mise par nœud. Une vraie main peut avoir 5
joueurs et n'importe quelle mise : il faut la **ramener** dans ce petit jeu.

```
cartes + board ──► bucket ─────────┐  cardAbstraction.js + handStrength.js
mises réelles  ──► "2c/c3///" ─────┤  historyTranslator.js + bettingTree.js
                                   ▼
          (tour, joueur, bucket, historique) ──► clé 64 bits    infosetKey.js
                                   ▼
          clé ──► une probabilité par option du nœud            StrategyTable.js
```

`infoset.js` enchaîne ces étapes : c'est **la seule** porte d'entrée, utilisée
par le bot **et** par les stats du joueur. Un test vérifie que les deux
donnent la même clé.

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `infoset.js` | **la** chaîne décision → clé (bucket + historique + clé) |
| `cardAbstraction.js` | cartes → bucket (préflop : `buckets.txt` ; postflop : EHS → seuils) |
| `handStrength.js` | force effective de la main (EHS), mêmes estimateurs que le C++ |
| `bettingTree.js` | l'arbre des tailles de mise du solveur, nœud par nœud (miroir de `betting.cpp`) |
| `historyTranslator.js` | table réelle → historique abstrait en tête-à-tête (taille la plus proche) |
| `infosetKey.js` | historique en texte, hachage FNV-1a, clé 64 bits (`BigInt`) |
| `StrategyTable.js` | lecture de `strategy.bin` (recherche par dichotomie) et fabrication du fichier |
| `historyWords.js` | un historique `'2c/c3///'` raconté en français |

## FONCTIONS

### 📄 `infoset.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `describeInfoset(abstraction, view)` | `{ round, seat, hole, board, history }` → `{ key, round, player, bucket, strength, history, options, offTree, facing }` | transforme une décision réelle en situation du solveur. Si `offTree` est rempli, `key` ne veut rien dire |

### 📄 `cardAbstraction.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `CardAbstraction.FILES` | 5 noms de fichiers | `buckets.txt`, `equity_table.txt`, `flop/turn/river_thresholds.txt` |
| `CardAbstraction.fromTexts(texts)` | contenus dans l'ordre de `FILES` → instance | le serveur lit les fichiers sur disque et appelle ceci |
| `CardAbstraction.load(baseUrl)` | URL → `Promise<instance>` | le navigateur les télécharge |
| `describe(round, hole, board)` | cartes (nombres) → `{ bucket, strength }` | préflop : bucket du type de main (0–29) et équité ; postflop : EHS puis bucket (0–49) |
| `preflopBuckets`, `equity`, `thresholds` | `Map` / tableaux | les données lues |
| `bucketFromEHS(thresholds, value)` | → index | nombre de seuils ≤ EHS, exactement `std::upper_bound` |

### 📄 `handStrength.js`

EHS = probabilité de gagner contre une main adverse au hasard (égalité = ½).

| Fonction | Entrée → Sortie | Méthode |
|---|---|---|
| `riverEHS(hole, board5)` | → 0..1 | **exacte** : les 990 mains adverses |
| `turnEHS(hole, board4, rollouts = 45)` | → 0..1 | 45 tirages (carte river + main adverse) |
| `flopEHS(hole, board3, rollouts = 50)` | → 0..1 | 50 tirages (turn + river + main adverse) |
| `ehs(hole, board)` | → 0..1 | choisit selon la taille du board |
| `TURN_EHS_ROLLOUTS`, `FLOP_EHS_ROLLOUTS` | 45, 50 | **les mêmes que le C++** : les seuils ont été calculés avec eux |

### 📄 `bettingTree.js`

Dans chaque nœud, les options sont **toujours** dans cet ordre, et l'historique
retient **l'indice** :

| Indice | Option | Lettre |
|---|---|---|
| 0 | se coucher (listé même si illégal) | `f` |
| 1 | checker / suivre | `c` |
| 2 … n-2 | les tailles du niveau de relance | `2` … |
| n-1 | tapis | dernier chiffre |

| Niveau de relance | Préflop | Postflop |
|---|---|---|
| 0 | ouverture 2 BB ou 2,5 BB | ⅓, ½, ⅔, 1 pot |
| 1 | 3-bet ×3 | relance ×3 |
| 2 | 4-bet ×2,5 | tapis seulement |
| 3 | tapis seulement | tapis seulement |

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `sizeTo(spec, { currentBet, toCall, pot, bigBlind, maxTo })` | taille → « relancer à » | **la** formule du solveur, utilisée dans le jeu abstrait et sur la vraie table |
| `new AbstractHand()` | — | une main du jeu du solveur (tapis 200, blindes 1/2) |
| `.options()` | → `[{ type, spec?, to?, legal }]` | les options du nœud courant, calculées comme `legalActions()` en C++ |
| `.apply(index)` | indice → option | joue une option (avance le joueur) |
| `.startRound(round)` | — | nouveau tour : mises à 0, la grosse blinde parle |
| `.raisesThisRound()`, `.historyString()` | → nombre / texte | niveau de relance ; historique `"25c/3///"` |
| `optionChar(i)` / `charOption(ch)` | `0` ↔ `'f'`, `1` ↔ `'c'`, `2` ↔ `'2'` | indice ↔ lettre |
| `replayHistory(history)` | `"2c/c3///"` → `[{ round, player, index, option, facing }]` | rejoue un historique pas à pas (pour le raconter) |
| `optionLabel(option, facing?)` | → `'Se coucher'`, `'½ pot'`, `'×3'`, `'Tapis'` | libellé court français |
| `FOLD`, `CALL`, `FIRST_RAISE_OPTION` | 0, 1, 2 | indices fixes |
| `SOLVER_SB`, `SOLVER_BB`, `SOLVER_STACK` | 1, 2, 200 | le jeu du solveur |
| `PREFLOP_SIZES`, `POSTFLOP_SIZES`, `MAX_BETS_PER_ROUND` (4), `ALLIN_THRESHOLD` (⅔) | — | les tables de tailles, mêmes noms qu'en C++ |
| `BETTING_ID` | texte JSON | l'identité de l'abstraction de mises (entre dans la **version** des `PlayerInfoset`) |

Une taille est retirée si elle est sous la relance min, égale au tapis, ajoute
plus de ⅔ du tapis, ou tombe sur le même montant que la précédente. Donc `2`
= « la première taille de **ce** nœud » : ½ pot dans un pot limpé (⅓ de 4 < 2).

### 📄 `historyTranslator.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `toAbstract(rounds, me, round)` | historique réel par tour, siège du bot, tour → `{ player, rounds, options, offTree, facing }` | l'historique abstrait, les options du nœud où le bot décide, et s'il est sorti de l'arbre |
| `mapRaise(options, pot, action)` | → indice d'option (ou -1) | la taille du solveur la plus proche d'une vraie relance, en « relance à / pot avant », **échelle log** |

Règles de `toAbstract` :
- les actions adverses consécutives fusionnent (leur plus grosse relance, sinon `c`) ; les folds adverses disparaissent ;
- joueur abstrait 0 = celui qui parle en premier préflop ;
- s'il manque un côté dans l'alternance, un check / call **virtuel** est inséré ;
- après un call qui ferme le tour, les checks suivants sont ignorés ;
- la suite de la main continue avec le montant **du solveur**, jamais le réel ;
- une relance réelle non-tapis ne devient jamais le tapis du solveur (sauf s'il n'y a que lui).

### 📄 `infosetKey.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `historyString(rounds)` | `[['2','c'],['c','3']]` → `"2c/c3///"` | toujours 4 `/` |
| `hashHistory(history)` | texte → `BigInt` | FNV-1a 64 bits |
| `packInfoSetKey(round, player, bucket, history, depth?)` | → clé en **texte décimal** | `[0-1] tour · [2] joueur · [3-12] bucket · [13-21] profondeur en BB (défaut `SOLVER_DEPTH` = 200) · [22-63] FNV-1a` ; la profondeur sépare les nœuds de chaque tapis : seul 200 BB est entraîné |
| `NUM_ROUNDS` | 4 | — |

### 📄 `StrategyTable.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new StrategyTable(buffer)` | `ArrayBuffer` ou `Buffer` → table | lit l'en-tête `MCFR` et crée des vues sans rien analyser |
| `StrategyTable.load(url)` | → `Promise<table>` | téléchargement dans le navigateur |
| `get(key)` | clé texte → `number[]` ou `undefined` | recherche par dichotomie ; une probabilité par option |
| `size` | → nombre | nombre d'infosets (≈ 4,16 M) |
| `packStrategy(text)` | `strategy.txt` → `{ buffer, count, options }` | fabrique `strategy.bin` (`scripts/pack-strategy.mjs`) |

Format de `strategy.bin` (49 Mo au lieu de 170) : en-tête 16 octets
(`"MCFR"`, version, nombre d'infosets, nombre d'options) → clés `u64` triées →
nombre d'options par infoset (`u8`) → probabilités sur 1 octet (somme = 255,
méthode des plus grands restes).

### 📄 `historyWords.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `describeHistory(history, round, player)` | `'c/c3///', 1, 1` → `"Au flop, tu checkes, l'adversaire mise ½ pot."` | raconte ce qui s'est passé dans le tour avant la décision (onglet « Face au solveur ») |

## POURQUOI / PIÈGES

- **Les clés dépassent 2⁵³** : `BigInt` pour les calculer, texte pour les
  transporter et les stocker (même le `bigint` signé de PostgreSQL ne suffit pas).
- **Même EHS que le C++, au tirage près** : un autre estimateur décalerait
  tous les buckets. Mais les tirages rendent le bucket d'une main **à la frontière**
  légèrement aléatoire.
- **Changer une taille de mise** change le sens des lettres de l'historique :
  il faut réentraîner, relancer `ai:sync`, et `BETTING_ID` change la version
  des `PlayerInfoset` (reconstruites par `db:rebuild-infosets`).
- Un test rejoue des mains abstraites au hasard : chaque nœud doit exister dans
  la stratégie avec **le même nombre d'options**.

## VOIR AUSSI

[ai](../MAN.md) (`PokerBot`) · [stats](../../stats/MAN.md) (`playerInfosets`) ·
[server/stats](../../../../server/src/stats/MAN.md) (comparaison au solveur) ·
`src/shared/ai/README.md` · [scripts](../../../../scripts/MAN.md) (`ai:sync`)
