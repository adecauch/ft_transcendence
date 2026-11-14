# 🪟 ui/overlay — la fenêtre posée sur la table

> **Dossier** `src/front/ui/overlay/` · **Couche** front (HTML) · **Piloté par** `TableInput` (`show` après un clic sur la carte de départ)

## NOM

`overlay` — un fond assombri, un **panneau en bois** avec son titre sur une
enseigne dorée, un bouton ✕, et les fondus d'entrée / sortie.

## SYNOPSIS

```js
const overlay = new Overlay();                 // s'installe dans <div id="overlay">
await overlay.show({ id: 'start', label: 'Nouvelle partie' });
await overlay.hide();                          // émet « overlay:close »
```

## FICHIERS ET FONCTIONS

### 📄 `Overlay.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new Overlay()` | — | fond + panneau + bouton ✕ ; un clic **sur le fond** (hors du panneau) ferme |
| `show(section)` | `{ id, label }` → `Promise` | remplit le panneau et fait apparaître le fond (350 ms) |
| `hide()` | → `Promise` | fondu (300 ms) puis émet **`overlay:close`** (la caméra revient, la carte se remet à plat) |

### 📄 `Panel.js`

| Membre | À quoi il sert |
|---|---|
| `new Panel()` | `.overlay-panel.wood-panel` → `.panel-header` (enseigne) + `.panel-body` (qui défile) |
| `render(section)` | titre (`LABELS[id]` ou `section.label`), relance l'animation d'arrivée, et dessine le contenu avec **la fonction de `panels.js` qui porte le même `id`** (sinon « Section pas encore disponible ») |
| `element` | l'élément du panneau |

### 📄 `panels.js`

La table des contenus : `start` → `renderNewGameMenu` (le paquet « Contre l'IA »),
`online` → `renderOnlineMenu` (la carte d'invitation, `ui/online/`). **Ajouter une
fenêtre** = une fonction `(section) => HTMLElement` exportée sous l'`id` de sa section.

### 📄 `fade.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `fadeIn(el, duration = 300)` | → `Promise` | opacité 0 → 1 |
| `fadeOut(el, duration = 300)` | → `Promise` | opacité 1 → 0, puis `display: none` |

## POURQUOI / PIÈGES

- Le panneau ne connaît pas ses contenus : il les **cherche par `id`**. Un menu
  s'ajoute sans toucher à `Overlay` ni `Panel`.
- **Échap** ferme la fenêtre (géré par `TableInput`).

## VOIR AUSSI

[newGame](../newGame/MAN.md) · [input](../../input/MAN.md) · [ui](../MAN.md) (`saloon.css`)
