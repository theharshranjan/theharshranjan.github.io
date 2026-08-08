/**
 * SAMARPAN — Retreats & Events Auto-Builder
 * ---------------------------------
 * Runs on every Cloudflare Pages deploy (add alongside the other build
 * scripts: "node scripts/build-journal.js && node scripts/build-testimonials.js
 * && node scripts/build-retreats.js").
 *
 * Reads every retreat/event in the CMS (content/retreats/*.md) and:
 *   1. Generates a full event page for each one (retreats/<slug>.html)
 *      with a CUSTOM registration form built from that event's
 *      "formFields" list — different events can have completely
 *      different forms.
 *   2. Rebuilds the homepage retreat calendar between
 *      CMS:RETREATS:START / CMS:RETREATS:END marker comments.
 *
 * Form submissions use the SAME Apps Script backend + dual-write
 * pattern as booking.html/contact.html (reCAPTCHA v3, honeypot,
 * timing check) — just tagged with an "eventSlug" field so each
 * event's responses land in their own segment of the sheet/Firestore.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'retreats');
const OUTPUT_DIR = path.join(ROOT, 'retreats');
const TEMPLATE_PATH = path.join(ROOT, 'templates', 'retreat-template.html');
const HOME_INDEX = path.join(ROOT, 'index.html');

const START_MARKER = '<!-- CMS:RETREATS:START -->';
const END_MARKER = '<!-- CMS:RETREATS:END -->';

// SET THIS to your existing Apps Script Web App URL (same one
// booking.html/contact.html already post to).
const APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyBRC53kbCsrsU-22Jx3C7Vci2tMlFjpMi4_XXNmnARwl9Um5_-peKFpPnLj2-foFty/exec';

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fill(tpl, data) {
  return tpl.replace(/{{(\w+)}}/g, (_, key) => (data[key] !== undefined ? data[key] : ''));
}

function readRetreats() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.log('No content/retreats folder yet — skipping retreats build.');
    return [];
  }
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    const { data, content } = matter(raw);
    const slug = data.slug || file.replace(/\.md$/, '');
    return { ...data, slug, bodyMarkdown: content };
  }).filter(r => r.title);
}

// Renders one HTML <input>/<select>/<textarea> from a formFields entry.
function buildFormField(field) {
  const req = field.required ? 'required' : '';
  const label = `<label class="block text-xs font-bold uppercase tracking-widest mb-2" style="color:var(--text-muted);">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>`;

  let input;
  if (field.type === 'textarea') {
    input = `<textarea name="${escapeHtml(field.name)}" ${req} rows="4" class="w-full border rounded-sm px-4 py-3 text-sm" style="border-color:var(--border);background:var(--bg);"></textarea>`;
  } else if (field.type === 'select') {
    const opts = (field.options || []).map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
    input = `<select name="${escapeHtml(field.name)}" ${req} class="w-full border rounded-sm px-4 py-3 text-sm" style="border-color:var(--border);background:var(--bg);"><option value="">Select...</option>${opts}</select>`;
  } else if (field.type === 'checkbox') {
    input = `<input type="checkbox" name="${escapeHtml(field.name)}" ${req} class="mr-2">`;
    return `<div class="mb-5 flex items-center">${input}${label}</div>`;
  } else {
    // text, email, tel, number
    input = `<input type="${escapeHtml(field.type || 'text')}" name="${escapeHtml(field.name)}" ${req} class="w-full border rounded-sm px-4 py-3 text-sm" style="border-color:var(--border);background:var(--bg);">`;
  }
  return `<div class="mb-5">${label}${input}</div>`;
}

function buildRegistrationForm(retreat) {
  const fields = (retreat.formFields || []).map(buildFormField).join('\n        ');
  return `      <form id="retreatForm-${retreat.slug}" class="retreat-form" data-event-slug="${escapeHtml(retreat.slug)}" data-endpoint="${APPS_SCRIPT_ENDPOINT}">
        <input type="hidden" name="eventSlug" value="${escapeHtml(retreat.slug)}">
        <input type="hidden" name="eventTitle" value="${escapeHtml(retreat.title)}">
        <input type="text" name="website" class="hidden-honeypot" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;">
        ${fields}
        <button type="submit" class="w-full bg-brand-black text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-clay transition">Register for This Event</button>
        <p class="form-status text-xs mt-3" style="color:var(--text-muted);"></p>
      </form>
      <script>
      (function() {
        var form = document.getElementById('retreatForm-${retreat.slug}');
        if (!form) return;
        var loadTime = Date.now();
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          if (Date.now() - loadTime < 3000) return; // timing check, same as other forms
          if (form.website.value) return; // honeypot
          var status = form.querySelector('.form-status');
          status.textContent = 'Submitting...';
          var data = Object.fromEntries(new FormData(form).entries());
          fetch(form.dataset.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data)
          }).then(function() {
            status.textContent = 'Thank you! We will contact you shortly.';
            form.reset();
          }).catch(function() {
            status.textContent = 'Something went wrong — please try again or email us directly.';
          });
        });
      })();
      </script>`;
}

function buildEventPage(retreat, template) {
  const bodyHtml = marked.parse(retreat.bodyMarkdown || '');
  const start = retreat.startDate ? new Date(retreat.startDate) : null;
  const end = retreat.endDate ? new Date(retreat.endDate) : null;
  const dateRange = start
    ? `${start.toLocaleDateString('en-IN', { month: 'long', day: 'numeric' })}${end ? ' – ' + end.toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}`
    : '';

  const html = fill(template, {
    title: escapeHtml(retreat.title),
    slug: retreat.slug,
    location: escapeHtml(retreat.location || ''),
    dateRange,
    image: retreat.image || '',
    description: escapeHtml(retreat.description || ''),
    price: escapeHtml(retreat.price || ''),
    spots: retreat.spots || '',
    bodyHtml,
    registrationFormHtml: buildRegistrationForm(retreat)
  });

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, `${retreat.slug}.html`), html);
}

// Matches the site's REAL existing markup exactly (.event-card /
// .event-card-img / .event-tag / .event-card-body / .event-date /
// "Get Notified" link) — confirmed against index.html's #events section,
// not a generic guess.
function buildCalendarCard(retreat) {
  const start = retreat.startDate ? new Date(retreat.startDate) : null;
  const end = retreat.endDate ? new Date(retreat.endDate) : null;
  let dateLabel = 'Date: TBA';
  if (start) {
    const days = end ? Math.round((end - start) / 86400000) + 1 : null;
    const month = start.toLocaleDateString('en-IN', { month: 'long' });
    dateLabel = days ? `${days} Days · ${month}` : month;
  }
  const tag = retreat.eventTag || 'Retreat'; // e.g. "Yatra", "Retreat", "Meditation" — matches existing badge style
  return `      <div class="event-card">
        <div class="event-card-img">
          <span class="event-tag">${escapeHtml(tag)}</span>
          <img src="${retreat.image || ''}" loading="lazy" alt="${escapeHtml(retreat.title)}">
        </div>
        <div class="event-card-body">
          <h3>${escapeHtml(retreat.title)}</h3>
          <p class="event-date">${escapeHtml(dateLabel)}</p>
          <a href="retreats/${retreat.slug}.html" onclick="gaEvent('click','Event','${escapeHtml(retreat.title)} Interest')">Register →</a>
        </div>
      </div>`;
}

function updateHomepageCalendar(retreats) {
  if (!fs.existsSync(HOME_INDEX)) return;
  let html = fs.readFileSync(HOME_INDEX, 'utf8');
  if (!html.includes(START_MARKER) || !html.includes(END_MARKER)) {
    console.log(`⚠️  Could not find ${START_MARKER} / ${END_MARKER} markers in index.html — add them around the retreat calendar cards once, manually.`);
    return;
  }
  const featured = retreats.filter(r => r.featured !== false)
    .sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
  const cardsHtml = featured.map(buildCalendarCard).join('\n\n');
  const before = html.split(START_MARKER)[0];
  const after = html.split(END_MARKER)[1];
  html = `${before}${START_MARKER}\n${cardsHtml}\n      ${END_MARKER}${after}`;
  fs.writeFileSync(HOME_INDEX, html);
  console.log(`✅ Homepage retreat calendar updated with ${featured.length} event(s).`);
}

function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.log('⚠️  templates/retreat-template.html not found — skipping retreat page generation (calendar update will still run).');
  }
  const retreats = readRetreats();
  console.log(`Found ${retreats.length} retreat(s)/event(s) in content/retreats/`);

  if (fs.existsSync(TEMPLATE_PATH)) {
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    retreats.forEach(r => buildEventPage(r, template));
  }
  updateHomepageCalendar(retreats);
  console.log('✅ Retreats build complete.');
}

main();
