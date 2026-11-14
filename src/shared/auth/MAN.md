# 🔑 auth (partagé) — les règles d'un compte

> **Fichier** `src/shared/auth/rules.js` · **Couche** logique pure (`shared`) · **Utilisé par** `src/front/ui/auth/AuthScreen.js` (front) et `server/src/auth/schemas.js` (serveur)

## NOM

`rules.js` — les limites d'un compte (longueurs, caractères permis) et les
fonctions qui vérifient un formulaire de connexion ou d'inscription, avec des
messages d'erreur **en français**.

## SYNOPSIS

```js
import { RULES, emailError, usernameError, passwordError, checkRegister, checkLogin } from '../shared/auth/rules.js';

emailError('toi@exemple');            // 'Cet email ne semble pas valide'
usernameError('jo');                  // 'Le pseudo doit faire entre 3 et 20 caractères'
passwordError('secret');              // 'Au moins 8 caractères'

checkRegister({ email: 'a@b.fr', username: 'alice', password: 'un-bon-mot', confirm: 'un-bon-mot' });
// {}   → tout est bon

checkLogin({ email: '', password: '' });
// { email: "L'email est obligatoire", password: 'Le mot de passe est obligatoire' }
```

## DESCRIPTION

Les règles d'un compte doivent être **les mêmes** dans le navigateur et sur le
serveur. Elles sont donc écrites **une seule fois**, ici :

| Qui | Ce qu'il en fait | Est-ce que ça compte ? |
|---|---|---|
| le **front** (`AuthScreen`) | appelle `checkRegister` / `checkLogin` avant d'envoyer, pour afficher l'erreur **tout de suite**, sous le bon champ ; lit `RULES` pour les `maxlength` des champs et le texte « Au moins 8 caractères » | non : c'est du confort, n'importe qui peut envoyer une requête sans passer par l'écran |
| le **serveur** (`schemas.js`) | construit ses JSON Schemas avec les nombres de `RULES` ; Fastify refuse la requête (`400`) avant même d'exécuter la route | **oui** : c'est la vérification qui fait foi |

Le fichier ne contient que des fonctions **pures** : pas de réseau, pas de
DOM, pas d'effet de bord. Chacune renvoie un message (ou `null`, ou un objet
vide) et ne lève jamais d'erreur volontairement.

## FICHIERS

| Fichier | Rôle |
|---|---|
| `rules.js` | 1 constante exportée (`RULES`), 2 expressions régulières internes, 5 fonctions exportées |

## CONSTANTES

### `RULES` (exportée)

```js
export const RULES = {
  username: { min: 3, max: 20, pattern: '^[A-Za-z0-9_-]+$' },
  tag: { min: 1000, max: 9999 },
  password: { min: 8, max: 128 },
  emailMax: 254,
};
```

