/**
 * SAMARPAN — Journal Auto-Builder
 * ---------------------------------
 * Runs automatically on every Cloudflare Pages deploy.
 * Reads every article written in the CMS (content/journal/*.md) and:
 *   1. Generates a full article page for each one (journal/<slug>.html)
 *   2. Rebuilds the article grid inside journal.html
 *   3. Rebuilds journal-sitemap.xml
 *   4. Pings IndexNow (Bing/Yandex) if INDEXNOW_KEY is configured
 *
 * You never need to touch this file. Contributors just use the
 * /admin panel — this script does the rest.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'journal');
const OUTPUT_DIR = path.join(ROOT, 'journal');
const JOURNAL_INDEX = path.join(ROOT, 'journal.html');
const TEMPLATE_PATH = path.join(ROOT, 'templates', 'article-template.html');
const SITEMAP_PATH = path.join(ROOT, 'journal-sitemap.xml');

// One-time setup (optional): generate a random key, create a file at the
// repo root named "<key>.txt" containing just the key, and add
// INDEXNOW_KEY as an environment variable in Cloudflare Pages build
// settings for the WEBSITE project. Until that's done, this just skips
// silently — nothing else breaks.
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';

const START_MARKER = '<!-- CMS:ARTICLES:START -->';
const END_MARKER = '<!-- CMS:ARTICLES:END -->';

function escapeHtml(str = '') {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeJson(str = '') {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function fill(tpl, data) {
  return tpl.replace(/{{(\w+)}}/g, (_, key) => (data[key] !== undefined ? data[key] : ''));
}
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'S';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function buildAvatar(article, sizeClass, initials) {
  if (article.authorPhoto) {
    return `<img src="${escapeHtml(article.authorPhoto)}" alt="${escapeHtml(article.author || '')}" class="${sizeClass}" style="object-fit:cover;">`;
  }
  return `<div class="${sizeClass}">${initials}</div>`;
}
function buildBannerContent(article) {
  if (article.image) {
    return `<img src="${escapeHtml(article.image)}" alt="${escapeHtml(article.title || '')}" style="width:100%;height:100%;object-fit:cover;">`;
  }
  const icon = escapeHtml(article.bannerIcon || 'leaf');
  return `<i data-lucide="${icon}" class="w-14 h-14" style="color:rgba(255,255,255,.85);"></i>`;
}

function readArticles() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.log('No content/journal folder yet — skipping journal build.');
    return [];
  }
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    const { data, content } = matter(raw);
    const slug = data.slug || file.replace(/\.md$/, '');
    return { ...data, slug, bodyMarkdown: content };
  }).filter(a => a.title); // skip empty/broken entries
}

function buildArticlePage(article, template) {
  const tags = (article.tags || []).map(t => `<span class="article-tag">${escapeHtml(t)}</span>`).join('');
  const bodyHtml = marked.parse(article.bodyMarkdown || '');
  const date = article.date ? new Date(article.date) : new Date();
  const dateDisplay = date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const initials = getInitials(article.author || 'Samarpan Editorial Team');
  const primaryTag = (article.tags && article.tags[0]) || article.badge || 'Journal';
  const tagsInline = (article.tags || []).join(', ');
  const tagPillsHtml = (article.tags || [])
    .map(t => `<a href="../journal.html" class="tag-pill">${escapeHtml(t)}</a>`).join('\n        ');

  const html = fill(template, {
    title: escapeHtml(article.title),
    titleJson: escapeJson(article.title),
    description: escapeHtml(article.description || ''),
    descriptionJson: escapeJson(article.description || ''),
    slug: article.slug,
    image: article.image || '',
    imageJson: escapeJson(article.image || ''),
    badge: escapeHtml(article.badge || 'Article'),
    badgeClass: article.badgeClass || 'badge-narrative',
    author: escapeHtml(article.author || 'Samarpan Editorial Team'),
    authorJson: escapeJson(article.author || 'Samarpan Editorial Team'),
    authorRole: escapeHtml(article.authorRole || 'Contributing Author'),
    authorBio: escapeHtml(article.authorBio || 'Article contributed to The Samarpan Journal.'),
    authorInitials: initials,
    authorAvatarSmall: buildAvatar(article, 'article-byline-avatar', initials),
    authorAvatarLarge: buildAvatar(article, 'author-card-avatar', initials),
    bannerContent: buildBannerContent(article),
    primaryTag: escapeHtml(primaryTag),
    tagsInline: escapeHtml(tagsInline),
    tagPillsHtml,
    readTime: escapeHtml(article.readTime || '5 min read'),
    date: date.toISOString(),
    dateDisplay,
    tagsHtml: tags,
    bodyHtml
  });

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, `${article.slug}.html`), html);
}

function buildCard(article) {
  const tagsAttr = (article.tags || []).join(',');
  const tagsHtml = (article.tags || []).slice(0, 2)
    .map(t => `<span class="article-tag">${escapeHtml(t)}</span>`).join('');

  return `      <a href="journal/${article.slug}.html" class="journal-card article-card fade-up rounded" data-tags="${escapeHtml(tagsAttr.toLowerCase())}" onclick="gaEvent('click','Journal','Article ${article.slug}');">
        <div class="article-thumb">
          <img src="${article.image || ''}" alt="${escapeHtml(article.title)}" loading="lazy">
        </div>
        <div class="p-5 flex flex-col flex-1">
          <span class="article-badge ${article.badgeClass || 'badge-narrative'} w-fit mb-3">${escapeHtml(article.badge || 'Article')}</span>
          <h3 class="font-serif text-lg leading-snug mb-2" style="color:var(--text);">${escapeHtml(article.title)}</h3>
          <p class="font-sans text-xs leading-relaxed mb-4 flex-1" style="color:var(--text-muted);">${escapeHtml(article.description || '')}</p>
          <div class="flex flex-wrap gap-1.5 mb-4">
            ${tagsHtml}
          </div>
          <div class="hairline pt-3 flex items-center justify-between mono-label">
            <span>${escapeHtml(article.author || 'Samarpan Editorial Team')}</span><span>${escapeHtml(article.readTime || '5 min read')}</span>
          </div>
        </div>
      </a>`;
}

function updateJournalIndex(articles) {
  if (!fs.existsSync(JOURNAL_INDEX)) {
    console.log('journal.html not found at repo root — skipping grid update.');
    return;
  }
  let html = fs.readFileSync(JOURNAL_INDEX, 'utf8');

  if (!html.includes(START_MARKER) || !html.includes(END_MARKER)) {
    console.log(`\n⚠️  Could not find ${START_MARKER} / ${END_MARKER} markers in journal.html.`);
    console.log('   Add these two comment lines around your #articleGrid content once, manually:');
    console.log(`   ${START_MARKER}\n   ...existing article cards...\n   ${END_MARKER}\n`);
    return;
  }

  const sorted = [...articles].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const cardsHtml = sorted.map(buildCard).join('\n\n');

  const before = html.split(START_MARKER)[0];
  const after = html.split(END_MARKER)[1];
  html = `${before}${START_MARKER}\n${cardsHtml}\n      ${END_MARKER}${after}`;

  fs.writeFileSync(JOURNAL_INDEX, html);
}

// Small, separate sitemap covering only journal articles — safe to add
// without touching or overwriting any existing main sitemap.xml. If you
// have a main sitemap.xml/sitemap index, add one line pointing to this
// file; otherwise you can submit this URL directly in Search Console.
function buildJournalSitemap(articles) {
  const urls = articles.map(a => {
    const lastmod = a.date ? new Date(a.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    return `  <url>\n    <loc>https://thesamarpan.co.in/journal/${a.slug}.html</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml);
  console.log(`✅ journal-sitemap.xml written with ${articles.length} URL(s).`);
}

// Tells Bing/Yandex about every journal URL on every build. Silently
// skipped until INDEXNOW_KEY is set up (see the note above). Wrapped so
// any network failure here can never fail the whole build.
async function pingIndexNow(articles) {
  if (!INDEXNOW_KEY) {
    console.log('ℹ️  INDEXNOW_KEY not set — skipping IndexNow ping.');
    return;
  }
  const urlList = articles.map(a => `https://thesamarpan.co.in/journal/${a.slug}.html`);
  if (!urlList.length) return;
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'thesamarpan.co.in',
        key: INDEXNOW_KEY,
        keyLocation: `https://thesamarpan.co.in/${INDEXNOW_KEY}.txt`,
        urlList
      })
    });
    console.log(`IndexNow ping status: ${res.status}`);
  } catch (err) {
    console.log('IndexNow ping failed (non-fatal):', err.message);
  }
}

async function main() {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const articles = readArticles();

  console.log(`Found ${articles.length} article(s) in content/journal/`);
  articles.forEach(a => buildArticlePage(a, template));
  updateJournalIndex(articles);
  buildJournalSitemap(articles);
  await pingIndexNow(articles);

  console.log('✅ Journal build complete.');
}

main().catch(err => {
  console.error('❌ Journal build failed:', err);
  process.exit(1);
});
