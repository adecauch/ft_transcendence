# Parties, historique, statistiques, succès, classement

Module 42 n° 6 (« Stats et historique des parties »). Ce document explique
comment les parties et **chaque coup** sont enregistrés, comment on empêche la
triche, et d'où viennent les chiffres affichés. Pour les comptes et la
connexion, voir [`README.md`](README.md).

---

## 1. Vue d'ensemble

```
NAVIGATEUR                         SERVEUR
──────────────────────────────     ─────────────────────────────────────────────
Mode distant : action ──────────►  WebSocket → PokerGame + PokerBot
Mode distant : événements ◄─────  TableSession → HandRecorder → Hand + Action
                                   Game (PLAYING) → succès → PlayerInfoset → SSE
Mode local : GameRecorder ──────►  POST /api/games/:id/hands (ancien chemin, rejeu)
annonce « Succès débloqué ! » ◄──  `{ achievements }` ou message WebSocket
Quitter / déconnexion ──────────►  Game (QUIT) si la partie n'est pas terminée

« 📊 Mes stats »  ── StatsMenu ───────────────────────────►  GET /api/stats/me, /api/games, /api/games/:id,
                                                             /api/leaderboard
```

- **Seuls les joueurs connectés sont enregistrés.** Un invité joue normalement,
  mais rien n'est sauvegardé.
- **Chaque coup est sauvegardé** : blindes, couchers, checks, suivis, mises,
  relances, avec les montants et le pot après chaque coup (table `Action`).
  C'est ce que lit le **tableau de bord** (module 4, section 7 quater) :
  courbe de gains, VPIP et PFR par période, gains par niveau d'IA, etc.

---

## 2. Anti-triche : le serveur possède la partie distante

**Tables partagées (mode en ligne, `table/shared.js`)** : chaque main est
enregistrée **pour chaque joueur**, dans sa propre ligne `Game`, vue depuis sa
place (`src/shared/poker/viewpoint.js` tourne la table pour qu'il soit le siège 0 :
les colonnes `hero…`, les stats, les succès et la comparaison au solveur restent
les mêmes). Les adversaires humains y ont le niveau `human`. Un joueur éliminé
n'a plus de mains enregistrées ; un départ en cours de partie la passe à `QUIT`.

Dans le mode distant, le navigateur ne dit jamais au serveur qui a gagné, ne
possède pas le paquet et n'envoie aucun journal de main. `PokerGame` tourne sur
le serveur et `TableSession` enregistre directement ses événements avec
`HandRecorder`. Le journal HTTP décrit plus bas reste le chemin historique du
mode local.

```js
{
  handNo: 3,
  hole:  [['AS','KD'], ['7H','7C']],         // cartes de chaque siège (null = éliminé)
  board: ['2S','9D','TC','QH'],              // 0, 3, 4 ou 5 cartes
  actions: [                                 // blindes non comprises
    { seat: 1, street: 0, type: 'raise', to: 60 },
    { seat: 0, street: 0, type: 'call' },
    { seat: 0, street: 1, type: 'check' },
  ],
}
```

Le serveur **rejoue** la main avec le **même moteur** que le jeu
(`src/shared/stats/replay.js` → `PokerGame`), en partant de **son propre état** :
les tapis et le bouton qu'il a enregistrés après la main précédente. Il refuse
la main (`422 Main refusée : …`) si :

