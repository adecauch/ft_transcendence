# 🎨 front — l'affichage (démarrage : `main.js`)

> **Dossier** `src/front/` · **Stack** JavaScript (modules ES) + Three.js 0.169 + Vite · **Lancer** `npm run dev` (jeu :3000 + serveur :3100)

## NOM

`front` — tout ce qu'on **voit** : la salle 3D, les animations, les menus.
Il **importe** `src/shared/` (règles, IA) et parle au serveur par `net/`.
Cette page décrit le démarrage (`main.js`) et sert de sommaire.

## SYNOPSIS

```bash
npm run dev          # jeu + serveur
npm run dev:front    # le jeu seul (Vite) ; /api/* redirigé vers :3100
npm run debug_ia     # cartes des IA visibles + gros panneau de debug
npm run build        # version de production dans dist/
```

## DESCRIPTION

`main.js` construit tout, **dans l'ordre** :

| Étape | Ce qui est créé |
|---|---|
| 0 | accueil → session (`authApi.me()`) → `AuthScreen` ou `UserBadge` (sauf en `debug_ia`) ; `AchievementToast`, `GameRecorder` |
| 1–3 | `Engine` (rendu), `Lighting`, `AssetLoader.preload()` (modèles, textures) |
| 4 | la salle : `Table`, `Room`, `Chairs`, `Lamps`, `Dealer` |
| 5 | la carte « Nouvelle partie » (`StartCards`) |
| 5b | le jeu : `TableCards`, `TableChips`, `ActionBar`, `TableController`, `Opponents`, `RangeScreen` ; le bot MCCFR est chargé uniquement par `debug_ia` |
| 6–9 | `DustParticles`, `CameraController`, `Overlay`, `PauseMenu`, `TableInput` |
| 10 | boucle de rendu : chaque objet reçoit `update(delta)`, **`ToonStyle` en dernier** |

**Événements de fenêtre** (le moyen de communication entre menus et jeu) :

| Événement | Émis par | Effet |
|---|---|---|
| `game:start` (`detail` = config) | `NewGameMenu` | cache la carte de départ, `tableController.start(config)` |
| `game:pause` / `game:resume` | `PauseMenu` | fige / relance cartes, jetons, croupier, adversaires |
| `game:quit` | `PauseMenu` | `tableController.stop()`, la carte de départ revient |
| `ranges:open` | badge, menu pause | ouvre le tableau des ranges |

Pendant un tapis, `tableController.onAllIn` fait lever la caméra vers le
croupier qui tire en l'air (`CameraMoves.focus(dealer.showView)` →
`dealer.celebrate()` → retour au siège).

## LES SECTIONS DU FRONT

| Section | Page |
|---|---|
| Le pont règles ↔ écran | [game](game/MAN.md) |
| Rendu 3D, cartoon | [render](render/MAN.md) |
| Caméra | [camera](camera/MAN.md) |
| Souris et clavier sur la table | [input](input/MAN.md) |
| La salle et ses objets | [scene](scene/MAN.md) → [room](scene/room/MAN.md), [dealer](scene/dealer/MAN.md), [opponents](scene/opponents/MAN.md), [cards](scene/cards/MAN.md), [chips](scene/chips/MAN.md), [start](scene/start/MAN.md) |
| Les menus | [ui](ui/MAN.md) → [actionBar](ui/actionBar/MAN.md), [auth](ui/auth/MAN.md), [newGame](ui/newGame/MAN.md), [pause](ui/pause/MAN.md), [overlay](ui/overlay/MAN.md), [stats](ui/stats/MAN.md), [dashboard](ui/stats/dashboard/MAN.md), [ranges](ui/ranges/MAN.md) |
| Parler au serveur | [net](net/MAN.md) |
| Réglages modifiables | [config](config/MAN.md) |

## OUTILS DE DEBUG

`window.__poker` (en développement seulement) : `toon, opponents, engine,
cameraController, tableCards, tableChips, tableController, table, dealer,
tableInput, startCards`. Pratique dans la console ou pour les captures
automatiques (Chrome headless).

## POURQUOI / PIÈGES

- **Le front ne décide rien** : il anime ce que `PokerGame` annonce. Les règles
  sont dans `src/shared/`, partagées avec le serveur.
- Si les modèles ne chargent pas, on continue : chaque classe a un repli.
- Le port **3001** est pris par une autre appli ; pour tester : `npx vite --port 3050 --strictPort --no-open`.

## VOIR AUSSI

[shared/poker](../shared/poker/MAN.md) · [shared/ai](../shared/ai/MAN.md) · [server](../../server/MAN.md) · `src/front/README.md` · `docs/project/CODE.md`
