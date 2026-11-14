# server/ — le back-end (comptes, parties, statistiques)

Serveur **Node.js + Fastify**, base **PostgreSQL** via l'ORM **Prisma**. Il gère :
- les **comptes** : inscription, connexion, déconnexion, « qui suis-je » (ce document) ;
- les **parties** : chaque main et chaque coup, rejoués et vérifiés par le
  serveur, l'historique, les statistiques, les succès et le classement. Tout
  est expliqué dans **[`STATS.md`](STATS.md)**.

Le moteur de jeu et l'IA tournent désormais côté serveur pour les tables
WebSocket ; le navigateur ne reçoit pas la stratégie MCCFR.

Ce document explique **comment ça marche et pourquoi**, pour qu'on puisse
relire le code et le défendre en soutenance.

---

## 1. Lancer le serveur

Il faut Podman (et son provider Compose) lancé pour PostgreSQL, ainsi que Node 20 ou plus.

```bash
# Une seule fois
cp .env.example .env            # à la racine du dépôt, puis changer les secrets
make install                    # installe le frontend, le serveur et Prisma
make postgres-up                # démarre PostgreSQL avec Podman (port 5432)
make migrate                    # crée les tables (applique prisma/migrations/)

# À chaque session de travail
make postgres-up                # (le conteneur repart avec Podman)
npm run dev                     # le jeu (http://localhost:3000) ET le back-end (:3100) dans le même terminal,
                                # logs préfixés [jeu] / [serveur], Ctrl+C arrête les deux
# séparément si besoin : npm run dev:front (le jeu seul) · npm run server (le back-end seul)
```

| Commande (dans `server/`) | Rôle |
|---|---|
| `npm run dev` | serveur qui redémarre à chaque sauvegarde |
| `npm test` | tests des routes contre la vraie base (17 tests : comptes, parties, infosets, ranges) |
| `npm run db:rebuild-infosets` | reconstruit la table `PlayerInfoset` depuis l'historique (après un réentraînement du solveur) |
| `npm run db:migrate -- --name xxx` | après une modification de `schema.prisma` : crée et applique une migration SQL |
| `npm run db:deploy` | applique les migrations existantes (base neuve, prod) |
| `npm run db:studio` | interface web pour voir et modifier les tables |

Depuis la racine : `npm run server` et `npm run test:server` font pareil.

Arrêter la base : `make postgres-down` (les données restent dans le volume
`pgdata`). **Tout effacer** : `make postgres-reset`.

### Backend conteneurisé

Le backend peut aussi être lancé dans un conteneur Podman. L'image est construite
depuis la racine du dépôt, car elle embarque `src/shared/` et les données MCCFR.
Avant une première construction ou après un entraînement, générer la stratégie
privée avec `npm run ai:sync` : elle est écrite dans
`server/data/strategy.bin`, ignoré par Git et copié uniquement dans l'image
serveur. Sans ce fichier privé, le build du serveur échoue volontairement.
Le conteneur applique les migrations Prisma avant de démarrer Fastify.

```bash
make server-build
make server-up
curl http://127.0.0.1:3100/api/health
make server-logs
```

Dans le conteneur, PostgreSQL est joint par le nom Compose `db` et non par
`localhost`. Le déploiement complet n'expose pas directement le backend :
seul nginx est accessible depuis la machine hôte. Les commandes de
développement qui doivent joindre PostgreSQL ou Fastify depuis l'hôte
utilisent automatiquement `docker-compose.dev.yml` via le Makefile.

Le service `nginx` sert le frontend compilé en HTTPS sur
`https://127.0.0.1:8443`, transmet les requêtes `/api/` au backend et conserve
la mise à niveau WebSocket de `/ws/table` (`wss://127.0.0.1:8443/ws/table`).
Le port HTTP `8080` redirige vers HTTPS. `make up` démarre les trois services
(`db`, `server`, `nginx`) et génère automatiquement un certificat auto-signé
local dans `certs/` si nécessaire. Le certificat doit être accepté
manuellement dans le navigateur pendant le développement.

nginx transmet `Host` avec `$http_host` pour conserver le port public `8443` :
le contrôle d'origine WebSocket doit comparer `https://localhost:8443` à la
même adresse, port compris. `make` (ou `make up`) reconstruit les images puis
recrée les conteneurs explicitement : les changements sont réellement chargés.
`make fclean` supprime les conteneurs, les images locales des services et
`dist/`, mais conserve la base. `make re` enchaîne ce nettoyage puis le lancement.
`make fclean-db` supprime également le volume PostgreSQL : comptes, parties,
amis et ranges sont effacés. Le prochain `make` recrée une base vide et applique
les migrations. `.env`, les certificats, le cache de build et les dépendances
installées sur l'hôte sont conservés.

