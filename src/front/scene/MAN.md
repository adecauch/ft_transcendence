# 🏛️ scene — ce qu'on voit dans la salle (et `seatLayout.js`)

> **Dossier** `src/front/scene/` · **Couche** front (Three.js) · **Créé par** `main.js`, étapes 4–6

## NOM

`scene` — les objets 3D de la salle. Cette page décrit `seatLayout.js`, la
**source unique des positions**, et sert de sommaire aux sous-dossiers.

## LES SOUS-DOSSIERS

| Dossier | Contenu | Page |
|---|---|---|
| `room/` | table, salle (sol, murs, plafond, porte, meuble), chaises, lampes, poussière | [room](room/MAN.md) |
| `dealer/` | le croupier cowboy, ses revolvers, ses caisses, le coup de feu | [dealer](dealer/MAN.md) |
| `opponents/` | les IA assises et leurs réactions | [opponents](opponents/MAN.md) |
| `cards/` | les cartes 3D : paquet, mains, board | [cards](cards/MAN.md) |
| `chips/` | les jetons 3D : tapis, mises, pot, étiquettes | [chips](chips/MAN.md) |
| `start/` | la carte « Nouvelle partie » | [start](start/MAN.md) |

## REPÈRES 3D

```
                        z > 0  (côté croupier)
         cowboy (0, 2.6) sur deux caisses
    ┌──────────────────────────────────────────────┐
    │  pot (-0.35, 0.5)          paquet (0.9, 0.75) │
    │ midRight          board (z = 0)       midLeft │   feutre ≈ x ∈ [-3.1, 3.1]
    │ nearRight                            nearLeft │           z ∈ [-0.98, 0.98]
    │              cartes du joueur (0, -0.75)      │
    └──────────────────────────────────────────────┘
                        z < 0  (côté joueur)          caméra du joueur (0, 6.2, -6.4)
```

- Siège 0 = le joueur ; les IA suivent **dans le sens horaire**, en commençant à sa gauche (+x).
- Échelle : carte 0.3 × 0.42 (63 mm → 0.3) ; jeton r ≈ 0.093, h ≈ 0.0157.
- Le feutre est à y ≈ 2.3 (table haute), l'assise des chaises à y ≈ 1.0.

## FONCTIONS — 📄 `seatLayout.js`

Chaque siège a :

| Champ | Sens |
|---|---|
| `cards` | où posent ses deux cartes (face au centre) |
| `stack` + `stackDir` | où sont ses jetons, et dans quel sens s'alignent les piles |
| `bet` | où vont ses mises du tour |
| `chair` | la chaise au sol `{ x, z, rot }`, où s'assied le personnage |

| Nom | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `seatLayouts(opponentCount)` | 1 à 4 → `[{ cards, stack, stackDir, bet, chair, yaw }]` | la disposition du joueur + des IA, dans l'ordre des sièges |
| `seatSpots(opponentCount)` | → `[{ x, z }]` | seulement les places des cartes |
| `yawTowardCentre({ x, z })` | → angle | orientation qui pointe vers le centre de la table |
| `seatFrame({ x, z })` | → `{ toCentre, left }` | vecteurs unitaires : vers le centre, et la gauche du joueur assis |
| `CHAIRS` | 5 chaises | le joueur puis les 4 places d'adversaires (lu par `Chairs.js`) |
| `PLAYER_SPOT`, `DECK_SPOT`, `POT_SPOT` | `{ x, z }` | cartes du joueur, paquet, pot |

Quelles chaises selon le nombre d'IA (`SEATS_BY_COUNT`) :

| IA | Chaises |
|---|---|
| 1 | midLeft |
| 2 | midLeft, midRight |
| 3 | nearLeft, midLeft, midRight |
| 4 | nearLeft, midLeft, midRight, nearRight |

## POURQUOI / PIÈGES

- **Une seule source** : cartes, jetons, chaises et personnages lisent tous
  `seatLayout.js`. Déplacer un siège = changer une ligne ici.
- Les chaises de côté sont écartées pour que, depuis la place du joueur, les
  plus proches ne cachent pas celles du milieu.

## VOIR AUSSI

[front](../MAN.md) · [game](../game/MAN.md) (`TableController` utilise `seatLayouts`)
