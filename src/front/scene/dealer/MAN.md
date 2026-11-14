# 🤠 scene/dealer — le croupier cowboy

> **Dossier** `src/front/scene/dealer/` · **Couche** front (Three.js, Web Audio) · **Utilisé par** `TableCards` (donne), `main.js` (show du tapis)

## NOM

`dealer` — le cowboy assis sur deux caisses de whisky derrière la table : il
respire, regarde autour de lui, **lance les cartes** d'un geste du bras, et
**tire en l'air** avec deux revolvers quand quelqu'un fait tapis.

## SYNOPSIS

```js
const dealer = new Dealer(scene, loader);
await dealer.build();
tableCards.dealer = dealer;                    // les cartes partent de sa main
const from = await dealer.release(spot);       // position de la main quand la carte part
await dealer.celebrate();                      // six coups de feu, bras levés
// chaque image : dealer.update(dt) ; dealer.paused = true pendant la pause
```

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `Dealer.js` | le personnage : pose assise, vie au repos, bras qui donnent, show des revolvers |
| `revolver.js` | charger les revolvers, les mettre dans le poing, l'éclair au canon |
| `crates.js` | les deux caisses (boîtes dessinées en code, pas de fichier) |
| `Gunshot.js` | le bruit du coup de feu, **fabriqué** avec Web Audio (aucun fichier son) |

## FONCTIONS

### 📄 `Dealer.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new Dealer(scene, loader)` | — | — |
| `build()` | → `Promise` | charge `Cowboy_Male.gltf` (5,2 de haut, en `(0, 2.6)`, tourné vers le joueur), fige la **dernière image de `SitDown`**, le hisse pour que ses hanches soient à y = 2,35, pose les caisses dessous, monte les revolvers, ajoute un éclairage chaud |
| `release(point)` | point sur le feutre → `Promise<Vector3>` | le bras **du côté du point** se tend ; la promesse se résout **au moment où la carte quitte la main**, avec la position de la main |
| `celebrate()` | → `Promise` | sort les revolvers, lève les bras, **6 coups** alternés (recul, éclair, lumière, bruit) ; se résout quand les bras sont redescendus |
| `update(delta)` | — | chaque image : restaure la pose, respiration, bras qui donnent, show |
| `paused` | booléen | fige tout |
| `showView` | `{ position, target }` | point de vue caméra pour le show (en biais, entre les lampes) |

Internes : `_breathe` (buste et tête), `_updateReaches` (aller-retour du bras,
la carte part à 45 % du geste), `_skyward` (direction « vers le plafond »,
un peu vers l'extérieur, recul), `_aimArmAt(arm, dir, w)` (oriente bras et
avant-bras vers une direction, mélangé avec la pose par `w`), `_fire(arm)`.

Réglages : `SHOTS` (instant et main de chaque tir), `RAISE_TIME` 0,35 s,
`HOLD_TIME` 2,2 s, `LOWER_TIME` 0,5 s, `REACH_TIME` 0,34 s, `RELEASE_AT` 0,45.

### 📄 `revolver.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `loadRevolver()` | → `Promise<Object3D \| null>` | lit `Revolver_2.obj/.mtl` et le repeint (crosse en noyer, acier poli) ; `null` si les fichiers manquent |
| `mountGun(gun, fist, side)` | → groupe | met une copie dans le poing, canon le long du bras, **annule l'échelle du personnage** ; caché jusqu'au show |
| `makeMuzzleFlash()` | → groupe | cône ouvert + étoile en mélange additif, au bout du canon |

### 📄 `crates.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `makeCrates(x, z, seatY, floorY)` | → groupe | deux caisses empilées (celle du haut un peu tournée), bandes sombres et montants aux coins |

### 📄 `Gunshot.js`

| Membre | À quoi il sert |
|---|---|
| `unlock()` | crée / réveille le contexte audio (doit venir d'une action du joueur) |
| `play()` | un tir : bruit filtré (le claquement) + sinus descendant (le coup sourd) + court écho (la salle) |

## POURQUOI / PIÈGES

- **Pose figée qui ne se réapplique pas** : une animation « clampée » n'est pas
  rejouée à chaque image. On **restaure la pose mémorisée** avant d'ajouter les
  petits mouvements, sinon ils s'accumulent.
- GLTFLoader **retire les points** des noms : l'os `UpperArm.R` s'appelle `UpperArmR`.
- Une suspension cache le croupier en ligne droite depuis la place du joueur :
  d'où `showView` en biais.

## VOIR AUSSI

[scene/cards](../cards/MAN.md) (`release`) · [camera](../../camera/MAN.md) (`focus`) · [opponents](../opponents/MAN.md) (même modèle) ·
Crédits : Cowboy et revolver de Quaternius (CC0)
