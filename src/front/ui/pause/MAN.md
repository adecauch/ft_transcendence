# ⏸️ ui/pause — le menu pause et les options

> **Dossier** `src/front/ui/pause/` · **Couche** front (HTML) · **Créé par** `main.js` (`new PauseMenu()`)

## NOM

`pause` — le bouton ☰ en haut à gauche pendant une partie, la fenêtre de
pause, et la page **Options**.

## SYNOPSIS

```
☰  (ou Échap)  →  ┌──────── Pause ────────┐
                  │ [ Reprendre ]          │  → game:resume
                  │ [ 📖 Tableau des ranges]│  → ranges:open
                  │ [ ⚙️ Options ]          │  → page Options (« Retour »)
                  │ [ Quitter la partie ]  │  → game:quit
                  └────────────────────────┘
```

## DESCRIPTION

Le bouton n'apparaît qu'**entre `game:start` et `game:quit`**. Ouvrir la pause
émet `game:pause` : cartes, jetons, croupier, adversaires et caméra se figent
(tous les délais du jeu passent par la boucle de rendu).

## FICHIERS ET FONCTIONS

### 📄 `PauseMenu.js`

| Membre | À quoi il sert |
|---|---|
| `new PauseMenu()` | construit le bouton et la fenêtre ; écoute `game:start` et **Échap** |
| `pause()` | fenêtre visible, focus sur « Reprendre », émet `game:pause` |
| `resume()` | émet `game:resume` |
| `quit()` | émet `game:quit`, cache le bouton |
| `toggle()` | Échap |

Internes : `_showView('pause' | 'options')`, `_setInGame(inGame)`, `_build()`.

### 📄 `OptionsPanel.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new OptionsPanel({ isInGame })` | — | **une ligne par entrée** de `config/preferences.js` : titre, un bouton par choix (le choisi est doré), une aide et le raccourci |
| `focus()` | — | focus sur le premier choix à l'ouverture |
| `el` | élément | la liste, posée dans la vue Options du menu pause |

Un clic change l'option **tout de suite** (`setPref`) ; les vues qui l'utilisent
se redessinent seules. Les **raccourcis clavier** (`key`, ex. **B** pour
jetons / BB) ne marchent qu'**en partie**, jamais pendant qu'on tape dans un
champ, jamais avec Ctrl / Alt / Cmd.

### 📄 `styles.js`

| Fonction | À quoi elle sert |
|---|---|
| `injectPauseStyles()` | CSS du bouton ☰ et de la fenêtre |
| `injectOptionsStyles()` | CSS des lignes d'options |

## POURQUOI / PIÈGES

- **Pas de bouton de plus à l'écran** pour les options (ne pas surcharger la
  table) : tout passe par la pause.
- Ajouter une option = une entrée dans `config/preferences.js`, rien à toucher ici.

## VOIR AUSSI

[config](../../config/MAN.md) (`preferences.js`) · [ui](../MAN.md) (`preferences.js`, `chipUnit.js`) · [front](../../MAN.md) (événements `game:*`)
