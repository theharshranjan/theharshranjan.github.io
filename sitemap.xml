/**
 * build-sitemap.js
 *
 * Regenerates sitemap.xml from what's actually live on the site, with a
 * real <lastmod> date pulled from git history for every URL.
 *
 * Why an allowlist for root-level pages instead of "everything at root":
 * this repo has 20+ orphaned duplicate files at root (old copies of journal
 * articles that now live in journal/, plus what look like old drafts of the
 * homepage - new.html, updates.html) that are not linked from anywhere on
 * the live site. Auto-including "every .html file" would put duplicate
 * content back in the sitemap. Add a page to ROOT_PAGES below once you've
 * confirmed it's a real, live, linked page.
 *
 * journal/*.html, journal/issues/*.html, retreats/*.html and media/*.html
 * are auto-discovered, since those folders are actively maintained by the
 * CMS build scripts and don't have the same stale-duplicate problem -
 * except journal/sample-welcome-article.html, the CMS's own placeholder
 * sample article, which is explicitly excluded below.
 *
 * Usage (from the repo root):
 *   node scripts/build-sitemap.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITE_URL = 'https://thesamarpan.co.in';

// Cloudflare Pages' build container does a SHALLOW git clone (depth 1) by
// default, so `git log -1 -- <file>` returns nothing for any file not
// touched in that single fetched commit - which silently made every
// lastmod fall back to "today", on every single page, on every build.
// Fix: try to deepen the clone once at the start. If that's not possible
// (e.g. truly no history available), fall back to whatever lastmod the
// PREVIOUS sitemap.xml already had for that URL, rather than stamping
// today's date on everything - a sitemap where every page shows the same
// "updated today" date looks exactly like the ping-spam pattern Google
// said it stopped trusting, and would undermine the whole point of this.
function ensureFullHistory() {
  try {
    const isShallow = execSync('git rev-parse --is-shallow-repository', { cwd: ROOT }).toString().trim();
    if (isShallow === 'true') {
      execSync('git fetch --unshallow --quiet', { cwd: ROOT, stdio: 'ignore' });
    }
  } catch (e) {
    // Not a git repo, or fetch failed (e.g. no network, or already full) - continue anyway.
  }
}

function loadPreviousLastmods() {
  const map = {};
  if (!fs.existsSync(SITEMAP_PATH)) return map;
  try {
    const prevXml = fs.readFileSync(SITEMAP_PATH, 'utf8');
    const blocks = [...prevXml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)];
    for (const [, loc, lastmod] of blocks) map[loc] = lastmod;
  } catch (e) { /* ignore, start fresh */ }
  return map;
}

// Confirmed real, live, linked root-level pages only. See note above for why
// this is an allowlist rather than "every .html file at root".
const ROOT_PAGES = [
  { file: 'index.html', priority: '1.0', changefreq: 'weekly' },
  { file: 'journal.html', priority: '0.9', changefreq: 'weekly' },
  { file: 'about.html', priority: '0.8', changefreq: 'monthly' },
  { file: 'ayurveda.html', priority: '0.8', changefreq: 'monthly' },
  { file: 'sessions.html', priority: '0.8', changefreq: 'monthly' },
  { file: 'booking.html', priority: '0.8', changefreq: 'monthly' },
  { file: 'community.html', priority: '0.7', changefreq: 'monthly' },
  { file: 'communityupdatess.html', priority: '0.6', changefreq: 'monthly' },
  { file: 'publications.html', priority: '0.6', changefreq: 'monthly' },
  { file: 'contact.html', priority: '0.6', changefreq: 'monthly' },
  { file: 'donate.html', priority: '0.6', changefreq: 'monthly' },
  { file: 'diet.html', priority: '0.5', changefreq: 'monthly' },
  { file: 'yoga.html', priority: '0.5', changefreq: 'monthly' },
  { file: 'meditation.html', priority: '0.5', changefreq: 'monthly' },
  { file: 'mantra.html', priority: '0.5', changefreq: 'monthly' },
  { file: 'psychology.html', priority: '0.5', changefreq: 'monthly' },
  { file: 'register.html', priority: '0.5', changefreq: 'monthly' },
  { file: 'trips.html', priority: '0.4', changefreq: 'monthly' },
  { file: 'harsh-ranjan.html', priority: '0.4', changefreq: 'monthly' },
  { file: 'lella_naga_durga_bhavani.html', priority: '0.4', changefreq: 'monthly' },
  { file: 'padigireddy_bhuvaneswari.html', priority: '0.4', changefreq: 'monthly' },
  { file: 'rural-health-posting-intern-to-clinician.html', priority: '0.4', changefreq: 'yearly' },
  { file: 'privacy-policy.html', priority: '0.2', changefreq: 'yearly' },
  { file: 'terms-of-service.html', priority: '0.2', changefreq: 'yearly' },
];

