/**
 * template.js — The manual's single HTML page: layout, saloon style, navigation
 *
 * Same look as the game's menus (src/front/ui/theme/saloon.css): dark wood,
 * cream text, gold labels; Rye / Lilita One / Nunito. Very large, high
 * contrast text (the user's screen is damaged). Light and dark themes.
 *
 * One page at a time, chosen by the address's #anchor (#shared-poker,
 * #shared-poker--synopsis): links stay shareable and the browser's back button works.
 */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `
/* Layout: wooden rail of sections on the left, the open man page on leather to the right */
:root {
  --bg: #f3e6c8;
  --panel: #fbf3e0;
  --rail: #4a2c17;
  --rail-ink: #fff1d2;
  --ink: #24140a;
  --dim: #5f4630;
  --gold: #8a5a00;
  --gold-bg: #f7bb2a;
  --line: #d9c49b;
  --code-bg: #efe0bd;
  --pre-bg: #2a1a10;
  --pre-ink: #fff1d2;
  --focus: #c0392b;
  --display: 'Rye', 'Georgia', serif;
  --label: 'Lilita One', 'Trebuchet MS', sans-serif;
  --body: 'Nunito', 'Segoe UI', system-ui, sans-serif;
  --mono: 'IBM Plex Mono', 'DejaVu Sans Mono', Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #1b110a; --panel: #2a1a10; --rail: #120b06; --rail-ink: #fff1d2; --ink: #fff1d2; --dim: #e8cfa3;
    --gold: #f7bb2a; --gold-bg: #f7bb2a; --line: #4d3320; --code-bg: #3b2616; --pre-bg: #120b06; --pre-ink: #fff1d2;
    --focus: #ffe07a; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #1b110a; --panel: #2a1a10; --rail: #120b06; --rail-ink: #fff1d2; --ink: #fff1d2; --dim: #e8cfa3;
  --gold: #f7bb2a; --gold-bg: #f7bb2a; --line: #4d3320; --code-bg: #3b2616; --pre-bg: #120b06; --pre-ink: #fff1d2;
  --focus: #ffe07a; color-scheme: dark;
}
* { box-sizing: border-box; }
html { scroll-padding-top: 1rem; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 600 1.19rem/1.6 var(--body); }
a { color: inherit; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }

.man { display: grid; grid-template-columns: minmax(17rem, 21rem) minmax(0, 1fr); min-height: 100vh; }

/* ── Rail ── */
.rail { background: var(--rail); color: var(--rail-ink); padding: 1.4rem 1rem 2rem; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.rail-title { font: 400 1.7rem/1.1 var(--display); color: #f7bb2a; margin: 0 0 .2rem; text-decoration: none; display: block; }
.rail-sub { margin: 0 0 1rem; color: #e8cfa3; font-size: .95rem; }
.search { width: 100%; font: 700 1.05rem var(--body); padding: .6rem .8rem; border-radius: 10px; border: 3px solid #22120a; background: #fff1d2; color: #24140a; }
.rail-group { margin-top: 1.3rem; }
.rail-group h2 { font: 400 1.15rem var(--label); letter-spacing: .06em; text-transform: uppercase; color: #f7bb2a; margin: 0 0 .1rem; }
.rail-group p { margin: 0 0 .4rem; font-size: .85rem; color: #e8cfa3; }
.rail ul { list-style: none; margin: 0; padding: 0; display: grid; gap: .15rem; }
.rail li a { display: block; padding: .35rem .6rem; border-radius: 8px; text-decoration: none; font: 700 1.02rem/1.3 var(--body); color: #fff1d2; }
.rail li a small { display: block; font: 500 .8rem var(--mono); color: #e8cfa3; }
.rail li a:hover { background: rgba(247, 187, 42, .16); }
.rail li a[aria-current="page"] { background: #f7bb2a; color: #22120a; }
.rail li a[aria-current="page"] small { color: #4a2c17; }
.rail li[hidden] { display: none; }
.rail .d1 { margin-left: .9rem; } .rail .d2 { margin-left: 1.8rem; }

/* ── Page ── */
main { min-width: 0; padding-inline: clamp(16px, 4vw, 3.5rem); padding-block: 2rem 4rem; }
.page { max-width: 62rem; }
.page[hidden] { display: none; }
h1 { font: 400 clamp(1.9rem, 4vw, 2.7rem)/1.15 var(--label); margin: 0 0 .8rem; text-wrap: balance; }
h1 code { font: inherit; background: none; padding: 0; }
h2 { font: 400 1.35rem var(--label); letter-spacing: .12em; text-transform: uppercase; color: var(--gold);
     margin: 2.4rem 0 .8rem; padding-bottom: .3rem; border-bottom: 3px solid var(--line); text-wrap: balance; }
h3 { font: 800 1.2rem var(--body); margin: 2rem 0 .6rem; }
h3 code { font-size: 1.05rem; }
p, li { max-width: 68ch; }
ul, ol { padding-left: 1.4rem; }
li + li { margin-top: .25rem; }
strong { font-weight: 900; }
code { font: 500 .92em var(--mono); background: var(--code-bg); padding: .05em .35em; border-radius: 5px; overflow-wrap: anywhere; }
.path { font: 500 .92em var(--mono); border-bottom: 2px dotted var(--line); }
a:not(.rail a) { color: var(--gold); font-weight: 800; text-underline-offset: 3px; }
blockquote { margin: 1rem 0; padding: .7rem 1rem; border-left: 6px solid var(--gold-bg); background: var(--panel); }

.facts { display: flex; flex-wrap: wrap; gap: .5rem; margin: 0 0 1.2rem; }
.fact { background: var(--panel); border: 2px solid var(--line); border-radius: 999px; padding: .2rem .8rem; font-size: .95rem; }
.fact b { font: 400 .85rem var(--label); letter-spacing: .06em; text-transform: uppercase; color: var(--gold); margin-right: .25rem; }

.toc { display: flex; flex-wrap: wrap; gap: .4rem; margin: 0 0 .5rem; padding: 0; list-style: none; }
.toc li { margin: 0; }
.toc a { display: inline-block; font: 400 .9rem var(--label); letter-spacing: .06em; text-transform: uppercase; text-decoration: none;
         color: var(--ink); background: var(--panel); border: 2px solid var(--line); border-radius: 8px; padding: .15rem .6rem; }
.toc a:hover { border-color: var(--gold); }

pre.code { position: relative; background: var(--pre-bg); color: var(--pre-ink); padding: 1rem 1.1rem; border-radius: 12px; overflow-x: auto;
           font: 500 1rem/1.5 var(--mono); border: 3px solid #22120a; }
pre.code code { background: none; padding: 0; font: inherit; overflow-wrap: normal; }
pre.code::before { content: attr(data-lang); position: absolute; top: .3rem; right: .7rem; font: 400 .75rem var(--label);
                   letter-spacing: .08em; text-transform: uppercase; color: #f7bb2a; }

.table { overflow-x: auto; margin: .8rem 0 1.2rem; border: 3px solid var(--line); border-radius: 12px; }
table { border-collapse: collapse; width: 100%; font-size: 1.02rem; }
th { font: 400 .95rem var(--label); letter-spacing: .05em; text-transform: uppercase; text-align: left; background: var(--panel); color: var(--gold); }
th, td { padding: .55rem .8rem; vertical-align: top; border-bottom: 1px solid var(--line); }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--panel) 55%, transparent); }
td:first-child code { font-weight: 700; white-space: nowrap; }
td:first-child { min-width: 9rem; }

.pager { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-top: 3rem; padding-top: 1rem; border-top: 3px solid var(--line); }
.pager a { text-decoration: none; background: var(--panel); border: 3px solid var(--line); border-radius: 12px; padding: .5rem 1rem; }
.pager a small { display: block; font: 400 .8rem var(--label); letter-spacing: .08em; text-transform: uppercase; color: var(--dim); }

/* ── Home ── */
.home-lead { font-size: 1.25rem; max-width: 60ch; }
.home-group { margin-top: 2rem; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: .8rem; }
.card { display: flex; flex-direction: column; gap: .25rem; text-decoration: none; background: var(--panel); border: 3px solid var(--line);
        border-radius: 14px; padding: .8rem 1rem; color: var(--ink) !important; font-weight: 600 !important; }
.card:hover { border-color: var(--gold); }
.card-title { font: 400 1.2rem var(--label); color: var(--ink); }
.card-path { font: 500 .85rem var(--mono); color: var(--dim); }
.card-text { font-size: 1rem; }
.theme-btn { margin-top: 1rem; font: 400 1rem var(--label); background: #f7bb2a; color: #22120a; border: 3px solid #22120a; border-radius: 10px; padding: .35rem .8rem; cursor: pointer; }

@media (max-width: 860px) {
  .man { grid-template-columns: minmax(0, 1fr); }
  .rail { position: static; height: auto; max-height: none; }
  .rail nav { max-height: 45vh; overflow-y: auto; }
}
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
`;

