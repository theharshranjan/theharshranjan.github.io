/**
 * sync-navbar.js
 *
 * Syncs the canonical navbar + mobile-menu (canonical-navbar.html, in this
 * same scripts/ folder) into every page that uses the main site nav.
 * Unlike the footer, the navbar is NOT identical on every page — each page
 * marks its own link "active". This script fills in canonical-navbar.html's
 * {{ACTIVE:key}} placeholders per page, then swaps out the existing
 * <nav id="navbar">...</nav> + <div id="mobile-menu">...</div> pair.
 *
 * Usage (from the repo root):
 *   node scripts/sync-navbar.js
 *
 * Pages with no <nav id="navbar"> are left completely untouched — that
 * includes journal article pages (deliberately use a different minimal
 * nav), admin/portal tool pages (deliberately use a different dashboard
 * nav), and a few pages with no nav at all.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const CANONICAL_PATH = path.join(__dirname, 'canonical-navbar.html');

// filename -> which nav key to mark active. Anything not listed here gets
// no active link at all, matching index.html's own convention.
const ACTIVE_MAP = {
  'about.html': 'about',
  'journal.html': 'journal',
  'sessions.html': 'sessions',
  'ayurveda.html': 'ayurveda',
  'community.html': 'community',
  'communityupdatess.html': 'community', // existing convention, preserved
};

function collectHtmlFiles() {
  const patterns = [REPO_ROOT, path.join(REPO_ROOT, 'retreats'), path.join(REPO_ROOT, 'media')];
  const files = [];
  for (const dir of patterns) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (name.toLowerCase().endsWith('.html')) {
        files.push(path.join(dir, name));
      }
    }
  }
  return files;
}

// Depth-counting matcher: finds the index just after the matching closing
// tag for the tag that starts at openTagStart. Handles nested tags of the
// same name correctly (simple regex with .*? cannot).
function findMatchingClose(content, openTagStart, tagName) {
  const combined = new RegExp('<' + tagName + '(?:\\s[^>]*)?>|</' + tagName + '\\s*>', 'gi');
  combined.lastIndex = openTagStart;
  let depth = 0;
  let m;
  while ((m = combined.exec(content)) !== null) {
    if (m[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0) return m.index + m[0].length;
    } else {
      depth += 1;
    }
    combined.lastIndex = m.index + m[0].length;
  }
  return null;
}

function findNavBlockRange(content) {
  const navMatch = /<nav\s+id="navbar"/i.exec(content);
  if (!navMatch) return null;
  const navStart = navMatch.index;
  const navEnd = findMatchingClose(content, navStart, 'nav');
  if (navEnd === null) return null;

  const rest = content.slice(navEnd);
  const mmMatch = /<div\s+id="mobile-menu"/i.exec(rest);
  if (!mmMatch) return { start: navStart, end: navEnd };

  const mmStart = navEnd + mmMatch.index;
  const mmEnd = findMatchingClose(content, mmStart, 'div');
  if (mmEnd === null) return { start: navStart, end: navEnd };

  return { start: navStart, end: mmEnd };
}

function renderCanonical(canonicalTemplate, activeKey) {
  return canonicalTemplate.replace(/\{\{ACTIVE:([a-z]+)\}\}/g, (_, key) => {
    return key === activeKey ? ' active' : '';
  });
}

function main() {
  const canonicalRaw = fs.readFileSync(CANONICAL_PATH, 'utf8');
  const canonicalCRLF = canonicalRaw.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n').replace(/\r\n$/, '');

  const updated = [];
  const skipped = [];

  for (const filePath of collectHtmlFiles()) {
    const content = fs.readFileSync(filePath, 'utf8');
    const range = findNavBlockRange(content);
    if (!range) {
      skipped.push(filePath);
      continue;
    }

    const fileName = path.basename(filePath);
    const activeKey = ACTIVE_MAP[fileName] || null;
    const rendered = renderCanonical(canonicalCRLF, activeKey);

    const newContent = content.slice(0, range.start) + rendered + content.slice(range.end);
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      updated.push({ file: filePath, active: activeKey || '(none)' });
    }
  }

  console.log(`Updated: ${updated.length}`);
  updated.forEach(u => console.log('  -', path.relative(REPO_ROOT, u.file), '| active:', u.active));
  console.log(`\nSkipped (no id="navbar" found, left untouched): ${skipped.length}`);
  skipped.forEach(f => console.log('  -', path.relative(REPO_ROOT, f)));
}

main();
