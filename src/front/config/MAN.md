# ⚙️ config — les réglages qu'on modifie sans toucher au code

> **Dossier** `src/front/config/` · **Couche** front (données seulement) · **Lu par** `NewGameMenu`, `OptionsPanel`, le tableau des ranges

## NOM

`config` — des **listes** : niveaux et noms des IA, tapis et blindes, options
d'affichage, ranges d'exemple. **Ajouter une entrée suffit** : l'interface se
construit à partir d'elles.

## FICHIERS ET CONTENU

### 📄 `newGameOptions.js`

| Constante | Contenu | Utilisé par |
|---|---|---|
| `LEVELS` | `beginner` Débutant · `regular` Confirmé · `expert` Expert (+ une phrase d'aide) | `NewGameMenu` |
| `MAX_OPPONENTS` | 4 | nombre de chaises libres |
| `OPPONENT_NAMES` | Le Baron, Lucky Lou, Madame Rouge, Doc Holliday | noms donnés aux sièges dans l'ordre |
| `STACK_OPTIONS` | 500, 1000, 2000, 5000 | tapis de départ |
| `BLIND_OPTIONS` | 5/10, 10/20, 25/50 | blindes |
| `DEFAULT_CONFIG` | 1 IA Confirmée, 1000 jetons, 10/20 | **tête-à-tête par défaut** (le solveur a été entraîné pour un adversaire) |
| `START_SECTION` | `{ id: 'start', label: 'Nouvelle partie', icon: '♠' }` | le paquet posé sur la table (« Contre l'IA ») |
| `ONLINE_SECTION` | `{ id: 'online', label: 'Table en ligne', icon: '✉️' }` | la carte d'invitation à côté (`ui/online/`) |

Types documentés : `GameConfig = { opponents: [{ name, level }], startingStack, blinds: { small, big } }`.

### 📄 `preferences.js`

| Constante | Contenu |
|---|---|
| `PREFERENCES` | `[{ id, label, hint?, key?, choices: [{ value, label }] }]` — le premier choix = le défaut |

Aujourd'hui une option : **`chipUnit`** « Montants » (touche **B**) : `chips`
(en jetons) ou `bb` (en grosses blindes).

**Ajouter une option** : une entrée ici. `OptionsPanel` dessine sa ligne de
boutons et son raccourci, `ui/preferences.js` retient le choix, et le code qui
en a besoin lit `getPref(id)` / `onPrefChange(fn)`.

### 📄 `rangePresets.js`

| Constante | Contenu |
|---|---|
| `ACTIONS` | apparence de chaque action : `raise`, `threebet`, `call`, `check`, `callcheck`, `limp`, `fold` → `{ label, short, color }` (couleurs lisibles avec du texte foncé) |
| `RANGE_PRESETS` | les ranges de l'onglet 🔍 Explorer, groupées |

Une entrée de `RANGE_PRESETS` :

| Champ | Sens |
|---|---|
| `id`, `group`, `name` | identifiant, titre du groupe, nom |
| `situation` | qui, où, face à quoi (une ligne) |
| `lesson` | ce qu'il faut remarquer (quelques phrases) |
| `actions` | ids d'`ACTIONS` dans l'ordre d'affichage : **le premier gagne les chevauchements, le dernier = le reste** |
| `notation` | `{ action: 'QQ+, AK' }` — une range humaine |
| `solver` + `solverActions` | ou bien : une **vraie range de l'IA** (`sbOpen`, `bbVsLimp`, `bbVsRaise`) et la traduction fold / call / raise → actions affichées |

Groupes actuels : Pour commencer · Ouvrir le pot (6 joueurs) · Répondre à une
relance · Tête-à-tête (comme dans le jeu, ranges de `shared/theory/huRanges.js`) ·
La vraie range de notre IA.

## EXEMPLE

```js
// une range d'exemple de plus
{ id: 'sb-steal', group: 'Ouvrir le pot (6 joueurs)', name: 'Petite blinde, tout le monde s’est couché',
  situation: '…', lesson: '…', actions: ['raise', 'fold'], notation: { raise: '22+, A2s+, K5s+, …' } },
```

## VOIR AUSSI

[ui/newGame](../ui/newGame/MAN.md) · [ui/pause](../ui/pause/MAN.md) (`OptionsPanel`) · [ui](../ui/MAN.md) (`preferences.js`, `chipUnit.js`) ·
[ui/ranges](../ui/ranges/MAN.md) · [shared/theory](../../shared/theory/MAN.md)
