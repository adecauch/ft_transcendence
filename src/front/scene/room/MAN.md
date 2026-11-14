# 🪵 scene/room — la salle du saloon

> **Dossier** `src/front/scene/room/` · **Couche** front (Three.js) · **Créé par** `main.js` (étapes 4 et 6)

## NOM

`room` — le décor fixe : la table, la pièce (sol, murs, plafond, porte, meuble),
les chaises, les lampes et la poussière qui flotte.

## SYNOPSIS

```js
const table = new Table(scene, loader);   await table.build();   // table.feltY = hauteur du feutre
new Room(scene).build();
await new Chairs(scene, loader).build();
const lamps = new Lamps(scene, loader);   await lamps.build();
const dust = new DustParticles(scene);    dust.init();
// chaque image : lamps.update(dt); dust.update(dt);
```

## FICHIERS ET FONCTIONS

### 📄 `Table.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new Table(scene, loader)` | — | groupe `poker-table` |
| `build()` | → `Promise` | utilise le modèle `table` s'il est chargé (mis à l'échelle à 9 unités de large, recentré, posé au sol), sinon une **table de secours** procédurale (feutre ovale vert, boudin en noyer, 4 pieds) ; puis descend le tout de 0.4 |
| `feltY` | nombre | **hauteur du feutre**, lue par les cartes, les jetons et la carte de départ |

### 📄 `Room.js`

| Membre | À quoi il sert |
|---|---|
| `new Room(scene, loader?)` | — |
| `build()` | brouillard, **sol** en planches usées (textures + relief), **murs** en cuir, plafond, vignette ; puis la **porte** (`door.glb`) et le **meuble** (`Cabinet.glb`) si les modèles chargent |

Salle de 22 × 16 × 10. Sol, murs et plafond ont `userData.noOutline = true`
(pas de contour cartoon sur de grandes surfaces plates).

### 📄 `Chairs.js`

| Membre | À quoi il sert |
|---|---|
| `build()` | charge `old_western_saloon_chair.glb`, lui donne une couleur bois (le modèle est blanc et 100 % métallique : noir en rendu réaliste), le met à 2,7 de haut et le **clone sur les 5 chaises** de `CHAIRS` (`seatLayout.js`) |

### 📄 `Lamps.js`

| Membre | À quoi il sert |
|---|---|
| `build()` | 6 suspensions (`lamp.glb`, ou un cylindre de secours), chacune avec un **spot** doré qui éclaire vers le bas (ombres 1024²) et un cône de poussière de 80 grains |
| `update(delta)` | fait onduler la poussière sous chaque lampe |

Positions (`LAMP_POSITIONS`) à y = 5.5 ; celle en `(0, 5.5, -2)` est
au-dessus de la place du joueur (elle cache le croupier en ligne droite).

### 📄 `DustParticles.js`

| Membre | À quoi il sert |
|---|---|
| `init()` | 300 grains dorés dans un volume au-dessus de la table (un seul objet `Points`, tampon `Float32Array`) |
| `update(delta)` | montée lente, scintillement, et retour en bas quand ils sortent du volume |

## POURQUOI / PIÈGES

- `poker_table_empty.glb` est une version **nettoyée** du modèle d'origine, qui
  avait des jetons et des cartes fondus dans le mesh.
- Chaque classe a un **repli** si son modèle manque : la scène a toujours quelque chose à montrer.

## VOIR AUSSI

[scene](../MAN.md) (`seatLayout.js`) · [render](../../render/MAN.md) (`AssetLoader`, `ToonStyle`) ·
Crédits : table « Poker Table » de Pieter Ferreira (CC BY 4.0, modifiée)
