# 🖌️ render — le moteur 3D et le style cartoon

> **Dossier** `src/front/render/` · **Couche** front (Three.js) · **Créé par** `main.js`, étapes 1–3 et 10

## NOM

`render` — le moteur de rendu (scène, caméra, boucle), les lumières, le
chargement des modèles et le **rendu cartoon** (matériaux toon + contours noirs).

## SYNOPSIS

```js
const engine = new Engine('#canvas');
new Lighting(engine.scene).setup();
const loader = new AssetLoader();
await loader.preload();
const toon = new ToonStyle(engine.camera, engine.renderer);
engine.setUpdateCallback((dt) => { /* …update de chaque objet… */ toon.update(engine.scene); });
engine.start();
```

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `Engine.js` | rendu WebGL, caméra, scène (fond et brouillard), redimensionnement, boucle d'animation |
| `Lighting.js` | lumière ambiante chaude + hémisphère (les lampes ont leurs propres lumières) |
| `AssetLoader.js` | charge modèles `.glb` et textures **une seule fois** (cache par clé) |
| `ToonStyle.js` | transforme toute la scène en cartoon, image après image |

## FONCTIONS

### 📄 `Engine.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new Engine(canvasSelector)` | — | scène (fond `#0d0d0d`, brouillard exponentiel), caméra 45° en `(0, 9.5, -10)` regardant `(0, 2.6, 0.8)`, ombres douces, tone mapping ACES |
| `setUpdateCallback(fn)` | `(delta) => void` | appelée **avant** chaque image avec le temps écoulé (secondes) |
| `start()` / `stop()` | — | lance / arrête `setAnimationLoop` |
| `scene`, `camera`, `renderer`, `canvas`, `clock` | propriétés | partagées avec tout le reste |

Le rapport de pixels est plafonné à 2 (écrans très denses = trop lent sinon).

### 📄 `Lighting.js`

| Membre | À quoi il sert |
|---|---|
| `new Lighting(scene).setup()` | ajoute `AmbientLight` (0xffe0c0, 1.2) et `HemisphereLight` (ciel doré / sol noir) |
| `lights` | les lumières créées |

### 📄 `AssetLoader.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `preload()` | → `Promise<void>` | charge tout ce qui est listé dans `TEXTURES` et `MODELS` (un échec n'arrête pas les autres) |
| `getModel(key)` / `getTexture(key)` | → objet en cache ou `undefined` | lecture sans chargement |
| `loadModel(key, path)` | → `Promise` | modèle chargé **à la demande**, mis en cache |

Aujourd'hui `MODELS = { table: '/models/tables/poker_table_empty.glb' }` ; les
autres classes (chaises, croupier…) utilisent `loadModel` à la demande. Le
décodeur DRACO (modèles compressés) vient de `gstatic.com`.

### 📄 `ToonStyle.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new ToonStyle(camera, renderer)` | — | désactivé si l'URL contient `?realiste` |
| `update(scene)` | — | **à chaque image** : chaque mesh pas encore traité reçoit ses matériaux toon et son contour |
| `OUTLINE_COLOR`, `OUTLINE_PX` | `0x1a0d06`, 2.2 | couleur et épaisseur du contour en **pixels** |

**Fonctions internes** :

| Fonction | Rôle |
|---|---|
| `_toToon(material)` | Standard / Physical / Phong / Lambert → `MeshToonMaterial` même couleur, mêmes textures, **rampe 3 tons** ; cache par matériau (un matériau partagé le reste) |
| `_wantsOutline(mesh)` | seulement les surfaces opaques, visibles, éclairées ; jamais `userData.noOutline` |
| `_addOutline(mesh)` | la **coque inversée** : copie noire du mesh, faces arrière, poussée le long des normales ; `SkinnedMesh` pour le cowboy ; jamais touchée par le raycast |
| `_makeOutlineMaterial()` | shader : poussée = `pixels × taille d'un pixel à cette profondeur ÷ échelle de l'objet` |
| `makeRamp()` | texture 3 texels (95 / 185 / 255) en filtrage « nearest » : paliers nets |
| `addSmoothNormals(geometry)` | moyenne des normales des sommets qui partagent une position → attribut `outlineNormal` (sinon la coque s'ouvre sur les arêtes vives) |

## POURQUOI / PIÈGES

- **Pourquoi à chaque image** : les cartes et jetons créés en cours de partie
  deviennent cartoon tout seuls, sans que leur code le sache.
- Le matériau toon **remplace** `mesh.material` : un code qui change ensuite
  `mesh.material.map` (retourner une carte) modifie bien le matériau toon.
- Exclure un objet du contour : `mesh.userData.noOutline = true` (sol, murs, plafond, cartes).
- `ToonStyle.update` est appelé **en dernier** dans la boucle.

## VOIR AUSSI

[front](../MAN.md) (ordre de démarrage) · [camera](../camera/MAN.md) · [scene](../scene/MAN.md)
