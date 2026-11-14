/**
 * markdown.js — The small Markdown subset the MAN.md pages use → HTML
 *
 * Headings (#, ##, ###), paragraphs, fenced code, tables, blockquotes, lists
 * (- and 1.), and inline `code`, **bold** and [links](…). No dependency, so
 * the manual builds offline and renders the same everywhere.
 *
 * Links to another MAN.md become in-page links (`resolveLink`); anything else
 * relative (a README, a source file) is shown as a path, not a link: the
 * manual is a single page that may be opened far from the repository.
 */

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {string} text — one line of Markdown (already a single block's text)
 * @param {(href: string) => string | null} resolveLink — MAN.md link → '#page-id', or null
 */
export function inline(text, resolveLink) {
  // Code spans first, kept aside so nothing inside them is formatted
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${esc(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    if (/^https?:/.test(href)) return `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;
    const target = resolveLink(href);
    return target ? `<a href="${target}">${label}</a>` : `<span class="path">${label}</span>`;
  });
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

/** Split a table row, keeping escaped pipes (\|) inside cells. */
function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '')
    .split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

/** A heading's anchor: lowercase letters and digits, joined by dashes. */
export function slug(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * @param {string} md
 * @param {{ resolveLink: (href: string) => string | null, idPrefix: string }} options
 * @returns {{ html: string, title: string, headings: { level: number, text: string, id: string }[] }}
 */
export function render(md, { resolveLink, idPrefix }) {
  const lines = md.replace(/\r/g, '').split('\n');
  const out = [];
  const headings = [];
  let title = '';
  let afterTitle = false;
  const inl = (t) => inline(t, resolveLink);

  for (let i = 0; i < lines.length;) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Fenced code
    const fence = /^```(\w*)/.exec(line);
    if (fence) {
      const body = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) body.push(lines[i]);
      i++;
      out.push(`<pre class="code" data-lang="${fence[1] || 'texte'}"><code>${esc(body.join('\n'))}</code></pre>`);
      afterTitle = false;
      continue;
    }

    // Headings
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      const id = `${idPrefix}--${slug(text)}`;
      if (level === 1) {
        title = text;
        out.push(`<h1>${inl(text)}</h1>`);
        afterTitle = true;
      } else {
        headings.push({ level, text, id });
        out.push(`<h${level} id="${id}">${inl(text)}</h${level}>`);
        afterTitle = false;
      }
      i++;
      continue;
    }

    // Blockquote (right after the title: the page's facts, shown as chips)
    if (line.startsWith('>')) {
      const body = [];
      for (; i < lines.length && lines[i].startsWith('>'); i++) body.push(lines[i].replace(/^>\s?/, ''));
      if (afterTitle) {
        const parts = body.join(' · ').split(' · ').map((p) => {
          const m = /^\*\*([^*]+)\*\*\s*(.*)$/.exec(p.trim());
          return m ? `<span class="fact"><b>${esc(m[1])}</b> ${inl(m[2])}</span>` : `<span class="fact">${inl(p.trim())}</span>`;
        });
        out.push(`<div class="facts">${parts.join('')}</div>`);
      } else {
        out.push(`<blockquote>${inl(body.join(' '))}</blockquote>`);
      }
      afterTitle = false;
      continue;
    }

    // Table
    if (line.trim().startsWith('|') && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? '')) {
      const head = cells(line);
      const rows = [];
      for (i += 2; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(cells(lines[i]));
      out.push(`<div class="table"><table><thead><tr>${head.map((c) => `<th>${inl(c)}</th>`).join('')}</tr></thead>`
        + `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inl(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      afterTitle = false;
      continue;
    }

    // Lists (a line starting with spaces continues the previous item)
    const item = /^(-|\d+\.)\s+(.*)$/.exec(line);
    if (item) {
      const ordered = item[1] !== '-';
      const items = [];
      while (i < lines.length) {
        const m = /^(-|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (m) { items.push(m[2]); i++; continue; }
        if (/^\s+\S/.test(lines[i]) && items.length) { items[items.length - 1] += ` ${lines[i].trim()}`; i++; continue; }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((t) => `<li>${inl(t)}</li>`).join('')}</${tag}>`);
      afterTitle = false;
      continue;
    }

    // Paragraph: until a blank line or another block
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>|\||-\s|\d+\.\s)/.test(lines[i])) para.push(lines[i++].trim());
    if (!para.length) para.push(lines[i++].trim());
    out.push(`<p>${inl(para.join(' '))}</p>`);
    afterTitle = false;
  }

  return { html: out.join('\n'), title, headings };
}
