# 🪧 ui — les menus (et les petits fichiers de la racine)

> **Dossier** `src/front/ui/` · **Couche** front (HTML + CSS, pas de framework) · **Style** « saloon bois et cuir » (`theme/saloon.css`)

## NOM

`ui` — tout ce qui est en HTML par-dessus la 3D. Cette page décrit les
fichiers à la **racine** du dossier et le thème ; chaque écran qui a son propre
CSS est un **sous-dossier** avec sa page.

## LES SOUS-DOSSIERS

| Dossier | Contenu | Page |
|---|---|---|
| `actionBar/` | la barre du bas en partie et le panneau de relance | [actionBar](actionBar/MAN.md) |
| `auth/` | connexion / inscription / jouer sans compte | [auth](auth/MAN.md) |
| `newGame/` | le menu « Nouvelle partie » | [newGame](newGame/MAN.md) |
| `pause/` | le menu pause et les options | [pause](pause/MAN.md) |
| `overlay/` | la fenêtre posée sur la table (fond, panneau, fondus) | [overlay](overlay/MAN.md) |
| `stats/` | « Mon carnet » (onglets) | [stats](stats/MAN.md) → [dashboard](stats/dashboard/MAN.md) |
| `ranges/` | le tableau des ranges | [ranges](ranges/MAN.md) |
| `theme/` | `saloon.css`, le style commun | ci-dessous |

## CONVENTION

Un écran avec son CSS = un dossier : le composant + un `styles.js` qui
**injecte son CSS une seule fois** (`injectXStyles()`). Les composants gardent
leur CSS de **mise en page** et piochent les classes du thème pour l'apparence.

## FICHIERS ET FONCTIONS (racine)

### 📄 `WelcomeScreen.js` — le premier écran

| Membre | À quoi il sert |
|---|---|
| `new WelcomeScreen({ onEnter })` | enseigne « Poker Transcendence », les commandes (clic gauche, molette, clic sur la carte) et « Entrer dans la salle » ; se retire du DOM puis appelle `onEnter` |

### 📄 `UserBadge.js` — en haut à droite

```
🤠 alice   [📖 Ranges] [📊 Mes stats] [Déconnexion]     connecté
🤠 Invité  [📖 Ranges] [Se connecter]                   invité
```

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new UserBadge({ onSignIn, onStats, onFriends, onUser? })` | — | 📖 émet `ranges:open` ; 👥 appelle `onFriends` (joueur connecté) ; 📊 appelle `onStats` ; le dernier bouton déconnecte ou rouvre la connexion |
| `setOnline(n)` | nombre d'amis en ligne | pastille verte « ● n » sur « 👥 Amis » (rien si 0) |
| `set(user)` | joueur ou `null` (invité) | affiche le badge, prévient `onUser(user)` (→ `GameRecorder.user`) |
| `hide()` | — | cache le badge |

**Caché pendant une partie** (`game:start` / `game:quit`) : le menu pause est en haut à gauche et la table a besoin de place.

### 📄 `AchievementToast.js` — « Succès débloqué ! »

| Membre | À quoi il sert |
|---|---|
| `show(ids)` | une plaque dorée par succès (icône, nom, description tirés d'`ACHIEVEMENTS`), 5 s, puis elle glisse ; plusieurs s'empilent |

### 📄 `AiDebugPanel.js` — `npm run debug_ia`

| Membre | À quoi il sert |
|---|---|
| `new AiDebugPanel(tableController, tableCards)` | panneau noir à bord jaune, texte de 26 px, cartes de 48 px, **quatre couleurs** (♠ blanc, ♥ rouge, ♦ bleu, ♣ vert) |
| `record(seat, action, debug, street)` | appelé après chaque décision d'IA : action, clé, bucket, historique, probabilités par option, solveur ou repli |

Seul composant qui garde **son propre style** (la lisibilité avant tout).

### 📄 `preferences.js` — valeurs des options

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `getPref(id)` | → valeur | valeur courante (le premier choix par défaut) |
| `setPref(id, value)` | — | change, enregistre dans le `localStorage` (`poker.preferences`), prévient les écouteurs ; une valeur hors des choix est ignorée |
| `cyclePref(id)` | — | choix suivant (raccourci clavier) |
| `onPrefChange(fn)` | → fonction d'arrêt | `fn(id, value)` après chaque changement |

Sans `localStorage` (navigation privée) : les défauts s'appliquent, les
changements durent jusqu'à la fermeture de la page.

### 📄 `chipUnit.js` — jetons ou grosses blindes

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `money(n)` | jetons → `"1 240"` ou `"62 BB"` | **tous** les montants affichés passent par elle |
| `inBB()` | → booléen | option BB choisie **et** une grosse blinde connue |
| `setBigBlind(bb)` / `getBigBlind()` | — | réglée par `TableController.start` |
| `onUnitChange(fn)` | → fonction d'arrêt | redessiner quand l'unité change |

**Affichage seulement** : le moteur, les montants envoyés à `PokerGame` et
les mains enregistrées restent en jetons.

### 🎨 `theme/saloon.css` — le style commun

| Classe | Apparence |
|---|---|
| `.wood-panel` | planches de bois, contour sombre, rivets de laiton aux coins |
| `.wood-sign` | la plaque dorée penchée qui porte le titre |
| `.leather` | encart de cuir sombre rembourré |
| `.wood-btn` (+ `--red`, `--green`, `--gold`, `--grey`) | bouton en relief qui s'enfonce ; `aria-pressed="true"` = doré |
| `.saloon-label` | étiquette de section dorée en majuscules |
| `.saloon-ol` | contour épais autour d'un texte |
| `.saloon-key` | touche de clavier dessinée |
| `.saloon-backdrop`, `.saloon-scroll` | fond assombri, zone qui défile |

Variables `:root` (`--outline`, `--wood-hi`, `--cream`, `--gold`, `--red-hi`…).
Polices Rye (titres), Lilita One (interface), Nunito 800/900 (texte), en local
via `@fontsource`. Contours épais, ombres dures, transitions élastiques.

## POURQUOI / PIÈGES

- L'écran de l'utilisateur est abîmé : **texte grand, contraste fort** partout.
- Pas de requête vouée au `401` pour un invité (le badge n'ouvre pas les stats).

## VOIR AUSSI

[config](../config/MAN.md) (`preferences.js`, les listes) · [front](../MAN.md) (câblage dans `main.js`) · [game](../game/MAN.md)
