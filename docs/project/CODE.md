# Guide du code — « Poker Transcendence »

Ce document explique **chaque partie du code** : à quoi elle sert, quels
fichiers la composent et quelles sont leurs fonctions principales. Il sert à
se repérer vite et à défendre le projet en soutenance.

Pour aller plus loin sur un sujet :

| Sujet | Document |
|---|---|
| **Chaque section en détail** (toutes les fonctions) | le `MAN.md` de son dossier, ou `docs/man/index.html` (`npm run docs:man`) |
| Comptes, sessions, sécurité, ranges enregistrées | `server/README.md` |
| Parties enregistrées, rejeu, stats, succès, tableau de bord, solveur | `server/STATS.md` |
| IA MCCFR (clés, buckets, tailles de mise, traduction) | `src/shared/ai/README.md` |
| Liste courte des fichiers | `src/shared/README.md`, `src/front/README.md` |
| Match contre Slumbot | `../CFR/tests/slumbot/README.md` (dépôt voisin) |
| Modules 42 et état d'avancement | `docs/project/ROADMAP.md` |

---

## 1. La grande idée : trois couches

```
 navigateur                                   serveur (Node)
┌─────────────────────────────┐          ┌──────────────────────────────┐
│ src/front/   AFFICHAGE      │  /api/*  │ server/src/   HTTP + BASE    │
│ Three.js, menus, animations │ ───────► │ Fastify, Prisma, PostgreSQL  │
└──────────────┬──────────────┘          └───────────────┬──────────────┘
               │ importe                                 │ importe
               ▼                                         ▼
        ┌──────────────────────────────────────────────────────┐
        │ src/shared/   LOGIQUE PURE (partagée)                   │
        │ règles du poker, IA, rejeu, succès, analyse de ranges │
        │ pas de DOM, pas de Three.js, pas de minuterie         │
        └──────────────────────────────────────────────────────┘
```

**Règle d'or** : `src/front/` et `server/` peuvent importer `src/shared/`,
jamais l'inverse. **Pourquoi** : la même règle du poker tourne à la fois dans
le navigateur (pour jouer) et sur le serveur (pour **rejouer** chaque main et
refuser la triche). Si elle existait en deux exemplaires, ils finiraient par
diverger. Et parce que `src/shared/` ne touche jamais l'écran, il se teste
directement dans Node (`npm run test:ai`).

**Un fichier = un rôle.** Côté serveur, chaque service est découpé de la même
façon :

| Fichier | Rôle | Il ne fait **pas** |
|---|---|---|
| `schemas.js` | la forme des requêtes et des réponses (JSON Schema, vérifiée par Fastify avant le code) | de base de données |
| `service.js` | la logique et la base de données (Prisma) | de HTTP |
| `routes.js` | le HTTP seulement : lire la requête, appeler le service, répondre | de SQL |

Côté front, un écran qui a son propre CSS est un **dossier** : le composant,
et un `styles.js` qui injecte son CSS une seule fois (`injectXStyles()`).
Un menu à onglets a **un fichier par onglet** (`ui/stats/tabs/`, `ui/ranges/`).

---

## 2. `src/shared/` — la logique pure

### 2.1 `poker/` — les règles du jeu

| Fichier | Rôle | Fonctions principales |
|---|---|---|
| `cards.js` | codes de cartes (`'AS'`, `'TD'`), paquet, codage du solveur C++ (`rang × 4 + couleur`) | `createDeck`, `shuffle`, `codeToCard`, `handType` (`'AKs'`) |
| `handEvaluator.js` | meilleure main de 5 cartes parmi 5 à 7 → un **nombre** comparable (plus grand = meilleur) | `evaluate`, `compareHands` |
| `viewpoint.js` | la table vue depuis un siège (tables en ligne) : sièges tournés, cartes des autres cachées | `rotateEvent`, `viewEvent`, `rotateRequest` |
| `betting.js` | règles No-Limit pour **une** décision : ce qui est légal, relance min / max, vérification d'un montant, raccourcis de relance, montants en BB | `legalActions`, `validateRaise`, `raisePresets`, `quickBets`, `toCall`, `fmtBB`, `parseBB` |
| `showdown.js` | pots principal et secondaires, gagnants, partages, nom de la main en français | `buildPots`, `splitPots`, `handName` |
| `ranges.js` | grille 13 × 13 des 169 mains, combinaisons (1 326), notation `QQ+, ATs+`, statistiques, nettoyage d'une range envoyée par un joueur | `parseRange`, `rangeFromNotation`, `rangeStats`, `cleanRange`, `combos` |
| `PokerGame.js` | **la table entière** : tapis, bouton, blindes, donne, tours d'enchères, abattage | `new PokerGame({ players, startingStack, blinds, onEvent, deck? })`, `playHand()` |

