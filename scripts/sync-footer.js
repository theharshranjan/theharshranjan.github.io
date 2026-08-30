/**
 * sync-footer.js
 *
 * Syncs the canonical footer (canonical-footer.html, in this same scripts/
 * folder) into every HTML page in the site. Run this any time the footer
 * needs to be reapplied — e.g. after adding a new page.
 *
 * Usage (from the repo root):
 *   node scripts/sync-footer.js
 *
 * It only ever touches the <footer>...</footer> block (or an existing
 * CMS:FOOTER:START/END zone) in each file — everything else in every file
 * is left byte-for-byte untouched. Files with no footer at all are skipped
 * and listed at the end.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const CANONICAL_PATH = path.join(__dirname, 'canonical-footer.html');

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

function main() {
  const canonicalRaw = fs.readFileSync(CANONICAL_PATH, 'utf8');
  // Normalize the canonical block to CRLF, to match this repo's line endings,
  // and trim any trailing newline so it drops in cleanly.
  const canonical = canonicalRaw.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n').replace(/\r\n$/, '');

  const footerRe = /(?:<!--\s*CMS:FOOTER:START\s*-->[\s\S]*?<!--\s*CMS:FOOTER:END\s*-->)|(?:<footer[\s\S]*?<\/footer>)/i;

  const updated = [];
  const skipped = [];

  for (const filePath of collectHtmlFiles()) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!footerRe.test(content)) {
      skipped.push(filePath);
      continue;
    }
    const newContent = content.replace(footerRe, canonical);
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      updated.push(filePath);
    }
  }

  console.log(`Updated: ${updated.length}`);
  updated.forEach(f => console.log('  -', path.relative(REPO_ROOT, f)));
  console.log(`\nSkipped (no footer found, left untouched): ${skipped.length}`);
  skipped.forEach(f => console.log('  -', path.relative(REPO_ROOT, f)));
}

main();