const SCRIPT = `
(() => {
  const pages = [...document.querySelectorAll('.page')];
  const links = [...document.querySelectorAll('.rail li a')];
  function show() {
    const hash = decodeURIComponent(location.hash.slice(1));
    const id = hash.split('--')[0] || 'sommaire';
    const page = pages.find((p) => p.id === id) || pages[0];
    pages.forEach((p) => { p.hidden = p !== page; });
    links.forEach((a) => a.setAttribute('aria-current', a.getAttribute('href') === '#' + page.id ? 'page' : 'false'));
    const target = hash.includes('--') ? document.getElementById(hash) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
     document.title = page.dataset.title ? page.dataset.title + ' · Manuel Poker Transcendence' : 'Manuel Poker Transcendence';
  }
  window.addEventListener('hashchange', show);
  show();

  // Search: keep the sections whose page mentions every word typed
  const text = new Map(pages.map((p) => [p.id, p.textContent.toLowerCase()]));
  document.getElementById('man-search').addEventListener('input', (e) => {
    const words = e.target.value.toLowerCase().split(/\\s+/).filter(Boolean);
    links.forEach((a) => {
      const body = text.get(a.getAttribute('href').slice(1)) || '';
      a.parentElement.hidden = !words.every((w) => body.includes(w));
    });
  });

  // Theme: follows the system; the button forces the other one
  document.getElementById('man-theme').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
  });
})();
`;

