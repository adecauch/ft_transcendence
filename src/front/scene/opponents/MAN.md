# 🪑 scene/opponents — les IA assises autour de la table

> **Dossier** `src/front/scene/opponents/` · **Couche** front (Three.js) · **Piloté par** `TableController` (`seat`, `react`, `clear`)

## NOM

`opponents` — un personnage par IA, assis sur la chaise de son siège, avec
de **petites réactions** au jeu.

## SYNOPSIS

```js
const opponents = new Opponents(scene, loader);
await opponents.seat(['Le Baron', 'Lucky Lou']);   // siège 1, siège 2
opponents.react(1, 'raise');                        // hochement de tête
opponents.react(2, 'out');                          // s'affaisse, reste ainsi
opponents.clear();
```

## DESCRIPTION

| Réaction | Geste |
|---|---|
| `raise` | double hochement de tête |
| `fold` | tête basse, se recule, puis revient |
| `lose` | secoue lentement la tête |
| `win` | menton levé, léger balancement des épaules |
| `out` | s'affaisse sur la chaise et **reste** ainsi |

Le corps garde la **pose assise** (dernière image de `SitDown`) ; les gestes
sont de **petites rotations** du buste, du cou et de la tête ajoutées à chaque
image, plus une respiration et un regard qui se promène.

## FICHIERS ET FONCTIONS

### 📄 `Opponents.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `seat(names)` | noms dans l'ordre des sièges → `Promise` | charge (une fois par fichier) et assied un personnage par IA sur sa chaise (`seatLayouts(n)[i].chair`) ; ignoré si `clear()` ou un autre `seat()` est arrivé entre-temps |
| `clear()` | — | retire et libère tous les personnages |
| `react(seat, kind)` | — | joue un geste |
| `update(delta)` | — | chaque image ; `paused` fige tout |

Classe interne `Character` : clone le modèle (squelette compris), **recolore**
ses matériaux, le met à 6 de haut, fige la pose assise, le place sur la chaise
(hanches un peu vers le dossier), mémorise buste / cou / tête ;
`react(kind)`, `update(delta)`, `dispose()`.

`GESTURES` : pour chaque geste, sa durée et une fonction par os
`temps → { x, y, z }` (x = pencher en avant, y = tourner, z = incliner).
Volontairement **petits** : le buste ne se penche jamais de plus de quelques degrés vers la table.

### 📄 `characters.js`

| Nom | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `LOOKS` | nom → `{ model, colors }` | l'apparence de Le Baron, Lucky Lou, Madame Rouge, Doc Holliday |
| `DEFAULT_LOOK` | — | tout autre nom |
| `lookFor(name)` | → apparence | — |

`colors` = nom de matériau → couleur (`Skin, Jacket, Top, Scarf, HatBrown,
HatLightBrown, Pants, Hair`).

## POURQUOI / PIÈGES

- **Modèles provisoires** : tous utilisent le `Cowboy_Male` du croupier,
  recoloré. Les vrais (Suit_Male, Cowboy_Hair, Suit_Female, OldClassy_Male du
  même pack) sont à déposer dans `public/models/characters/` puis à brancher dans `LOOKS`.
- Les clips du pack (Punch, Victory, Death…) sont animés **debout** : joués
  assis, les bras traversent la table. Ne pas les réutiliser.
- La table est haute (feutre y ≈ 2,3, assise y ≈ 1,0) : d'où `HEIGHT` 6,0 (croupier 5,2).

## VOIR AUSSI

[scene](../MAN.md) (`seatLayout.js`) · [dealer](../dealer/MAN.md) · [game](../../game/MAN.md) (qui appelle `react`)