**Comment `PokerGame` parle au reste** : il ne dessine rien. Il **émet des
événements** (`handStart`, `blind`, `deal`, `street`, `turn`, `action`,
`roundEnd`, `win`, `showdown`, `handEnd`, liste complète en tête du fichier) et
**attend** chacun (le front anime, puis la partie continue). Pour chaque
décision, il appelle `agent.decide(request)` du siège : l'agent peut être le
joueur (la barre d'actions), une IA (`PokerBot`) ou, sur le serveur, le
**journal** d'une main à rejouer. L'option `deck` impose l'ordre des cartes :
c'est ce qui permet de rejouer une main à l'identique.

### 2.2 `ai/` — l'IA MCCFR

L'IA joue la stratégie calculée par notre solveur C++ (`../CFR`). Le
travail en JavaScript consiste à **traduire une vraie situation de jeu dans
les termes du solveur**, puis à lire la probabilité de chaque action.

| Fichier | Rôle | Fonctions principales |
|---|---|---|
| `PokerBot.js` | un siège IA : situation → clé → probabilités → action réelle, avec un repli si la situation sort de l'arbre du solveur | `decide(request)` |
| `mccfr/infoset.js` | **LA** chaîne décision → clé, utilisée par le bot **et** par les stats du joueur (un test vérifie qu'elles sont identiques) | `describeInfoset` |
| `mccfr/cardAbstraction.js` | cartes → *bucket* (préflop : 169 buckets, un par type de main ; postflop : EHS → seuils) | `CardAbstraction`, `bucketFromEHS` |
| `mccfr/handStrength.js` | force effective de la main (EHS), **mêmes estimateurs que le C++** (sinon les buckets glissent) | `riverEHS`, `turnEHS`, `flopEHS`, `ehs` |
| `mccfr/bettingTree.js` | les tailles de mise du solveur, nœud par nœud (miroir exact de `betting.cpp`) | `sizeTo`, `AbstractHand`, `replayHistory`, `BETTING_ID` |
| `mccfr/historyTranslator.js` | vraies mises → historique abstrait tête-à-tête (taille du solveur la plus proche, en échelle log) | `toAbstract`, `mapRaise` |
| `mccfr/infosetKey.js` | clé 64 bits identique au C++ : `[tour · joueur · bucket · profondeur · FNV-1a(historique)]` (en `BigInt`) | `packInfoSetKey`, `historyString`, `hashHistory` |
| `mccfr/StrategyTable.js` | lecture de `strategy.bin` (49 Mo : clés triées + probabilités sur 1 octet), recherche par dichotomie | `StrategyTable`, `packStrategy` |
| `mccfr/historyWords.js` | un historique `'2c/c3///'` en français lisible | `describeHistory` |
| `preflopRanges.js` | les **vraies** ranges préflop de l'IA, lues dans la stratégie (tableau des ranges) | `solverPreflopRange`, `SOLVER_SPOTS` |

Pourquoi les clés sont en `BigInt` et stockées en texte : elles dépassent
2^53, la limite des nombres exacts en JavaScript et du `bigint` signé de
PostgreSQL.

### 2.3 `stats/` — ce que le serveur fait des mains jouées

| Fichier | Rôle | Fonctions principales |
|---|---|---|
| `handLog.js` | le **journal** d'une main envoyé par le navigateur : les cartes et les décisions, **jamais les résultats** | `HandLogger` |
| `replay.js` | le serveur **rejoue** le journal avec `PokerGame` depuis **son** état ; coup illégal, carte en double ou coup manquant → refus | `replayHand`, `ReplayError` |
| `handRecord.js` | tout ce qui s'est passé dans la main, pour la base (coups, résultats par siège, stats du joueur) | `HandRecorder` |
| `achievements.js` | les 12 succès et leur condition (le serveur les débloque, le front les affiche) | `ACHIEVEMENTS`, `newlyUnlocked` |
| `playerInfosets.js` | les décisions du joueur classées sous les clés du solveur ; écart joueur / solveur | `playerInfosets`, `foldCallRaise`, `strategyGap` |
| `rangeAnalysis.js` | la range **vraiment jouée** (première décision préflop), erreurs nettes, plus grosses pertes | `analyseHands` |
| `savedHand.js` | une main lue en base → les entrées de `replayHand` (pour reconstruire les données dérivées) | `replayInputs` |

### 2.4 `theory/` — le modèle pédagogique préflop

| Fichier | Rôle |
|---|---|
| `equityMatrix.js` | équité préflop main contre main, main contre range (table 169 × 169 faite par `npm run ai:equity`) |
| `huRanges.js` | ranges de référence en tête-à-tête (arrondies, pour enseigner) |
| `preflopModel.js` | ce que vaut chaque action préflop, en BB, face à ces ranges : un modèle **simple et explicable**, affiché dans « Mon historique » |

### 2.5 `auth/rules.js`

Les règles d'un compte (longueurs, caractères permis) et leurs messages en
français. **Pourquoi partagé** : le front s'en sert pour afficher l'erreur
tout de suite sous le bon champ ; le serveur construit ses JSON Schemas à
partir des mêmes nombres, et c'est **sa** vérification qui compte.

---

## 3. `server/` — le back-end

Node + Fastify 5 + Prisma 6 + PostgreSQL 17 (Docker).

### 3.1 Démarrage

| Fichier | Rôle |
|---|---|
| `src/index.js` | lance le serveur (port 3100) |
| `src/app.js` | `buildApp()` construit l'application **sans ouvrir de port** : les tests l'utilisent directement (`app.inject`) |
| `src/config.js` | lit le `.env` une fois ; une valeur obligatoire manquante arrête le serveur tout de suite |
| `src/ai/solverData.js` | lit les fichiers du solveur une seule fois, à la demande (buckets, `strategy.bin`) et calcule la **version d'abstraction** |
| `src/ai/preflop.js` · `schemas.js` · `routes.js` | `GET /api/ai/preflop` : les 3 ranges préflop de l'IA et les équités, calculées ici pour le tableau des ranges (la stratégie ne part pas au navigateur) |
| `prisma/schema.prisma` | les tables : `User`, `Session`, `Game`, `Hand`, `Action`, `UserAchievement`, `PlayerInfoset`, `SavedRange` |

### 3.2 `auth/` — les comptes

| Fichier | Rôle |
|---|---|
| `password.js` | hachage **Argon2id** (+ poivre optionnel). Le mot de passe n'est jamais stocké ni écrit dans les logs |
| `sessions.js` | connexion = jeton aléatoire de 32 octets dans un cookie `httpOnly` ; seul son **SHA-256** est en base |
| `guard.js` | `requireUser` : une route réservée aux joueurs connectés répond `401` sans session |
| `schemas.js` | ce que les routes acceptent **et renvoient** (le hash ne peut pas fuiter dans une réponse) |
| `routes.js` | `POST /register`, `/login`, `/logout`, `GET /me` ; 10 essais par minute et par IP |

### 3.3 `games/` — les parties enregistrées

| Fichier | Rôle |
|---|---|
| `schemas.js` | forme des requêtes (nouvelle partie, journal d'une main) |
| `service.js` | `saveHand()` : 1) rejouer le journal (`shared/stats/replay.js`) ; 2) en **une transaction**, avancer l'état de la partie, enregistrer la main et chaque coup ; 3) débloquer les succès. Aussi `startGame`, `quitGame` |
| `routes.js` | `POST /api/games`, `POST /api/games/:id/hands` (`422` si refusé, `409` si déjà enregistrée), `POST /:id/quit`, `GET /api/games` (liste), `GET /api/games/:id` (une partie et ses mains) |

### 3.4 `stats/` — les statistiques

| Fichier | Rôle |
|---|---|
| `totals.js` | les totaux du joueur, une requête SQL chacun (`COUNT(*) FILTER`) |
| `dashboard.js` | chiffres du tableau de bord, tous lus sur **le même** ensemble filtré (`filteredHands`), en BB |
| `exportCsv.js` | les mains en CSV (BOM UTF-8, formules neutralisées contre l'injection CSV) |
| `liveFeed.js` | temps réel (SSE) : prévient le tableau de bord à chaque main enregistrée |
| `infosets.js` | après chaque main, compte les décisions du joueur par clé du solveur |
| `rebuildInfosets.js` | reconstruit `PlayerInfoset` depuis l'historique (après un nouvel entraînement) |
| `solverReport.js` | le joueur comparé au solveur, situation par situation |
| `schemas.js` | les filtres (période, niveau, nombre d'IA, fuseau horaire) |
| `routes.js` | `/api/stats/me`, `/solver`, `/range`, `/dashboard`, `/export.csv`, `/live`, `/api/leaderboard` |

### 3.5 `ranges/` — les ranges enregistrées

`schemas.js` (forme), `service.js` (chaque joueur ne voit que les siennes,
nom unique, 50 au maximum, contenu vérifié par `cleanRange()`), `routes.js`
(`GET / POST / PUT / DELETE /api/ranges`).

### 3.6 `table/` — la table autoritaire WebSocket

Le navigateur ne possède pas le moteur dans ce mode : la session serveur crée
`PokerGame`, donne les sièges IA à `PokerBot` et attend les actions humaines
sur `/ws/table`. Les cartes de l'IA et la stratégie MCCFR restent côté serveur.

| Fichier | Rôle |
|---|---|
| `PROTOCOL.md` | contrat versionné des messages WebSocket, des séquences et des données privées |
| `routes.js` | authentifie la connexion, vérifie Origin/taille/débit et transmet les messages |
| `registry.js` | conserve les tables pendant la fenêtre de reconnexion et rattache une nouvelle socket |
| `session.js` | possède le moteur, valide les actions, filtre/rejoue les événements, enregistre les mains et enchaîne les parties |
| `humanAgent.js` | adapte `agent.decide(request)` à une réponse WebSocket du joueur |
| `shared.js` | **table partagée** du mode en ligne : code, hôte, salle d'attente, 2 à 5 humains + IA, un chrono par joueur, mains enregistrées pour chacun |
| `channel.js` | le flux privé d'un joueur d'une table partagée (séquences, reprise) |

La table solo : un humain contre une ou plusieurs IA. La table partagée : plusieurs
humains (créer, rejoindre par code ou invitation, l'hôte lance). Chaque joueur reçoit
la table **tournée vers lui** (`src/shared/poker/viewpoint.js`) : il est toujours le
siège 0, si bien que le navigateur, l'enregistreur et les stats ne changent pas.

### 3.6 bis `friends/` et `lobby/` — amis, présence, invitations

| Fichier | Rôle |
|---|---|
| `friends/service.js` | la table `Friendship` : lister les amis, les demandes, chercher par code ami ou pseudo, demander (une demande croisée devient une amitié), accepter, refuser, retirer |
| `friends/presence.js` | qui est **en ligne** (flux `GET /api/friends/live` ouvert), **en partie** (table serveur), sinon « vu il y a… » (`User.lastSeenAt`) ; pousse `friends` / `invitations` aux pages ouvertes |
| `friends/schemas.js` · `friends/routes.js` | forme des requêtes et réponses (jamais d'email) · `/api/friends/*` |
| `lobby/service.js` | la table `TableInvitation` : inviter un ami en ligne (une par paire, 30 min), lister, refuser |
| `lobby/schemas.js` · `lobby/routes.js` | `/api/lobby/invitations` |

Trajet d'une invitation : « 🎲 Inviter » (`ui/friends/tabs/friendsTab.js`) → `POST /api/lobby/invitations`
→ `presence.notify(ami, 'invitations')` → le flux de l'ami (`net/socialLive.js`) → `lobby:changed`
→ sa carte « Table en ligne · 1 » (`StartCards.setInvites`) et son panneau `ui/online/`.

### 3.7 Tests

`server/tests/` : chaque fichier tourne contre la **vraie** base, crée ses
comptes `…@test.invalid` et les supprime à la fin. `helpers.mjs` fournit une
application de test, des joueurs connectés et des parties jouées au hasard.

---

## 4. `src/front/` — l'affichage

### 4.1 Démarrage : `main.js`

Démarre dans l'ordre : moteur 3D, lumières, chargement des modèles → la salle
(table, chaises, lampes, croupier) → la carte « Nouvelle partie » → les pièces
du jeu (cartes, jetons, barre d'actions, `TableController`, `RemoteGame`) →
caméra, menus, souris → boucle de rendu. Il relie aussi l'accueil, la
connexion et les événements de fenêtre (`game:start`, `game:pause`,
`game:resume`, `game:quit`, `ranges:open`).

### 4.2 `game/` — le pont entre la règle et l'écran

| Fichier | Rôle |
|---|---|
| `TableController.js` | transforme **chaque événement** en animation et l'attend ; utilise le moteur local ou `RemoteGame` selon le mode |
| `GameRecorder.js` | parties locales seulement : envoie le journal de chaque main au serveur, une à la fois, dans l'ordre |

`src/front/net/RemoteGame.js` est l'adaptateur du mode serveur : WebSocket,
événements publics, demandes d'action et fin de main. Il ne contient aucune
règle de poker.

### 4.3 `render/`, `camera/`, `input/` — la 3D de base

| Fichier | Rôle |
|---|---|
| `render/Engine.js` | moteur de rendu, caméra, scène, redimensionnement, boucle d'animation |
| `render/Lighting.js` | les lumières de la salle |
| `render/AssetLoader.js` | charge modèles et textures une seule fois (cache par clé) |
| `render/ToonStyle.js` | le rendu cartoon : matériaux toon et contours noirs, appliqués à chaque nouvel objet (`?realiste` le coupe) |
| `camera/CameraController.js` | orbite de la souris et ses limites selon le mode : `overview` (menus), `seat` (en partie), `fixed` (gros plans) |
| `camera/CameraMoves.js` | les transitions animées : vers le siège, gros plan sur des cartes, vue du croupier |
| `input/TableInput.js` | le carrefour des clics et du survol : carte de départ, gros plans, retour au siège, Échap |
| `input/CardPicker.js` | quel objet 3D est sous la souris (lancer de rayon) |

### 4.4 `scene/` — ce qu'on voit dans la salle

| Dossier / fichier | Rôle |
|---|---|
| `room/` | `Room` (sol, murs, plafond), `Table`, `Chairs`, `Lamps`, `DustParticles` |
| `dealer/Dealer.js` | le croupier cowboy : assis, respire, lance les cartes (`release`), tire en l'air quand quelqu'un fait tapis (`celebrate`) |
| `dealer/revolver.js` | les revolvers : chargement, fixation dans le poing, éclair au canon |
| `dealer/crates.js` | les deux caisses de whisky sur lesquelles il est assis |
| `dealer/Gunshot.js` | le bruit du coup de feu, fabriqué avec Web Audio (pas de fichier son) |
| `opponents/Opponents.js` | les IA assises sur leur chaise, et leurs petites réactions (hochement, tête basse…) |
| `opponents/characters.js` | l'apparence de chaque adversaire |
| `cards/Card.js` | une carte 3D ; `CardTextures.js` : faces SVG converties à la demande |
| `cards/TableCards.js` | les cartes sur le tapis : paquet, mains, board, défausse (**elle ne mélange rien**, elle reçoit les cartes) |
| `chips/ChipModel.js` | un jeton 3D par valeur ; `chipStacks.js` : un montant → des jetons exacts |
| `chips/TableChips.js` | tapis, mises et pot toujours égaux aux vrais montants, avec leurs étiquettes ; `labelStyles.js` : le CSS de ces étiquettes |
| `start/` | la carte « Nouvelle partie » posée devant le croupier |
| `seatLayout.js` | **source unique** des positions : où vont les cartes, les jetons et la chaise de chaque siège |

### 4.5 `ui/` — les menus

| Dossier / fichier | Rôle |
|---|---|
| `theme/saloon.css` | le style commun « bois et cuir » : `.wood-panel`, `.wood-sign`, `.leather`, `.wood-btn`… |
| `WelcomeScreen.js` | le premier écran (titre, commandes, « Entrer dans la salle ») |
| `auth/` | `AuthScreen` : connexion / inscription / « Jouer sans compte » ; `styles` |
| `UserBadge.js` | en haut à droite : pseudo, 📖 Ranges, 👥 Amis (● amis en ligne), 📊 Mes stats, déconnexion |
| `online/` | ✉️ « Table en ligne » : le panneau derrière la carte d'invitation (code ami, invitations, créer une table, rejoindre par code) et `WaitingRoom` (salle d'attente d'une table partagée) |
| `friends/` | 👥 « Mes amis » : `FriendsMenu` + un fichier par onglet (`tabs/` : amis, demandes, ajouter) ; données de `net/friendsApi.js` (**fausses** en attendant le serveur) |
| `newGame/` | `NewGameMenu` : nombre d'IA, niveau, tapis, blindes ; `styles` |
| `actionBar/ActionBar.js` | la barre du bas : situation (pot, à suivre, tapis) et les trois boutons, message de fin de main. `ask(state)` renvoie une promesse résolue avec l'action du joueur |
| `actionBar/RaisePanel.js` | le panneau de relance : champ, curseur, raccourcis, **vérification à chaque frappe** (`validateRaise`), bouton désactivé tant que le montant est illégal |
| `pause/PauseMenu.js` | le bouton ☰ et la fenêtre de pause (Reprendre, Ranges, Options, Quitter) |
| `pause/OptionsPanel.js` | une ligne de boutons par option de `config/preferences.js`, et leurs raccourcis clavier |
| `preferences.js` | valeurs des options, gardées dans le navigateur (`getPref`, `setPref`, `onPrefChange`) |
| `chipUnit.js` | option « Montants » : `money()` écrit un montant en jetons ou en BB (affichage seulement) |
| `AchievementToast.js` | la plaque « Succès débloqué ! » |
| `AiDebugPanel.js` | `npm run debug_ia` : toutes les cartes et chaque décision des IA, en très gros |
| `overlay/` | la fenêtre des menus posée sur la table (fond assombri, panneau, fondus) |
| `stats/` | « Mon carnet » : voir 4.6 |
| `ranges/` | le tableau des ranges : voir 4.7 |

### 4.6 `ui/stats/` — « Mon carnet »

`StatsMenu.js` n'est **que** la fenêtre et le passage d'un onglet à l'autre.
Un onglet est un objet `{ id, label, wide?, open(view), close?() }` ;
`open()` reçoit `view = { body, get, load }` et renvoie du HTML (ou
`{ html, bind }`). `close()` sert au tableau de bord pour couper son flux
temps réel.

| Fichier | Rôle |
|---|---|
| `tabs/totalsTab.js` | Statistiques (tuiles) |
| `tabs/dashboardTab.js` + `dashboard/` | Tableau de bord : `Dashboard` (l'onglet), `charts` (Chart.js), `filters` (période, niveau, nombre d'IA), `pdfExport`, `styles` |
| `tabs/historyTab.js` + `tabs/handHtml.js` | Historique : parties → mains → coups racontés en français |
| `tabs/achievementsTab.js` | Succès |
| `tabs/solverTab.js` | Face au solveur (+ `pdf/solverPdf.js` pour l'export) |
| `tabs/leaderboardTab.js` | Classement |
| `pdf/pdfPage.js` | la page PDF commune aux deux exports (jsPDF chargé seulement au clic) |
| `format.js`, `styles.js` | petites aides partagées (`esc`, cartes, tuiles) et CSS |

### 4.7 `ui/ranges/` — le tableau des ranges

| Fichier | Rôle |
|---|---|
| `RangeScreen.js` | la fenêtre, les onglets, la case épinglée (📌) |
| `RangeGrid.js` | la grille 13 × 13 : dessin, sélection, peinture |
| `ExploreMode.js` | 🔍 ranges d'exemple, leçons, vraies ranges de l'IA |
| `aiRanges.js` | charge une fois les ranges de l'IA calculées par le serveur (`GET /api/ai/preflop`) |
| `BuildMode.js` + `Brush.js` + `draftStore.js` | 🖌️ peindre une range (pure ou mélangée), brouillon dans le navigateur, enregistrement sur le compte |
| `HistoryMode.js` + `historyHtml.js` + `theoryData.js` + `theoryHtml.js` | 📜 la range vraiment jouée, les erreurs, les pertes, la comparaison avec le modèle théorique |
| `html.js`, `styles.js` | morceaux de HTML partagés, CSS |

### 4.8 `net/` — parler au serveur

| Fichier | Rôle |
|---|---|
| `request.js` | **un** `fetch()` qui ne lève jamais d'erreur : `{ ok, status, data, error? }` avec un message en français |
| `authApi.js`, `gamesApi.js`, `rangesApi.js` | une fonction par route |
| `statsLive.js` | l'`EventSource` du temps réel (`/api/stats/live`) |

### 4.9 `config/` — les réglages modifiables

`newGameOptions.js` (niveaux, tapis, blindes, noms des IA),
`preferences.js` (ajouter une option = ajouter une entrée),
`rangePresets.js` (ajouter une range d'exemple = ajouter une entrée).

---

## 5. Le trajet d'une main, de bout en bout

1. Le joueur clique sur la carte « Nouvelle partie » → `NewGameMenu` envoie
   `game:start` → `TableController` crée `RemoteGame` en mode normal ; le
   serveur ouvre `Game` si le joueur est connecté. `debug_ia` garde le moteur local.
2. Le serveur exécute `PokerGame.playHand()`, mélange, donne et émet `deal` → `RemoteGame`,
   `TableCards` et le
   croupier animent la donne.
3. C'est au tour d'une IA côté serveur → `PokerBot.decide()` : bucket des cartes, historique
   traduit dans l'arbre du solveur, clé, probabilités lues dans `strategy.bin`,
   tirage d'une action, montant réel.
4. C'est au tour du joueur → `ActionBar.ask()` ; `RaisePanel` vérifie le
   montant avec `validateRaise()` (la même règle que le moteur).
5. Chaque action émet `action` → `TableChips` déplace les jetons ; `HandRecorder`
   note la décision côté serveur.
6. Fin de main (`handEnd`) → `TableSession` enregistre directement `Hand` et
   chaque `Action`, classe les décisions sous `PlayerInfoset`, débloque les succès
   et prévient le tableau de bord (SSE).
7. Le message WebSocket contient les nouveaux succès → `AchievementToast`.

Le mode normal mélange et enregistre côté serveur. Le chemin local de
`debug_ia` et son rejeu HTTP restent des outils de développement et de
compatibilité.

---

## 6. Où ajouter quoi

| Je veux… | Je touche… |
|---|---|
| une option du joueur | une entrée dans `src/front/config/preferences.js` |
| une range d'exemple | une entrée dans `src/front/config/rangePresets.js` |
| un succès | `src/shared/stats/achievements.js` (serveur et front le voient) |
| un onglet dans « Mon carnet » | un fichier dans `ui/stats/tabs/` + une ligne dans `TABS` de `StatsMenu.js` |
| une route | `schemas.js` + `service.js` + `routes.js` du service, puis l'enregistrer dans `server/src/app.js` |
| une colonne en base | `server/prisma/schema.prisma`, puis `npm --prefix server run db:migrate -- --name xxx` |
| une règle du poker | `src/shared/poker/` + un test dans `tests/` (elle vaut alors pour le jeu **et** le rejeu) |