/**
 * @param {{ groups: { id, label, hint, pages: { id, dir, title, short, summary, html, headings }[] }[], date: string, standalone: boolean }} manual
 *   standalone — a full document (the local file); false: the page body only (the Artifact adds its own skeleton)
 */
export function pageHtml({ groups, date, standalone }) {
  const all = groups.flatMap((g) => g.pages);
  const depth = (dir) => Math.max(0, dir.split('/').length - (dir.startsWith('server') ? 1 : 2) - 1);

  const rail = `
    <aside class="rail">
      <a class="rail-title" href="#sommaire">Manuel du saloon</a>
      <p class="rail-sub">Poker Transcendence · une page par section du code</p>
      <label for="man-search" class="rail-sub">Chercher une fonction, un fichier…</label>
      <input id="man-search" class="search" type="search" placeholder="ex. validateRaise" autocomplete="off">
      <nav aria-label="Sections">
        ${groups.map((g) => `
          <div class="rail-group">
            <h2>${esc(g.label)}</h2>
            <p>${esc(g.hint)}</p>
            <ul>${g.pages.map((p) => `<li class="d${Math.min(2, depth(p.dir))}"><a href="#${p.id}">${esc(p.short)}<small>${esc(p.dir)}/</small></a></li>`).join('')}</ul>
          </div>`).join('')}
      </nav>
      <button type="button" id="man-theme" class="theme-btn">Clair / sombre</button>
    </aside>`;

  const home = `
    <section class="page" id="sommaire" data-title="">
      <h1>Manuel du code</h1>
      <p class="home-lead">Une page de manuel par section du projet : son rôle, chaque fonction avec ce qu'elle reçoit et ce qu'elle rend,
      un exemple, les pièges déjà rencontrés et les sections voisines. Les sources sont les fichiers <code>MAN.md</code>
      rangés à côté du code ; cette page est générée par <code>npm run docs:man</code> (${esc(date)}).</p>
      ${groups.map((g) => `
        <div class="home-group">
          <h2>${esc(g.label)}</h2>
          <div class="cards">${g.pages.map((p) => `
            <a class="card" href="#${p.id}">
              <span class="card-title">${esc(p.short)}</span>
              <span class="card-path">${esc(p.dir)}/</span>
              <span class="card-text">${esc(p.summary)}</span>
            </a>`).join('')}</div>
        </div>`).join('')}
    </section>`;

  const pages = all.map((p, i) => {
    const prev = all[i - 1];
    const next = all[i + 1];
    const toc = p.headings.filter((h) => h.level === 2)
      .map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join('');
    const [first, ...rest] = p.html.split('\n');
    // The title, the facts, then the list of the page's parts
    const factsEnd = rest[0]?.startsWith('<div class="facts">') ? 1 : 0;
    return `
    <section class="page" id="${p.id}" data-title="${esc(p.short)}" hidden>
      ${first}
      ${rest.slice(0, factsEnd).join('\n')}
      <ul class="toc" aria-label="Parties de la page">${toc}</ul>
      ${rest.slice(factsEnd).join('\n')}
      <nav class="pager" aria-label="Pages voisines">
        ${prev ? `<a href="#${prev.id}"><small>← Précédente</small>${esc(prev.short)}</a>` : '<span></span>'}
        ${next ? `<a href="#${next.id}"><small>Suivante →</small>${esc(next.short)}</a>` : ''}
      </nav>
    </section>`;
  }).join('');

  const body = `
<title>Manuel Poker Transcendence</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=Lilita+One&family=Nunito:wght@600;700;800;900&family=Rye&display=swap">
<style>${CSS}</style>
<div class="man">
  ${rail}
  <main>${home}${pages}</main>
</div>
<script>${SCRIPT}</script>`;

  if (!standalone) return body;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${body.split('<div class="man">')[0]}
</head>
<body>
<div class="man">${body.split('<div class="man">')[1]}
</body>
</html>
`;
}
