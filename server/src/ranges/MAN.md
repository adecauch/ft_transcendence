# 🗂️ server/ranges — les ranges enregistrées du joueur

> **Dossier** `server/src/ranges/` · **Routes** `/api/ranges` (connecté) · **Table** `SavedRange` · **Testé par** `server/tests/ranges.test.mjs`

## NOM

`ranges` — enregistrer, renommer, modifier et supprimer les ranges peintes
dans « 🖌️ Construire ».

## SYNOPSIS

```http
GET    /api/ranges          → { ranges: [{ id, name, range, createdAt, updatedAt }] }
POST   /api/ranges          { name, range }    → 201 { range }
PUT    /api/ranges/:id      { name?, range? }  → { range }
DELETE /api/ranges/:id                         → 204
```

`range = { "AKs": { "raise": 1 }, "77": { "call": 0.5 }, … }` — main absente = se coucher.

## DESCRIPTION

Chaque joueur ne voit et ne modifie que **ses** ranges : chaque requête filtre
sur `userId`, l'id d'un autre se comporte comme s'il n'existait pas. Nom unique
par joueur, **50 ranges au maximum**. Le **contenu** est vérifié par
`cleanRange()` (partagé avec le front), la **forme** par le JSON Schema.

## FICHIERS ET FONCTIONS

### 📄 `schemas.js`

| Schéma | Vérifie |
|---|---|
| `createSchema` | `name` (1–40) et `range` (≤ 169 mains, fréquences 0–1) obligatoires |
| `updateSchema` | au moins un des deux ; `id` en paramètre |
| `idSchema` | `id` entier ≥ 1 |

### 📄 `service.js`

| Fonction | Entrée → Sortie | À quoi elle sert |
|---|---|---|
| `listRanges(prisma, userId)` | → `[range]` | les plus récemment modifiées d'abord |
| `createRange(prisma, userId, { name, range })` | → `range` | refuse au-delà de `MAX_RANGES` (50) |
| `updateRange(prisma, userId, id, { name?, range? })` | → `range` | `updateMany` filtré sur `userId` : 0 ligne = `404` |
| `deleteRange(prisma, userId, id)` | → `void` | idem |
| `RangeRefused(status, message)` | classe d'erreur | un refus avec son code HTTP et un message français |
| `checked(range)` *(interne)* | → range propre | `cleanRange`, erreur → `400` |
| `unique(write)` *(interne)* | → résultat | contrainte unique de la base (`P2002`) → `409` « Tu as déjà une range avec ce nom » |

### 📄 `routes.js`

Les 4 routes, `requireUser` sur toutes ; un `setErrorHandler` transforme
`RangeRefused` en `{ error }` avec son code (`400`, `404`, `409`).

## POURQUOI / PIÈGES

- On laisse **la base** garantir l'unicité du nom (pas de « vérifier puis
  écrire », qui laisserait passer deux envois simultanés) et on traduit son refus.

## VOIR AUSSI

[poker](../../../src/shared/poker/MAN.md) (`cleanRange`) · [ui/ranges](../../../src/front/ui/ranges/MAN.md) (`BuildMode`) ·
[net](../../../src/front/net/MAN.md) (`rangesApi`) · `server/README.md`
