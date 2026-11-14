/**
 * build-man.mjs — Gather every MAN.md into one browsable page
 *
 *   npm run docs:man                       → docs/man/index.html (opens in any browser)
 *   node scripts/docs/build-man.mjs --fragment --out <file>   the page body only (for an Artifact)
 *
 * The MAN.md files stay the source of truth, next to the code they describe;
 * this page is generated from them (never edit it by hand). A MAN.md missing
 * from pages.js, or a link to a MAN.md that doesn't exist, stops the build.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { render } from './markdown.js';
import { GROUPS, pageId } from './pages.js';
import { pageHtml } from './template.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { values: args } = parseArgs({
  options: { out: { type: 'string', default: 'docs/man/index.html' }, fragment: { type: 'boolean', default: false } },
});

// ── Every MAN.md of the repository must be listed ──
function findManuals(dir, found = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.') || name === 'dist') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) findManuals(path, found);
    else if (name === 'MAN.md') found.push(relative(ROOT, dir));
  }
  return found;
}
const listed = new Set(GROUPS.flatMap((g) => g.pages));
const unlisted = findManuals(ROOT).filter((d) => !listed.has(d));
if (unlisted.length) {
  console.error(`MAN.md absents de scripts/docs/pages.js : ${unlisted.join(', ')}`);
  process.exit(1);
}

// ── Render each page ──
const broken = [];
const groups = GROUPS.map((g) => ({
  ...g,
  pages: g.pages.map((dir) => {
    const id = pageId(dir);
    const md = readFileSync(join(ROOT, dir, 'MAN.md'), 'utf8');
    const resolveLink = (href) => {
      if (!href.endsWith('MAN.md')) return null;
      const target = normalize(join(dir, href)).replace(/\/?MAN\.md$/, '') || '.';
      if (!listed.has(target)) { broken.push(`${dir}/MAN.md → ${href}`); return null; }
      return `#${pageId(target)}`;
    };
    const { html, title, headings } = render(md, { resolveLink, idPrefix: id });
    const [short, summary = ''] = title.replace(/`/g, '').split(' — ');
    return { id, dir, title, short, summary, html, headings };
  }),
}));
if (broken.length) {
  console.error(`Liens vers des MAN.md inconnus :\n  ${broken.join('\n  ')}`);
  process.exit(1);
}

const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const out = join(ROOT, args.out.startsWith('/') ? relative(ROOT, args.out) : args.out);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, pageHtml({ groups, date, standalone: !args.fragment }));
const count = groups.reduce((n, g) => n + g.pages.length, 0);
console.log(`${count} pages de manuel → ${relative(ROOT, out)}`);
