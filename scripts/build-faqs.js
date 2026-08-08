/**
 * SAMARPAN — FAQs Auto-Builder
 * ---------------------------------
 * Add to the deploy build command alongside the others:
 * "node scripts/build-journal.js && node scripts/build-testimonials.js
 *  && node scripts/build-retreats.js && node scripts/build-faqs.js"
 *
 * Reads content/faqs/*.md and rebuilds the FAQ accordion in index.html
 * between CMS:FAQS:START / CMS:FAQS:END markers. Matches the site's
 * real .faq-item / .faq-btn / .faq-body markup exactly.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'faqs');
const INDEX_HTML = path.join(ROOT, 'index.html');

const START_MARKER = '<!-- CMS:FAQS:START -->';
const END_MARKER = '<!-- CMS:FAQS:END -->';

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readFaqs() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.log('No content/faqs folder yet — skipping FAQ build.');
    return [];
  }
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  return files
    .map(file => {
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
      const { data } = matter(raw);
      return { ...data, slug: file.replace(/\.md$/, '') };
    })
    .filter(f => f.question && f.answer && f.featured !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

// Exact same markup as the original hand-written FAQ items.
function buildFaqItem(faq) {
  return `      <div class="faq-item"><button class="faq-btn" onclick="toggleFaq(this)"><span>${escapeHtml(faq.question)}</span><i data-lucide="plus" class="faq-icon w-5 h-5"></i></button><div class="faq-body"><p>${escapeHtml(faq.answer)}</p></div></div>`;
}

function updateFaqSection(faqs) {
  if (!fs.existsSync(INDEX_HTML)) return;
  let html = fs.readFileSync(INDEX_HTML, 'utf8');

  if (!html.includes(START_MARKER) || !html.includes(END_MARKER)) {
    console.log(`⚠️  Could not find ${START_MARKER} / ${END_MARKER} markers in index.html — add them once, manually, around the .faq-item blocks inside #faq.`);
    return;
  }
  if (!faqs.length) {
    console.log('ℹ️  No FAQs found in content/faqs/ — section left untouched.');
    return;
  }

  const itemsHtml = faqs.map(buildFaqItem).join('\n');
  const before = html.split(START_MARKER)[0];
  const after = html.split(END_MARKER)[1];
  html = `${before}${START_MARKER}\n${itemsHtml}\n      ${END_MARKER}${after}`;

  fs.writeFileSync(INDEX_HTML, html);
  console.log(`✅ FAQ section updated with ${faqs.length} item(s).`);
}

function main() {
  const faqs = readFaqs();
  console.log(`Found ${faqs.length} FAQ(s) in content/faqs/`);
  updateFaqSection(faqs);
  console.log('✅ FAQs build complete.');
}

main();
