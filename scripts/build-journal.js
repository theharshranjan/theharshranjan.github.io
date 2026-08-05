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
const ARCHIVE_INDEX = path.join(ROOT, 'journal', 'articles.html');
const TEMPLATE_PATH = path.join(ROOT, 'templates', 'article-template.html');
const SITEMAP_PATH = path.join(ROOT, 'journal-sitemap.xml');

const ISSUES_CONTENT_DIR = path.join(ROOT, 'content', 'issues');
const ISSUES_OUTPUT_DIR = path.join(ROOT, 'journal', 'issues');
const ISSUE_TEMPLATE_PATH = path.join(ROOT, 'templates', 'issue-template.html');

// One-time setup (optional): generate a random key, create a file at the
// repo root named "<key>.txt" containing just the key, and add
// INDEXNOW_KEY as an environment variable in Cloudflare Pages build
// settings for the WEBSITE project. Until that's done, this just skips
// silently — nothing else breaks.
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';

const START_MARKER = '<!-- CMS:ARTICLES:START -->';
const END_MARKER = '<!-- CMS:ARTICLES:END -->';
const FEATURED_START = '<!-- CMS:FEATURED_ISSUE:START -->';
const FEATURED_END = '<!-- CMS:FEATURED_ISSUE:END -->';
const HOME_TEASER_START = '<!-- CMS:HOME_TEASER:START -->';
const HOME_TEASER_END = '<!-- CMS:HOME_TEASER:END -->';
const HOME_TEASER_COUNT = 9; // how many of the newest archive cards to mirror onto the homepage

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

// Reads content/issues/*.md (the new "Journal Issues" CMS collection).
// Returns [] safely if the folder doesn't exist yet — this is expected
// before an editor has published a single issue, and every function below
// falls back gracefully to leaving the existing hand-written Featured Issue
// block untouched in that case.
function readIssues() {
  if (!fs.existsSync(ISSUES_CONTENT_DIR)) {
    console.log('No content/issues folder yet — Featured Issue stays as-is until the first issue is published.');
    return [];
  }
  const files = fs.readdirSync(ISSUES_CONTENT_DIR).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const raw = fs.readFileSync(path.join(ISSUES_CONTENT_DIR, file), 'utf8');
    const { data, content } = matter(raw);
    const slug = data.slug || file.replace(/\.md$/, '');
    return { ...data, slug, bodyMarkdown: content };
  }).filter(i => i.title);
}

