# 🛠️ scripts — les outils en ligne de commande

> **Dossier** `scripts/` · **Couche** outils Node (hors jeu) · **Lancés par** `npm run ai:sync`, `ai:equity`, `docs:man`

## NOM

`scripts` — préparer les données de l'IA (depuis le solveur C++), calculer la
table d'équités, générer le manuel. Le match contre Slumbot a déménagé dans le
dépôt du solveur (`../CFR/tests/slumbot/`, `make slumbot`).

## SYNOPSIS

```bash
npm run ai:sync                                   # ../CFR/data → public/ai/mccfr/ + server/data/strategy.bin
MCCFR_STRATEGY=data/backup_50M_97272ca04d/strategy.txt npm run ai:sync   # une stratégie donnée (celle du jeu)
npm run ai:analysis                               # ../CFR/data/strategy.txt → server/data/analysis.bin (référence de « Face au solveur »)
npm run ai:equity                                 # → public/ai/equity169.json
```

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `sync-mccfr.sh` | copie les fichiers du solveur et compacte sa stratégie (celle du bot) |
| `sync-analysis.sh` | compacte une stratégie **d'analyse** dans `server/data/analysis.bin` (la référence de « Face au solveur ») |
| `pack-strategy.mjs` | `strategy.txt` (170 Mo) → `strategy.bin` (49 Mo) |
| `equity-matrix.mjs` | équité préflop des 169 × 169 paires de mains |
| `docs/build-man.mjs` | `npm run docs:man` : tous les `MAN.md` → `docs/man/index.html` ; échoue si un `MAN.md` n'est pas listé ou si un lien pointe vers une page inconnue |
| `docs/pages.js` · `docs/markdown.js` · `docs/template.js` | l'ordre et les groupes des pages · le petit convertisseur Markdown (sans dépendance, marche hors ligne) · la page HTML (style saloon, recherche, clair / sombre) |

## FONCTIONS

### 📄 `sync-mccfr.sh`

1. copie `buckets.txt`, `equity_table.txt`, `flop/turn/river_thresholds.txt`
   de `$MCCFR_DIR/data` (par défaut `../CFR`) vers `public/ai/mccfr/` ;
2. prend `$MCCFR_STRATEGY`, ou le `data/strategy*.txt` **le plus récent** ;
3. le compacte avec `pack-strategy.mjs` dans `server/data/strategy.bin`, jamais dans `public/`.

Piège : pendant un entraînement, `data/strategy.txt` est réécrit tous les 5 M
d'itérations. Passer par `MCCFR_STRATEGY` pour prendre une stratégie **finie**.

### 📄 `sync-analysis.sh`

`npm run ai:analysis` (ou `MCCFR_STRATEGY=data/… npm run ai:analysis`) :
1. vérifie que les buckets et seuils du solveur sont **ceux du jeu**
   (`public/ai/mccfr/`) et la stratégie privée (`server/data/strategy.bin`), sinon refuse : les décisions du joueur sont classées
   sous les clés du jeu ;
2. refuse `data/strategy.txt` tant que le solveur s'entraîne (sauvegarde en
   cours de route), sauf `MCCFR_STRATEGY` explicite ;
3. compacte la stratégie dans `server/data/analysis.bin` (lu seulement par le
   serveur ; redémarrer le serveur). Le bot ne change pas.

### 📄 `pack-strategy.mjs`

`node scripts/pack-strategy.mjs <strategy.txt> <strategy.bin>` — appelle
`packStrategy()` (`src/shared/ai/mccfr/StrategyTable.js`). **Refuse** un fichier
où chaque ligne a exactement 3 probabilités (ancien solveur à une seule taille de mise).

### 📄 `equity-matrix.mjs`

Pour chaque paire de types de main (AKs contre QQ…), combien de fois la
première gagne à l'abattage (égalité = ½), tapis préflop : Monte-Carlo sur des
couleurs et des boards au hasard, **3000 tirages par paire** (≈ ±1 %). Générateur
pseudo-aléatoire à graine (`mulberry32`) : **le même fichier à chaque fois**.
Sortie en pour mille, lue par `EquityMatrix`.

## POURQUOI / PIÈGES

- `public/ai/mccfr/` et `server/data/strategy.bin` doivent venir **d'un seul
  entraînement** : buckets et stratégie vont ensemble (la clé contient le
  bucket). `ai:sync` les synchronise.
- Si le solveur change ses tailles, son tapis ou sa clé, le JS doit suivre
  (`bettingTree.js`, `infosetKey.js`) : `npm run test:ai` le détecte.

## VOIR AUSSI

[shared/ai](../src/shared/ai/MAN.md) (`PokerBot`) · [mccfr](../src/shared/ai/mccfr/MAN.md) (`StrategyTable`) · [shared/theory](../src/shared/theory/MAN.md) (`EquityMatrix`) ·
[tests](../tests/MAN.md) · `../CFR/tests/slumbot/README.md` (le match contre Slumbot)
