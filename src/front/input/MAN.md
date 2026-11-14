# 🖱️ input — les clics et le survol sur la table 3D

> **Dossier** `src/front/input/` · **Couche** front · **Créé par** `main.js` (étape 9)

## NOM

`input` — le **carrefour** des événements souris et clavier du canvas : carte
de départ (menus), gros plans et retour au siège (en partie), Échap.

## SYNOPSIS

```js
const tableInput = new TableInput({ engine, startCards, tableCards, cameraController, overlay });
tableInput.init();       // enregistre tous les écouteurs
tableInput.destroy();    // les retire
```

## DESCRIPTION

**Hors partie** (menus) : survoler la carte « Nouvelle partie » la met en
valeur ; un clic la retourne, la caméra va au siège et la fenêtre s'ouvre.
Fermer la fenêtre → retour à la vue d'ensemble.

**En partie** :

| Geste | Effet |
|---|---|
| glisser | regarder autour (mode `seat` de la caméra) |
| survol de **sa main** ou du **board** | les cartes se lèvent face au joueur (`peekHand('look')` / `peekBoard(true)`) ; elles se reposent quand la souris s'en va |
| clic sur **sa main** ou le **board** | gros plan vu du dessus |
| clic n'importe où, ou clic droit, pendant un gros plan | retour au siège |
| nouvelle carte au board pendant le gros plan | le cadrage s'ajuste |
| ses cartes disparaissent (couché, nouvelle main) | retour au siège |

Un clic n'est compté que si la souris a bougé de **moins de 6 px** depuis
l'appui (sinon c'était un glisser).

## FICHIERS ET FONCTIONS

### 📄 `TableInput.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new TableInput({ engine, startCards, tableCards, cameraController, overlay })` | — | garde ses dépendances, prépare les rayons |
| `init()` | — | écoute `mousemove`, `click`, `pointerdown`, `contextmenu`, `keydown`, et `overlay:close`, `game:start`, `game:quit`, `game:pause`, `game:resume` ; branche `tableCards.onChange` |
| `destroy()` | — | retire les écouteurs du canvas et du clavier |

Internes :

| Méthode | Rôle |
|---|---|
| `_handleMouseMove(e)` | curseur `pointer` / `grab` / `grabbing` ; hors partie, survol de la carte |
| `_handleClick(e)` / `_handleGameClick(e)` | carte de départ → siège + fenêtre ; en partie → gros plan ou retour |
| `_lookTarget(e)` | `'hand'`, `'board'` ou `null` : ce que la souris survole ; celui qu'on regarde déjà garde la priorité, et sa zone au repos compte aussi |
| `_look(kind)` | lève la main ou le board, repose l'autre (`null` = tout reposé) |
| `_tableCardAt(e)` | la carte du joueur ou du board sous la souris (`tableCards.closeUpMeshes()`) |
| `_closedUp()` | vrai si on est en gros plan — sauf si autre chose (le show du croupier) a bougé la caméra depuis |
| `_backToSeat()` | `CameraMoves.backToSeat(0)` |
| `_onOverlayClose()`, `_handleKeyDown(e)` | fin de menu ; **Échap** ferme la fenêtre |

### 📄 `CardPicker.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new CardPicker(camera, canvas, startCards)` | — | un `Raycaster` réutilisé |
| `getHandAtEvent(event)` | souris → `StartCard` ou `null` | la carte de départ sous la souris (lancer de rayon sur ses meshes) |

## POURQUOI / PIÈGES

- Les deux cartes d'une main sont **écartées** : un rayon au centre de la main
  ne touche rien. On teste les meshes des cartes, pas un point.
- Les cartes levées **quittent leur place** : sans la zone au repos dans
  `_lookTarget`, elles retomberaient sous la souris, se relèveraient, etc.
  (clignotement). Les cartes levées elles-mêmes comptent aussi : on peut
  monter la souris dessus pour les lire.
- Tous les écouteurs DOM sont ici : un seul endroit à nettoyer.

## VOIR AUSSI

[camera](../camera/MAN.md) · [scene/cards](../scene/cards/MAN.md) · [scene/start](../scene/start/MAN.md) · [ui/overlay](../ui/overlay/MAN.md)
