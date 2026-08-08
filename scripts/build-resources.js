/**
 * SAMARPAN — Free Resources (Guides) Auto-Builder
 * Add to build command: "... && node scripts/build-resources.js"
 * Rebuilds #free-downloads grid between CMS:RESOURCES:START/END.
 *
 * "Sent straight to your inbox": each card opens a shared email-gate
 * modal (built once, reused by all cards) instead of a bare link —
 * visitor enters their email, it's dual-written via the same Apps
 * Script + Firestore pipeline as other forms (tagged resourceSlug),
 * then the guide opens in a new tab. SET RESOURCE_ENDPOINT below.
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'resources');
const INDEX_HTML = path.join(ROOT, 'index.html');
const START_MARKER = '<!-- CMS:RESOURCES:START -->';
const END_MARKER = '<!-- CMS:RESOURCES:END -->';
const MODAL_START = '<!-- CMS:RESOURCE_MODAL:START -->';
const MODAL_END = '<!-- CMS:RESOURCE_MODAL:END -->';

// SET THIS to your existing Apps Script Web App URL (same one
// booking.html/contact.html/retreats already post to).
const RESOURCE_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyBRC53kbCsrsU-22Jx3C7Vci2tMlFjpMi4_XXNmnARwl9Um5_-peKFpPnLj2-foFty/exec';

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readItems() {
  if (!fs.existsSync(CONTENT_DIR)) { console.log('No content/resources yet — skipping.'); return []; }
  return fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'))
    .map(file => { const { data } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')); return data; })
    .filter(r => r.title && r.featured !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function buildCard(r) {
  const iconBg = (r.iconColor || '#D95D39') + '1F';
  const pdfUrl = r.pdf ? `https://docs.google.com/viewer?url=${encodeURIComponent(r.pdf)}&embedded=true` : '#';
  return `      <div class="resource-card">
        <div class="resource-card-img"><img src="${escapeHtml(r.image || '')}" loading="lazy" alt="${escapeHtml(r.title)}"></div>
        <div class="resource-card-badge" style="background:${iconBg};"><i data-lucide="${escapeHtml(r.icon || 'file-text')}" class="w-5 h-5" style="color:${escapeHtml(r.iconColor || '#D95D39')};"></i></div>
        <div class="resource-card-body">
          <h3 class="font-serif text-base mt-1.5" style="color:var(--text);">${escapeHtml(r.title)}</h3>
          <p class="font-sans text-xs mt-2 leading-relaxed" style="color:var(--text-muted);">${escapeHtml(r.description || '')}</p>
          <a href="#" onclick="requestGuide('${escapeHtml(r.title)}','${pdfUrl}');return false;" class="resource-pill" style="background:${iconBg};color:${escapeHtml(r.iconColor || '#D95D39')};">Get Guide <i data-lucide="arrow-right" class="w-3 h-3"></i></a>
        </div>
      </div>`;
}

function buildModalBlock() {
  return `${MODAL_START}
<div id="resourceModalOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;align-items:center;justify-content:center;padding:1rem;">
  <div style="background:var(--bg);max-width:420px;width:100%;border-radius:6px;padding:2rem;position:relative;">
    <button onclick="closeResourceModal()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-muted);">×</button>
    <h3 class="font-serif text-lg mb-2" style="color:var(--text);" id="resourceModalTitle">Get this guide</h3>
    <p class="font-sans text-xs mb-4" style="color:var(--text-muted);">We'll email you the guide and add you to our wellness updates list.</p>
    <form id="resourceModalForm">
      <input type="email" id="resourceModalEmail" required placeholder="you@example.com" class="w-full border rounded-sm px-4 py-3 text-sm mb-3" style="border-color:var(--border);background:var(--bg2);">
      <input type="text" id="resourceModalHoneypot" style="position:absolute;left:-9999px;" tabindex="-1" autocomplete="off">
      <button type="submit" class="w-full bg-brand-black text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-clay transition">Send Me the Guide</button>
      <p id="resourceModalStatus" class="text-xs mt-3" style="color:var(--text-muted);"></p>
    </form>
  </div>
</div>
<script>
var resourceEndpoint = '${RESOURCE_ENDPOINT}';
var pendingResourceUrl = '';
var resourceModalLoadTime = 0;
function requestGuide(title, pdfUrl) {
  pendingResourceUrl = pdfUrl;
  document.getElementById('resourceModalTitle').textContent = 'Get "' + title + '"';
  document.getElementById('resourceModalOverlay').style.display = 'flex';
  resourceModalLoadTime = Date.now();
}
function closeResourceModal() { document.getElementById('resourceModalOverlay').style.display = 'none'; }
document.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById('resourceModalForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (Date.now() - resourceModalLoadTime < 2000) return;
    if (document.getElementById('resourceModalHoneypot').value) return;
    var status = document.getElementById('resourceModalStatus');
    status.textContent = 'Sending...';
    var email = document.getElementById('resourceModalEmail').value;
    fetch(resourceEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ formType: 'resourceDownload', email: email, resourceTitle: document.getElementById('resourceModalTitle').textContent })
    }).then(function() {
      status.textContent = 'Sent! Opening your guide...';
      if (pendingResourceUrl && pendingResourceUrl !== '#') window.open(pendingResourceUrl, '_blank');
      setTimeout(closeResourceModal, 1200);
    }).catch(function() {
      status.textContent = 'Something went wrong — please try again.';
    });
  });
});
</script>
${MODAL_END}`;
}

function main() {
  const items = readItems();
  console.log(`Found ${items.length} resource(s)`);
  if (!fs.existsSync(INDEX_HTML)) return;
  let html = fs.readFileSync(INDEX_HTML, 'utf8');
  if (!html.includes(START_MARKER) || !html.includes(END_MARKER)) {
    console.log(`⚠️  Grid markers not found — add ${START_MARKER}/${END_MARKER} once, manually.`);
    return;
  }
  if (items.length) {
    const cardsHtml = items.map(buildCard).join('\n');
    const before = html.split(START_MARKER)[0];
    const after = html.split(END_MARKER)[1];
    html = `${before}${START_MARKER}\n${cardsHtml}\n      ${END_MARKER}${after}`;
  } else {
    console.log('ℹ️  No resources — grid left untouched.');
  }

  if (html.includes(MODAL_START) && html.includes(MODAL_END)) {
    const before = html.split(MODAL_START)[0];
    const after = html.split(MODAL_END)[1];
    html = `${before}${buildModalBlock()}${after}`;
  } else {
    console.log(`⚠️  Modal markers not found — add ${MODAL_START}/${MODAL_END} once, manually, right before </body>.`);
  }

  fs.writeFileSync(INDEX_HTML, html);
  console.log(`✅ Free Resources updated with ${items.length} guide(s) + email-gate modal.`);
}
main();