- ce n'est pas la main suivante (numéro) ;
- une carte est inconnue, apparaît deux fois, ou le board n'a pas le bon nombre de cartes ;
- un coup n'est pas joué par le siège dont c'est le tour, ou sur le mauvais tour d'enchères ;
- un coup est illégal à ce moment-là : checker face à une mise, relancer en
  dehors du minimum et du maximum, suivre alors qu'il n'y a rien à suivre
  (mêmes règles que la barre d'actions : `src/shared/poker/betting.js`) ;
- il manque un coup, ou il y en a en trop.

Les **tapis, le pot, les gagnants et les pots secondaires** viennent du rejeu,
jamais du navigateur. Donc un joueur ne peut pas s'inventer des jetons ni des
victoires au classement.

Le mode distant mélange les cartes côté serveur. Le chemin HTTP local conserve
la limite historique du navigateur qui fournit les cartes et reste vérifié par
rejeu.

Autres protections :
- une partie n'est visible que par son propriétaire (l'id d'un autre joueur
  répond `404`, comme si la partie n'existait pas) ;
- une main envoyée deux fois (réseau qui renvoie) répond `409 déjà enregistrée`
  et ne change rien. L'état de la partie n'avance que depuis celui qui a servi
  au rejeu (`updateMany … where handsPlayed = n`, dans une transaction) ;
- l'historique **ne montre pas les cartes des IA** qu'elles n'ont pas
  retournées à l'abattage (`publicHand`), comme à une vraie table.

---

## 3. Les tables

```
User 1 ── n Game 1 ── n Hand 1 ── n Action
  │
  └── n UserAchievement
```

| Table | Contenu |
|---|---|
| `Game` | adversaires (`opponents`, JSON `[{ name, level }]`), tapis de départ, blindes, **état courant** (`stacks`, `button`, `handsPlayed`), `status` : `PLAYING`, `WON`, `LOST` ou `QUIT`, `finalStack`, dates |
| `Hand` | n°, positions (bouton, blindes), `board`, `pot`, `result` (`uncontested` = tout le monde s'est couché, ou `showdown`), `players` (JSON, par siège : tapis avant/après, cartes, couché, montré, main, gains), et **les chiffres du joueur en colonnes** : `heroHole`, `heroNet`, `heroCollected`, `heroVpip`, `heroPfr`, `heroAllIn`, `heroShowdown`, `heroShowdownWon`, `heroHandName` |
| `Action` | chaque coup, dans l'ordre (`seq`) : `street` (0 préflop … 3 river), `seat`, `type` (`blind`, `fold`, `check`, `call`, `bet`, `raise`), `amount` (jetons mis par ce coup), `betTo` (mise totale du siège sur ce tour), `potAfter`, `allIn` |
| `UserAchievement` | `(userId, code)` = succès débloqué, avec sa date |

Pourquoi des colonnes `hero…` en plus du JSON `players` ? Les statistiques se
calculent alors avec de simples `COUNT` et `SUM` en SQL, sans fouiller dans du
JSON. Le JSON garde le détail des autres sièges pour l'affichage.

Une partie restée `PLAYING` (navigateur fermé) passe en `QUIT` au lancement de
la partie suivante.

Schéma complet : `prisma/schema.prisma`. Migration :
`prisma/migrations/…_games_hands_stats/`.

---

## 4. Les routes

Toutes demandent d'être connecté, sauf le classement.

| Route | Rôle |
|---|---|
| `POST /api/games` | `{ opponents, startingStack, blinds }` → `201 { game }` |
| `POST /api/games/:id/hands` | le journal d'une main → `201 { hand, game, achievements }` (`achievements` = ids des succès **nouvellement** débloqués) ; `422` main refusée ; `409` déjà enregistrée ou partie terminée |
| `POST /api/games/:id/quit` | → `204` ; la partie passe en `QUIT` (sans effet si elle est déjà finie) |
| `GET /api/games?limit=20&before=<id>` | mes parties, de la plus récente à la plus ancienne → `{ games, next }` (`next` = valeur de `before` pour la page suivante, ou `null`) |
| `GET /api/games/:id` | une partie, toutes ses mains et tous leurs coups → `{ game, hands }` |
| `GET /api/stats/me` | `{ totals, achievements: [{ id, unlockedAt }] }` |
| `GET /api/stats/range` | la range vraiment jouée + erreurs + plus grosses pertes (section 7 bis) |
| `GET /api/stats/solver` | le joueur comparé au solveur, infoset par infoset (section 7 ter) |
| `GET /api/stats/dashboard?from&to&level&opponents&tz` | les chiffres du tableau de bord (section 7 quater) |
| `GET /api/stats/export.csv?mêmes filtres` | les mêmes mains en fichier CSV (téléchargé) |
| `GET /api/stats/live` | flux d'événements (SSE) : un événement `hand` à chaque main enregistrée |
| `GET /api/leaderboard` | public → `{ players, me }` : les 20 premiers, et ma ligne même hors du top 20 |

Fichiers : `src/games/` (`schemas.js`, `routes.js`, `service.js`),
`src/stats/` (`totals.js`, `routes.js`, `dashboard.js`, `exportCsv.js`,
`liveFeed.js`, `schemas.js`), `src/auth/guard.js` (`requireUser`).

---

## 5. Les statistiques (`src/stats/totals.js`)

Deux requêtes SQL, avec `COUNT(*) FILTER (WHERE …)` de PostgreSQL pour compter
plusieurs choses en un seul passage. Avec `$queryRaw` en template, la valeur
`${userId}` est envoyée comme **paramètre**, jamais collée dans le SQL : pas
d'injection possible.

| Chiffre | Calcul |
|---|---|
| Parties jouées / gagnées / perdues / abandons | `Game` par `status` |
| % de victoires | gagnées ÷ parties terminées (gagnées + perdues + abandons) |
| Mains jouées / gagnées | `Hand` ; gagnée = `heroNet > 0` |
| Abattages gagnés | `heroShowdownWon` ÷ `heroShowdown` |
| Jetons gagnés | somme des `heroNet` |
| Plus gros pot | max de `heroCollected` |
| **VPIP** | % des mains où le joueur a mis des jetons **de lui-même** avant le flop (suivre ou relancer ; les blindes ne comptent pas) |
| **PFR** | % des mains où le joueur a **relancé** avant le flop |

VPIP et PFR sont les deux statistiques de base d'un profil de joueur de poker :
un VPIP élevé veut dire qu'il joue beaucoup de mains, un PFR proche du VPIP
qu'il est agressif. Elles sont calculées au rejeu (`src/shared/stats/handRecord.js`).

---

## 6. Les succès (`src/shared/stats/achievements.js`)

La liste est dans un fichier **partagé** : le serveur les teste, et le menu les
affiche (grisés tant qu'ils sont verrouillés).

| | Succès | Condition |
|---|---|---|
| 🃏 | Premier pas | jouer sa première partie |
| 💰 | Premier pot | remporter une main |
| 🧊 | Sang-froid | gagner un abattage |
| 🎭 | Bluffeur | miser à la river et voir tout le monde se coucher |
| 🔥 | Tapis ! | faire tapis et remporter la main |
| 🏦 | Gros coup | remporter un pot d'au moins 50 grosses blindes |
| 👑 | Main de monstre | gagner un abattage avec un carré ou mieux |
| ⭐ | Shérif | gagner une partie |
| 🎯 | Chasseur de primes | gagner une partie contre une IA Expert |
| 🪑 | Table pleine | gagner une partie contre 4 IA |
| 🍺 | Habitué du saloon | jouer 100 mains |
| 🤠 | Légende de l'Ouest | gagner 10 parties |

Après chaque main enregistrée, le serveur recalcule les totaux du joueur, teste
les succès pas encore débloqués (`newlyUnlocked`) et enregistre les nouveaux.
Il les renvoie dans sa réponse, et le jeu les annonce à l'écran.

**Ajouter un succès** : une entrée de plus dans `ACHIEVEMENTS`, avec `id`,
`icon`, `name`, `description` et `test(ctx)`. `ctx` contient `totals`, `hand`
(la main rejouée, avec `hand.hero`) et `game`. Rien à changer dans la base.

---

## 7. Le classement

Une requête SQL (`src/stats/routes.js`) :
1. par joueur : parties **terminées** (gagnées, perdues ou abandonnées), victoires, mains ;
2. rang avec `RANK()` : d'abord les victoires, puis le % de victoires, puis le
   nombre de mains. Les ex æquo ont le même rang (1, 2, 2, 4…) ;
3. on garde le top 20 **et** la ligne du joueur connecté.

Le classement est public : un invité le voit, sans ligne « toi ».

---

## 7 bis. La range vraiment jouée (onglet « Mon historique » du tableau des ranges)

`GET /api/stats/range` relit les 5 000 dernières mains du joueur et les passe à
`src/shared/stats/rangeAnalysis.js`. On regarde seulement **la première décision
avant le flop** de chaque main (les blindes ne comptent pas) :

- **situation** : `unraised` (personne n'avait relancé : ouvrir, compléter ou
  checker, se coucher) ou `vsRaise` (un adversaire avait relancé : sur-relancer,
  suivre, se coucher) ;
- **par type de main** (AKo, 77…) : combien de fois reçue, ce qui a été fait,
  et le bilan en grosses blindes. Le tableau affiche ces fréquences, et les
  cases jamais reçues sont rayées.

**Erreurs** : seulement des fautes nettes avant le flop, jugées avec l'équité
de la main contre une main au hasard (`public/ai/mccfr/equity_table.txt`, la
table du solveur). Les règles sont simples pour qu'un débutant comprenne
chacune d'elles :

| Règle | Quand |
|---|---|
| Couché alors que checker était gratuit | grosse blinde, personne n'a relancé, et il s'est couché |
| Couché avec une très grosse main | équité ≥ 64 % : 77+, AK, AQ, AJs, ATs |
| Payé une relance avec une main très faible | face à une relance, suivi ou relancé avec une équité < 38 % (72o, 83o, 54o, 32s…) |

Une même règle et une même main sont regroupées (« 3 fois avec 52o »). Les
erreurs sont classées par gravité et par nombre, 6 au maximum.

**Plus grosses pertes** : les 5 mains qui ont coûté le plus de grosses blindes,
avec le board et, à l'abattage, les cartes montrées par l'adversaire.

Un invité ne fait pas l'appel : le jeu sait qu'il n'est pas connecté et
l'invite à se connecter, sans erreur `401` dans la console.

---

## 7 ter. Tes décisions face au solveur (table `PlayerInfoset`)

Chaque décision du joueur est classée **exactement comme le fait l'IA** : même
bucket de cartes, même historique abstrait (`f`, `c`, puis l'index de la taille
de mise : `2c/c3///`), même clé 64 bits que la stratégie du solveur. On obtient ainsi **sa propre table de stratégie**, directement
comparable à celle du solveur.

```
Hand / Action (source de vérité)          PlayerInfoset (dérivée)
cartes, montants, chaque coup      ──►    userId · version · clé · nb fold / call / raise
         │  rejeu (replay.js → decisions)          │ même clé
         └─► ai/mccfr/infoset.js ─────────►        ▼
             (la même fonction que PokerBot)   strategy.bin (stratégie du solveur)
```

**Une seule chaîne** : `src/shared/ai/mccfr/infoset.js` (`describeInfoset`)
transforme une décision en clé. `PokerBot` l'utilise pour lire sa stratégie, et
`src/shared/stats/playerInfosets.js` l'utilise pour classer les décisions du
joueur. Un test vérifie que les deux donnent la même clé.

**Quand ?** À chaque main enregistrée, la route passe les `decisions` du rejeu
à `src/stats/infosets.js`, qui incrémente les compteurs. C'est une donnée
dérivée : si ça échoue (fichiers du solveur absents…), la main reste
enregistrée et la reconstruction répare.

**Les tailles de mise** : le solveur connaît un menu de tailles par situation
(ouverture 2 BB ou 2,5 BB, 3-bet ×3, 4-bet ×2,5 ; après le flop ⅓, ½, ⅔ ou tout le pot,
relance ×3 ; tapis partout). Une mise réelle est rangée sous **la taille la plus
proche** (`src/shared/ai/mccfr/historyTranslator.js`). Les compteurs restent
fold / call / raise : toutes les tailles comptent comme « raise », et côté
solveur on additionne les probabilités de ses tailles (`foldCallRaise`). Plus
simple à lire, et il faudrait beaucoup plus de mains pour comparer taille par taille.

**Ce qui n'est pas classé** : les décisions **hors abstraction** (une 5e mise
dans un même tour, que l'arbre du solveur n'a pas). Leur clé ne veut rien dire.

**Version d'abstraction** : chaque ligne porte `version` = un hash des fichiers
de buckets et de seuils **et des tailles de mise** (`BETTING_ID` de
`bettingTree.js`, voir `src/ai/solverData.js`). Si le solveur est réentraîné
avec d'autres buckets ou d'autres tailles, les anciennes lignes ne correspondent plus. Il faut alors :

```bash
npm --prefix server run db:rebuild-infosets        # tous les joueurs
npm --prefix server run db:rebuild-infosets -- 12  # le joueur n° 12
```

Le script (`scripts/rebuild-infosets.js` → `src/stats/rebuildInfosets.js`)
rejoue chaque main enregistrée (`src/shared/stats/savedHand.js` reconstruit le
rejeu depuis `Hand` / `Action`) et reclasse tout sous la version actuelle.

**Stockage de la clé** : en texte. Elle va jusqu'à 2^64, ce qui dépasse le
`bigint` de PostgreSQL (signé, 2^63).

**La comparaison** (`src/stats/solverReport.js`, onglet « Face au solveur »
du carnet) :
- **la référence** : la stratégie d'**analyse** (`server/data/analysis.bin`,
  `npm run ai:analysis`) si elle est installée, sinon celle que joue l'IA
  (`server/data/strategy.bin`). Pourquoi : le joueur doit être comparé à
  ce qui se rapproche le plus du GTO (plus d'itérations), pas forcément au bot.
  La stratégie du bot est privée et n'est jamais téléchargée par le navigateur.
  Les deux doivent venir
  de **la même abstraction** (mêmes buckets, mêmes tailles, même clé) : les
  décisions sont classées une seule fois, sous des clés qui doivent exister
  dans les deux (`ai:analysis` refuse un solveur aux buckets différents). Le
  rapport dit laquelle est utilisée (`reference`, avec son empreinte) ;
- seulement les situations vues au moins `MIN_SAMPLES` fois (4) ;
- **tous les tours, préflop compris** (`FROM_ROUND = 0`) depuis que le solveur
  joue de vraies tailles (avant, sa relance valait toujours le pot et il ne se
  couchait presque jamais préflop : on ne comparait qu'après le flop) ;
- l'écart d'une situation = la moitié de la somme des différences entre les
  fréquences du joueur et celles du solveur (0 % = identique, 100 % = opposé).
  L'écart moyen est pondéré par le nombre de fois où chaque situation revient ;
- les situations sont classées par écart × √(nombre de fois) ;
- chaque situation est décrite en français (`src/shared/ai/mccfr/historyWords.js`),
  avec la force de la main (après le flop : la plage d'équité EHS du bucket ;
  avant : les mains du même groupe) ;
- bouton **⬇ PDF** (`src/front/ui/stats/pdf/solverPdf.js`) : le même rapport en
  fichier, pour le garder ou le montrer. Mêmes phrases que l'onglet (fonctions
  exportées par `stats/tabs/solverTab.js`, rien n'est réécrit), barres dessinées en
  rectangles (nettes à tout zoom, contrairement à une capture d'écran), une
  situation n'est jamais coupée entre deux pages.

**Limite** : après le flop, le bucket vient d'une équité estimée par tirages au
hasard (50 au flop, 45 au turn). Une main pile à la frontière de deux buckets
peut tomber d'un côté ou de l'autre. Il y a aussi beaucoup de clés possibles
(50 buckets × les historiques) : il faut plusieurs centaines de mains avant
que beaucoup de situations reviennent 4 fois.

---

## 7 quater. Le tableau de bord (module 4, onglet « Tableau de bord » de Mon carnet)

But : voir **comment on joue dans le temps**, pas seulement des totaux. Tout
vient des tables `Hand`, `Game` et `Action` (aucune table de plus).

### Ce qui est affiché (`src/front/ui/stats/dashboard/`)

| Élément | Contenu |
|---|---|
| Tuiles | mains, parties, résultat, **BB / 100 mains**, mains gagnées, VPIP, PFR, abattages gagnés |
| Courbe de gains | résultat cumulé main après main (vert au-dessus de zéro, rouge en dessous) |
| Résultat par jour | une barre par jour (par semaine si la période dépasse 90 jours) |
| VPIP / PFR dans le temps | deux courbes en %, un clic sur la légende en masque une |
| Gains par niveau d'IA, par position, par nombre d'IA | BB / 100 mains par groupe |
| Tes actions | camembert se coucher / checker / suivre / miser / relancer, tous les tours ou un seul |

Graphiques **Chart.js** (`charts.js`) : infobulles au survol, légendes
cliquables. Gros caractères, traits épais (écran de l'utilisateur).

**Pourquoi tout en big blinds** : une partie à blindes 1/2 et une à 5/10 ne
s'additionnent pas en jetons. `heroNet / bigBlind` rend toutes les mains
comparables ; **BB / 100 mains** est l'unité habituelle au poker pour dire
« je gagne à ce rythme ».

### Filtres (`filters.js` → `src/stats/schemas.js`)

Période (7 jours, 30 jours, 3 mois, tout, dates choisies), niveau des IA
(débutant, confirmé, expert, ou « mélangés » quand une partie avait plusieurs
niveaux), nombre d'IA. Les mêmes filtres servent au tableau et à l'export CSV.

- **Les jours sont ceux du joueur** : « 7 jours » commence à minuit, heure
  locale. Le navigateur envoie les bornes en ISO **et** son fuseau (`tz`) ; le
  serveur découpe la frise par jour dans ce fuseau (`AT TIME ZONE`). Un fuseau
  inconnu de Node devient `UTC` (`safeZone`).
- Tous les filtres passent par **une seule** sous-requête, `filteredHands()`
  (`dashboard.js`) : chaque graphique lit exactement le même ensemble de mains.
- Les valeurs passent par les gabarits `$queryRaw` de Prisma : toujours
  envoyées en **paramètres**, jamais collées dans le SQL (pas d'injection) ;
  et le JSON Schema refuse déjà tout champ inconnu.
- La courbe est **échantillonnée** à 300 points au plus (`sampleCurve`, la
  dernière main toujours gardée) : même avec 50 000 mains, la réponse reste petite.

### Export

- **CSV** (`src/stats/exportCsv.js`) : construit par le serveur, une ligne par
  main, montants en jetons **et** en BB, colonnes en français. UTF-8 avec BOM
  (sinon Excel affiche « Ã© »). **Injection de formule** : une cellule texte
  qui commence par `=`, `+`, `-` ou `@` s'exécuterait dans un tableur → on la
  préfixe d'une apostrophe. Le bouton est un simple lien `download` : le
  cookie de session suit, rien à faire en JS.
- **PDF** (`pdfExport.js`, **jsPDF**) : fait dans le navigateur, à partir des
  graphiques déjà dessinés (chaque `<canvas>` → image) et des tuiles, avec les
  filtres en sous-titre. La page elle-même (fond cuir, titre, tuiles, saut de
  page) vient de `src/front/ui/stats/pdf/pdfPage.js`, partagée avec le PDF « Face au
  solveur » (§7 ter). jsPDF n'est chargé qu'au clic (`import()` dynamique :
  le jeu ne le télécharge jamais sinon). Les polices intégrées du PDF ne
  connaissent que le Latin-1 : `−`, `’`, `…`, `⅓`, `⅔` sont remplacés.

### Temps réel (`server/src/stats/liveFeed.js` ↔ `src/front/net/statsLive.js`)

Le tableau ouvre `GET /api/stats/live` (un `EventSource`). À chaque main
enregistrée (`POST /api/games/:id/hands`), le serveur envoie `event: hand` à
tous les tableaux ouverts **de ce joueur** ; le tableau recharge ses chiffres
(regroupés sur 600 ms) et affiche « Mis à jour à … ». On peut jouer dans un
onglet et voir les courbes bouger dans un autre.

- **Pourquoi SSE plutôt que WebSocket** : le serveur parle dans un seul sens ;
  SSE est du HTTP simple (passe par le proxy de Vite et nginx, garde le cookie
  de session) et le navigateur se reconnecte tout seul (`retry: 5000`).
- Une ligne de commentaire toutes les 25 s : les proxys ne coupent pas une
  connexion muette. `X-Accel-Buffering: no` : nginx ne met pas le flux en tampon.
- En mémoire, **un seul processus** : suffisant ici. Plusieurs processus
  demanderaient un canal partagé (PostgreSQL `LISTEN / NOTIFY`, Redis…).
- À l'arrêt du serveur, `closeAll()` ferme les flux (sinon `close()` les attend).
- Changer d'onglet ou fermer Mon carnet appelle `Dashboard.destroy()` :
  graphiques détruits, flux fermé.

---

## 8. Côté jeu

| Fichier | Rôle |
|---|---|
| `src/shared/stats/handLog.js` | `HandLogger` : événements de `PokerGame` → journal de la main |
| `src/shared/stats/handRecord.js` | `HandRecorder` : événements → enregistrement complet (utilisé par le serveur pendant le rejeu) |
| `src/shared/stats/replay.js` | `replayHand()` + `ReplayError` (utilisé par le serveur) |
| `src/shared/stats/achievements.js` | la liste des succès (serveur + menu) |
| `src/front/game/GameRecorder.js` | branché sur `TableController` : crée la partie, envoie chaque main **une par une, dans l'ordre**, signale la fin. Si le serveur refuse une main ou ne répond plus, il arrête d'enregistrer cette partie, mais le jeu continue |
| `src/front/net/gamesApi.js` | les appels `fetch` |
| `src/front/ui/stats/StatsMenu.js` | « Mon carnet » : la fenêtre et le passage d'un onglet à l'autre ; un fichier par onglet dans `ui/stats/tabs/` (Statistiques, Tableau de bord → `stats/dashboard/`, Historique partie → mains → coups rue par rue, Succès, Face au solveur, Classement) |
| `src/front/ui/AchievementToast.js` | l'annonce « Succès débloqué ! » pendant la partie |
| `src/front/ui/UserBadge.js` | bouton « 📊 Mes stats » (connecté seulement) |

`PokerGame` accepte maintenant une option `deck` (une fonction qui renvoie le
paquet). Par défaut, c'est un paquet mélangé. Le rejeu, lui, passe un paquet
« arrangé » pour que le moteur distribue exactement les cartes du journal.

---

## 9. Tests

- `npm run test:ai` (racine) : `tests/replay.test.mjs`. Des parties complètes
  sont jouées par des agents aléatoires, de 2 à 5 joueurs. Chaque main est
  notée comme le ferait le navigateur, puis rejouée comme le ferait le
  serveur, et doit retomber **exactement** sur les mêmes tapis. Des journaux
  trafiqués doivent être refusés (main sautée, carte en double, carte
  inconnue, coup manquant ou en trop, mauvais siège, relance trop petite ou
  trop grosse). Les ids des succès doivent être uniques.
- `npm test` (dans `server/`) : `tests/infosets.test.mjs` vérifie que chaque
  main enregistrée classe les décisions sous des clés du solveur, que la
  reconstruction retombe sur le même total, et que la comparaison ignore
  l'avant-flop. `tests/games.test.mjs` Une partie entière
  est envoyée main par main, puis on vérifie l'historique, le détail des coups
  (blindes comprises), les cartes des IA cachées, les stats, les succès et le
  classement. Aussi : triche refusée (`422`), main en double (`409`), partie
  d'un autre joueur (`404`), abandon, invité (`401`, mais le classement reste
  public).
  `tests/dashboard.test.mjs` : les totaux du tableau de bord égalent la somme
  des mains enregistrées (en BB), les filtres (niveau, nombre d'IA, période),
  personne ne voit les mains d'un autre, le CSV (une ligne par main, filtres,
  formules neutralisées), l'échantillonnage de la courbe, et le direct (une
  main enregistrée arrive dans le flux ouvert).
