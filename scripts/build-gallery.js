/**
 * SAMARPAN — Retreat Gallery Auto-Builder
 * Add to build command: "... && node scripts/build-gallery.js"
 * Rebuilds the gallery grid AND the lightbox's galleryImages[] JS
 * array so add/delete/reorder in the CMS is fully reflected —
 * add a photo, it appears in the grid AND becomes clickable in the
 * lightbox at the right index; delete one in the CMS, it disappears
 * from both.
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'gallery');
const INDEX_HTML = path.join(ROOT, 'index.html');

const GRID_START = '<!-- CMS:GALLERY:START -->';
const GRID_END = '<!-- CMS:GALLERY:END -->';
const JS_START = '/* CMS:GALLERY_IMAGES:START */';
const JS_END = '/* CMS:GALLERY_IMAGES:END */';

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeJs(str = '') { return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

function readPhotos() {
  if (!fs.existsSync(CONTENT_DIR)) { console.log('No content/gallery yet — skipping.'); return []; }
  return fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'))
    .map(file => { const { data } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')); return data; })
    .filter(g => g.image && g.featured !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function buildGridItem(photo, idx) {
  return `      <div class="gallery-item rounded-sm" onclick="openLightbox(${idx})" role="button" tabindex="0"><img src="${escapeHtml(photo.image)}" loading="lazy" alt="${escapeHtml(photo.caption || '')}"><div class="gallery-overlay"><i data-lucide="zoom-in" class="gallery-icon w-7 h-7"></i></div></div>`;
}

function main() {
  const photos = readPhotos();
  console.log(`Found ${photos.length} gallery photo(s)`);
  if (!fs.existsSync(INDEX_HTML)) return;
  let html = fs.readFileSync(INDEX_HTML, 'utf8');

  if (!html.includes(GRID_START) || !html.includes(GRID_END)) {
    console.log(`⚠️  Grid markers not found — add ${GRID_START}/${GRID_END} once, manually, around the .gallery-item blocks.`);
    return;
  }
  if (!html.includes(JS_START) || !html.includes(JS_END)) {
    console.log(`⚠️  JS markers not found — wrap the "var galleryImages = [...]" line once, manually, with ${JS_START}/${JS_END}.`);
    return;
  }
  if (!photos.length) { console.log('ℹ️  No gallery photos — left untouched.'); return; }

  const gridHtml = photos.map(buildGridItem).join('\n');
  let before = html.split(GRID_START)[0];
  let after = html.split(GRID_END)[1];
  html = `${before}${GRID_START}\n${gridHtml}\n      ${GRID_END}${after}`;

  const jsArray = `${JS_START}
  var galleryImages = [
    ${photos.map(p => `'${escapeJs(p.image)}'`).join(',\n    ')}
  ];
  ${JS_END}`;
  before = html.split(JS_START)[0];
  after = html.split(JS_END)[1];
  html = `${before}${jsArray}${after}`;

  fs.writeFileSync(INDEX_HTML, html);
  console.log(`✅ Gallery updated with ${photos.length} photo(s) — grid + lightbox both synced.`);
}
main();
