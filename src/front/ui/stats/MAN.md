# 📒 ui/stats — « Mon carnet »

> **Dossier** `src/front/ui/stats/` · **Couche** front (HTML) · **Ouvert par** le badge (« 📊 Mes stats », joueur connecté) · **Données** `gamesApi` (serveur)

## NOM

`StatsMenu` — la fenêtre « Mon carnet » et ses six onglets : Statistiques,
Tableau de bord, Historique, Succès, Face au solveur, Classement.

## SYNOPSIS

```js
const stats = new StatsMenu();
stats.show();                // onglet « Statistiques »
stats.show('solver');        // directement « Face au solveur »
stats.hide();
```

## DESCRIPTION

`StatsMenu.js` n'est **que** la fenêtre et le passage d'un onglet à l'autre.
Chaque onglet est un fichier de `tabs/`, sous la forme :

```js
export const monOnglet = {
  id: 'monOnglet', label: 'Mon onglet', wide: false,     // wide = fenêtre plus large
  async open(view) { … },   // view = { body, get, load } ; renvoie du HTML, { html, bind } ou null
  close() { … },            // facultatif : quand un autre onglet s'ouvre ou que le carnet se ferme
};
```

| Retour de `open()` | Effet |
|---|---|
| une chaîne | HTML posé dans le corps |
| `{ html, bind }` | HTML, puis `bind(body)` pour ajouter les écouteurs |
| `null` | l'onglet a dessiné lui-même (tableau de bord) |

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `StatsMenu.js` | la fenêtre, les onglets, « Chargement… », les erreurs |
| `format.js` | petites aides partagées : échappement, pourcentages, cartes, tuiles |
| `styles.js` | le CSS commun du carnet (injecté une fois) |
| `tabs/totalsTab.js` | 📊 Statistiques |
| `tabs/dashboardTab.js` | 📈 Tableau de bord → [dashboard](dashboard/MAN.md) |
| `tabs/historyTab.js` + `tabs/handHtml.js` | 📜 Historique |
| `tabs/achievementsTab.js` | 🏆 Succès |
| `tabs/solverTab.js` | 🧠 Face au solveur |
| `tabs/leaderboardTab.js` | 🥇 Classement |
| `pdf/pdfPage.js` | la page PDF commune aux deux exports |
| `pdf/solverPdf.js` | « Face au solveur » en PDF |

## FONCTIONS

### 📄 `StatsMenu.js`

| Membre | À quoi il sert |
|---|---|
| `show(tab = 'stats')` | construit la fenêtre si besoin et ouvre l'onglet |
| `hide()` | ferme l'onglet (`close()`), retire la fenêtre ; aussi **Échap**, ✕ et clic à côté |
| `TABS` | l'ordre des onglets : **ajouter un onglet = un fichier + une ligne ici** |

Internes : `_open(id)`, `_closeTab()`, `_load(loader)` (affiche « Chargement… »,
attend, affiche le résultat ou « ⚠ erreur » ; **ignore** un résultat si un autre
onglet a été ouvert entre-temps), `_get(call)` (appel API → `data`, ou erreur
affichée dans l'onglet).

### 📄 `format.js`

| Nom | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `esc(s)` | texte → HTML sûr | **tout** ce qu'un joueur a tapé (pseudos) passe par là |
| `pct(a, b)` | `3, 4` → `'75 %'`, `0, 0` → `'—'` | — |
| `signed(n)` | `+1 200`, `−300`, `0` | résultat avec son signe |
| `netClass(n)` | → `'plus' \| 'minus' \| ''` | vert / rouge |
| `date(d)`, `time(d)` | → texte français | — |
| `cardHtml(code)`, `cardsHtml(codes)` | `'TD'` → petite carte « 10♦ » rouge | tiret si aucune carte (jamais montrée) |
| `tilesHtml([[valeur, label, aide?]])` | → grille de tuiles | — |
| `emptyHtml(text)` | → message centré | onglet vide |
| `STATUS`, `LEVEL`, `STREETS`, `fmt` | — | libellés français |

### 📄 Les onglets

| Onglet | Route | Contenu |
|---|---|---|
| `totalsTab` | `GET /api/stats/me` | 12 tuiles : parties jouées / gagnées / perdues / abandons, % de victoires, mains, mains gagnées, abattages, jetons gagnés, plus gros pot, **VPIP**, **PFR** |
| `dashboardTab` | — | crée un `Dashboard` dans le corps ; `close()` coupe son flux temps réel |
| `historyTab` | `GET /api/games`, `GET /api/games/:id` | liste des parties (page par page, « Voir plus ») → une partie : chaque main dépliable |
| `achievementsTab` | `GET /api/stats/me` | les 12 succès, 🔒 si verrouillé, date sinon |
| `solverTab` | `GET /api/stats/solver` | tuiles (décisions classées, situations comparées, écart moyen) puis les situations les plus différentes : ce qui s'est passé (`describeHistory`), la main, **deux barres** (toi / solveur), une phrase |
| `leaderboardTab` | `GET /api/leaderboard` | tableau ; ta ligne en or, après « … » si tu n'es pas dans le top |

`handHtml(h, names)` (Historique) : la ligne résumé (cartes, board, pot,
résultat) et, dépliée, **chaque coup en français** (« Tu relances à 60 »,
« Le Baron suit 60 »), les cartes montrées, qui a gagné quoi.

`solverTab.js` exporte aussi `ACTIONS`, `COLORS`, `LABELS`, `POSITION`, `pct`,
`handWords(spot)` et `verdict(spot)` : **le PDF dit exactement les mêmes mots**.

### 📄 `pdf/`

| Nom | À quoi il sert |
|---|---|
| `PdfPage.create()` | charge jsPDF **au premier clic** seulement (import dynamique : Vite le met dans son propre fichier) |
| `page.ensure(h)`, `header(title, subtitle)`, `paragraph(text, opts)`, `tiles(tiles)`, `save(name)` | un curseur `y` descend la page et passe à la suivante si besoin |
| `latin1(s)`, `rgb(hex)`, `PAGE`, `INK`, `DIM`, `GOLD`, `OUTLINE` | les polices du PDF ne connaissent que le Latin-1 : `−`, `’`, `…`, `⅓` sont remplacés |
| `exportSolverPdf(report)` | le rapport « Face au solveur » en PDF, barres dessinées en rectangles (nettes à tout zoom) |

## POURQUOI / PIÈGES

- **Un fichier par onglet** : un onglet s'ajoute ou se corrige sans toucher aux autres.
- L'historique ne montre pas les cartes des IA qui ne sont pas allées à l'abattage (le serveur les retire).
- Un invité n'ouvre pas le carnet (pas de `401` rouge dans la console).

## VOIR AUSSI

[dashboard](dashboard/MAN.md) · [server/stats](../../../../server/src/stats/MAN.md) · [server/games](../../../../server/src/games/MAN.md) ·
[net](../../net/MAN.md) (`gamesApi`) · [shared/stats](../../../shared/stats/MAN.md) (`ACHIEVEMENTS`)