const EXCLUDED_JOURNAL_FILES = new Set(['sample-welcome-article.html', 'articles.html']);

function getLastmod(relPath, loc, previousLastmods) {
  try {
    const out = execSync(`git log -1 --format=%cI -- "${relPath}"`, { cwd: ROOT }).toString().trim();
    if (out) return out.slice(0, 10); // YYYY-MM-DD
  } catch (e) { /* fall through */ }
  // git couldn't tell us - reuse the previous sitemap's value if we have
  // one, instead of falsely claiming this page changed today.
  if (previousLastmods[loc]) return previousLastmods[loc];
  return new Date().toISOString().slice(0, 10);
}

function collectJournalArticles() {
  const dir = path.join(ROOT, 'journal');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html') && !EXCLUDED_JOURNAL_FILES.has(f))
    .map(f => ({ file: `journal/${f}`, priority: '0.6', changefreq: 'yearly' }));
}

function collectJournalIssues() {
  const dir = path.join(ROOT, 'journal', 'issues');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html'))
    .map(f => ({ file: `journal/issues/${f}`, priority: '0.5', changefreq: 'yearly' }));
}

function collectFolder(name, priority) {
  const dir = path.join(ROOT, name);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html'))
    .map(f => ({ file: `${name}/${f}`, priority, changefreq: 'monthly' }));
}

function main() {
  ensureFullHistory();
  const previousLastmods = loadPreviousLastmods();

  const entries = [
    ...ROOT_PAGES,
    { file: 'journal/articles.html', priority: '0.6', changefreq: 'monthly' },
    ...collectJournalArticles(),
    ...collectJournalIssues(),
    ...collectFolder('retreats', '0.6'),
    ...collectFolder('media', '0.5'),
  ];

  const seen = new Set();
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  let written = 0, missing = [];

  for (const entry of entries) {
    if (seen.has(entry.file)) continue;
    seen.add(entry.file);

    const fullPath = path.join(ROOT, entry.file);
    if (!fs.existsSync(fullPath)) {
      missing.push(entry.file);
      continue;
    }

    // Cloudflare Pages auto-redirects /page.html -> /page (confirmed live).
    // Point the sitemap straight at that canonical clean URL rather than
    // making every crawler follow a redirect hop on every single page.
    const cleanPath = entry.file === 'index.html' ? '' : entry.file.replace(/\.html$/, '');
    const loc = `${SITE_URL}/${cleanPath}`;
    const lastmod = getLastmod(entry.file, loc, previousLastmods);

    xml += `  <url>\n`;
    xml += `    <loc>${loc}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    xml += `    <priority>${entry.priority}</priority>\n`;
    xml += `  </url>\n`;
    written += 1;
  }
  xml += `</urlset>\n`;

  fs.writeFileSync(SITEMAP_PATH, xml.replace(/\n/g, '\r\n'), 'utf8');

  console.log(`sitemap.xml written with ${written} URLs.`);
  if (missing.length) {
    console.log(`\nSkipped (listed but file not found on disk): ${missing.length}`);
    missing.forEach(f => console.log('  -', f));
  }
}

main();