/**
 * pages.js — Which MAN.md pages make the manual, in which order and group
 *
 * Adding a section's manual: write its MAN.md next to its code, then add its
 * folder here (the build refuses a MAN.md that is not listed, so none is
 * forgotten).
 */

export const GROUPS = [
  {
    id: 'shared',
    label: 'Logique pure',
    hint: 'src/shared/ — règles, IA, rejeu, partagés par le jeu et le serveur',
    pages: ['src/shared/poker', 'src/shared/ai', 'src/shared/ai/mccfr', 'src/shared/stats', 'src/shared/theory', 'src/shared/auth'],
  },
  {
    id: 'server',
    label: 'Serveur',
    hint: 'server/ — Fastify, Prisma, PostgreSQL',
    pages: ['server', 'server/src/auth', 'server/src/games', 'server/src/stats', 'server/src/ranges', 'server/src/table', 'server/src/friends', 'server/src/lobby'],
  },
  {
    id: 'front',
    label: 'Affichage',
    hint: 'src/front/ — la salle 3D et les menus',
    pages: [
      'src/front', 'src/front/game', 'src/front/render', 'src/front/camera', 'src/front/input',
      'src/front/scene', 'src/front/scene/room', 'src/front/scene/dealer', 'src/front/scene/opponents',
      'src/front/scene/cards', 'src/front/scene/chips', 'src/front/scene/start',
      'src/front/ui', 'src/front/ui/actionBar', 'src/front/ui/auth', 'src/front/ui/newGame',
      'src/front/ui/pause', 'src/front/ui/overlay', 'src/front/ui/stats', 'src/front/ui/stats/dashboard',
      'src/front/ui/ranges', 'src/front/ui/friends', 'src/front/ui/online', 'src/front/net', 'src/front/config',
    ],
  },
  {
    id: 'tools',
    label: 'Outils',
    hint: 'scripts/ et tests',
    pages: ['scripts', 'tests'],
  },
];

/** 'src/shared/ai/mccfr' → 'shared-ai-mccfr' (the page's anchor). */
export function pageId(dir) {
  return dir.replace(/^src\//, '').replace(/\/src\//, '/').replace(/\//g, '-');
}
