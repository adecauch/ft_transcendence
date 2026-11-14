# 📈 ui/stats/dashboard — le tableau de bord

> **Dossier** `src/front/ui/stats/dashboard/` · **Couche** front (HTML + Chart.js + jsPDF) · **Onglet** « Tableau de bord » de Mon carnet · **Données** `GET /api/stats/dashboard`, flux `GET /api/stats/live`

## NOM

`Dashboard` — filtres, tuiles, 7 graphiques interactifs, export CSV / PDF, et
mise à jour **en temps réel** quand une main est jouée (dans un autre onglet ou
un autre appareil).

## SYNOPSIS

```js
const dash = new Dashboard(element);
await dash.mount();     // construit, charge, ouvre le flux temps réel
dash.destroy();         // ferme le flux et détruit les graphiques
```

## DESCRIPTION

| Zone | Contenu |
|---|---|
| **Filtres** | période (7 jours, 30 jours, 3 mois, Tout, Dates…), niveau d'IA, nombre d'IA ; boutons ⬇ CSV et ⬇ PDF ; voyant « En direct » |
| **Tuiles** | mains jouées, résultat, pour 100 mains, mains gagnées, VPIP, PFR, abattages gagnés |
| **Graphiques** | courbe de gains · résultat par jour · VPIP / PFR dans le temps · gains par niveau d'IA · par position · selon le nombre d'IA · tes actions (camembert, filtrable par tour) |

**Tout est en grosses blindes** : des parties aux blindes différentes s'additionnent.

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `Dashboard.js` | l'onglet : construit la page, recharge, dessine, exporte, écoute le direct |
| `charts.js` | une fonction par graphique : données du serveur → configuration Chart.js |
| `filters.js` | l'état des filtres → la requête envoyée au serveur (et sa description) |
| `pdfExport.js` | le tableau de bord en PDF |
| `styles.js` | le CSS (une seule fois) |

## FONCTIONS

### 📄 `Dashboard.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new Dashboard(root)` | élément | filtres par défaut (« Tout ») |
| `mount()` | → `Promise` | dessine les filtres, ouvre `watchHands`, premier chargement |
| `refresh(fromLive?)` | → `Promise` | recharge avec les filtres ; met à jour le lien CSV ; « Mis à jour à 21:04:12 » si ça vient du direct |
| `destroy()` | — | coupe la minuterie, le flux, détruit les graphiques |

Internes : `_render()` (la mise en page n'est construite **qu'une fois** ; ensuite
seules les tuiles et les données changent, **sans clignoter**), `_tiles()`
(aussi les chiffres du PDF), `_drawCharts()` (met à jour ou crée chaque
graphique), `_clearCharts()`, `_syncFilters()`, `_liveStatus(text, on, flash)`, `_pdf(button)`.

`LIVE_DEBOUNCE_MS` = 600 ms : plusieurs mains enregistrées de suite → **un seul** rechargement.

### 📄 `charts.js`

| Fonction | Entrée (serveur) → Sortie | Graphique |
|---|---|---|
| `curveChart(curve)` | `[{ hand, total }]` | ligne : résultat cumulé |
| `resultByDayChart({ unit, points })` | jour ou semaine | barres vertes / rouges |
| `styleChart({ unit, points })` | VPIP / PFR par période | deux lignes |
| `rateChart(rows, kind)` | `kind` = `level` \| `position` \| `opponents` | barres BB / 100 mains |
| `actionsChart(actions, street)` | coups par tour, `street = null` = tous | camembert |
| `Chart`, `STREETS`, `ACTION_LABELS` | — | réexportés |

Seules les pièces utilisées de Chart.js sont enregistrées (bundle plus petit).
Couleurs du saloon, grosses polices, traits épais ; survol = infobulle, clic sur
une légende = masquer la série.

### 📄 `filters.js`

| Nom | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `PERIODS`, `LEVELS`, `OPPONENTS` | listes `{ id, label }` | les choix affichés |
| `defaultFilters()` | → `{ period: 'all', from, to, level: '', opponents: '' }` | — |
| `toQuery(f)` | → `'from=…&to=…&level=…&tz=Europe/Paris'` | la requête ; **le fuseau du navigateur** est envoyé |
| `dateRange(f)` | → `{ from, to }` | « 7 jours » = depuis minuit, heure locale, il y a 6 jours ; « Dates… » inclut tout le dernier jour |
| `describe(f)` | → `'30 jours · Expert · Tête-à-tête'` | sous-titre du PDF |

### 📄 `pdfExport.js`

| Fonction | À quoi elle sert |
|---|---|
| `exportPdf({ subtitle, tiles, charts })` | page commune (`pdf/pdfPage.js`) + tuiles + les graphiques en images, deux par ligne (la courbe sur toute la largeur) ; chargé **au clic** seulement |

## POURQUOI / PIÈGES

- **Les jours du joueur** : sans le fuseau, un joueur à Paris verrait ses mains
  de 00 h 30 comptées la veille (jour UTC).
- Le **CSV** est un simple lien : le navigateur le télécharge, le serveur le
  fabrique avec **les mêmes filtres** (`filteredHands`).
- `destroy()` est indispensable : sinon le flux SSE resterait ouvert après avoir changé d'onglet.

## VOIR AUSSI

[ui/stats](../MAN.md) (`StatsMenu`, `pdf/`) · [server/stats](../../../../../server/src/stats/MAN.md) (`dashboard.js`, `liveFeed.js`, `exportCsv.js`) ·
[net](../../../net/MAN.md) (`statsLive.js`)
