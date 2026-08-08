/**
 * SAMARPAN — Publications Auto-Builder
 * Add to build command: "... && node scripts/build-publications.js"
 * Rebuilds #publications grid between CMS:PUBLICATIONS:START/END.
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'publications');
const INDEX_HTML = path.join(ROOT, 'index.html');
const START_MARKER = '<!-- CMS:PUBLICATIONS:START -->';
const END_MARKER = '<!-- CMS:PUBLICATIONS:END -->';

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readItems() {
  if (!fs.existsSync(CONTENT_DIR)) { console.log('No content/publications yet — skipping.'); return []; }
  return fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'))
    .map(file => { const { data } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')); return data; })
    .filter(p => p.title && p.featured !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function buildCard(p) {
  return `      <a href="${escapeHtml(p.link || '#')}" class="pub-card">
        <div class="pub-card-icon"><i data-lucide="${escapeHtml(p.icon || 'book-marked')}" class="w-5 h-5 ${escapeHtml(p.iconColor || 'text-clay')}"></i></div>
        <span class="pub-card-tag">${escapeHtml(p.tag || 'Journal')}</span>
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.description || '')}</p>
        <span class="pub-card-link">${escapeHtml(p.buttonLabel || 'Read')} <i data-lucide="arrow-right" class="w-3 h-3"></i></span>
      </a>`;
}

function main() {
  const items = readItems();
  console.log(`Found ${items.length} publication(s)`);
  if (!fs.existsSync(INDEX_HTML)) return;
  let html = fs.readFileSync(INDEX_HTML, 'utf8');
  if (!html.includes(START_MARKER) || !html.includes(END_MARKER)) {
    console.log(`⚠️  Markers not found in index.html — add ${START_MARKER}/${END_MARKER} once, manually.`);
    return;
  }
  if (!items.length) { console.log('ℹ️  No publications — section left untouched.'); return; }
  const cardsHtml = items.map(buildCard).join('\n');
  const before = html.split(START_MARKER)[0];
  const after = html.split(END_MARKER)[1];
  html = `${before}${START_MARKER}\n${cardsHtml}\n      ${END_MARKER}${after}`;
  fs.writeFileSync(INDEX_HTML, html);
  console.log(`✅ Publications updated with ${items.length} card(s).`);
}
main();
