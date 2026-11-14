# 🂡 scene/cards — les cartes 3D sur le tapis

> **Dossier** `src/front/scene/cards/` · **Couche** front (Three.js) · **Piloté par** `TableController` (donne), `TableInput` (gros plans)

## NOM

`cards` — le paquet, les cartes des joueurs, le board, la défausse.
**Elle ne mélange rien** : le moteur (`PokerGame`) dit quelles cartes sont
données, cette partie les anime.

## SYNOPSIS

```js
const tableCards = new TableCards(scene, renderer, table.feltY);
tableCards.dealer = dealer;                                     // les cartes partent de sa main
await tableCards.newHand(1, [['AS', 'KD'], ['7H', '7C']]);      // donne, le joueur retourne les siennes
await tableCards.dealStreet(['2S', '9D', 'TC']);                // flop
await tableCards.reveal(1);                                     // abattage
// chaque image : tableCards.update(dt) ; tableCards.paused = true pendant la pause
```

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `Card.js` | **une** carte 3D : face, dos, tranche ; déplacement et retournement animés |
| `CardTextures.js` | les faces SVG converties en texture **à la demande** (cache) |
| `TableCards.js` | toutes les cartes de la table et leur chorégraphie |

## FONCTIONS

### 📄 `Card.js`

Hiérarchie (chaque rotation reste indépendante) :
`group` (position + orientation sur la table) → `tilt` (couchée sur le feutre)
→ `flip` (0 = face visible, π = face cachée) → meshes face / dos / tranche.

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new Card(code, textures)` | `'AS'` ou `null` (encore inconnue) | coins arrondis, géométrie partagée par toutes les cartes |
| `setCode(code)` | — | donne sa face à une carte du paquet quand elle est distribuée |
| `set({ position?, yaw?, faceUp? })` | — | place **tout de suite** |
| `moveTo({ position?, yaw?, faceUp?, duration = 0.5, delay = 0, lift = 0.15 })` | → `Promise` | déplacement animé en arc (monte de `lift` au milieu) ; ce qui n'est pas donné reste tel quel |
| `flip({ duration, delay })` | → `Promise` | retourne la carte là où elle est |
| `update(delta)` | — | avance l'animation (courbe douce) |
| `CARD_SIZE` | `{ width: 0.3, height: 0.42, depth: 0.0015, radius: 0.015 }` | 63 × 88 mm à l'échelle |
| `meshes`, `code`, `faceUp` | propriétés | — |

### 📄 `CardTextures.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new CardTextures(renderer?)` | — | filtrage anisotrope maximal du GPU |
| `face(code)` | `'AS'` → `CanvasTexture` | rendue **tout de suite** (blanche), le SVG `public/textures/cards/deck/AS.svg` est dessiné dedans une fois chargé (1024 px de haut) |
| `back()` | → texture | `card.jpg`, une seule fois |

Seules les cartes réellement sur la table prennent de la mémoire GPU.

### 📄 `TableCards.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `newHand(opponentCount, hole)` | → `Promise` | vide la table, empile 52 cartes face cachée au paquet, **deux tours** de donne (le joueur d'abord), puis le joueur regarde ses cartes ; `hole[seat] = null` = siège éliminé, `[null, null]` = cartes cachées (adversaire d'une partie serveur, valeur donnée par `reveal`) |
| `dealStreet(codes)` | → `Promise` | brûle une carte, pose 1 ou 3 cartes du board face visible |
| `foldSeat(seat)` | → `Promise` | les cartes glissent face cachée vers la défausse |
| `reveal(seat, codes?)` | → `Promise` | retourne les cartes d'un siège (abattage) ; `codes` donne leur valeur quand elles ont été distribuées cachées (partie serveur : le navigateur ne les connaît qu'à l'abattage) |
| `holeCodes(seat)`, `boardCodes()` | → codes | ce qui a été distribué |
| `handMeshes()` / `boardMeshes()` | → meshes | **ses** cartes (tant qu'il ne s'est pas couché) / les cartes du board retournées : ce que le survol teste |
| `peekHand(mode)` | `'look' \| 'flat' \| null` | le joueur regarde sa main : `'look'` (survol : les cartes se lèvent face à lui, ×2,3, écartées), `'flat'` (gros plan : face visible à plat), `null` (reposées face cachée) ; prévient `onLook('hand', on)` |
| `peekBoard(on)` | `boolean` | même geste pour le **board** (survol) : les cartes se lèvent vers le joueur, ×1,7 (cinq cartes doivent tenir à l'écran) et s'écartent du milieu en grandissant pour ne pas se chevaucher ; une carte donnée pendant ce temps rejoint les autres ; prévient `onLook('board', on)` (`main.js` y efface l'étiquette du pot) |
| `closeUpMeshes()` | → meshes | ce qu'on peut cliquer pour un gros plan : **ses** cartes visibles et le board |
| `closeUpTarget(mesh)` | → `{ kind, centre, width, depth }` ou `null` | la zone (main ou board) de la carte cliquée |
| `closeUpArea(kind)` | `'hand' \| 'board'` → zone ou `null` | la zone couverte, pour recadrer |
| `stop()`, `clear()` | — | tout retirer |
| `update(delta)` | — | cartes et minuteries ; `paused` fige tout |
| `dealer` | `Dealer` ou `null` | si présent, chaque carte **part de sa main** |
| `onChange(kind)` | rappel | la main ou le board a changé (le gros plan se recadre ou se ferme) |
| `revealAll` | booléen | `debug_ia` : les cartes des IA sont retournées aussi |

Internes : `_draw(code)` (carte du dessus du paquet, avec sa face),
`_toss(card, move)` (voir ci-dessous), `_wait(s)` (délai sensible à la pause),
`_onFelt({x, z}, layer)` (position sur le feutre, empilée sans scintillement),
`_holePosition(spot, index)` (deux cartes côte à côte face au centre, en éventail).

## POURQUOI / PIÈGES

- **`_toss` renvoie `{ landed }`** : une fonction `async` qui renvoie une promesse
  l'attend aussi. En l'emballant, on attend seulement que la carte **parte**
  (la suivante peut suivre) et pas qu'elle atterrisse.
- Cartes `noOutline` : une coque de contour traverserait le feutre.
- Les deux cartes d'une main sont écartées : on teste les meshes, pas le centre.

## VOIR AUSSI

[dealer](../dealer/MAN.md) (`release`) · [scene](../MAN.md) (`seatLayout.js`) · [input](../../input/MAN.md) · [camera](../../camera/MAN.md) (`closeUp`) ·
Crédits : faces RevK SVG playing cards (CC0)
