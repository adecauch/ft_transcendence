# 👥 ui/friends — « Mes amis »

> **Dossier** `src/front/ui/friends/` · **Couche** front (HTML) · **Ouvert par** le badge (« 👥 Amis », joueur connecté) · **Données** `net/friendsApi.js` (`server/src/friends`) · **Temps réel** `net/socialLive.js`

## NOM

`FriendsMenu` — la fenêtre « Mes amis » et ses trois onglets : Mes amis,
Demandes, Ajouter. Première brique du mode en ligne : voir qui est connecté,
gérer ses amis ; l'invitation à une table viendra avec le mode en ligne.

## SYNOPSIS

```js
const friends = new FriendsMenu({ onChange: () => recompterLesAmisEnLigne() });
friends.show();               // onglet « Mes amis »
friends.show('requests');     // directement « Demandes »
friends.hide();
badge.setOnline(3);           // « 👥 Amis ● 3 » dans le badge
```

## DESCRIPTION

Même cadre et même contrat d'onglet que « Mon carnet » (`ui/stats/`) : la
fenêtre réutilise ses classes CSS `stats-*`, et chaque onglet est un fichier de
`tabs/` qui renvoie du HTML ou `{ html, bind }`.

**Les données viennent du serveur** (`server/src/friends`, `net/friendsApi.js`).
La fenêtre est **en direct** : quand un ami se connecte, accepte une demande ou
en envoie une, le flux du joueur (`net/socialLive.js`) prévient `main.js`, qui
recompte le badge et appelle `friends.refresh()` (l'onglet ouvert se redessine).
« 🎲 Inviter » envoie une vraie invitation (`lobbyApi.invite`, amis en ligne
seulement) : l'ami la voit sur sa carte « Table en ligne ».

**Code ami** : en haut de la fenêtre, « Ton code ami : Pseudo#1234 » et 📋 Copier ;
partout, les joueurs s'affichent avec leur `#tag` (deux joueurs peuvent porter le
même pseudo). « Ajouter » accepte un code complet (exactement ce joueur) ou un bout
de pseudo.

Statuts d'un ami : `online` (dans la salle, pastille verte), `playing` (à une
table, pastille dorée), `offline` (grise, « Vu il y a 2 h »).

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `FriendsMenu.js` | la fenêtre, les onglets, leurs compteurs, la ligne de message |
| `tabs/friendsTab.js` | 👥 en ligne / en partie / hors ligne ; 🎲 Inviter, Retirer (deux clics) |
| `tabs/requestsTab.js` | 📨 demandes reçues (Accepter, Refuser) et envoyées (Annuler) |
| `tabs/addTab.js` | ➕ chercher un pseudo, envoyer une demande |
| `html.js` | statut en français, « il y a 2 h », une ligne de joueur |
| `styles.js` | lignes, pastilles, recherche, compteurs (le cadre vient de `stats/styles.js`) |

## FONCTIONS

### 📄 `FriendsMenu.js`

| Nom | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new FriendsMenu({ onChange? })` | — | `onChange()` après chaque changement réussi (le badge recompte les amis en ligne) |
| `show(tab?)` / `hide()` | id d'onglet | ouvre la fenêtre (Échap, ✕ ou clic à côté la ferment) |
| `getTableId` (option) | → code ou `null` | assis dans la salle d'attente d'une table en ligne : « Inviter » y invite (l'invitation porte le code) |
| `refresh()` | — | redessine l'onglet ouvert (appelé par le flux en direct) ; rien si la fenêtre est fermée |
| `view.get(call)` | appel d'API → `data` | une erreur s'affiche dans l'onglet |
| `view.act(call, done)` | changement + message | lance l'appel, affiche `done` (vert) ou l'erreur (rouge) sous les onglets, redessine l'onglet |
| `view.say(text, error?)` · `view.refresh()` · `view.open(id)` | — | ligne de message, redessiner, changer d'onglet |

Compteurs sur les onglets : amis en ligne (vert), demandes reçues (rouge).

### 📄 `tabs/`

| Onglet | Ce qu'il montre | Actions |
|---|---|---|
| `friendsTab` | « En ligne » (dans la salle puis en partie), « Hors ligne » (vus récemment d'abord) | 🎲 Inviter (en ligne seulement ; message « arrivera avec le mode en ligne »), Retirer → « Confirmer ? » |
| `requestsTab` | « Reçues », « Envoyées » | Accepter, Refuser, Annuler |
| `addTab` | une recherche (au moins 2 lettres, lancée par Entrée ou 🔍) | ➕ Ajouter · Envoyée · Répondre (il t'a demandé : ouvre « Demandes ») · Déjà ami |

### 📄 `html.js`

| Nom | Entrée → Sortie |
|---|---|
| `statusText(friend)` | → `'En ligne'`, `'En partie'`, `'Vu il y a 2 h'` |
| `ago(iso)` | → `'il y a 5 min'` / `'2 h'` / `'3 j'` |
| `rowHtml({ name, sub, dot?, buttons, cls? })` | une ligne : pastille, pseudo, sous-titre, boutons |

## POURQUOI / PIÈGES

- **Échap** ferme la fenêtre **seulement** : écouté en capture avec `stopPropagation()`,
  sinon le menu pause s'ouvrait aussi (la fenêtre s'ouvre depuis la salle d'attente
  d'une table en ligne, déjà « en partie ») et figeait toute la table.

- **Le corps de la fenêtre est réutilisé** d'un onglet à l'autre : `bind()` reçoit
  un élément **neuf** à chaque ouverture, sinon les écouteurs s'accumuleraient
  (un clic compterait deux fois après deux ouvertures).
- La recherche part à la validation, pas à chaque touche : une seule requête
  par recherche quand le serveur répondra. Pas d'attribut `minlength` : la bulle
  du navigateur est petite, le message « Tape au moins 2 lettres » est gros.
- Retirer un ami demande **deux clics** (« Confirmer ? »), comme supprimer une
  range enregistrée.
- Réservé aux joueurs connectés : un invité n'a pas le bouton (pas de requête
  vouée au `401`, voir `net/MAN.md`). La déconnexion ferme la fenêtre.
- Le compteur d'amis en ligne du badge et les onglets se mettent à jour **sans
  recharger** : c'est le flux `/api/friends/live` qui prévient.
- `act(call, done)` accepte un message ou une fonction `done(data)` : une
  demande croisée répond `{ friend }` (« vous êtes amis ! ») au lieu de `{ request }`.

## VOIR AUSSI

[ui](../MAN.md) (`UserBadge`) · [ui/stats](../stats/MAN.md) (même cadre, même contrat d'onglet) · [net](../../net/MAN.md) (`friendsApi`)