---

## 2. Organisation des fichiers

```
server/
  prisma/
    schema.prisma        les tables (User, Session), en langage Prisma
    migrations/          le SQL généré à partir du schéma, versionné dans git
  src/
    index.js             démarre le serveur (lit la config, écoute le port)
    app.js               construit l'application Fastify (utilisé aussi par les tests)
    config.js            lit le .env ; s'arrête tout de suite s'il manque une valeur
    auth/
      password.js        hachage et vérification des mots de passe (Argon2id)
      sessions.js        création / lecture / suppression des sessions
      guard.js           requireUser : routes réservées aux joueurs connectés
      schemas.js         règles de validation des requêtes et des réponses
      routes.js          les 4 routes /api/auth/*
    ai/solverData.js     les fichiers du solveur MCCFR, lus une fois (buckets, version, stratégie)
    games/               /api/games : parties, mains (rejouées), abandon, historique — voir STATS.md
    stats/               /api/stats/* et /api/leaderboard : totals (SQL), infosets (tes décisions sous
                         les clés du solveur), solverReport (comparaison), rebuildInfosets,
                         dashboard + exportCsv + liveFeed (tableau de bord, CSV, temps réel en SSE) — voir STATS.md
    ranges/              /api/ranges : les ranges construites et enregistrées (schemas, service, routes)
  scripts/
    rebuild-infosets.js  npm run db:rebuild-infosets : reconstruit PlayerInfoset depuis l'historique
  tests/
    helpers.mjs          outils communs : app de test, joueurs connectés, parties jouées au hasard
    auth.test.mjs        inscription, connexion, déconnexion, validation, doublons, limite d'essais
    games.test.mjs       partie complète, historique, stats, succès, classement, triche refusée
    infosets.test.mjs    décisions classées sous les clés du solveur, reconstruction, comparaison
    ranges.test.mjs      ranges enregistrées : création, modification, suppression, refus
```

Les secrets sont dans **`.env` à la racine** (ignoré par git). `.env.example`,
lui, est versionné et sert de modèle.

---

## 3. Les routes

| Méthode et URL | Corps envoyé | Réponse |
|---|---|---|
| `POST /api/auth/register` | `{ email, username, password }` | `201 { user }` + cookie de session ; `409` si l'email a déjà un compte ; `400` si invalide. Le pseudo peut être déjà porté : le serveur tire un **numéro** (`tag`) libre pour ce pseudo |
| `POST /api/auth/login` | `{ email, password }` | `200 { user }` + cookie ; `401` « Email ou mot de passe incorrect » |
| `POST /api/auth/logout` | — | `204`, la session est supprimée et le cookie effacé |
| `GET /api/auth/me` | — | `200 { user }`, `user` vaut `null` si personne n'est connecté (pas de `401` : « pas connecté » est une réponse normale ici, et une erreur 4xx s'afficherait en rouge dans la console de Chrome à chaque visite) |
| `GET /api/health` | — | `{ ok: true }` (pour vérifier que le serveur tourne) |

`user` = `{ id, email, username, tag, createdAt }`, jamais le hash.

**Code ami** (`Pseudo#1234`) : comme sur Battle.net ou Riot, plusieurs joueurs
peuvent porter le même pseudo. À l'inscription, le serveur tire 4 chiffres au
hasard (`tag`, 1000 à 9999) et en retire d'autres si ce couple existe déjà
(20 essais : un refus n'arrive que si presque tous les numéros de ce pseudo
sont pris). C'est le couple `(username, tag)` qui est unique en base ;
`friendCode()` / `parseFriendCode()` (`src/shared/auth/rules.js`) l'écrivent et le
relisent. Pourquoi : bloquer un pseudo déjà pris frustre (« LuckyLuke » est vite
parti), et le code ami sert à retrouver exactement un joueur (onglet Amis).

Règles de validation (`schemas.js`) :
- **email** : format email, 254 caractères max, enregistré en minuscules ;
- **pseudo** : 3 à 20 caractères, lettres, chiffres, `_` ou `-` ;
- **mot de passe** : 8 à 128 caractères.

Essai à la main :

