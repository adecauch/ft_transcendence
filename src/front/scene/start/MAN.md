# 🂠 scene/start — « Contre l'IA » et « Table en ligne »

> **Dossier** `src/front/scene/start/` · **Couche** front (Three.js) · **Piloté par** `TableInput` (clics), `main.js` (cachée pendant une partie)

## NOM

`start` — deux objets posés sur le feutre devant le croupier, un par façon de
jouer, chacun avec une **grande étiquette** au-dessus :

| Objet | Étiquette | Ouvre |
|---|---|---|
| le paquet (`StartCard`, deux cartes face cachée) | « Contre l'IA » | le menu de nouvelle partie (`START_SECTION`) |
| la carte d'invitation (`InviteCard`, carton crème, cachet de cire) | « Table en ligne · 2 » | le panneau en ligne (`ONLINE_SECTION`, `ui/online/`) |

Les survoler les soulève ; les cliquer les retourne (le paquet) ou relève la
carte vers le joueur (l'invitation), puis ouvre le panneau.

## SYNOPSIS

```js
const startCards = new StartCards(scene, loader);
startCards.buildAll(table.feltY);
// chaque image : startCards.update(dt)
startCards.setVisible(false);   // game:start
startCards.setInvites(2);       // « Table en ligne · 2 » + pastille rouge sur la carte
```

## FICHIERS ET FONCTIONS

### 📄 `StartCards.js` — le gestionnaire

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `buildAll(feltY?)` | — | crée les objets de `HAND_POSITIONS` (`Kind` : `StartCard` ou `InviteCard`), agrandis (`SCALE` 1.6 : lisibles depuis la vue d'ensemble), et leur étiquette |
| `setInvites(n)` | invitations en attente | pastille sur la carte d'invitation et « · n » dans son étiquette (rien si 0) |
| `update(delta)` | — | transmet à chaque carte |
| `getHandByMesh(mesh)` | mesh touché → `StartCard` | après un lancer de rayon (`userData.handIndex`) |
| `selectHand(i)` / `deselectAll()` | — | retourne une carte (et remet l'ancienne) / remet tout |
| `setHovered(hand)` | — | une seule carte survolée à la fois |
| `setVisible(v)`, `visible` | — | cachée = ni survolable ni cliquable |
| `hands`, `selectedIndex` | propriétés | — |

### 📄 `StartCard.js` — une paire de cartes

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new StartCard({ index, position, rotation, section, loader })` | — | deux cartes vernies en éventail + une **boîte invisible** plus grande pour cliquer facilement |
| `flip()` / `unflip()` | — | lance l'animation (états `resting → flipping → flipped → unflipping`) |
| `update(delta)` | — | avance l'animation (courbe douce) et monte de 0.12 au survol |
| `getMeshes()` | → meshes | les cartes + la boîte invisible (ce que le rayon teste) |
| `section` | `{ id, label, icon }` | ce que la fenêtre doit ouvrir |

### 📄 `InviteCard.js` — la carte d'invitation

Même interface que `StartCard` (`group`, `section`, `index`, `isHovered`,
`getMeshes()`, `flip()`, `unflip()`, `update()`), plus `setCount(n)` : une
pastille rouge avec le nombre d'invitations. Face dessinée sur un canvas
(« INVITATION » en Rye, « Table en ligne », cachet de cire ♠).

### 📄 `canvasText.js`

| Fonction | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `canvasTexture(w, h, draw)` | → texture, `.redraw()` | une texture dessinée, **redessinée quand les polices sont chargées** |
| `makeLabel(text, { toward })` | → sprite, `.setText(t)` | étiquette bois sombre / texte crème, **même taille à l'écran à toute distance** (`sizeAttenuation: false`, 6,5 % de la hauteur), qui part de l'objet vers `toward` (`'left'` / `'right'`) |

## POURQUOI / PIÈGES

- Vus de la place du joueur (`z < 0`, regard vers `+z`), **`+x` est à gauche** :
  le paquet (`x = 0.8`) est à gauche, l'invitation (`x = -0.8`) à droite.
- Étiquettes de **taille fixe à l'écran** (l'écran du joueur est abîmé : de loin,
  une étiquette « en 3D » devient minuscule), chacune partant **vers l'extérieur**
  (`sprite.center` ancré côté objet) : deux étiquettes côte à côte ne se chevauchent pas.
- **Pas d'emoji dans un canvas** : sans police emoji (Linux, headless), ils
  s'affichent en carrés. Texte simple seulement.
- Les polices (Rye, Lilita One) peuvent arriver après la construction de la
  scène : `canvasTexture` redessine quand elles sont prêtes.
- Le nombre d'invitations peut arriver avant que la scène existe : `main.js` le
  garde (`showInvites`) et l'applique après `buildAll`.

- Vues à plat depuis l'autre bout de la table, les cartes sont une **cible très
  fine** : la boîte invisible les rend faciles à cliquer.
- Cartes `noOutline` : trop fines pour un contour cartoon.

## VOIR AUSSI

[input](../../input/MAN.md) (`CardPicker`) · [ui/overlay](../../ui/overlay/MAN.md) · [ui/newGame](../../ui/newGame/MAN.md) · [ui/online](../../ui/online/MAN.md) · [config](../../config/MAN.md) (`START_SECTION`, `ONLINE_SECTION`)
