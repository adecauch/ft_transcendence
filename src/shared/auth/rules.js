/**
 * rules.js — Account rules, shared by the front and the server
 *
 * The server (server/src/auth/schemas.js) builds its JSON Schemas from RULES:
 * that check is the one that counts. The front runs checkRegister() /
 * checkLogin() before sending, to show the mistakes right away, in French,
 * under the right field. Same numbers on both sides, one place to change them.
 *
 * Friend code: two players may share a pseudo. At sign-up, the server gives
 * each account a random 4-digit number, `tag`: the pair (username, tag) is
 * unique, and "LuckyLuke#4821" is how a friend finds you (as on Battle.net
 * or Riot): friendCode() writes it, parseFriendCode() reads it back.
 */

export const RULES = {
  username: { min: 3, max: 20, pattern: '^[A-Za-z0-9_-]+$' },
  tag: { min: 1000, max: 9999 },
  password: { min: 8, max: 128 },
  emailMax: 254,
};

// Looser than the server's `format: "email"` on purpose: only catches typos;
// the server has the final word.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = new RegExp(RULES.username.pattern);

/** @returns {string | null} what's wrong with this email, in French */
export function emailError(email) {
  const e = email.trim();
  if (!e) return "L'email est obligatoire";
  if (e.length > RULES.emailMax || !EMAIL.test(e)) return 'Cet email ne semble pas valide';
  return null;
}

export function usernameError(username) {
  const u = username.trim();
  const { min, max } = RULES.username;
  if (!u) return 'Le pseudo est obligatoire';
  if (u.length < min || u.length > max) return `Le pseudo doit faire entre ${min} et ${max} caractères`;
  if (!USERNAME.test(u)) return "Pas d'espace ni d'accent : lettres, chiffres, _ et - seulement";
  return null;
}

/** @param {{ username: string, tag: number }} user @returns {string} 'LuckyLuke#4821' */
export function friendCode({ username, tag }) {
  return `${username}#${tag}`;
}

const FRIEND_CODE = new RegExp(`^(${RULES.username.pattern.slice(1, -1)})#(\\d{4})$`);

/**
 * 'LuckyLuke#4821' (spaces around ignored) → { username, tag }; anything else → null.
 * @param {string} text
 * @returns {{ username: string, tag: number } | null}
 */
export function parseFriendCode(text) {
  const m = FRIEND_CODE.exec(String(text).trim());
  if (!m) return null;
  const tag = Number(m[2]);
  const { min, max } = RULES.username;
  if (m[1].length < min || m[1].length > max || tag < RULES.tag.min || tag > RULES.tag.max) return null;
  return { username: m[1], tag };
}

export function passwordError(password) {
  const { min, max } = RULES.password;
  if (!password) return 'Le mot de passe est obligatoire';
  if (password.length < min) return `Au moins ${min} caractères`;
  if (password.length > max) return `Au plus ${max} caractères`;
  return null;
}

/**
 * @param {{ email: string, username: string, password: string, confirm?: string }} form
 * @returns {Record<string, string>} field → message; empty when all is fine
 */
export function checkRegister({ email, username, password, confirm }) {
  const errors = {};
  const add = (field, message) => { if (message) errors[field] = message; };
  add('email', emailError(email));
  add('username', usernameError(username));
  add('password', passwordError(password));
  if (confirm !== undefined && !errors.password && confirm !== password) {
    errors.confirm = 'Les deux mots de passe ne sont pas identiques';
  }
  return errors;
}

/** Login: just "filled in" (a password's rules may have changed since the account was made). */
export function checkLogin({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = "L'email est obligatoire";
  if (!password) errors.password = 'Le mot de passe est obligatoire';
  return errors;
}
