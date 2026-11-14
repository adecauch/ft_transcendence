# 🪙 scene/chips — les jetons et leurs étiquettes

> **Dossier** `src/front/scene/chips/` · **Couche** front (Three.js + étiquettes HTML) · **Piloté par** `TableController`

## NOM

`chips` — les tapis, les mises et le pot en **vrais jetons 3D**, toujours
égaux aux montants réels, avec de petites étiquettes qui suivent la caméra.

## SYNOPSIS

```js
const chips = new TableChips({ scene, camera, renderer, feltY: table.feltY });
chips.reset(seats);                 // nouvelle main : tapis de chacun, pas de mise, pot vide
await chips.bet(1, 60, 940);        // le siège 1 mise, total 60, il lui reste 940
await chips.collect(120);           // les mises glissent au pot
await chips.payout([{ seat: 0, amount: 120, stack: 1060 }]);
await chips.wait(3.5);              // délai qui respecte la pause
```

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `chipStacks.js` | valeurs et couleurs des jetons ; un montant → une liste **exacte** de jetons |
| `ChipModel.js` | un jeton 3D par valeur (textures dessinées dans un canvas) |
| `TableChips.js` | les piles de chaque siège, les mises, le pot, les animations, les étiquettes |
| `labelStyles.js` | le CSS des étiquettes (injecté une seule fois) |

## FONCTIONS

### 📄 `chipStacks.js`

| Nom | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `DENOMINATIONS` | 1000 or · 500 violet · 100 noir · 25 vert · 5 rouge · 1 blanc | couleurs classiques de casino (base, inserts, incrustation, texte) |
| `exactChips(amount)` | `135` → `[100, 25, 5, 5]` | **le moins de jetons possible** (une mise, un pot) |
| `stackChips(amount)` | → valeurs | un **tapis** réaliste : même total, réparti sur plusieurs couleurs (pas un seul jeton de 1000) |
| `denomination(value)` | → couleurs | — |

### 📄 `ChipModel.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new ChipModel(renderer?)` | — | géométrie partagée (cylindre 39 × 3,3 mm à l'échelle) |
| `create(value)` | → `Mesh` | un jeton ; matériaux **partagés par valeur** |
| `warmUp()` | — | prépare tous les matériaux d'avance (la première mise ne saccade pas) |
| `CHIP_SIZE` | `{ radius, height }` | r ≈ 0.093, h ≈ 0.0157 |

Face : couleur de base, 6 inserts sur le bord, un anneau fin, une incrustation
crème avec la valeur. Tranche : les mêmes inserts qui traversent le bord.

### 📄 `TableChips.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `reset(seats)` | `[{ name, layout, stack, out? }]` | nouvelle main |
| `bet(i, totalBet, stack)` | → `Promise` | seuls les jetons **ajoutés** volent du tapis vers la mise |
| `collect(potTotal)` | → `Promise` | fin de tour : toutes les mises glissent au pot |
| `payout(results)` | `[{ seat, amount, stack }]` → `Promise` | chaque part du pot glisse vers son gagnant |
| `showHand(i, text)` | — | le nom de la main sous l'étiquette du siège (abattage) |
| `fold(i)` | — | grise l'étiquette |
| `clearLabels(i, on)` | — | efface les étiquettes du siège (le joueur regarde sa main, levée juste dessous) |
| `clearPot(on)` | — | efface l'étiquette du pot (le joueur regarde le board, levé par-dessus) |
| `wait(seconds)` | → `Promise` | **le** délai du jeu, avancé par `update` (donc figé par la pause) |
| `clear()` | — | tout retirer |
| `update(delta)` | — | animations, minuteries, et **replace les étiquettes** sur l'écran |

Internes : `_setStack`, `_setBet`, `_setPot` (reconstruisent la pile 3D),
`_pile(values, dir)` (piles de 20 jetons max, légèrement de travers),
`_tween(obj, to, duration, lift)`, `_label`, `_drawLabels` (montants via
`money()`, redessinés quand on passe jetons ↔ BB), `_placeLabels` (projection 3D → écran).

### 📄 `labelStyles.js`

| Fonction | À quoi elle sert |
|---|---|
| `injectChipLabelStyles()` | ajoute le CSS des étiquettes (`.chip-labels` : tapis, mise, pot, main montrée) une seule fois |

## POURQUOI / PIÈGES

- **Toujours exact** : ce qu'on voit sur le feutre fait **exactement** le vrai
  tapis, la vraie mise, le vrai pot.
- `wait()` sert à **tout** le jeu (`TableController`), pas seulement aux jetons :
  c'est ce qui permet au menu pause de figer la partie.
- Les montants s'affichent en jetons ou en BB selon l'option (`ui/chipUnit.js`) ;
  les jetons 3D, eux, restent des jetons.

## VOIR AUSSI

[game](../../game/MAN.md) · [scene](../MAN.md) (`seatLayout.js`, `POT_SPOT`) · [ui](../../ui/MAN.md) (`chipUnit.js`)
