# 🤖 ai — l'adversaire IA (MCCFR)

> **Dossier** `src/shared/ai/` · **Couche** logique pure (`shared`) · **Utilisé par** `TableController` (jeu), le tableau des ranges, le match contre Slumbot (`../CFR/tests/slumbot/`)
> **Testé par** `tests/pokerBot.test.mjs`, `tests/ranges.test.mjs`

## NOM

`ai` — un siège joué par l'ordinateur : il lit la stratégie calculée par notre
solveur C++ (`../CFR`) et la transforme en un vrai coup sur la vraie table.

## SYNOPSIS

```js
import { PokerBot } from '../shared/ai/PokerBot.js';

const bot = await PokerBot.load('/ai/mccfr/');           // debug local uniquement
const { action, debug } = bot.decide(request);          // request = celle de PokerGame
// action = { type: 'raise', to: 125 }, debug = { key, bucket, probs, options, … }
```

## DESCRIPTION

Ce dossier contient la partie « haut niveau » de l'IA ; le détail de la
traduction vers le solveur est dans [`mccfr/`](mccfr/MAN.md).

Pour chaque décision, `PokerBot` :

1. range ses cartes dans un **bucket** (préflop : table ; postflop : force EHS → seuils) ;
2. traduit les mises réelles en **historique du solveur** (`2c/c3///`), chaque
   mise devenant la taille du solveur la plus proche ;
3. calcule la **clé 64 bits** et lit une probabilité par option du nœud dans `strategy.bin` (privé côté serveur) ;
4. mélange éventuellement avec une **politique simple** (selon le niveau, ou seule si le solveur n'a pas de réponse) ;
5. **tire** une option au hasard selon ces probabilités et la convertit en coup légal,
   dimensionné avec la formule du solveur appliquée à la **vraie** table.

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `PokerBot.js` | un siège IA : situation → clé → probabilités → coup réel, avec repli hors de l'arbre |
| `preflopRanges.js` | les **vraies** ranges préflop de l'IA, lues dans la stratégie (pour le tableau des ranges) |
| `mccfr/` | la traduction vers le solveur (voir [sa page](mccfr/MAN.md)) |
| `README.md` | la référence technique en anglais (ce qui doit rester identique au C++) |

## FONCTIONS

### 📄 `PokerBot.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `PokerBot.load(baseUrl?)` | URL → `Promise<PokerBot>` | charge les buckets et `strategy.bin` pour le mode debug local ; si la stratégie manque, le bot joue sa politique de repli |
| `new PokerBot(abstraction, strategy)` | — | construit le bot à partir de données déjà lues (le serveur, les tests) |
| `decide(view)` | requête de `PokerGame` → `{ action, debug }` | **la** décision (les 5 étapes ci-dessus) |
| `_toAction(option, turn, legal)` | option abstraite → coup légal | calcule le montant réel avec `sizeTo()` et le borne entre relance min et tapis |
| `stats` | `{ lookups, hits }` | combien de décisions ont trouvé leur clé (affiché en `debug_ia`) |

`debug` contient `key, bucket, strength, history, player, fromSolver, offTree,
facing, probs, options (libellés français), choice` : c'est ce qu'affiche
`AiDebugPanel`.

**Fonctions internes** (non exportées) :

| Fonction | Rôle |
|---|---|
| `simplePolicy(strength, turn, opponents, looseness, facing, round)` | politique « force contre cote du pot » → `[fold, call, raise]` ; la force est réduite pour chaque adversaire en plus |
| `spread([f, c, r], options)` | répartit `raise` entre les tailles du nœud (le tapis n'en reçoit que s'il est seul) |
| `withTemperature(probs, t)` | `t < 1` durcit la stratégie, `t > 1` l'aplatit |
| `normalise(p)`, `sample(p)` | ramène la somme à 1 ; tire un indice au hasard |

**Constantes** :

| Nom | Valeur | Sens |
|---|---|---|
| `CALL_SHOVE_PREFLOP` | 0.62 | hors de l'arbre, payer un tapis préflop demande ≥ 62 % d'équité (≈ 77+, AJ+, KQs) |
| `CALL_SHOVE_POSTFLOP` | 0.75 | idem après le flop, en EHS |
| `OVERSIZE_MARGIN` | 0.10 | face à une mise hors arbre (pas un tapis) : cote du pot + 10 % |
| `USE_LEVELS` | `false` | pour l'instant **tous les niveaux jouent la stratégie pure** ; `true` active `LEVELS` (expert / regular / beginner) |

### 📄 `preflopRanges.js`

| Nom | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `SOLVER_SPOTS` | `{ sbOpen, bbVsLimp, bbVsRaise }` | les trois situations préflop montrées : petite blinde qui ouvre ; grosse blinde après un limp (`c`) ; grosse blinde face à l'ouverture 2,5 BB (`2`) |
| `solverPreflopRange(abstraction, strategy, spot)` | → `{ main: { fold, call, raise } }` ou `null` | lit la stratégie pour les 169 mains ; toutes les tailles et le tapis sont additionnés en `raise` |

## EXEMPLE

```js
// Ce que l'IA fait avec AKo en petite blinde, première à parler
// (côté serveur : server/src/ai/preflop.js, GET /api/ai/preflop)
const range = solverPreflopRange(abstraction, strategy, 'sbOpen');
range.AKo; // { fold: 0, call: 0.08, raise: 0.92 }  (valeurs d'exemple)
```

## POURQUOI / PIÈGES

- **Hors de l'arbre** (`offTree`) : 5ᵉ mise d'un tour, ou le tapis abstrait déjà
  fait. La clé ne veut alors plus rien dire : on **ne lit pas** la table et on
  joue la politique simple en **suivre ou se coucher** seulement.
- **Une ligne de la table avec un autre nombre d'options** qu'au nœud = elle vient
  d'une autre abstraction de mises : elle est ignorée.
- **`purify` 0.03** : on retire les options sous 3 % (bruit de la stratégie
  moyenne : un expert ne se couche pas avec AA 0,1 % du temps), jamais les
  folds de la politique de repli.
- À plusieurs, l'IA ramène la table à « moi contre le reste » : c'est une
  approximation (voir `historyTranslator.js`).

## VOIR AUSSI

[mccfr](mccfr/MAN.md) · [poker](../poker/MAN.md) (`legalActions`, `PokerGame`) ·
[ranges du front](../../front/ui/ranges/MAN.md) (onglet Explorer) ·
`src/shared/ai/README.md` · `../CFR/tests/slumbot/README.md`
