# ✉️ ui/online — « Table en ligne »

> **Dossier** `src/front/ui/online/` · **Couche** front (HTML) · **Ouvert par** la carte d'invitation posée sur la table (`scene/start/InviteCard.js`, section `online`) · **Données** `net/lobbyApi.js` (`server/src/lobby`)

## NOM

`OnlineMenu` — le panneau derrière la carte d'invitation : l'entrée du mode en
ligne, à côté du paquet « Contre l'IA ».

## SYNOPSIS

```js
// ui/overlay/panels.js
export { renderOnlineMenu as online } from '../online/OnlineMenu.js';
// Overlay.show(ONLINE_SECTION) → renderOnlineMenu() → HTMLElement
```

## DESCRIPTION

L'entrée du mode en ligne :

- **invité** : « il faut un compte » + « Se connecter / s'inscrire » (ferme le
  panneau, ouvre l'écran de connexion) ;
- **joueur connecté** : son **code ami**, les **invitations reçues**
  (🎲 Rejoindre, Refuser), « ➕ Créer une table » et « 👥 Inviter des amis »
  (ouvre la fenêtre Amis).

Rejoindre et créer une table répondent qu'ils arriveront avec le mode en ligne.
Les invitations viennent du serveur (`net/lobbyApi.js` → `server/src/lobby`) ;
une invitation reçue apparaît sans recharger (flux en direct → `lobby:changed`).

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `OnlineMenu.js` | `renderOnlineMenu()` : le contenu du panneau, selon invité / connecté ; **créer une table** (IA, tapis, blinds), **rejoindre avec un code**, rejoindre depuis une invitation |
| `WaitingRoom.js` | la **salle d'attente** d'une table partagée, par-dessus la table 3D : code (📋), joueurs (👑 hôte, connecté ou non), IA, « ▶ Lancer » (hôte), « 👥 Inviter des amis », « Quitter la table » |
| `styles.js` | mise en page du panneau (lignes, ligne de message : celles de `ui/friends/`) |

## FONCTIONS

| Nom | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `renderOnlineMenu()` | → `HTMLElement` | « Chargement… », puis `authApi.me()` décide invité / connecté, et `lobbyApi.invitations()` remplit la liste |

Événements envoyés sur `window` (écoutés par `main.js`) :

| Événement | Quand | Effet |
|---|---|---|
| `auth:open` | invité → « Se connecter » | `AuthScreen.show('login')` |
| `friends:open` | « 👥 Inviter des amis » | `FriendsMenu.show()` |
| `lobby:changed` | une invitation refusée | recompte : `startCards.setInvites(n)` (pastille et étiquette de la carte) |

### 📄 `WaitingRoom.js`

| Membre | Entrée → Sortie | Rôle |
|---|---|---|
| `new WaitingRoom({ onStart, onInvite, onLeave })` | — | `main.js` : `tableController.startShared()`, `friends:open`, `game:quit` |
| `update(state)` | message `lobby` | redessine ; se cache dès que `status` n'est plus `waiting` (cartes distribuées) |
| `hide()` | — | `game:quit` |

« ▶ Lancer » n'existe que pour l'hôte (`state.host.id === state.you`), grisé tant
qu'il n'y a pas 2 joueurs connectés. Le message dit à chacun quoi faire
(« donne le code à un ami », « attends son retour », « Lance la partie ! »).

## POURQUOI / PIÈGES

- Salle d'attente centrée par `margin-inline: auto`, pas par `transform` :
  l'animation d'apparition (`saloonPop`) anime `transform` et la décalait.
- L'enseigne reste **dans** le panneau : il défile (petits écrans), il rognerait
  une enseigne qui dépasse.

- Le panneau passe par `window` plutôt que d'importer `AuthScreen` ou
  `FriendsMenu` : ces fenêtres sont créées par `main.js` (une seule instance),
  le panneau n'a pas à les connaître.
- `authApi.me()` répond `200 { user: null }` pour un invité : pas d'erreur rouge
  dans la console.
- Le panneau se redessine sur `lobby:changed` (une invitation reçue en direct, ou
  refusée ici) : **un seul** écouteur de clic pour toute sa vie, sinon chaque
  redessin en ajouterait un (un clic compterait plusieurs fois).

## VOIR AUSSI

[scene/start](../../scene/start/MAN.md) (la carte d'invitation) · [ui/friends](../friends/MAN.md) · [ui/overlay](../overlay/MAN.md) · [net](../../net/MAN.md) (`lobbyApi`)
