# 🃏 ui/newGame — le menu « Nouvelle partie »

> **Dossier** `src/front/ui/newGame/` · **Couche** front (HTML) · **Ouvert par** un clic sur la carte posée devant le croupier (via `Overlay`)

## NOM

`renderNewGameMenu` — choisir ses adversaires et les règles de la table, puis
« **Lancer la partie** ».

## SYNOPSIS

```js
// dans overlay/panels.js : la section « start » est dessinée par ce menu
export { renderNewGameMenu as start } from '../newGame/NewGameMenu.js';

// quand le joueur lance :
window.dispatchEvent(new CustomEvent('game:start', { detail: {
  opponents: [{ name: 'Le Baron', level: 'regular' }], startingStack: 1000, blinds: { small: 10, big: 20 } } }));
```

## DESCRIPTION

| Bloc | Choix |
|---|---|
| **Adversaires** | nombre d'IA (1 à 4) ; pour chacune, un niveau (Débutant / Confirmé / Expert) avec une phrase d'aide ; « Tous au niveau » pour les régler d'un coup |
| **Table** | tapis de départ (500 à 5000), blindes (5/10, 10/20, 25/50) |
| Boutons | **Annuler** (ferme la fenêtre) · **Lancer la partie** (émet `game:start` avec la config, puis ferme) |

Les valeurs par défaut viennent de `DEFAULT_CONFIG` : **tête-à-tête**, IA Confirmée, 1000 jetons, 10/20.

## FICHIERS ET FONCTIONS

### 📄 `NewGameMenu.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `renderNewGameMenu()` | → `HTMLElement` | construit le menu (exportée) |
| `segmented(options, selected, onChange, { small?, ariaLabel? })` | → élément | une rangée de boutons dont un seul est enfoncé (`aria-pressed`) |
| `block(label, right?)` | → élément | un encart en cuir avec son titre |
| `levelById(id)` | → niveau | — |

Les niveaux sont gardés **pour chaque siège** : baisser puis remonter le
nombre d'adversaires ne perd pas ce que le joueur avait choisi.

### 📄 `styles.js`

| Fonction | À quoi elle sert |
|---|---|
| `injectNewGameStyles()` | le CSS du menu (une seule fois) |

## POURQUOI / PIÈGES

- Pour l'instant **tous les niveaux jouent la même stratégie** (`USE_LEVELS = false`
  dans `PokerBot.js`) : le choix est enregistré avec la partie, mais ne change pas encore le jeu.
- Le menu ne connaît pas `TableController` : il **émet un événement**, `main.js` fait le lien.

## VOIR AUSSI

[config](../../config/MAN.md) (`newGameOptions.js`) · [overlay](../overlay/MAN.md) · [scene/start](../../scene/start/MAN.md) · [game](../../game/MAN.md)
