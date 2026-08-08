/**
 * SAMARPAN — Recent Issues (homepage teaser) Auto-Builder
 * Add to build command: "... && node scripts/build-recent-issues.js"
 *
 * Reuses the EXISTING "issues" CMS collection (content/issues/*.md —
 * already defined in config.yml for the Featured Issue block) — no
 * new collection needed. Just rebuilds the 4-card "From The Samarpan
 * Journal" teaser grid on the homepage from the same data, newest first.
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'issues');
const INDEX_HTML = path.join(ROOT, 'index.html');
const START_MARKER = '<!-- CMS:RECENT_ISSUES:START -->';
const END_MARKER = '<!-- CMS:RECENT_ISSUES:END -->';
const TEASER_COUNT = 4;

const BADGE_COLORS = [
  { bg: 'rgba(217,93,57,.12)', fg: '#D95D39', icon: 'flame' },
  { bg: 'rgba(74,93,79,.12)', fg: '#4A5D4F', icon: 'activity' },
  { bg: 'rgba(197,160,89,.15)', fg: '#C5A059', icon: 'heart' },
  { bg: 'rgba(74,93,79,.12)', fg: '#4A5D4F', icon: 'stethoscope' },
];

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readIssues() {
  if (!fs.existsSync(CONTENT_DIR)) { console.log('No content/issues yet — skipping.'); return []; }
  return fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'))
    .map(file => {
      const { data } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8'));
      const slug = data.slug || file.replace(/\.md$/, '');
      return { ...data, slug };
    })
    .filter(i => i.title)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, TEASER_COUNT);
}

function buildCard(issue, i) {
  const c = BADGE_COLORS[i % BADGE_COLORS.length];
  const label = issue.issueNumber || 'Editorial';
  return `      <div class="resource-card">
        <div class="resource-card-img"><img src="${escapeHtml(issue.coverImage || issue.image || '')}" loading="lazy" alt="${escapeHtml(issue.title)}"></div>
        <div class="resource-card-badge" style="background:${c.bg};"><i data-lucide="${c.icon}" class="w-5 h-5" style="color:${c.fg};"></i></div>
        <div class="resource-card-body">
          <span class="font-sans text-[9px] uppercase tracking-widest text-brand-gold font-bold">${escapeHtml(label)}</span>
          <h3 class="font-serif text-base mt-1.5" style="color:var(--text);">${escapeHtml(issue.coverTitle || issue.title)}</h3>
          <p class="font-sans text-xs mt-2 leading-relaxed" style="color:var(--text-muted);">${escapeHtml(issue.description || '')}</p>
          <a href="journal/issues/${escapeHtml(issue.slug)}.html" class="resource-pill" style="background:${c.bg};color:${c.fg};">Visit Journal <i data-lucide="arrow-right" class="w-3 h-3"></i></a>
        </div>
      </div>`;
}

function main() {
  const issues = readIssues();
  console.log(`Found ${issues.length} issue(s) for the homepage teaser`);
  if (!fs.existsSync(INDEX_HTML)) return;
  let html = fs.readFileSync(INDEX_HTML, 'utf8');
  if (!html.includes(START_MARKER) || !html.includes(END_MARKER)) {
    console.log(`⚠️  Markers not found — add ${START_MARKER}/${END_MARKER} once, manually, around the 4 resource-card blocks in #samarpan-journal.`);
    return;
  }
  if (!issues.length) { console.log('ℹ️  No issues yet — left untouched.'); return; }
  const cardsHtml = issues.map(buildCard).join('\n');
  const before = html.split(START_MARKER)[0];
  const after = html.split(END_MARKER)[1];
  html = `${before}${START_MARKER}\n${cardsHtml}\n      ${END_MARKER}${after}`;
  fs.writeFileSync(INDEX_HTML, html);
  console.log(`✅ Recent Issues teaser updated with ${issues.length} issue(s).`);
}
main();
