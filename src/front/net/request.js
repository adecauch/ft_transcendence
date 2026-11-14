/**
 * request.js — One fetch() to the back-end, never throwing
 *
 * Resolves to { ok, status, data } on an answer, with `error` (French) when
 * it's not a success, or { ok: false, offline: true, error } when the server
 * can't be reached. Same origin (/api is proxied by Vite, later nginx), so
 * the session cookie goes along by itself.
 */

const MESSAGES = {
  400: 'Certaines informations ne sont pas valides',
  401: 'Connecte-toi pour continuer',
  404: 'Introuvable',
  429: "Trop d'essais : attends une minute avant de réessayer",
  500: 'Le serveur a rencontré un problème, réessaie plus tard',
};
export const OFFLINE = 'Serveur injoignable : le back-end est-il lancé ? (npm run server)';

/**
 * @param {'GET' | 'POST' | 'PUT' | 'DELETE'} method
 * @param {string} url
 * @param {object} [body]
 */
export async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, offline: true, error: OFFLINE };
  }

  if (res.status === 204) return { ok: true, status: 204, data: null };
  const data = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, status: res.status, data };

  // Vite answers 5xx itself when the server behind the proxy is down
  if (res.status >= 502 && res.status <= 504) return { ok: false, status: res.status, offline: true, error: OFFLINE };
  // Our own messages are in French; Fastify's validation ones (400) are not
  const ours = res.status !== 400 && typeof data.error === 'string';
  return {
    ok: false,
    status: res.status,
    data,
    field: data.field,
    error: ours ? data.error : MESSAGES[res.status] ?? MESSAGES[500],
  };
}
