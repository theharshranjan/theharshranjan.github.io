#!/usr/bin/env node
/**
 * scripts/fix-canonicals.js
 * Makes every canonical / og:url / twitter:url / JSON-LD URL / encoded share link point to the
 * clean production URL: https://thesamarpan.co.in/<path>  (no www, no .html).
 * Idempotent. Dry run by default:   node scripts/fix-canonicals.js
 * Apply the changes:                node scripts/fix-canonicals.js --write
 */
const fs = require('fs');
const path = require('path');

const WRITE = process.argv.includes('--write');
const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', '.github', 'admin', 'admin-test', 'content', 'journal-images', 'templates', 'verify']);
const OURS = /^https?:\/\/(www\.)?thesamarpan\.co\.in/i;

function clean(u) {
  if (!OURS.test(u)) return u;                       // never touch other domains
  return u
    .replace(OURS, 'https://thesamarpan.co.in')
    .replace(/\/index\.html(?=$|[?#])/, '/')
    .replace(/\.html(?=$|[?#])/, '');
}

function fixHtml(src) {
  let out = src;

  // 1. canonical link (rel before href, or href before rel)
  out = out.replace(/(<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["'])([^"']+)(["'])/gi, (m, a, u, z) => a + clean(u) + z);
  out = out.replace(/(<link\b[^>]*\bhref=["'])([^"']+)(["'][^>]*\brel=["']canonical["'])/gi, (m, a, u, z) => a + clean(u) + z);

  // 2. og:url and twitter:url
  out = out.replace(/(<meta\b[^>]*\b(?:property|name)=["'](?:og:url|twitter:url)["'][^>]*\bcontent=["'])([^"']+)(["'])/gi, (m, a, u, z) => a + clean(u) + z);

  // 3. JSON-LD blocks
  out = out.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, body, z) =>
    a + body.replace(/https?:\/\/(?:www\.)?thesamarpan\.co\.in[^"\s\\]*/gi, (u) => clean(u)) + z);

  // 4. URL-encoded share links (WhatsApp / Twitter / Facebook)
  out = out.replace(/(https%3A%2F%2F)(?:www\.)?(thesamarpan\.co\.in)([^"'&\s]*?)(?:\.html)?(?=["'&\s])/gi, '$1$2$3');

  return out;
}

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), files); }
    else if (e.name.endsWith('.html')) files.push(path.join(dir, e.name));
  }
  return files;
}

let changed = 0;
for (const f of walk(ROOT)) {
  const src = fs.readFileSync(f, 'utf8');
  const out = fixHtml(src);
  if (out !== src) {
    changed++;
    console.log((WRITE ? 'fixed   ' : 'would fix ') + path.relative(ROOT, f));
    if (WRITE) fs.writeFileSync(f, out);
  }
}
console.log(`\n${changed} file(s) ${WRITE ? 'updated' : 'would change (dry run, add --write to apply)'}`);