// Picks which issue is Featured on the homepage. If more than one is marked
// Featured:true, the most recently dated one wins (so publishing a new
// featured issue automatically retires the old one — no manual toggling
// required). If none are marked Featured, falls back to the single most
// recent issue overall, so the homepage never falls behind once issues exist.
function pickFeaturedIssue(issues) {
  if (!issues.length) return null;
  const byDateDesc = [...issues].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const featured = byDateDesc.filter(i => i.featured);
  return featured.length ? featured[0] : byDateDesc[0];
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

// hrefPrefix defaults to '' because cards are now built for journal/articles.html,
// which sits in the same journal/ folder as the article pages themselves (so a bare
// "<slug>.html" is correct). Issue pages live one level deeper at journal/issues/,
// so buildIssuePage() calls this with hrefPrefix='../'.
function buildCard(article, hrefPrefix = '') {
  const tagsAttr = (article.tags || []).join(',');
  const tagsHtml = (article.tags || []).slice(0, 2)
    .map(t => `<span class="article-tag">${escapeHtml(t)}</span>`).join('');

  return `      <a href="${hrefPrefix}${article.slug}.html" class="journal-card article-card fade-up rounded" data-tags="${escapeHtml(tagsAttr.toLowerCase())}" onclick="gaEvent('click','Journal','Article ${article.slug}');">
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

// Renders the individual /journal/issues/<slug>.html page for one issue,
// pulling in the full article cards for every slug listed in articleSlugs.
function buildIssuePage(issue, articlesBySlug, template) {
  const date = issue.date ? new Date(issue.date) : new Date();
  const bodyHtml = issue.bodyMarkdown && issue.bodyMarkdown.trim() ? marked.parse(issue.bodyMarkdown) : '';

  const categoryTagsHtml = (issue.categoryTags || []).map(t =>
    `<span class="mono-label border-l-2 pl-3" style="border-color:#4A5D4F;">${escapeHtml(t)}</span>`
  ).join('\n          ');

  const pdfButtonHtml = issue.pdfLink
    ? `<a href="${escapeHtml(issue.pdfLink)}" onclick="gaEvent('click','Journal','Download Issue PDF: ${escapeHtml(issue.slug)}');" class="inline-flex items-center justify-center gap-2 bg-brand-black text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-clay transition"><i data-lucide="download" class="w-3.5 h-3.5"></i>Download PDF</a>`
    : '';

  const includedSlugs = (issue.articleSlugs || []).filter(Boolean);
  const matchedArticles = includedSlugs.map(s => articlesBySlug[s]).filter(Boolean);
  const issueArticleCardsHtml = matchedArticles.length
    ? matchedArticles.map(a => buildCard(a, '../')).join('\n\n')
    : `<p class="font-sans text-sm col-span-full" style="color:var(--text-muted);">Articles for this issue will appear here once published.</p>`;

  const html = fill(template, {
    title: escapeHtml(issue.title),
    titleJson: escapeJson(issue.title),
    description: escapeHtml(issue.description || ''),
    descriptionJson: escapeJson(issue.description || ''),
    slug: issue.slug,
    volume: escapeHtml(issue.volume || 'Volume 1'),
    issueNumber: escapeHtml(issue.issueNumber || ''),
    issueNumberJson: escapeJson(issue.issueNumber || ''),
    coverTitle: escapeHtml(issue.coverTitle || issue.title),
    date: date.toISOString(),
    categoryTagsHtml,
    pdfButtonHtml,
    articleCount: matchedArticles.length,
    bodyHtml,
    issueArticleCardsHtml
  });

  if (!fs.existsSync(ISSUES_OUTPUT_DIR)) fs.mkdirSync(ISSUES_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ISSUES_OUTPUT_DIR, `${issue.slug}.html`), html);
}

// Builds the homepage Featured Issue card markup for one issue.
function buildFeaturedIssueBlock(issue) {
  const articleCount = (issue.articleSlugs || []).filter(Boolean).length;
  const tagsHtml = (issue.categoryTags || []).map((t, i) => {
    const colors = ['#D95D39', '#4A5D4F', '#2E4F8F', '#7C5AA8', '#666'];
    return `<span class="mono-label border-l-2 pl-3" style="border-color:${colors[i % colors.length]};">${escapeHtml(t)}</span>`;
  }).join('\n          ');
  const countPill = `<span class="mono-label border-l-2 pl-3" style="border-color:#D95D39;">${articleCount} Article${articleCount === 1 ? '' : 's'}</span>`;

  const pdfBtn = issue.pdfLink
    ? `<a href="${escapeHtml(issue.pdfLink)}" onclick="gaEvent('click','Journal','Download Featured PDF')" class="cta-btn inline-flex items-center justify-center gap-2 bg-brand-black text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-clay transition"><i data-lucide="download" class="w-3.5 h-3.5"></i>Download PDF</a>`
    : '';

  return `    <div class="feature-issue fade-up">
      <div class="feature-issue-cover">
        <div class="feature-issue-cover-mark px-8">
          <p class="mono-label" style="color:rgba(245,240,232,.6);">${escapeHtml(issue.volume || 'Volume 1')} · ${escapeHtml(issue.issueNumber || '')}</p>
          <svg width="46" height="46" viewBox="0 0 100 100" fill="none" class="mx-auto my-4" style="color:#C5A059;">
            <circle cx="50" cy="50" r="45" stroke="currentColor" stroke-width="3"/>
            <path d="M50 15C50 15 70 40 70 55C70 66 61 75 50 75C39 75 30 66 30 55C30 40 50 15 50 15Z" stroke="currentColor" stroke-width="3"/>
            <circle cx="50" cy="85" r="3" fill="currentColor"/>
            <path d="M20 50H80" stroke="currentColor" stroke-width="1.5" stroke-opacity=".8"/>
          </svg>
          <p class="font-display text-2xl" style="color:#F5F0E8;">${escapeHtml(issue.coverTitle || issue.title)}</p>
        </div>
      </div>
      <div class="p-8 sm:p-10 flex flex-col justify-center">
        <p class="eyebrow mb-3">Featured Issue</p>
        <h2 class="font-display text-2xl sm:text-3xl leading-tight mb-4" style="color:var(--text);">${escapeHtml(issue.title)}</h2>
        <p class="font-sans text-sm leading-relaxed mb-6" style="color:var(--text-muted);">${escapeHtml(issue.description || '')}</p>
        <div class="flex flex-wrap gap-4 mb-7">
          ${countPill}
          ${tagsHtml}
        </div>
        <div class="flex flex-col sm:flex-row gap-3">
          ${pdfBtn}
          <a href="journal/issues/${issue.slug}.html" onclick="gaEvent('click','Journal','Read Featured Online')" class="inline-flex items-center justify-center gap-2 border-2 px-6 py-3 text-[10px] font-bold uppercase tracking-widest rounded-sm transition hover:border-clay hover:text-clay" style="border-color:var(--border);color:var(--text);"><i data-lucide="book-open" class="w-3.5 h-3.5"></i>Read Online</a>
        </div>
      </div>
    </div>`;
}

// Swaps the Featured Issue block in journal.html for whichever issue won
// pickFeaturedIssue(). If there are no issues in the CMS yet, this does
// nothing and the original hand-written PCOS block stays exactly as-is —
// so the homepage never breaks before the first issue is published.
function updateFeaturedIssueSection(issue) {
  if (!issue) {
    console.log('ℹ️  No CMS issues found — Featured Issue section left untouched.');
    return;
  }
  if (!fs.existsSync(JOURNAL_INDEX)) return;
  let html = fs.readFileSync(JOURNAL_INDEX, 'utf8');
  if (!html.includes(FEATURED_START) || !html.includes(FEATURED_END)) {
    console.log(`⚠️  Could not find ${FEATURED_START} / ${FEATURED_END} markers in journal.html — skipping Featured Issue update.`);
    return;
  }
  const before = html.split(FEATURED_START)[0];
  const after = html.split(FEATURED_END)[1];
  html = `${before}${FEATURED_START}\n${buildFeaturedIssueBlock(issue)}\n    ${FEATURED_END}${after}`;
  fs.writeFileSync(JOURNAL_INDEX, html);
  console.log(`✅ Featured Issue set to: "${issue.title}" (${issue.slug})`);
}

// Counts articles per category by reading every .article-card's data-tags
// attribute from journal/articles.html (the full archive — this is where
// ALL cards live now, both the legacy hand-written ones and every
// CMS-authored one), then writes the totals into the category tiles on the
// HOMEPAGE (journal.html). Must run AFTER updateJournalIndex() has written
// the fresh CMS cards into the archive.
function updateCategoryCounts() {
  if (!fs.existsSync(ARCHIVE_INDEX) || !fs.existsSync(JOURNAL_INDEX)) return;
  const archiveHtml = fs.readFileSync(ARCHIVE_INDEX, 'utf8');

  // Pull every data-tags="..." value from article cards in the archive grid
  const tagAttrRegex = /class="journal-card article-card[^"]*"\s+data-tags="([^"]*)"/g;
  const counts = {};
  let m;
  while ((m = tagAttrRegex.exec(archiveHtml)) !== null) {
    m[1].split(',').map(t => t.trim().toLowerCase()).filter(Boolean).forEach(tag => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
  }

  // Replace each <span class="category-count" data-tag="...">N articles</span> on the homepage
  let homeHtml = fs.readFileSync(JOURNAL_INDEX, 'utf8');
  homeHtml = homeHtml.replace(
    /(<span class="category-count" data-tag="([^"]+)">)\d+( articles?<\/span>)/g,
    (full, openTag, tag, closeTag) => {
      const n = counts[tag.toLowerCase()] || 0;
      return `${openTag}${n}${n === 1 ? closeTag.replace('articles', 'article') : closeTag}`;
    }
  );

  fs.writeFileSync(JOURNAL_INDEX, homeHtml);
  console.log('✅ Category counts updated:', counts);
}

// Computes the 4 "State of Integrative Health Research" numbers by parsing
// every article card in journal/articles.html (the full archive) — this is
// the SAME technique updateCategoryCounts() uses, and for the same reason:
// it must cover BOTH the legacy hand-written cards AND every CMS-authored
// card, not just what's in content/journal/. Numbers are written into the
// HOMEPAGE dashboard. Must run AFTER updateJournalIndex() has written the
// fresh CMS cards into the archive.
// Heuristics used (adjust here if the editorial team wants different
// definitions later):
//   - Total Articles            -> every card in the archive
//   - Research Papers           -> badge label text === "Research Review"
//   - Conditions Covered        -> unique tags, EXCLUDING the 8 fixed
//                                   top-level category names, so a condition
//                                   like "PCOS" or "Anemia" counts but a
//                                   category like "Ayurveda" doesn't double up
//                                   with the Browse by Category section above.
//   - Reviews & Evidence Syntheses -> badge label text is "Classical Review" or "Narrative Review"
function updateResearchDashboard() {
  if (!fs.existsSync(ARCHIVE_INDEX) || !fs.existsSync(JOURNAL_INDEX)) return;
  const archiveHtml = fs.readFileSync(ARCHIVE_INDEX, 'utf8');

  const FIXED_CATEGORY_TAGS = new Set([
    'ayurveda', 'psychology', 'nutrition', 'yoga', 'research review',
    'public health', "women's health", 'integrative health'
  ]);

  // NOTE: cards inside journal/articles.html use bare "<slug>.html" hrefs
  // (no "journal/" prefix), since the archive page already lives in that folder.
  const cardBlocks = archiveHtml.match(/<a href="[^"]+\.html" class="journal-card article-card[\s\S]*?<\/a>/g) || [];

  let totalArticles = 0, researchPapers = 0, reviewsEvidence = 0;
  const allTags = new Set();

  cardBlocks.forEach(block => {
    totalArticles++;
    const tagsMatch = block.match(/data-tags="([^"]*)"/);
    const badgeMatch = block.match(/class="article-badge[^"]*"[^>]*>([^<]*)</);
    const badge = badgeMatch ? badgeMatch[1].trim().toLowerCase() : '';
    if (badge === 'research review') researchPapers++;
    if (badge === 'classical review' || badge === 'narrative review') reviewsEvidence++;
    if (tagsMatch) {
      tagsMatch[1].split(',').map(t => t.trim().toLowerCase()).forEach(tag => {
        if (tag && !FIXED_CATEGORY_TAGS.has(tag)) allTags.add(tag);
      });
    }
  });

  const stats = { totalArticles, researchPapers, conditionsCovered: allTags.size, reviewsEvidence };

  let homeHtml = fs.readFileSync(JOURNAL_INDEX, 'utf8');
  homeHtml = homeHtml.replace(
    /(data-stat="(totalArticles|researchPapers|conditionsCovered|reviewsEvidence)" data-target=")\d+(")/g,
    (full, openTag, statKey, closeTag) => `${openTag}${stats[statKey]}${closeTag}`
  );

  fs.writeFileSync(JOURNAL_INDEX, homeHtml);
  console.log('✅ Research Dashboard updated:', stats);
}

// Injects fresh CMS article cards into journal/articles.html (the full,
// scalable archive) — NOT journal.html. The homepage no longer holds the
// full grid; it only shows a small hand-curated teaser (see the comment
// above the "LATEST FROM THE JOURNAL" section in journal.html for why that
// part still needs manual editing).
function updateJournalIndex(articles) {
  if (!fs.existsSync(ARCHIVE_INDEX)) {
    console.log('journal/articles.html not found — skipping archive grid update.');
    return;
  }
  let html = fs.readFileSync(ARCHIVE_INDEX, 'utf8');

  if (!html.includes(START_MARKER) || !html.includes(END_MARKER)) {
    console.log(`\n⚠️  Could not find ${START_MARKER} / ${END_MARKER} markers in journal/articles.html.`);
    console.log('   Add these two comment lines around your #articleGrid content once, manually:');
    console.log(`   ${START_MARKER}\n   ...existing article cards...\n   ${END_MARKER}\n`);
    return;
  }

  const sorted = [...articles].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const cardsHtml = sorted.map(a => buildCard(a)).join('\n\n'); // arrow fn: avoids map() passing (index, array) into buildCard's hrefPrefix param

  const before = html.split(START_MARKER)[0];
  const after = html.split(END_MARKER)[1];
  html = `${before}${START_MARKER}\n${cardsHtml}\n      ${END_MARKER}${after}`;

  fs.writeFileSync(ARCHIVE_INDEX, html);
}

// Mirrors the first HOME_TEASER_COUNT cards from journal/articles.html (the
// full archive, which updateJournalIndex() above always keeps newest-CMS-
// article-first) onto the homepage's "Latest from the Journal" teaser. This
// is what makes the homepage teaser fully automatic: publish a new CMS
// article -> it's newest in the archive -> it's now also the first card on
// the homepage, and whichever card used to be 9th quietly drops off.
// Must run AFTER updateJournalIndex() has refreshed the archive.
function syncHomepageTeaser() {
  if (!fs.existsSync(ARCHIVE_INDEX) || !fs.existsSync(JOURNAL_INDEX)) return;
  const archiveHtml = fs.readFileSync(ARCHIVE_INDEX, 'utf8');

  const cardBlocks = archiveHtml.match(/<a href="[^"]+\.html" class="journal-card article-card[\s\S]*?<\/a>/g) || [];
  const teaserCards = cardBlocks.slice(0, HOME_TEASER_COUNT)
    .map(block => block.replace('<a href="', '<a href="journal/')); // archive cards use bare "<slug>.html"; homepage needs "journal/<slug>.html"

  if (!teaserCards.length) {
    console.log('ℹ️  No articles found in the archive yet — homepage teaser left as-is.');
    return;
  }

  let homeHtml = fs.readFileSync(JOURNAL_INDEX, 'utf8');
  if (!homeHtml.includes(HOME_TEASER_START) || !homeHtml.includes(HOME_TEASER_END)) {
    console.log(`⚠️  Could not find ${HOME_TEASER_START} / ${HOME_TEASER_END} markers in journal.html — skipping homepage teaser sync.`);
    return;
  }

  const before = homeHtml.split(HOME_TEASER_START)[0];
  const after = homeHtml.split(HOME_TEASER_END)[1];
  homeHtml = `${before}${HOME_TEASER_START}\n${teaserCards.join('\n\n')}\n      ${HOME_TEASER_END}${after}`;

  fs.writeFileSync(JOURNAL_INDEX, homeHtml);
  console.log(`✅ Homepage teaser synced with the ${teaserCards.length} newest archive articles.`);
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
  syncHomepageTeaser();
  updateCategoryCounts();
  updateResearchDashboard();
  buildJournalSitemap(articles);
  await pingIndexNow(articles);

  // Journal Issues (Featured Issue + individual issue pages)
  const issues = readIssues();
  console.log(`Found ${issues.length} issue(s) in content/issues/`);
  if (issues.length) {
    const articlesBySlug = {};
    articles.forEach(a => { articlesBySlug[a.slug] = a; });
    if (fs.existsSync(ISSUE_TEMPLATE_PATH)) {
      const issueTemplate = fs.readFileSync(ISSUE_TEMPLATE_PATH, 'utf8');
      issues.forEach(issue => buildIssuePage(issue, articlesBySlug, issueTemplate));
    } else {
      console.log('⚠️  templates/issue-template.html not found — skipping individual issue page generation.');
    }
    updateFeaturedIssueSection(pickFeaturedIssue(issues));
  }

  console.log('✅ Journal build complete.');
}

main().catch(err => {
  console.error('❌ Journal build failed:', err);
  process.exit(1);
});
