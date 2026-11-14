# 📖 ui/ranges — le tableau des ranges

> **Dossier** `src/front/ui/ranges/` · **Couche** front (HTML) · **Ouvert par** l'événement `ranges:open` (badge « 📖 Ranges », menu pause) — invités compris

## NOM

`RangeScreen` — la grille 13 × 13 des 169 mains de départ, et trois onglets :
**🔍 Explorer** (ranges d'exemple et leçons), **🖌️ Construire** (peindre sa
range, l'enregistrer), **📜 Mon historique** (la range vraiment jouée, face à la théorie).

## SYNOPSIS

```js
const ranges = new RangeScreen({ getUser: () => recorder.user });
window.addEventListener('ranges:open', () => ranges.show());
```

## DESCRIPTION

```
┌──────────── enseigne : nom de la range ─────────────┐
│ [🔍 Explorer] [🖌️ Construire] [📜 Mon historique]     │
│ situation (une ligne)                                │
│ ┌──── grille 13×13 ────┐  ┌──── panneau de l'onglet ─┐│
│ │ AA AKs AQs …         │  │ légende, leçon, pinceau,  ││
│ │ AKo KK KQs …         │  │ encadré « La main »…      ││
│ └──────────────────────┘  └───────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

Une range = `{ main → { action → fréquence } }`, fréquences **mixtes** comprises.
Une case coupée en plusieurs couleurs = une main jouée de plusieurs façons.

**Encadré « La main »** : décrit la case survolée ; **un clic fixe la case** (📌)
pour pouvoir faire défiler le panneau sans la perdre ; un second clic la
libère ; un clic ailleurs déplace l'épingle.

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `RangeScreen.js` | la fenêtre, les onglets, l'épingle ; aiguille vers l'onglet courant |
| `RangeGrid.js` | la grille : dessin, survol, sélection, peinture |
| `ExploreMode.js` | 🔍 les ranges d'exemple, leurs leçons, les vraies ranges de l'IA |
| `aiRanges.js` | charge **une fois** les 3 ranges préflop de l'IA et les équités, calculées par le serveur (`GET /api/ai/preflop`) |
| `BuildMode.js` | 🖌️ peindre, copier un modèle, enregistrer sur le compte |
| `Brush.js` | le pinceau : action pure ou **mélange** |
| `draftStore.js` | le brouillon gardé dans le navigateur |
| `HistoryMode.js` | 📜 range jouée, théorie, carte de chaleur, erreurs, pertes |
| `theoryData.js` | charge le modèle théorique une seule fois |
| `theoryHtml.js` | comparaison joueur / théorie, carte de chaleur |
| `historyHtml.js` | listes des erreurs et des plus grosses pertes |
| `html.js` | morceaux de HTML partagés |
| `styles.js` | le CSS (une seule fois) |

## FONCTIONS

### 📄 `RangeScreen.js`

| Membre | À quoi il sert |
|---|---|
| `new RangeScreen({ getUser })` | le joueur connecté (les ranges de l'IA viennent du serveur, `aiRanges.js`) |
| `show()` / `hide()` | ouvre / ferme (✕, clic à côté, **Échap** — qui ne ferme **que** cette fenêtre, pas le menu pause dessous) |
| `render()` | redessine la grille et le panneau de l'onglet |
| `select(hand, options)` | entoure une main et la décrit |

**Contrat d'un onglet** (`mode`) :

| Membre | Obligatoire | Rôle |
|---|---|---|
| `id`, `paintable` | oui | nom ; la grille peint-elle ? |
| `view()` | oui | ce que montre la grille : `{ name, situation, actions, range, counts?, colors? }` |
| `sideHtml(view, selected)` | oui | le panneau de droite |
| `bind(side, screen)` | oui | ses écouteurs |
| `enter(screen)` | non | l'onglet s'ouvre (charger ses données, puis `screen.render()`) |
| `detailHtml(hand, view)` | non | l'encadré « La main » |
| `onHover(hand)`, `afterRender(screen)`, `paint(hand, screen)` | non | survol, après dessin (mini-grille), case peinte |

### 📄 `RangeGrid.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new RangeGrid(el, { onHover, onSelect, onPaint, interactive = true })` | — | les 169 cases sont construites **une fois**, seules leurs couleurs changent |
| `show(view)` | — | une bande de couleur par action ; avec `counts`, les mains jamais vues sont hachurées ; `colors` = une couleur par main (carte de chaleur) |
| `update(hand, view)` | — | une seule case (pendant qu'on peint) |
| `select(hand, { scroll })` | — | la case entourée |
| `setPaintMode(on)`, `stopPainting()`, `setZones(on)`, `destroy()` | — | peinture au clic ou en glissant ; « Montrer les zones » (paires / assorties / dépareillées) |

### 📄 `ExploreMode.js`

| Nom | À quoi il sert |
|---|---|
| `ExploreMode` | liste des ranges (`RANGE_PRESETS`), leçon, légende ; au survol : combinaisons, pourquoi 6 / 4 / 12, équité, ce que fait la range |
| `presetView(id)` | une entrée de `rangePresets.js` → vue : par la **notation**, ou par les **ranges de l'IA** reçues du serveur (`aiRangesNow()`, actions traduites par `solverActions`) ; message pendant le chargement ou si le serveur ne les a pas |
| `loadAiRanges()` / `aiRangesNow()` | `aiRanges.js` : lance le chargement (une fois ; réessaie après un échec) / → `{ ranges, equity }`, `undefined` pendant le chargement, `null` si indisponible |

### 📄 `BuildMode.js` et `Brush.js`

| Nom | À quoi il sert |
|---|---|
| `BuildMode.paint(hand, screen)` | donne à la case le mélange du pinceau (ou le **lit** en mode pipette) ; enregistre le brouillon ; met à jour légende et verdict |
| `BuildMode.bind(side, screen)` | effacer, **copier un modèle** (garde ses fréquences), enregistrer / mettre à jour / nouvelle / ouvrir / supprimer une range du compte |
| `_create`, `_update`, `_delete` | appels `rangesApi` ; les refus du serveur (nom pris, 50 max…) s'affichent |
| `Brush` | `{ raise, call }` en %, **pas de 5 %**, le reste = se coucher |
| `brush.mix()` | → `{ raise: 0.6, call: 0.25 }` (tout à 0 = couché = pas d'entrée) |
| `brush.take(mix)` | pipette : reprend le mélange d'une case, arrondi au pas |
| `brush.describe()` | « Relance 60 % · Suit 25 % · Couché 15 % » |
| `brush.html()`, `brush.bind(side)` | boutons purs (Relancer, Suivre, Gomme), deux curseurs (somme ≤ 100), raccourcis 50/50, 75/25, 25/75, bluff 25 %, suivre 50 %, pipette |
| `STEP` | 5 |

### 📄 `draftStore.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `loadDraft()` | → `{ range, savedId }` | le brouillon survit à un rechargement (`localStorage`, clé `poker.customRange`) ; lit aussi l'ancien format |
| `saveDraft(draft)` | — | sans stockage (navigation privée), le brouillon vit jusqu'à la fermeture |

### 📄 `HistoryMode.js`, `theoryData.js`, `theoryHtml.js`, `historyHtml.js`

| Nom | À quoi il sert |
|---|---|
| `HistoryMode.enter(screen)` | invité : un message, **aucune requête** ; connecté : `GET /api/stats/range` + `loadTheory()` |
| trois situations | Premier à parler · Face à un limp · Face à une relance (première décision préflop) |
| mini-grille | la range **théorique** de la même situation, à côté |
| carte de chaleur | la grille colorée par le **manque à gagner** (BB perdues pour 100 fois la main) |
| `loadTheory()` | `equity169.json` → `PreflopModel`, une seule fois (`null` si absent) |
| `mixOf(c)`, `heatColor(loss)`, `heatLegendHtml()`, `lossSummary(model, spot, counts)`, `summaryHtml(s)`, `comparisonHtml(model, spot, hand, c)`, `modelHowtoHtml()` | la comparaison main par main (ce que vaut chaque action, toi / la théorie) et l'explication du modèle |
| `mistakesHtml(mistakes)`, `lossesHtml(losses)`, `bbText(x)` | les erreurs préflop nettes et les plus grosses pertes |

### 📄 `html.js`

| Fonction | À quoi elle sert |
|---|---|
| `esc(s)` | tout ce qui vient du serveur ou du joueur |
| `pct(x, digits)` | `0.125` → `'12,5 %'` |
| `cardHtml(code, size)` | une petite carte |
| `cellBackground(mix, actions)` | le dégradé en bandes d'une case mixte |
| `legendRow(...)`, `comboLegendHtml(view)` | la légende avec la part de chaque action **en combinaisons** |
| `presetPickerHtml(selectedId, opts)` | la liste déroulante des ranges d'exemple, groupées |
| `howtoHtml()` | « 📖 Comment lire ce tableau ? » pour débutant |

## POURQUOI / PIÈGES

- Le **%** d'une action compte les **combinaisons**, pas les cases : une case « o » pèse 12, une paire 6, une case « s » 4.
- Les vraies ranges de l'IA sont **calculées par le serveur** : `strategy.bin` ne
  part plus au navigateur (la table joue côté serveur, la stratégie complète
  servirait d'aide en direct). Seules ces 3 grilles préflop sortent, et ce genre
  de tableau est public de toute façon.
- Les vraies ranges de l'IA ont **toutes les tailles additionnées** en « relancer ».
  En petite blinde elle se couche très rarement : elle **limpe** ses mains faibles.
- Le **quiz des ranges a été retiré** (futur projet à part).

## VOIR AUSSI

[config](../../config/MAN.md) (`rangePresets.js`) · [shared/poker](../../../shared/poker/MAN.md) (`ranges.js`) · [shared/ai](../../../shared/ai/MAN.md) (`preflopRanges.js`) ·
[shared/theory](../../../shared/theory/MAN.md) · [shared/stats](../../../shared/stats/MAN.md) (`rangeAnalysis.js`) · [server/ranges](../../../../server/src/ranges/MAN.md)