```bash
curl -c jar -X POST localhost:3000/api/auth/register -H 'content-type: application/json' \
     -d '{"email":"a@b.fr","username":"alice","password":"un-bon-mot-de-passe"}'
curl -b jar localhost:3000/api/auth/me
```

---

## 4. Les mots de passe : ce qu'on stocke vraiment

**On ne stocke jamais le mot de passe**, ni en clair, ni chiffré. On stocke
son **hash**, dans la colonne `passwordHash` de la table `User`, par exemple :

```
$argon2id$v=19$m=19456,p=1,t=2$zDaEB6zg2XqelyqniJP…$Qm9uam91ciBsYSBzb3V0ZW5hbmNl…
 └ algo  └ version └ réglages    └ sel (aléatoire)    └ le hash
```

### Pourquoi on peut stocker le hash tel quel

Un hash est une **fonction à sens unique** : on passe facilement du mot de
passe au hash, mais on ne peut pas revenir en arrière. Il n'y a pas de clé qui
le « déchiffre ». Donc il n'y a rien à cacher de plus : si la base est volée,
le pirate n'a que des hashes.

Pour vérifier une connexion, on ne compare jamais deux mots de passe :

```
inscription : mot de passe → Argon2id(sel aléatoire) → on enregistre la chaîne ci-dessus
connexion   : mot de passe tapé → Argon2id(même sel, mêmes réglages, lus dans la chaîne)
              → même résultat ? oui = bon mot de passe
```

C'est `argon2.verify()` qui fait tout ça (`password.js`).

### Le sel

Un nombre aléatoire tiré à chaque inscription et mélangé au mot de passe.
Deux personnes avec le même mot de passe ont donc des hashes différents, et
les tables de hashes précalculées (« rainbow tables ») ne servent à rien.
Le sel **n'est pas secret** : il est écrit dans la chaîne, la bibliothèque le
gère toute seule.

### Pourquoi Argon2id et pas SHA-256