| Clé | Valeur | Sens | Lue par |
|---|---|---|---|
| `username.min` | `3` | pseudo de 3 caractères au moins | `usernameError`, `AuthScreen` (aide), `schemas.js` (`minLength`) |
| `username.max` | `20` | pseudo de 20 caractères au plus | `usernameError`, `AuthScreen` (`maxlength`), `schemas.js` (`maxLength`) |
| `username.pattern` | `'^[A-Za-z0-9_-]+$'` | lettres **sans accent**, chiffres, `_` et `-` ; ni espace ni accent | `USERNAME`, `schemas.js` (`pattern`) |
| `tag.min` · `tag.max` | `1000` · `9999` | les 4 chiffres du code ami (`Pseudo#1234`), tirés par le serveur à l'inscription | `auth/routes.js`, `parseFriendCode` |
| `password.min` | `8` | mot de passe de 8 caractères au moins | `passwordError`, `AuthScreen` (« Au moins 8 caractères »), `schemas.js` |
| `password.max` | `128` | au plus 128 (évite d'envoyer des mégaoctets à hacher) | `passwordError`, `AuthScreen`, `schemas.js` |
| `emailMax` | `254` | longueur maximale d'une adresse email (limite de la norme) | `emailError`, `AuthScreen`, `schemas.js` |

`pattern` est une **chaîne** et pas une expression régulière : le JSON Schema du
serveur attend une chaîne, et le front en fabrique l'expression avec `new RegExp`.

### `EMAIL` (interne)

```js
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

« quelque chose sans espace ni `@` » + `@` + « quelque chose » + `.` + « quelque chose ».

| Adresse | Résultat |
|---|---|
| `a@b.fr` | ✅ valide |
| `prenom.nom@ecole-42.fr` | ✅ valide |
| `toi@exemple` | ❌ pas de point après le `@` |
| `toi exemple@a.fr` | ❌ espace |
| `a@@b.fr` | ❌ deux `@` |

Volontairement **plus souple** que le `format: "email"` du serveur : elle
n'attrape que les fautes de frappe évidentes, le serveur a le dernier mot.

### `USERNAME` (interne)

```js
const USERNAME = new RegExp(RULES.username.pattern);   // /^[A-Za-z0-9_-]+$/
```

Construite **à partir de `RULES`** : changer le motif à un seul endroit le
change pour le front et le serveur.

## FONCTIONS

### `emailError`

```js
function emailError(email: string): string | null
```

| Paramètre | Type | Sens |
|---|---|---|
| `email` | `string` | l'adresse telle que tapée (espaces autour compris) |

**Valeur de retour** : `null` si l'adresse est acceptable, sinon le message
d'erreur à afficher (une chaîne en français).

**Ce qu'elle fait, dans l'ordre** (la première règle qui échoue donne le message) :

1. retire les espaces au début et à la fin (`email.trim()`) ;
2. vide → `"L'email est obligatoire"` ;
3. plus de 254 caractères **ou** ne ressemble pas à une adresse (`EMAIL`) → `'Cet email ne semble pas valide'` ;
4. sinon → `null`.

| Appel | Retour |
|---|---|
| `emailError('')` | `"L'email est obligatoire"` |
| `emailError('   ')` | `"L'email est obligatoire"` (que des espaces) |
| `emailError('toi@exemple')` | `'Cet email ne semble pas valide'` |
| `emailError('  a@b.fr  ')` | `null` (les espaces autour sont ignorés) |

---

### `usernameError`

```js
function usernameError(username: string): string | null
```

| Paramètre | Type | Sens |
|---|---|---|
| `username` | `string` | le pseudo tel que tapé |

**Valeur de retour** : `null` si le pseudo est acceptable, sinon le message d'erreur.

**Ce qu'elle fait, dans l'ordre** :

1. retire les espaces autour (`username.trim()`) ;
2. vide → `'Le pseudo est obligatoire'` ;
3. moins de 3 ou plus de 20 caractères → `'Le pseudo doit faire entre 3 et 20 caractères'` (les nombres viennent de `RULES`) ;
4. un caractère hors de `A-Z a-z 0-9 _ -` → `"Pas d'espace ni d'accent : lettres, chiffres, _ et - seulement"` ;
5. sinon → `null`.

| Appel | Retour |
|---|---|
| `usernameError('')` | `'Le pseudo est obligatoire'` |
| `usernameError('jo')` | `'Le pseudo doit faire entre 3 et 20 caractères'` |
| `usernameError('lucky luke')` | `"Pas d'espace ni d'accent : lettres, chiffres, _ et - seulement"` |
| `usernameError('Hélène')` | `"Pas d'espace ni d'accent : …"` (le `é` n'est pas permis) |
| `usernameError('luckyluku')` | `null` |

La longueur est vérifiée **avant** les caractères : `'é'` (1 caractère) reçoit
le message de longueur, pas celui des accents.

---

### `passwordError`

```js
function passwordError(password: string): string | null
```

| Paramètre | Type | Sens |
|---|---|---|
| `password` | `string` | le mot de passe tel que tapé |

**Valeur de retour** : `null` si la longueur est bonne, sinon le message d'erreur.

**Ce qu'elle fait, dans l'ordre** :

1. vide (ou `undefined` / `null`) → `'Le mot de passe est obligatoire'` ;
2. moins de 8 caractères → `'Au moins 8 caractères'` ;
3. plus de 128 caractères → `'Au plus 128 caractères'` ;
4. sinon → `null`.

| Appel | Retour |
|---|---|
| `passwordError('')` | `'Le mot de passe est obligatoire'` |
| `passwordError('secret')` | `'Au moins 8 caractères'` |
| `passwordError('x'.repeat(200))` | `'Au plus 128 caractères'` |
| `passwordError('        ')` | `null` (8 espaces) |

**Pas de `trim()` ici**, exprès : un espace au début ou à la fin fait partie du
mot de passe. Aucune règle de « complexité » (majuscule, chiffre…) : seule la
longueur compte, comme le recommande l'OWASP.

---

### `checkRegister`

```js
function checkRegister(form: {
  email: string,
  username: string,
  password: string,
  confirm?: string,
}): Record<string, string>
```

| Paramètre | Type | Sens |
|---|---|---|
| `form.email` | `string` | champ Email |
| `form.username` | `string` | champ Pseudo |
| `form.password` | `string` | champ Mot de passe |
| `form.confirm` | `string` (facultatif) | champ Confirmation ; absent = pas de vérification |

**Valeur de retour** : un objet `{ nomDuChamp: message }` avec **une entrée par
champ en erreur**. Objet vide `{}` = le formulaire peut être envoyé. Les clés
possibles sont `email`, `username`, `password`, `confirm` : ce sont les noms
des champs de l'écran, ce qui permet d'afficher chaque message sous le bon.

**Ce qu'elle fait** :

1. crée un objet vide `errors` ;
2. appelle `emailError`, `usernameError`, `passwordError` ; chaque message non `null`
   est rangé sous son champ (par la petite fonction interne `add`) ;
3. **seulement si** `confirm` est donné **et** que le mot de passe est déjà valide :
   si `confirm` diffère de `password` → `errors.confirm = 'Les deux mots de passe ne sont pas identiques'` ;
4. renvoie `errors`.

Les trois premiers champs sont **tous** vérifiés (pas d'arrêt à la première
erreur) : le joueur voit d'un coup tout ce qu'il doit corriger.

| Appel | Retour |
|---|---|
| `checkRegister({ email: 'a@b.fr', username: 'alice', password: 'un-bon-mot', confirm: 'un-bon-mot' })` | `{}` |
| `checkRegister({ email: 'a@b', username: 'jo', password: '123', confirm: '123' })` | `{ email: 'Cet email ne semble pas valide', username: 'Le pseudo doit faire entre 3 et 20 caractères', password: 'Au moins 8 caractères' }` |
| `checkRegister({ email: 'a@b.fr', username: 'alice', password: 'un-bon-mot', confirm: 'un-autre' })` | `{ confirm: 'Les deux mots de passe ne sont pas identiques' }` |
| `checkRegister({ email: 'a@b.fr', username: 'alice', password: '123', confirm: '456' })` | `{ password: 'Au moins 8 caractères' }` — pas de message `confirm` : corriger d'abord le mot de passe |
| `checkRegister({ email: 'a@b.fr', username: 'alice', password: 'un-bon-mot' })` | `{}` — sans `confirm`, rien à comparer |

**Fonction interne `add`** :

```js
const add = (field: string, message: string | null): void
```

Range `message` sous `field` dans `errors`, **seulement** s'il n'est pas `null`.
Elle évite d'écrire trois fois `if (message) errors.x = message`.

---

### `friendCode` et `parseFriendCode`

```ts
function friendCode(user: { username: string, tag: number }): string
function parseFriendCode(text: string): { username: string, tag: number } | null
```

Le **code ami** : deux joueurs peuvent porter le même pseudo, le numéro (`tag`,
tiré par le serveur) les distingue. `friendCode` l'écrit, `parseFriendCode` le
relit (pour chercher exactement un joueur dans l'onglet Amis).

| Appel | Résultat |
|---|---|
| `friendCode({ username: 'LuckyLuke', tag: 4821 })` | `'LuckyLuke#4821'` |
| `parseFriendCode(' LuckyLuke#4821 ')` | `{ username: 'LuckyLuke', tag: 4821 }` (espaces autour ignorés) |
| `parseFriendCode('LuckyLuke')`, `'Bob#0999'`, `'Bob#12345'`, `'Lucky Luke#4821'` | `null` (pas de numéro, hors de 1000–9999, pseudo invalide) |

### `checkLogin`

```js
function checkLogin(form: { email: string, password: string }): Record<string, string>
```

| Paramètre | Type | Sens |
|---|---|---|
| `form.email` | `string` | champ Email |
| `form.password` | `string` | champ Mot de passe |

**Valeur de retour** : comme `checkRegister` : `{}` si on peut envoyer, sinon
`{ email?: message, password?: message }`.

**Ce qu'elle fait** : vérifie seulement que les deux champs sont **remplis** :

1. email vide après `trim()` → `errors.email = "L'email est obligatoire"` ;
2. mot de passe vide → `errors.password = 'Le mot de passe est obligatoire'` ;
3. renvoie `errors`.

| Appel | Retour |
|---|---|
| `checkLogin({ email: 'a@b.fr', password: 'x' })` | `{}` — même un mot de passe d'1 caractère part au serveur |
| `checkLogin({ email: '', password: '' })` | `{ email: "L'email est obligatoire", password: 'Le mot de passe est obligatoire' }` |

**Pourquoi si peu** : les règles du mot de passe ont pu **changer** depuis la
création du compte. Refuser ici un ancien mot de passe de 6 caractères
empêcherait son propriétaire de se connecter. C'est le serveur qui dira si le
couple email / mot de passe est le bon.

## FONCTIONS DU LANGAGE UTILISÉES

| Fonction | Prototype | Ce qu'elle fait ici |
|---|---|---|
| `String.prototype.trim` | `str.trim(): string` | renvoie la chaîne **sans** les espaces (et retours à la ligne) au début et à la fin ; la chaîne d'origine ne change pas |
| `RegExp.prototype.test` | `regex.test(str: string): boolean` | `true` si la chaîne correspond au motif (`EMAIL`, `USERNAME`) |
| `RegExp` (constructeur) | `new RegExp(pattern: string): RegExp` | fabrique `USERNAME` à partir de la chaîne `RULES.username.pattern` |
| `.length` | `str.length: number` | nombre de caractères, comparé aux bornes de `RULES` |

## OÙ C'EST APPELÉ

| Endroit | Ce qui est utilisé |
|---|---|
| `src/front/ui/auth/AuthScreen.js` — `_send()` | `checkRegister(values)` ou `checkLogin(values)` ; chaque message va sous son champ, le curseur va au premier champ en erreur, rien n'est envoyé tant que l'objet n'est pas vide |
| `src/front/ui/auth/AuthScreen.js` — `_build()` | `RULES` pour les `maxlength` des champs et l'aide « Au moins 8 caractères » |
| `server/src/auth/schemas.js` | `RULES` pour `minLength`, `maxLength`, `pattern` des routes `register` et `login` |

`emailError`, `usernameError`, `passwordError` ne sont appelées que par
`checkRegister` aujourd'hui ; elles sont exportées pour pouvoir vérifier **un**
champ seul (par exemple pendant la frappe).

## POURQUOI / PIÈGES

- **Changer une limite** : modifier `RULES` ; le front et le serveur suivent
  ensemble. Aucune migration : les comptes existants ne sont pas revérifiés
  (d'où `checkLogin` qui ne vérifie que « rempli »).
- **Arguments obligatoires** : `emailError(undefined)` et `usernameError(undefined)`
  plantent sur `.trim()`. Ce n'est jamais le cas avec `AuthScreen`, qui envoie
  toujours la valeur des champs (une chaîne, éventuellement vide).
- **Espaces autour** : le front ignore les espaces autour de l'email et du pseudo
  (`trim()`), mais `AuthScreen` envoie les valeurs **telles que tapées** ; or le
  JSON Schema du serveur vérifie la valeur brute. `"  alice"` passe le front puis
  reçoit un `400` « Certaines informations ne sont pas valides » du serveur.
  À corriger en envoyant les valeurs nettoyées depuis `AuthScreen`.
- **Longueur et emojis** : `.length` compte les unités UTF-16 (un emoji = 2), le
  serveur compte les vrais caractères (un emoji = 1). Un mot de passe de 4 emojis
  passe le front (8) mais pas le serveur (4) : cas rare, le message du serveur s'affiche.

## VOIR AUSSI

[server/auth](../../../server/src/auth/MAN.md) (schémas, hachage, sessions) · [ui/auth](../../front/ui/auth/MAN.md) (l'écran) ·
[net](../../front/net/MAN.md) (`authApi`) · `server/README.md`
