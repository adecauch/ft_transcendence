# 🔐 server/auth — comptes, mots de passe, sessions

> **Dossier** `server/src/auth/` · **Routes** `/api/auth/*` · **Testé par** `server/tests/auth.test.mjs`

## NOM

`auth` — créer un compte, se connecter, se déconnecter, savoir qui est
connecté ; et `requireUser`, la garde des routes réservées.

## SYNOPSIS

```http
POST /api/auth/register  { email, username, password }  → 201 { user } + cookie sid
POST /api/auth/login     { email, password }            → 200 { user } + cookie sid
POST /api/auth/logout                                   → 204, cookie effacé
GET  /api/auth/me                                       → 200 { user }   (user = null si personne)
```

```js
app.get('/x', { preHandler: requireUser }, async (req) => req.user.id);
```

## DESCRIPTION

- Mot de passe → **Argon2id** (+ poivre optionnel). Jamais stocké, jamais écrit dans les logs.
- Connexion → un **jeton aléatoire** de 32 octets dans un cookie `sid`
  `httpOnly` / `SameSite=Strict` ; en base, seulement son **SHA-256**.
- Déconnexion → la ligne est supprimée : le cookie meurt tout de suite, même copié ailleurs.

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `password.js` | hacher et vérifier un mot de passe (Argon2id) |
| `sessions.js` | créer, retrouver, détruire une session |
| `guard.js` | `requireUser` : `401` sans session valide |
| `schemas.js` | ce que les routes acceptent **et renvoient** |
| `routes.js` | les 4 routes HTTP |

## FONCTIONS

### 📄 `password.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new Passwords({ pepper })` | — | réglages OWASP minimum : 19 MiB, 2 passes, 1 fil (≈ 50 ms par hash) |
| `hash(password)` | → `Promise<string>` | `$argon2id$v=19$m=19456,t=2,p=1$<sel>$<hash>` : algorithme, réglages, sel et hash dans une seule chaîne |
| `verify(stored, password)` | → `Promise<boolean>` | recalcule avec le sel stocké, compare en temps constant ; `stored` vide = fait **quand même** un vrai calcul |

### 📄 `sessions.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `SESSION_COOKIE` | `'sid'` | nom du cookie |
| `new Sessions(prisma, { sessionDays })` | — | durée de vie d'une session |
| `create(userId)` | → `Promise<{ token, expiresAt }>` | nouveau jeton ; supprime au passage les sessions expirées de ce joueur |
| `userFor(token)` | → `Promise<User \| null>` | le joueur derrière un cookie (une session expirée est supprimée) |
| `destroy(token)` | → `Promise<void>` | déconnexion |

### 📄 `guard.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `requireUser(req, reply)` | hook Fastify | met `req.user`, ou répond `401 { error: 'Connecte-toi…' }` et la route ne tourne pas |

### 📄 `schemas.js`

| Schéma | Vérifie |
|---|---|
| `registerSchema` | email (format, 254 max), pseudo (3–20, `[A-Za-z0-9_-]`), mot de passe (8–128), rien d'autre ; réponses `201`, `409` |
| `loginSchema` | email + mot de passe (1024 max seulement : les règles ont pu changer) ; réponses `200`, `401` |
| `meSchema` | réponse `200 { user \| null }` |

Les nombres viennent de `src/shared/auth/rules.js`. Les réponses aussi sont
filtrées : `passwordHash` ne peut **pas** fuiter, même par erreur.

### 📄 `routes.js`

| Route | Codes | Détail |
|---|---|---|
| `POST /register` | 201, 400, 409, 429 | email mis en minuscules ; tire un `tag` libre pour ce pseudo (code ami `Pseudo#1234`, jusqu'à 20 essais) ; `409 { error, field: 'email' }` si l'email a un compte, `field: 'username'` seulement si ce pseudo n'a plus de numéro libre |
| `POST /login` | 200, 400, 401, 429 | **même** `401` « Email ou mot de passe incorrect » que l'email existe ou non |
| `POST /logout` | 204 | efface la ligne et le cookie |
| `GET /me` | 200 | `{ user: null }` si personne (pas de 4xx : il s'afficherait en rouge dans la console) |

`register` et `login` : **10 essais par minute et par IP**.

## POURQUOI / PIÈGES

- **Pas de différence de temps** entre « email inconnu » et « mauvais mot de
  passe » : `verify` fait un vrai calcul sur un hash factice.
- Un hash **rapide** (SHA-256) suffit pour les jetons de session : ils sont
  aléatoires, il n'y a rien à deviner. Pour les mots de passe, il faut un hash **lent**.
- Cookie `secure` seulement en production (HTTPS derrière nginx).
- À trancher : le `401` d'un mauvais mot de passe s'affiche en rouge dans la console de Chrome.

## VOIR AUSSI

[auth partagé](../../../src/shared/auth/MAN.md) (`rules.js`) · [ui/auth](../../../src/front/ui/auth/MAN.md) ·
[net](../../../src/front/net/MAN.md) (`authApi`) · `server/README.md`
