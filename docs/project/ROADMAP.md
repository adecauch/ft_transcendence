# Roadmap — ft_transcendence : Poker Transcendence

Objectif : **14 points** de modules requis ; **22 visés** (8 de marge), **avec un mode en ligne**
(décidé le 11/10/2026) : il sécurise le module 2 (« des joueurs qui jouent les uns contre
les autres ») et apporte Remote players, Multiplayer 3+ et Real-time features (+6, acquis).
L'IA adverse repose sur un **MCCFR écrit en C++**.

Légende : ✅ fait · 🟡 en cours · 🔴 à faire · `[x]` fait · `[~]` en partie · `[ ]` à faire

Dernière mise à jour : 12 octobre 2026.

---

## 1. Partie obligatoire (éliminatoire — à faire en premier)

Sans elle, le projet est refusé, quel que soit le nombre de points.

- [x] Back-end + base de données (PostgreSQL), schéma clair avec relations — `server/` (Fastify + Prisma) :
      `User`, `Session`, `Game` → `Hand` → `Action`, `UserAchievement`, `PlayerInfoset`, `SavedRange`, `Friendship`,
      `TableInvitation` (10 tables) ; 6 migrations versionnées, écrites à la main
- [x] Inscription / connexion par email + mot de passe (hashé et salé) — Argon2id + sel + poivre optionnel, sessions en cookie httpOnly, écran au style saloon (`server/README.md`)
- [x] Compose avec Podman : tout se lance en **une seule commande** (`make up`) — `db`, `server`, `nginx`
- [x] HTTPS pour toute connexion depuis le navigateur (nginx + certificat de développement, WebSockets compris) ; le cookie passe en `secure` avec `NODE_ENV=production`
- [x] Plusieurs utilisateurs connectés en même temps, sans conflit ni corruption de données — sessions par joueur, données filtrées par compte, transaction + garde de concurrence sur l'enregistrement des mains ; testé à plusieurs : tables partagées (2 et 3 joueurs + IA, tests serveur) et deux navigateurs réels (Bot0 / Bot1), mains enregistrées pour chacun sans conflit
- [~] Validation de tous les formulaires côté front **et** côté back — connexion / inscription (règles partagées `src/shared/auth/rules.js`), ranges enregistrées (`cleanRange`), actions de jeu (vérifiées par la table serveur), amis (recherche, demandes), code de table, réglages d'une table en ligne (`checkedSharedConfig`) ; reste le menu « Nouvelle partie » côté front et les futurs formulaires (profil…)
- [ ] Framework CSS (ex. Tailwind) — **à décider** : tout le style passe aujourd'hui par `saloon.css` (fait main)
- [x] `.env` ignoré par git + `.env.example` fourni
- [ ] Pages **Politique de confidentialité** et **Conditions d'utilisation** (contenu réel, liens dans le pied de page)
- [~] Aucune erreur ni warning dans la console de Chrome — `/me` ne renvoie plus de 401 ; **à trancher** : le `401` d'un mauvais mot de passe s'affiche en rouge
- [ ] README **en anglais** au format imposé (rôles, organisation, stack, schéma BDD, modules, contributions, usage de l'IA)
- [ ] Commits de **chaque membre** de l'équipe

---

## 2. Modules

| # | Module | Catégorie | Type | Pts | État | Fait / À faire |
|---|--------|-----------|------|-----|------|----------------|
| 1 | Graphismes 3D avancés | Gaming | Majeur | 2 | ✅ | Saloon 3D cartoon (toon + contours), cartes et jetons 3D, croupier et adversaires animés, caméra (regard ±30°, gros plans) |
| 2 | Jeu web complet | Gaming | Majeur | 2 | 🟡 | **Fait** : Hold'em No-Limit contre 1 à 4 IA, évaluation des mains, abattage, pots secondaires, enchaînement des mains, et **des joueurs les uns contre les autres** en ligne (tables partagées, exigence du sujet). **Reste** : vérifier avec l'équipe si le mode local (même écran) est encore utile |
| 3 | IA adverse (MCCFR en C++) | IA | Majeur | 2 | 🟡 | **Fait** : solveur entraîné hors ligne (50 M itérations), stratégie compactée (`strategy.bin`) lue par l'IA (clés identiques au C++), tailles de mise du solveur + tapis intégrés. L'IA est **jouée par le serveur** (la stratégie ne part plus au navigateur). **Reste** : plus d'itérations pour les nœuds rares (tapis), 3 niveaux réels (`USE_LEVELS`) |
| 4 | Tableau de bord statistique | Data & Analytics | Majeur | 2 | ✅ | Onglet « Tableau de bord » de Mon carnet : graphiques interactifs Chart.js (courbe de gains, résultat par jour, VPIP / PFR dans le temps, BB/100 par niveau d'IA, position, nombre d'IA, actions par tour), filtres période + niveau + nombre d'IA, export CSV (serveur) et PDF (jsPDF), mise à jour en temps réel (SSE) — `server/STATS.md` §7 quater |
| 5 | Gestion utilisateurs standard | User Management | Majeur | 2 | 🟡 | **Fait** : amis (demandes, code ami `Pseudo#1234`) + **statut en ligne / en partie / hors ligne** en direct (`server/src/friends/`). **Reste** : profil modifiable, avatar (défaut si aucun), page de profil |
| 6 | Stats et historique des parties | User Management | Mineur | 1 | ✅ | Historique coup par coup (rejoué et vérifié par le serveur), stats, 12 succès, classement, range vraiment jouée + erreurs, comparaison au solveur — `server/STATS.md` |
| 7 | Personnalisation du jeu | Gaming | Mineur | 1 | 🟡 | **Fait** : menu « Nouvelle partie » (adversaires, niveaux, tapis, blinds), page **Options** du menu pause (montants en jetons ou en BB, extensible). **Reste** : 1–2 thèmes de table (une ligne de plus dans Options) |
| 8 | Framework back-end | Web | Mineur | 1 | ✅ | Fastify : comptes, parties, stats, classement, ranges, amis, invitations, tables WebSocket — validation JSON Schema (requêtes et réponses), limites d'essais, 41 tests d'intégration |
| 9 | ORM | Web | Mineur | 1 | ✅ | Prisma : 10 tables, relations, migrations versionnées (écrites à la main), transactions |
| 10 | OAuth 42 | User Management | Mineur | 1 | 🔴 | Connexion avec le compte 42 (`passwordHash` peut déjà être vide pour ces comptes) |
| 11 | Gamification | Gaming | Mineur | 1 | 🟡 | **Fait** : 12 succès persistés + annonce en jeu, classement. **Reste** : XP / niveaux |
| 12 | Temps réel (WebSockets) | Web | Majeur | 2 | ✅ | Tables en WebSocket (solo et partagées : diffusion à chaque joueur de **sa** vue, reconnexion par jeton, chrono, messages gardés pendant l'ouverture), présence des amis et invitations en direct (SSE), tableau de bord en direct |
| 13 | Remote players | Gaming | Majeur | 2 | ✅ | Deux joueurs sur deux ordinateurs, en temps réel : table partagée (créer, rejoindre par invitation ou code, salle d'attente), coupures et reprise par jeton, chrono par tour, départ en cours de partie géré. **À montrer** en soutenance avec deux machines |
| 14 | Multiplayer 3+ | Gaming | Majeur | 2 | ✅ | Une table partagée accepte 2 à 5 joueurs (humains et IA), chacun ne voit que ses cartes, synchronisée par le serveur (testé à 3 humains + 1 IA) |
| | **Total visé** | | | **22** | | **Acquis : 13** (1, 4, 6, 8, 9, 12, 13, 14) · **en cours : 9** (2, 3, 5, 7, 11) |

> Marge : 22 visés pour 14 requis. Si besoin d'alléger : retirer la **Gamification (11)** et
> la **Personnalisation (7)**. Plus tard, peu coûteux une fois les tables partagées faites :
> **Spectator mode** (mineur, 1 pt) ; avec un chat, **User interaction** (majeur, 2 pts).

### Dépendances

```
Module 2 (jeu complet) ──► 3 (IA), 6 (stats), 7 (personnalisation), 11 (gamification)
                            6 (stats) ──► 4 (tableau de bord), 11 (gamification)
Module 8 (back-end) + BDD ──► 5 (utilisateurs), 9 (ORM), 10 (OAuth), 6 (stats)
Module 12 (temps réel) + 5 (amis) ──► 13 (remote players) ──► 14 (multiplayer 3+) ──► spectateurs
```

### Répartition

- **Antoine** (DevOps) : Compose Podman complet (`server`, `nginx`) + HTTPS de développement, table serveur WebSocket (première version).
- **Hector** : le reste (jeu, IA, back-end applicatif, stats).

---

## 3. Phases

### Phase 1 — Socle (obligatoire)
- [x] Compose Podman : nginx (HTTPS) + back-end Fastify + PostgreSQL — certificat auto-signé local, redirection HTTP → HTTPS
- [x] Prisma (ORM) + schéma : utilisateurs, sessions, parties, mains, actions
- [x] Authentification email / mot de passe, validation front + back
- [~] Pages légales, `.env.example` (fait), framework CSS (à décider)

### Phase 2 — Le jeu
- [x] Moteur de poker : évaluation des mains, abattage, pots secondaires, attribution du pot (`src/shared/poker/`, logique pure prête pour le serveur)
- [x] Front branché sur ce moteur (barre d'actions, jetons, cartes, croupier, adversaires)
- [x] Enregistrer chaque main en base (joueurs, actions, montants, gagnants), rejouée et vérifiée par le serveur
- [ ] Mode local à plusieurs : tour par tour sur le même écran, écran de passage qui cache les cartes
- [x] Moteur côté serveur : le serveur mélange, distribue et joue l'IA (`server/src/table/`), le navigateur n'affiche que sa vue — fin de la dernière faille anti-triche (le chemin local ne reste que pour `debug_ia`)

### Phase 3 — L'IA
- [x] MCCFR en C++ sur un jeu simplifié (mains regroupées par force, tailles de mise limitées)
- [x] Entraînement hors ligne → stratégie exportée en table (`strategy.txt`), lue par l'IA
- [x] Décisions du joueur classées sous les mêmes clés (`PlayerInfoset`) et comparées au solveur
- [x] Action tapis + tailles de mise du solveur (préflop 2,5 BB / ×3 / ×2,5, postflop ⅓ ½ ⅔ pot, relance ×3), réentraînement, arbre JS = C++ vérifié par test
- [x] Banc d'essai contre Slumbot (déplacé dans `../CFR/tests/slumbot/`, `make slumbot` ; résultats par stratégie en mbb/main ± marge)
- [ ] Plus d'itérations pour les nœuds rares (le solveur ne pousse jamais tapis préflop, ne paie un tapis qu'avec 88+)
- [ ] Niveaux Débutant / Confirmé / Expert réellement différents (`USE_LEVELS`)
- [x] IA servie par le back-end (table serveur) ; ses 3 ranges préflop pour l'Explorer : `GET /api/ai/preflop`
- [ ] Vérifier qu'elle s'adapte aux réglages (tapis, blinds, nombre d'adversaires) ; `debug_ia` charge encore la stratégie dans le navigateur (elle n'y est plus : l'IA y joue sa règle de secours)
- [ ] Plus tard : recherche en temps réel façon Pluribus par-dessus la stratégie

### Phase 4 — Utilisateurs & données
- [x] Amis + statut en ligne (voir Phase 4 ter)
- [ ] Profil modifiable, avatar, page de profil (reste du module 5), OAuth 42 (module 10)
- [x] Stats + historique des parties + classement
- [x] Tableau de bord : courbe de gains, VPIP / PFR dans le temps, résultats par niveau d'IA, export CSV / PDF, filtres, temps réel
- [~] Gamification : succès et classement faits, XP / niveaux à faire

### Phase 4 ter — Mode en ligne (décidé le 11/10/2026)
- [x] Code ami `Pseudo#1234` (pseudo non unique)
- [x] Amis : demandes, acceptation, retrait, recherche — `server/src/friends/`
- [x] Présence en direct : en ligne / en partie / hors ligne (SSE) — `friends/presence.js`
- [x] Invitations à une table, reçues en direct — `server/src/lobby/`, carte « Table en ligne » sur la table
- [x] Tables partagées : créer, rejoindre (invitation ou code), salle d'attente, 2 à 5 joueurs humains + IA,
      un chrono par joueur, reconnexion, chaque joueur ne voit que ses cartes, mains enregistrées pour chacun
      (`server/src/table/shared.js`, `src/shared/poker/viewpoint.js`)
- [ ] Spectateurs (mineur, 1 pt) : un siège « spectateur » qui reçoit la vue publique de la table
- [ ] Chat simple (avec le profil : module User interaction, 2 pts)
- [ ] À durcir : nombre de tables ouvertes par joueur, tables en mémoire (un redémarrage les ferme),
      salon public / matchmaking (hors périmètre : on rejoint par invitation ou par code)

### Phase 4 bis — Analyse du jeu du joueur (discuté le 28/09, pas commencé)

But : pousser le joueur vers le **GTO**, pas vers une adaptation au bot. Aujourd'hui,
trois écrans analysent son jeu avec **deux références différentes** :

| Écran | Référence |
|---|---|
| Mon carnet → « Face au solveur » (`PlayerInfoset`) | `analysis.bin` s'il existe (stratégie d'analyse), sinon `strategy.bin` (celle du bot) |
| Tableau des ranges → Explorer, « vraies ranges de l'IA » | la stratégie du serveur (`GET /api/ai/preflop`) |
| Tableau des ranges → Mon historique, « range théorique » + manque à gagner | **pas le solveur** : modèle simplifié (`shared/theory/preflopModel.js` : équités 169 × 169 + ranges écrites à la main, pas de jeu postflop) |

- [ ] **Mon historique** : afficher la range **du solveur** dans la mini-grille (incohérence
      actuelle : « théorie » ≠ solveur) ; garder le manque à gagner en BB du modèle simplifié
      (le solveur ne donne que des fréquences, pas la valeur de chaque action), en le disant clairement
- [ ] **Tailles de mise** : compter chaque taille à part dans `PlayerInfoset` (aujourd'hui fold / call / raise,
      tailles additionnées) — migration + `db:rebuild-infosets` (`Action` reste la source de vérité :
      `betTo`, `potAfter` donnent la vraie taille jouée)
- [ ] **Conseils de sizing** dans « Face au solveur » : ta taille réelle, la plus proche du solveur,
      ce qu'il choisit dans la situation ; habitudes globales (taille moyenne au flop, taille selon la force
      de la main, mises lisibles)
- [ ] **Solveur d'analyse séparé** (même C++ `../CFR` ; `npm run ai:analysis` existe déjà) : plus de tailles (préflop 2 / 2,5 / 3 BB,
      3-bet ×3 / ×4 ; postflop 25 / 33 / 50 / 75 / 100 / 150 % du pot) et plus d'itérations, lu **seulement
      par le serveur** (pas de limite de poids du navigateur) ; le bot garde sa petite stratégie.
      Condition pour dire « 3 BB au lieu de 2 » : une référence qui a **comparé** les deux tailles

Limites à garder en tête : postflop, les mains sont regroupées en 50 catégories (buckets) → le conseil
vaut pour une catégorie, pas une main exacte ; une situation précise revient rarement → les habitudes
globales deviennent fiables bien avant le détail par situation.

### Phase 5 — Finitions
- [x] Page Options (menu pause) : montants en jetons ou en BB (touche B), une option = une entrée de `config/preferences.js`
- [ ] Thèmes de table (personnalisation) : nouvelle ligne dans Options
- [ ] Zéro erreur console, test sous Chrome (le `401` d'un mauvais mot de passe reste à trancher)
- [ ] Attention : si `analysis.bin` existe, le serveur le prend aussi pour l'IA en jeu (`solverData.strategy()`) — séparer les deux si le bot doit garder `strategy.bin`
- [ ] README anglais complet, préparation de la soutenance (chacun doit pouvoir expliquer son code)

---

## 4. Déjà en place

**Jeu (front 3D)**
- Salle de saloon cartoon, table, chaises, suspensions, poussière
- Cartes 3D (faces SVG CC0), jetons 3D reliés aux vrais montants
- Menu « Nouvelle partie » (adversaires, niveaux, tapis, blinds), menu pause + page Options (montants en jetons / BB)
- Barre d'actions Se coucher / Check-Suivre / Relancer avec validation et raccourcis de mise
- Croupier cowboy animé (distribue, tire au plafond sur un tapis), adversaires assis qui réagissent
- Caméra : regard ±30° depuis sa place, gros plan sur sa main ou le board

**Back-end et données** (`server/README.md`, `server/STATS.md`)
- Comptes : Argon2id, sessions, limite d'essais, écran de connexion / inscription, mode invité
- Parties jouées **par le serveur** (WebSocket : il mélange, distribue, joue l'IA, enregistre chaque main) ; le chemin « journal rejoué » reste pour `debug_ia`
- Carnet : statistiques (VPIP, PFR…), historique partie → mains → coups, 12 succès, classement (avec `#tag`), comparaison au solveur
- Pause qui gèle le chrono du tour, compte à rebours, reprise après coupure réseau

**Mode en ligne**
- Code ami `Pseudo#1234`, amis, statut en ligne / en partie / hors ligne en direct, invitations
- Sur la table : paquet « Contre l'IA » et carte d'invitation « Table en ligne · n »
- Tables partagées : créer (IA, tapis, blinds), rejoindre par invitation ou code, salle d'attente, 2 à 5 joueurs ;
  chacun voit la table depuis sa place et ses seules cartes, mains enregistrées pour chacun
- Comptes de démo : `bot0@mail.com` … `bot9@mail.com`, mot de passe `salut123`

**En plus (éducatif, hors barème)**
- Tableau des ranges : Explorer (ranges d'exemple + vraies ranges de l'IA), Construire
  (ranges enregistrées sur le compte), Mon historique (range vraiment jouée, erreurs, pertes) ;
  un clic fixe la case décrite (le survol ne la remplace plus)

**Environnement**
- Deux machines (Linux et macOS), Podman, installation documentée dans `CLAUDE.md` ; une base par machine
  (après un pull : `db:deploy` + `db:generate`, et `server/data/strategy.bin` via `npm run ai:sync`)

**Écarté pour l'instant**
- Quiz des ranges : retiré, pourrait devenir un projet à part
- Supabase / Vercel : non retenus (on a notre PostgreSQL + Prisma ; le rendu 42 tourne dans Podman)
