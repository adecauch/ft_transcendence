# 🎯 ui/actionBar — la barre d'actions du joueur

> **Dossier** `src/front/ui/actionBar/` · **Couche** front (HTML) · **Utilisé par** `TableController` (`ask`, `message`, `hide`)

## NOM

`actionBar` — la barre en bas de l'écran pendant une partie :

```
 Le Baron relance à 60                                        ← ce que les IA viennent de faire
 Flop · Grosse blinde   Pot 140   À suivre 40   Ton tapis 960
 [ ×2,5 100 ] [ ×3 120 ] [ Pot 260 ] [ Tapis 960 ]             ← mises rapides : UN clic = joué
 [ Se coucher ]   [ Suivre 40 ]   [ Relancer 80 – 960 ]
      rouge           vert               doré
```

et le **panneau de relance** qui s'ouvre au-dessus.

## SYNOPSIS

```js
const bar = new ActionBar();
const action = await bar.ask(turnState);        // { type: 'fold' } | { type: 'check' } | { type: 'call', amount } | { type: 'raise', to }
bar.message('Tu gagnes 40 !', { label: 'Rejouer', onClick: restart });
bar.hide();
```

## FICHIERS

| Fichier | Rôle en une phrase |
|---|---|
| `ActionBar.js` | la barre : situation, mises rapides en un clic, trois boutons, message de fin de main |
| `RaisePanel.js` | le panneau de relance : champ, curseur, raccourcis, vérification à chaque frappe |
| `styles.js` | le CSS de la barre et du panneau (injecté une fois) |

## FONCTIONS

### 📄 `ActionBar.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `ask(state)` | `TurnState` (+ `street`, `note`) → `Promise<PlayerAction>` | montre les boutons **légaux** et attend le choix du joueur |
| `message(text, button?)` | texte, `{ label, onClick }` | fin de main, fin de partie (« Rejouer ») |
| `countdown(remainingMs, running)` | ms restantes, chrono en marche ou gelé | partie serveur : « ⏱ 24 s » au-dessus de la barre, en rouge et plus gros sous 10 s, « ⏸ En pause · 24 s » si gelé ; caché dès que le joueur répond (à zéro, le serveur joue à sa place) |
| `expire()` | → `void` | le chrono est à zéro et le serveur a joué à la place du joueur : ferme la barre et résout `ask()` avec `null` |
| `hide()` | — | cache la barre ; un tour non répondu est abandonné |

Boutons :
- **Se coucher** → `{ type: 'fold' }` ;
- **Check** ou **Suivre X** (ou **Tapis X** si suivre met à tapis) ;
- **Miser** (personne n'a misé) ou **Relancer**, avec la fourchette min – max ;
  désactivé (« impossible ») si le joueur n'a pas plus que ce qu'il doit suivre.

Mises rapides (`_drawQuickBets()`, d'après `quickBets()` de `betting.js`) :
une rangée au-dessus des boutons, **un clic joue la mise tout de suite**
(comme sur Winamax : ni panneau, ni confirmation). Préflop sans relance
2 / 2,5 / 3 BB ; face à une mise ×2,5 / ×3 / Pot ; première mise postflop
⅓ / ½ / ⅔ / Pot ; toujours **Tapis** (cadre rouge : tout le tapis en un clic).
Cachée quand le panneau de relance est ouvert (il a ses propres raccourcis)
et quand relancer est impossible. **Relancer** reste là pour tout autre montant.

Internes : `_render()` (d'après `legalActions`), `_drawQuickBets()`, `_answer(action)`,
`_cancelPending()`, `_openRaise()` / `_closeRaise()`, `_onUnitChange()`
(jetons ↔ BB : redessine en gardant le montant choisi).

### 📄 `RaisePanel.js`

| Membre | Entrée → Sortie | À quoi il sert |
|---|---|---|
| `new RaisePanel({ onConfirm(to), onCancel() })` | — | `onConfirm` reçoit un « relancer à » **légal, en jetons** |
| `open(state)` | — | ouvre sur la relance minimum, curseur min → max, raccourcis |
| `close()`, `isOpen` | — | — |
| `refreshLabel(state)` | — | « Miser » / « Relancer à » (+ « (BB) »), clavier numérique ou décimal sur téléphone |
| `onUnitChange()` | — | redessine en gardant le dernier montant légal |

Internes :

| Méthode | Rôle |
|---|---|
| `_drawPresets()` | un bouton par raccourci de `raisePresets()` (Min, 2,5 BB, ×3, ½ pot, Pot, Tapis…) avec son montant |
| `_setAmount(to)` | écrit le montant dans l'unité courante |
| `_readAmount()` | champ → jetons (en BB : `parseBB`, « 2,5 » ou « 2.5 ») → `validateRaise` |
| `_validate()` | **à chaque frappe** : message d'erreur français, bouton désactivé tant que c'est illégal, curseur et raccourci allumé synchronisés, « Tapis · 960 » si c'est tout |
| `_confirmRaise()` | envoie seulement un montant légal |

Clavier : **Entrée** valide, **Échap** annule.

## POURQUOI / PIÈGES

- **Pourquoi des mises en un clic** : relancer demandait 3 clics (Relancer →
  raccourci → confirmer). Les tailles les plus jouées sont donc posées
  directement sur la barre ; peu de boutons (4 ou 5) pour rester lisible. Les
  tailles postflop sont celles du solveur (⅓ ½ ⅔ pot) : ce que l'IA joue aussi.

- **Même règle que le moteur** : `legalActions()` et `validateRaise()` viennent
  de `shared/poker/betting.js`. La barre ne peut pas proposer un coup que
  `PokerGame` refuserait.
- En BB, un montant affiché peut être **arrondi** : tant que le joueur n'a pas
  touché au champ, on garde le montant exact en jetons (`_exact`).

## VOIR AUSSI

[shared/poker](../../../shared/poker/MAN.md) (`betting.js`) · [game](../../game/MAN.md) (`_askPlayer`) · [ui](../MAN.md) (`chipUnit.js`)
