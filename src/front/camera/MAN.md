# 🎥 camera — où l'on regarde

> **Dossier** `src/front/camera/` · **Couche** front (Three.js `OrbitControls`) · **Piloté par** `TableInput`, `main.js` (show du tapis)

## NOM

`camera` — les limites de la souris selon le **mode** (`CameraController`) et
les **trajets animés** (`CameraMoves`).

## SYNOPSIS

```js
const cam = new CameraController(engine.camera, engine.renderer);
cam.setup();
cam.setMode('seat');                       // en partie
const moves = new CameraMoves(cam);
await moves.closeUp(tableCards.closeUpArea('board'));  // vue du dessus
await moves.backToSeat(0);
```

## DESCRIPTION

| Mode | Quand | La souris peut… |
|---|---|---|
| `overview` | menus | tourner (±80°), zoomer (4 à 16), déplacer |
| `seat` | en partie, à sa place | regarder **±30° de côté, ±10° en hauteur**, ni zoom ni déplacement |
| `fixed` | gros plans, show du croupier | rien, et aucune limite |

Pendant un trajet (`tweenTo`), **toutes les limites sont levées**, puis celles
du mode sont remises **autour du point d'arrivée**.

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `CameraController.js` | enveloppe `OrbitControls` : modes, limites, pause, trajets |
| `CameraMoves.js` | les trajets nommés : vers le siège, gros plan, vue du croupier, vue d'ensemble |

## FONCTIONS

### 📄 `CameraController.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `setup()` | — | crée `OrbitControls` (inertie, limites, vitesse) visant `(0, 2.6, 0.8)` |
| `update()` | — | chaque image (obligatoire : inertie) |
| `setMode(mode)` | `'overview' \| 'seat' \| 'fixed'` | appliqué tout de suite, ou à la fin du trajet en cours |
| `setPaused(paused)` | booléen | menu pause ouvert : plus de glisser |
| `tweenTo(pos, lookAt, duration = 800, onComplete?)` | vecteurs, ms | trajet avec lissage (smoothstep) ; annule le précédent |
| `resumeOrbit()` | — | arrête tout trajet, retour en `overview` |
| `mode`, `controls` | propriétés | mode courant, l'`OrbitControls` |

Internes : `_liftLimits()`, `_applyMode()` (limites du mode autour de la
position actuelle), `_centerAzimuthLimits(azimuth, range)` (gère le passage de −π à π).

### 📄 `CameraMoves.js`

| Méthode | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `zoomToSeat(i)` | index | vers la place du joueur `(0, 6.2, -6.4)` → `(0, 2.3, 0.4)`, mode `fixed` |
| `focus({ position, target }, duration = 500)` | → `Promise` | vers n'importe quel point de vue (le croupier : `dealer.showView`) |
| `closeUp({ centre, width, depth }, duration = 600)` | → `Promise` | **vue du dessus** au plus près d'une zone : hauteur calculée avec le champ de vision et le format de l'écran ; cartes un peu au-dessus du centre (loin de la barre d'actions), côté joueur en bas |
| `backToSeat(i, duration = 550)` | → `Promise` | retour direct au siège, puis mode `seat` |
| `zoomToDefault()` | — | retour à la vue d'ensemble `(0, 9.5, -10)`, puis `resumeOrbit` |

Constantes : `CLOSE_UP_MARGIN` 1.25, `CLOSE_UP_SHIFT` 0.12, `CLOSE_UP_MIN`
`{ width: 1.2, depth: 0.8 }` (deux cartes ne paraissent pas plus grosses que le board).

## POURQUOI / PIÈGES

- `OrbitControls` applique ses limites **à chaque `update()`, même désactivé** :
  sans `_liftLimits()`, un trajet vers le dessus de la table serait bloqué à 75°.
- Une **suspension** pend en `(0, 5.5, -2)` et cache le croupier en ligne droite
  depuis la place du joueur : d'où la vue en biais de `dealer.showView`.

## VOIR AUSSI

[input](../input/MAN.md) (qui déclenche les trajets) · [scene/cards](../scene/cards/MAN.md) (`closeUpArea`) ·
[scene/dealer](../scene/dealer/MAN.md) (`showView`)