SHA-256 est **trop rapide** : une carte graphique en calcule des milliards par
seconde, donc on peut tester tous les mots de passe courants sur une base volée.
Argon2id est **lent exprès** et utilise beaucoup de mémoire (ici environ 50 ms
et 19 Mo par calcul, le minimum recommandé par l'OWASP). Pour une connexion,
personne ne voit la différence. Pour un attaquant, chaque essai coûte des
millions de fois plus cher. Les réglages sont dans `OPTIONS` en haut de `password.js`.

### Le poivre (`PASSWORD_PEPPER`)

Un secret **en plus**, gardé dans le `.env` du serveur et **pas dans la base**,
mélangé à chaque hash. Avec seulement la base volée, on ne peut même pas
commencer à deviner les mots de passe. C'est facultatif (vide = pas de poivre).
**Attention** : si on le change ou qu'on le perd, plus aucun mot de passe
existant ne fonctionne.

### Même réponse pour « email inconnu » et « mauvais mot de passe »

Sinon, n'importe qui pourrait tester quels emails ont un compte. Le serveur
fait même un vrai calcul Argon2 quand l'email n'existe pas, pour que le
**temps de réponse** ne le trahisse pas non plus (`Passwords.verify`).

Limite connue : l'inscription, elle, dit « Cet email a déjà un compte ».
C'est inévitable si on veut un message clair, et c'est limité par le point suivant.

### Limite d'essais

`/register` et `/login` acceptent **10 requêtes par minute et par adresse IP**
(`@fastify/rate-limit`), puis répondent `429`. Ça empêche de deviner un mot de
passe en essayant des milliers de possibilités en ligne.

---

## 5. Rester connecté : les sessions

Après l'inscription ou la connexion, le serveur crée une **session** :

1. il tire un **jeton aléatoire** de 32 octets (impossible à deviner) ;
2. il l'envoie au navigateur dans un **cookie** `sid` ;
3. il enregistre dans la table `Session` le **SHA-256 du jeton** (pas le jeton),
   l'utilisateur et la date d'expiration (`SESSION_DAYS`, 7 jours par défaut).

À chaque requête, le navigateur renvoie le cookie. Le serveur hache le jeton,
cherche la ligne, et sait qui parle (`sessions.js`).

- **Pourquoi hacher le jeton ?** Pour la même raison que les mots de passe :
  avec la base volée, on ne peut pas fabriquer un cookie valide. Ici un hash
  rapide (SHA-256) suffit : le jeton est aléatoire, il n'y a rien à deviner.
- **Déconnexion** : la ligne est supprimée, donc le cookie ne marche plus, même
  s'il a été copié ailleurs. C'est l'avantage sur un JWT, qu'on ne peut pas
  révoquer avant son expiration.
- Quand on supprime un utilisateur, ses sessions partent avec lui
  (`onDelete: Cascade`).

### Les options du cookie (`routes.js`)

| Option | Effet |
|---|---|
| `httpOnly` | le JavaScript de la page ne peut pas lire le cookie : une faille XSS ne peut pas le voler |
| `secure` | envoyé seulement en HTTPS (activé quand `NODE_ENV=production`, derrière nginx) |
| `sameSite: 'strict'` | jamais envoyé depuis un autre site : protège contre le CSRF (un site piégé qui ferait agir ton navigateur à ta place) |
| `expires` | même durée que la session en base |

Le jeu (Vite, port 3000) redirige `/api/*` vers le serveur (port 3100) : pour
le navigateur, tout vient de la même origine, donc le cookie marche sans
configuration CORS.

---

## 6. La base de données

Schéma dans `prisma/schema.prisma`, SQL généré dans `prisma/migrations/`.
Ci-dessous les tables des comptes. Les tables des parties (`Game`, `Hand`,
`Action`, `UserAchievement`) sont décrites dans [`STATS.md`](STATS.md#3-les-tables).

```
User                                   Session
─────────────────────────              ─────────────────────────
id            serial  PK      1 ──── n id         serial  PK
email         text    unique           tokenHash  text    unique
username      text                     userId     int     FK → User.id (cascade)
tag           int     unique avec username (code ami username#tag)
passwordHash  text    (null = OAuth)   createdAt  timestamp
createdAt     timestamp                expiresAt  timestamp
```

- **Prisma** : on décrit les tables dans `schema.prisma`, Prisma génère le SQL
  (migrations) et un client JS typé (`prisma.user.create(...)`). Les requêtes
  sont paramétrées, donc pas d'injection SQL.
- **Migrations** : chaque changement de schéma devient un fichier SQL versionné
  dans git. Une base neuve se reconstruit en les rejouant dans l'ordre
  (`db:deploy`).
- `passwordHash` peut être vide pour les futurs comptes « Se connecter avec 42 »
  (OAuth), qui n'ont pas de mot de passe chez nous.

---

## 7. Validation et fuites

- **Toutes les entrées sont validées côté serveur** par Fastify, avec les JSON
  Schema de `schemas.js`, **avant** que le code de la route s'exécute. Un
  champ manquant ou invalide donne un `400`. Le front devra vérifier les
  mêmes règles pour afficher les erreurs tout de suite, mais seule la
  vérification serveur compte : n'importe qui peut envoyer une requête sans
  passer par notre interface.
- **Les réponses aussi ont un schéma** : un champ non listé (comme
  `passwordHash`) est retiré automatiquement, même si on renvoie l'objet
  `user` complet par erreur.
- **Les logs** masquent les cookies et le champ `password` (`redact` dans `app.js`).

---

## 8. Tests

`npm test` (dans `server/`, base lancée) vérifie :
- l'inscription connecte, et la base ne contient qu'un hash Argon2id et le hash du jeton ;
- email insensible à la casse, même `401` pour « email inconnu » et « mauvais mot de passe » ;
- après la déconnexion, l'ancien cookie ne marche plus ;
- les entrées invalides donnent `400`, les doublons `409` avec le bon champ ;
- `/me` sans cookie, ou avec un cookie inventé, donne `user: null` ;
- la 11e tentative de connexion en une minute donne `429`.

Chaque test crée ses comptes (`…@test.invalid`) et les supprime à la fin.

---

## 9. Côté jeu : l'écran de connexion

```
Écran d'accueil ──« Entrer dans la salle »──► déjà une session (cookie) ? ──oui──► la salle, badge « 🤠 pseudo »
                                                     │ non
                                                     ▼
                                   AuthScreen : [Connexion] [Inscription]
                                     ├ connexion / inscription réussie ──► la salle, badge « 🤠 pseudo »
                                     └ « Jouer sans compte » ──────────► la salle, badge « 🤠 Invité »
Badge : « Déconnexion » (ou « Se connecter » en invité) ──► rouvre AuthScreen
```

| Fichier | Rôle |
|---|---|
| `src/front/ui/auth/AuthScreen.js` | le panneau en bois (style des menus), onglets Connexion / Inscription, champs, messages d'erreur, bouton « Afficher » le mot de passe |
| `src/front/ui/UserBadge.js` | en haut à droite : le pseudo et le bouton Déconnexion ; caché pendant une partie |
| `src/front/net/authApi.js` | les appels `fetch` vers `/api/auth/*` ; ne lève jamais d'erreur, renvoie `{ ok, user }` ou `{ ok: false, error, field }` en français |
| `src/shared/auth/rules.js` | **les règles communes** (longueurs, caractères permis) et leurs messages, utilisées par l'écran **et** par le serveur |
| `src/front/main.js` | l'enchaînement ci-dessus (demande `/me` dès le chargement de la page) |

- **Double validation** : l'écran vérifie les champs avant l'envoi, avec les
  règles de `rules.js`, et affiche l'erreur sous le bon champ (bordure rouge,
  ⚠). Le serveur revérifie avec les **mêmes** règles. Ses réponses (email
  déjà pris, mauvais mot de passe, trop d'essais, serveur éteint) s'affichent
  de la même façon.
- **Le front ne voit jamais le cookie** (`httpOnly`) : pour savoir qui est
  connecté, il demande `/api/auth/me`. Recharger la page garde la connexion.
- **Gestionnaires de mots de passe** : les champs ont les bons attributs
  `autocomplete` (`email`, `username`, `current-password` à la connexion,
  `new-password` à l'inscription), donc le navigateur propose d'enregistrer
  et de remplir le mot de passe.
- **Mode invité** : on peut jouer sans compte (rien ne sera sauvegardé quand
  les parties seront enregistrées). Si le back-end n'est pas lancé, l'écran
  l'indique (« Serveur injoignable ») et le mode invité reste possible.
- **Console** : une connexion ratée affiche une ligne rouge `401` dans la
  console de Chrome. C'est le navigateur qui affiche toute réponse 4xx, on ne
  peut pas l'empêcher sans renvoyer un faux `200`. Les évaluateurs 42
  regardent « aucune erreur dans la console » : à trancher.

## 10. Les ranges enregistrées (table `SavedRange`)

Dans le tableau des ranges, onglet « Construire », un joueur connecté peut
enregistrer sa range sous un nom, la rouvrir, la modifier ou la supprimer. Un
invité garde seulement son brouillon dans le navigateur (`localStorage`).

| Route | Rôle |
|---|---|
| `GET /api/ranges` | mes ranges, de la plus récente à la plus ancienne |
| `POST /api/ranges` | `{ name, range }` → `201 { range }` |
| `PUT /api/ranges/:id` | `{ name?, range? }` → `{ range }` |
| `DELETE /api/ranges/:id` | → `204` |

- `range` = `{ "AKs": { "raise": 1 }, "77": { "raise": 0.6, "call": 0.25 } }` : une
  main peut être **mixte** (peinte avec les curseurs du pinceau). Le reste de la
  main, et une main absente, veulent dire « se coucher ».
- **Deux validations** : la forme par le JSON Schema (`src/ranges/schemas.js`),
  le contenu par `cleanRange()` (`src/shared/poker/ranges.js`, partagé). Celle-ci
  vérifie que ce sont de vraies mains, seulement `raise` / `call`, et que les
  fréquences font au plus 100 %. Les zéros sont retirés.
- Nom **unique par joueur** (`409`), 50 ranges au maximum. Un joueur ne voit
  que les siennes : l'id d'un autre répond `404`.
- Les fichiers : `schemas.js` (la forme), `service.js` (la base, les refus
  `RangeRefused` avec leur code HTTP), `routes.js` (le HTTP seulement).

## 11. Ce qui reste à faire

- **HTTPS** : nginx devant le serveur (obligatoire pour 42), puis
  `NODE_ENV=production` pour activer `secure` sur le cookie.
- **Compose complet avec Podman** : ajouter les services `server` et `nginx`.
  Dans le réseau Compose, `DATABASE_URL` pointera vers l'hôte `db` au lieu de `localhost`.
- **OAuth 42** (module 10) : un compte sans mot de passe, lié à l'identifiant 42.
- Nettoyage périodique des sessions expirées (aujourd'hui supprimées à la
  connexion suivante de l'utilisateur, ou quand on les présente).

Versions : Prisma 6 (Prisma 7 exige Node 20.19, 22.12 ou 24+, et la machine
de dev est en Node 23). Pour passer à Prisma 7, il faudra changer de version
de Node et adapter le schéma (nouveau générateur et adaptateur `pg`).
