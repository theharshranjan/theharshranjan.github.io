/**
 * SAMARPAN — Testimonials Auto-Builder
 * ---------------------------------
 * Runs automatically on every Cloudflare Pages deploy (add this file's
 * path to the same build step that already runs build-journal.js — e.g.
 * "node scripts/build-journal.js && node scripts/build-testimonials.js").
 *
 * Reads every testimonial written in the CMS (content/testimonials/*.md)
 * and rebuilds the marquee card list inside index.html between
 * CMS:TESTIMONIALS:START / CMS:TESTIMONIALS:END marker comments.
 *
 * You never need to touch this file. Contributors just use the /admin
 * panel (Testimonials collection) — this script does the rest.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'testimonials');
const INDEX_HTML = path.join(ROOT, 'index.html');

const START_MARKER = '<!-- CMS:TESTIMONIALS:START -->';
const END_MARKER = '<!-- CMS:TESTIMONIALS:END -->';

// Category -> Tailwind text/bg class pair, matching the original
// hand-written cards (clay/sage/gold rotation). Falls back to clay
// for any category not listed here.
const CATEGORY_CLASSES = {
  'Ayurveda':        { text: 'text-clay',       bg: 'bg-clay/10' },
  'Yoga':            { text: 'text-sage',       bg: 'bg-sage/10' },
  'Ajapa Japa':      { text: 'text-brand-gold', bg: 'bg-brand-gold/10' },
  'Mantra':          { text: 'text-clay',       bg: 'bg-clay/10' },
  'Psychology':      { text: 'text-sage',       bg: 'bg-sage/10' },
  "Women's Health":  { text: 'text-brand-gold', bg: 'bg-brand-gold/10' },
  'Depression':      { text: 'text-clay',       bg: 'bg-clay/10' },
  'Nutrition':       { text: 'text-sage',       bg: 'bg-sage/10' },
  'Meditation':      { text: 'text-brand-gold', bg: 'bg-brand-gold/10' },
};

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readTestimonials() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.log('No content/testimonials folder yet — skipping testimonials build.');
    return [];
  }
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  return files
    .map(file => {
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
      const { data } = matter(raw);
      return { ...data, slug: file.replace(/\.md$/, '') };
    })
    .filter(t => t.name && t.quote && t.featured !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function buildCard(t) {
  const cls = CATEGORY_CLASSES[t.category] || CATEGORY_CLASSES['Ayurveda'];
  const stars = '★'.repeat(Math.max(1, Math.min(5, t.rating || 5)));
  const accent = t.accent || '#D95D39';

  return `      <div class="testi-card" style="--accent:${accent};"><div class="flex justify-between items-start mb-4"><span class="text-[9px] uppercase tracking-widest font-bold ${cls.text} ${cls.bg} px-2 py-1 rounded">${escapeHtml(t.category || '')}</span><span class="text-brand-gold text-xs">${stars}</span></div><p class="font-serif leading-relaxed mb-4 italic" style="color:var(--text);">"${escapeHtml(t.quote)}"</p><div class="border-t pt-3" style="border-color:var(--border);"><p class="font-bold text-sm" style="color:var(--text);">${escapeHtml(t.name)}</p><p class="text-xs uppercase tracking-wider" style="color:var(--text-muted);">${escapeHtml(t.location || '')}</p></div></div>`;
}

function updateTestimonialsSection(testimonials) {
  if (!fs.existsSync(INDEX_HTML)) {
    console.log('index.html not found — skipping testimonials update.');
    return;
  }
  let html = fs.readFileSync(INDEX_HTML, 'utf8');

  if (!html.includes(START_MARKER) || !html.includes(END_MARKER)) {
    console.log(`\n⚠️  Could not find ${START_MARKER} / ${END_MARKER} markers in index.html.`);
    console.log('   Add these two comment lines once, manually, around the .marquee-content div\'s');
    console.log('   testi-card blocks (inside <div class="marquee-content"> ... </div>):');
    console.log(`   ${START_MARKER}\n   ...existing testi-card blocks...\n   ${END_MARKER}\n`);
    return;
  }

  if (!testimonials.length) {
    console.log('ℹ️  No testimonials found in content/testimonials/ — section left untouched.');
    return;
  }

  // Marquee needs the list duplicated once for a seamless infinite-scroll loop
  // (matches the "<!-- Duplicates -->" pattern in the original hand-written HTML).
  const cardsHtml = testimonials.map(buildCard).join('\n');
  const duplicatedHtml = testimonials.map(buildCard).join('\n');

  const before = html.split(START_MARKER)[0];
  const after = html.split(END_MARKER)[1];
  html = `${before}${START_MARKER}\n${cardsHtml}\n      <!-- Duplicates (seamless marquee loop) -->\n${duplicatedHtml}\n      ${END_MARKER}${after}`;

  fs.writeFileSync(INDEX_HTML, html);
  console.log(`✅ Testimonials section updated with ${testimonials.length} card(s) (x2 for marquee loop).`);
}

function main() {
  const testimonials = readTestimonials();
  console.log(`Found ${testimonials.length} testimonial(s) in content/testimonials/`);
  updateTestimonialsSection(testimonials);
  console.log('✅ Testimonials build complete.');
}

main();
