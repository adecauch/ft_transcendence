# 🔑 ui/auth — l'écran de connexion

> **Dossier** `src/front/ui/auth/` · **Couche** front (HTML) · **Ouvert par** `main.js` (après l'accueil, si pas de session) et le badge (« Se connecter »)

## NOM

`AuthScreen` — un panneau en bois par-dessus la salle, avec deux onglets
(**Connexion**, **Inscription**) et « **Jouer sans compte** ».

## SYNOPSIS

```js
const auth = new AuthScreen({ onDone: (user) => badge.set(user) });  // user = null pour un invité
auth.show('login');       // ou 'register'
```

## DESCRIPTION

| Onglet | Champs |
|---|---|
| Connexion | email, mot de passe |
| Inscription | email, pseudo, mot de passe, confirmation (+ rappel des règles du mot de passe) |

1. Les champs sont vérifiés **ici d'abord** avec les règles partagées
   (`shared/auth/rules.js`) : l'erreur s'affiche tout de suite **sous le bon champ**,
   et le curseur va au premier champ en erreur.
2. Puis la requête part (`authApi.login` / `register`). Les réponses du serveur
   (email déjà pris, pseudo pris, mauvais mot de passe, trop d'essais, serveur
   éteint) s'affichent **de la même façon** : sous le champ concerné (`field`)
   ou en message général.
3. Succès → le panneau se retire et `onDone(user)` est appelé.

## FICHIERS ET FONCTIONS

### 📄 `AuthScreen.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new AuthScreen({ onDone })` | — | rien n'est construit avant le premier `show` |
| `show(mode = 'login')` | — | construit si besoin, choisit l'onglet, met le curseur sur l'email |
| `hide()` | — | glisse puis se retire du DOM |
| `mode` | `'login' \| 'register'` | onglet courant |

Internes :

| Méthode | Rôle |
|---|---|
| `_setMode(mode)` | champs visibles, textes, couleur du bouton ; `autocomplete` = `current-password` ou `new-password` (le gestionnaire de mots de passe du navigateur propose la bonne chose) |
| `_values()` | les valeurs du formulaire selon l'onglet |
| `_send()` | vérification locale → requête → succès ou erreurs ; mauvais mot de passe : on garde l'email, on vide le mot de passe |
| `_setError(name, message)` | texte sous le champ + `aria-invalid` |
| `_setBusy(busy)` | « Connexion… », boutons désactivés (pas de double envoi) |

### 📄 `styles.js`

| Fonction | À quoi elle sert |
|---|---|
| `injectAuthStyles()` | le CSS du panneau, des onglets et des champs (une seule fois) |

## POURQUOI / PIÈGES

- La vérification du front sert au **confort** ; seule celle du serveur **compte**
  (n'importe qui peut envoyer une requête sans passer par l'écran).
- Le mot de passe ne va nulle part ailleurs que dans la requête HTTPS vers le serveur.
- Pas d'écran de connexion en mode `debug_ia`.

## VOIR AUSSI

[shared/auth](../../../shared/auth/MAN.md) (`rules.js`) · [server/auth](../../../../server/src/auth/MAN.md) · [net](../../net/MAN.md) (`authApi`) · [ui](../MAN.md) (`UserBadge`)
