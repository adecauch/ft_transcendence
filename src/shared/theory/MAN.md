# 📐 theory — le modèle préflop pédagogique

> **Dossier** `src/shared/theory/` · **Couche** logique pure (`shared`) · **Utilisé par** le tableau des ranges (« 📜 Mon historique », exemples de ranges)
> **Testé par** `tests/theory.test.mjs`

## NOM

`theory` — combien vaut chaque action préflop, **en grosses blindes**, dans un
modèle simple et **explicable** (pas un solveur).

## SYNOPSIS

```js
import { EquityMatrix } from '../shared/theory/equityMatrix.js';
import { PreflopModel } from '../shared/theory/preflopModel.js';

const matrix = new EquityMatrix(await (await fetch('/ai/equity169.json')).json());
const model = new PreflopModel(matrix);
model.evs('open', 'K7o');                       // { fold: -0.5, call: 0.12, raise: 0.31 }  (exemple)
model.per100('open', 'K7o', { fold: 1 });       // { player, theory, loss } en BB / 100 mains
```

## DESCRIPTION

Le solveur répond « quoi faire », pas « pourquoi ». Ce modèle sert à
**expliquer** au joueur où il perd des jetons :

- l'**adversaire** répond avec des ranges de référence en tête-à-tête (`huRanges.js`) ;
- une fois les jetons au milieu, chacun reçoit sa part du pot selon son
  **équité** contre la range de l'autre (`equityMatrix.js`), comme si tout le
  monde allait à l'abattage ;
- tailles : ouverture 2,5 BB, relance sur limp 4 BB, 3-bet 8 BB, 4-bet 22 BB, tapis 100 BB ;
- l'équité est **réalisée** à 95 % en position, 75 % hors de position.

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `equityMatrix.js` | équité préflop main contre main, main contre range |
| `huRanges.js` | ranges de référence en tête-à-tête (arrondies, pour enseigner) |
| `preflopModel.js` | l'EV de chaque action, la range « théorique », le manque à gagner du joueur |

## FONCTIONS

### 📄 `equityMatrix.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new EquityMatrix({ hands, eq })` | contenu de `public/ai/equity169.json` | table 169 × 169 en pour mille (faite par `npm run ai:equity`) |
| `vs(hand, other)` | `'AKs', 'QQ'` → 0..1 | équité d'une main contre une autre, tapis préflop |
| `vsRange(hand, weights)` | main + `{ main: fréquence }` → 0..1 | moyenne pondérée par combinaisons × fréquence (0,5 si range vide) |

L'effet de blocage des cartes (mon as rend ses as plus rares) est ignoré :
petite approximation, suffisante pour enseigner.

### 📄 `huRanges.js`

| Constante | Situation |
|---|---|
| `SB_OPEN` | petite blinde (= bouton) qui ouvre à 2,5 BB |
| `SB_4BET` | petite blinde face à un 3-bet : les mains qui relancent à 22 BB |
| `SB_VS_3BET` | petite blinde face à un 3-bet : les mains qui continuent |
| `BB_VS_OPEN` | grosse blinde face à l'ouverture : `threebet` et `call` |
| `BB_VS_LIMP` | grosse blinde après un limp : relance à 4 BB, sinon check |

Écrites dans la notation habituelle (`'22+, A2+, K2+…'`), lue par
`rangeFromNotation`. Aussi montrées comme exemples dans le tableau des ranges.

### 📄 `preflopModel.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new PreflopModel(matrix)` | — | prépare les ranges adverses (pondérées) |
| `evs(spot, hand)` | → `{ fold, call, raise }` en BB | EV de chaque action (en cache) ; se coucher en petite blinde = −0,5 |
| `best(spot, hand)` | → `{ action: part }` | la ou les meilleures actions ; à moins de `TIE` (0,05 BB) l'une de l'autre = mélangées |
| `theory(spot)` | → range complète | la range théorique d'une situation |
| `per100(spot, hand, mix)` | fréquences du joueur → `{ player, theory, loss }` | BB gagnées sur 100 fois cette main, et ce que le joueur **laisse** (loss ≥ 0) |
| `SIZES`, `REALIZE`, `TIE`, `SPOTS` | — | tailles, réalisation d'équité, seuil de mélange, `['open','vsLimp','vsRaise']` |

Les trois situations sont **les mêmes** que dans `stats/rangeAnalysis.js`, pour
comparer directement la range jouée à la range théorique.

## POURQUOI / PIÈGES

- Modèle **grossier exprès** : il montre les grosses fuites (se coucher
  gratuitement, payer avec 72o), pas les nuances. Le vrai adversaire, lui, joue
  la stratégie du solveur.
- Pas de jeu après le flop, pas de bluff : on le dit clairement dans l'interface.

## VOIR AUSSI

[poker](../poker/MAN.md) (`ranges.js`) · [stats](../stats/MAN.md) (`rangeAnalysis`) ·
[ranges du front](../../front/ui/ranges/MAN.md) (onglet Mon historique) ·
[scripts](../../../scripts/MAN.md) (`equity-matrix.mjs`)
