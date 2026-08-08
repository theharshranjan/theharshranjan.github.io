/**
 * SAMARPAN — Media Centre Tabs Auto-Builder
 * ---------------------------------
 * Add to the deploy build command: "... && node scripts/build-media-items.js"
 *
 * Reads content/media_items/*.md (Podcasts/Interviews/News/Events) and
 * rebuilds FOUR separate panes inside #mediaPane in index.html — one
 * per type, each holding AS MANY cards as exist in the CMS (not just
 * one placeholder like before). Also rewrites the mediaTab() JS
 * function to toggle visibility between panes instead of swapping a
 * single hardcoded item.
 *
 * The "Videos" tab is untouched here — that one is driven separately
 * by build-videos.js and the .vid-testi-card grid above the tabs.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'media_items');
const INDEX_HTML = path.join(ROOT, 'index.html');
const OUTPUT_DIR = path.join(ROOT, 'media');
const TEMPLATE_PATH = path.join(ROOT, 'templates', 'media-item-template.html');

const TYPES = ['Podcast', 'Interview', 'News', 'Event'];
const TYPE_KEY = { Podcast: 'podcasts', Interview: 'interviews', News: 'news', Event: 'events' };

const PANES_START = '<!-- CMS:MEDIA_PANES:START -->';
const PANES_END = '<!-- CMS:MEDIA_PANES:END -->';
const JS_START = '/* CMS:MEDIA_TABS_JS:START */';
const JS_END = '/* CMS:MEDIA_TABS_JS:END */';

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readMediaItems() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.log('No content/media_items folder yet — skipping media tabs build.');
    return [];
  }
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  return files
    .map(file => {
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
      const { data, content } = matter(raw);
      const slug = file.replace(/\.md$/, '');
      return { ...data, slug, bodyMarkdown: content };
    })
    .filter(m => m.title && m.type && m.featured !== false);
}

function fill(tpl, data) {
  return tpl.replace(/{{(\w+)}}/g, (_, key) => (data[key] !== undefined ? data[key] : ''));
}

function buildItemPage(item, template) {
  const bodyHtml = marked.parse(item.bodyMarkdown || '<p>Content coming soon.</p>');
  const imageHtml = item.image
    ? `<div class="rounded-sm overflow-hidden mb-8"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" style="width:100%;"></div>`
    : '';
  const html = fill(template, {
    title: escapeHtml(item.title),
    description: escapeHtml(item.description || ''),
    typeLabel: escapeHtml(item.type),
    imageHtml,
    bodyHtml
  });
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, `${item.slug}.html`), html);
}

function cardLink(item) {
  if (item.linkMode === 'external') return item.link || '#journal';
  return `media/${item.slug}.html`;
}

function buildCard(item) {
  return `<a href="${escapeHtml(cardLink(item))}" class="journal-card rounded flex flex-col overflow-hidden"><div class="p-5"><span class="text-[9px] uppercase tracking-widest text-clay font-bold">${escapeHtml(item.type)}</span><h4 class="font-serif text-base mt-1" style="color:var(--text);">${escapeHtml(item.title)}</h4><p class="font-sans text-xs mt-1.5" style="color:var(--text-muted);">${escapeHtml(item.description || '')}</p></div></a>`;
}

function buildPane(type, items, isFirst) {
  const key = TYPE_KEY[type];
  const sorted = items
    .filter(i => i.type === type)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const cardsHtml = sorted.length
    ? sorted.map(buildCard).join('\n      ')
    : `<a href="#journal" class="journal-card rounded flex flex-col overflow-hidden" style="grid-column:1/-1;"><div class="p-6 text-center"><span class="text-[9px] uppercase tracking-widest text-clay font-bold">${escapeHtml(type)}</span><h4 class="font-serif text-lg mt-1" style="color:var(--text);">Coming Soon</h4></div></a>`;

  return `    <div class="media-pane-group grid grid-cols-1 sm:grid-cols-3 gap-6"${isFirst ? '' : ' style="display:none;"'} data-media-type="${key}">
      ${cardsHtml}
    </div>`;
}

function updateMediaPanes(items) {
  if (!fs.existsSync(INDEX_HTML)) return;
  let html = fs.readFileSync(INDEX_HTML, 'utf8');

  if (!html.includes(PANES_START) || !html.includes(PANES_END)) {
    console.log(`⚠️  Could not find ${PANES_START} / ${PANES_END} markers in index.html — see instructions to add them once, manually, replacing the old single #mediaPane div.`);
    return;
  }

  const panesHtml = TYPES.map((t, i) => buildPane(t, items, i === 0)).join('\n');
  const before = html.split(PANES_START)[0];
  const after = html.split(PANES_END)[1];
  html = `${before}${PANES_START}\n${panesHtml}\n    ${PANES_END}${after}`;

  // Rewrite mediaTab() to toggle pane visibility instead of the old
  // single-item innerHTML swap.
  const newJs = `${JS_START}
  function mediaTab(btn, key){
    document.querySelectorAll('.media-tab').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('.media-pane-group').forEach(function(g){
      g.style.display = (g.dataset.mediaType === key) ? '' : 'none';
    });
  }
  ${JS_END}`;

  if (html.includes(JS_START) && html.includes(JS_END)) {
    const jsBefore = html.split(JS_START)[0];
    const jsAfter = html.split(JS_END)[1];
    html = `${jsBefore}${newJs}${jsAfter}`;
  } else {
    console.log(`⚠️  Could not find ${JS_START} / ${JS_END} markers — see instructions to wrap the mediaTab() function once, manually.`);
  }

  fs.writeFileSync(INDEX_HTML, html);
  console.log(`✅ Media Centre tabs updated: ${items.length} item(s) across Podcasts/Interviews/News/Events.`);
}

function main() {
  const items = readMediaItems();
  console.log(`Found ${items.length} media item(s) in content/media_items/`);
  if (fs.existsSync(TEMPLATE_PATH)) {
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    items.filter(i => i.linkMode !== 'external').forEach(i => buildItemPage(i, template));
  } else {
    console.log('⚠️  templates/media-item-template.html not found — skipping individual page generation.');
  }
  updateMediaPanes(items);
  console.log('✅ Media tabs build complete.');
}

main();
