/**
 * SAMARPAN — Journal Auto-Builder
 * ---------------------------------
 * Runs automatically on every Cloudflare Pages deploy.
 * Reads every article written in the CMS (content/journal/*.md)
 * and:
 *   1. Generates a full article page for each one (journal/<slug>.html)
 *   2. Rebuilds the article grid inside journal.html
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

  const html = fill(template, {
    title: escapeHtml(article.title),
    titleJson: escapeJson(article.title),
    description: escapeHtml(article.description || ''),
    descriptionJson: escapeJson(article.description || ''),
    slug: article.slug,
    image: article.image || '',
    badge: escapeHtml(article.badge || 'Article'),
    badgeClass: article.badgeClass || 'badge-narrative',
    author: escapeHtml(article.author || 'Samarpan Editorial Team'),
    authorJson: escapeJson(article.author || 'Samarpan Editorial Team'),
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

function main() {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const articles = readArticles();

  console.log(`Found ${articles.length} article(s) in content/journal/`);
  articles.forEach(a => buildArticlePage(a, template));
  updateJournalIndex(articles);

  console.log('✅ Journal build complete.');
}

main();
