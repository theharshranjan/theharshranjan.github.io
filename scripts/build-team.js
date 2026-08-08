/**
 * SAMARPAN — Founding Team Auto-Builder
 * Add to build command: "... && node scripts/build-team.js"
 * Rebuilds the #team section between CMS:TEAM:START/END markers in
 * about.html, replicating the exact alternating photo-left/photo-right
 * card layout the original hand-written bios used.
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'team');
const ABOUT_HTML = path.join(ROOT, 'about.html');
const START_MARKER = '<!-- CMS:TEAM:START -->';
const END_MARKER = '<!-- CMS:TEAM:END -->';

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function readTeam() {
  if (!fs.existsSync(CONTENT_DIR)) { console.log('No content/team yet — skipping.'); return []; }
  return fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'))
    .map(file => { const { data } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')); return data; })
    .filter(t => t.name && t.featured !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function buildTags(tags, accent) {
  return (tags || []).map(t =>
    `<span style="background:${hexToRgba(accent, 0.08)};border:1px solid ${hexToRgba(accent, 0.2)};border-radius:50px;padding:.25rem .75rem;font-family:'Lato',sans-serif;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:${accent};font-weight:700;">${escapeHtml(t)}</span>`
  ).join('\n            ');
}

function buildBio(bio) {
  return (bio || []).map(b => `<p>${escapeHtml(b.paragraph || b)}</p>`).join('\n            ');
}

function buildPhotoBlock(member, roundedSide) {
  const badgeSide = member.photoSide === 'right' ? 'right:1.5rem;' : 'left:1.5rem;';
  const gradientDir = member.photoSide === 'right' ? 'to left' : 'to right';
  return `<div class="lg:col-span-2${member.photoSide === 'right' ? ' order-1 lg:order-2' : ''}" style="min-height:340px;position:relative;overflow:hidden;">
          <img src="${escapeHtml(member.photo)}" alt="${escapeHtml(member.name)} — ${escapeHtml(member.role || '')}" class="w-full h-full object-cover" style="object-position:center 15%;min-height:340px;" loading="lazy">
          <div style="position:absolute;inset:0;background:linear-gradient(${gradientDir},rgba(0,0,0,.45) 0%,transparent 60%);"></div>
          <div style="position:absolute;top:1.5rem;${badgeSide}z-index:2;">
            <div style="background:${hexToRgba(member.accent, 0.9)};border-radius:2px;padding:.3rem .75rem;display:inline-block;">
              <span style="font-family:'Lato',sans-serif;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#fff;font-weight:700;">${escapeHtml(member.badgeLabel || member.role || '')}</span>
            </div>
          </div>
        </div>`;
}

function buildCard(member, idx) {
  const textOrder = member.photoSide === 'right' ? ' order-2 lg:order-1' : '';
  const textBlock = `<div class="lg:col-span-3 p-8 md:p-12 flex flex-col justify-center${textOrder}" style="background:var(--card-bg);">
          <span class="font-sans text-[10px] uppercase tracking-widest block mb-2" style="color:${member.accent};">${escapeHtml(member.role || '')}</span>
          <h3 class="font-display text-3xl md:text-4xl mb-1" style="color:var(--text);">${escapeHtml(member.name)}</h3>
          <p class="font-serif italic text-brand-gold text-lg mb-5">${escapeHtml(member.subtitle || '')}</p>
          <div class="space-y-3 font-sans text-sm leading-relaxed mb-6" style="color:var(--text-muted);">
            ${buildBio(member.bio)}
          </div>
          <div class="flex flex-wrap gap-2 mb-6">
            ${buildTags(member.tags, member.accent)}
          </div>
          <a href="${escapeHtml(member.profileLink || '#')}" class="cta-btn inline-flex items-center gap-2 text-white px-7 py-3.5 text-[10px] font-bold uppercase tracking-widest rounded-sm w-fit" style="background:${member.accent};" onclick="gaEvent('click','Team','${escapeHtml(member.name)} Profile')">
            <i data-lucide="${escapeHtml(member.buttonIcon || 'user')}" class="w-4 h-4"></i> View Full Profile
          </a>
        </div>`;
  const photoBlock = buildPhotoBlock(member);

  const orderedBlocks = member.photoSide === 'right' ? [textBlock, photoBlock] : [photoBlock, textBlock];

  return `    <div class="${idx === 0 ? 'mb-16' : 'mt-16'} fade-up">
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-0 overflow-hidden rounded-sm shadow-2xl" style="border:1px solid var(--border);">
        ${orderedBlocks.join('\n        ')}
      </div>
    </div>`;
}

function main() {
  const team = readTeam();
  console.log(`Found ${team.length} team member(s)`);
  if (!fs.existsSync(ABOUT_HTML)) { console.log('about.html not found — skipping.'); return; }
  let html = fs.readFileSync(ABOUT_HTML, 'utf8');
  if (!html.includes(START_MARKER) || !html.includes(END_MARKER)) {
    console.log(`⚠️  Markers not found in about.html — add ${START_MARKER}/${END_MARKER} once, manually, around the 3 team-member card blocks inside #team.`);
    return;
  }
  if (!team.length) { console.log('ℹ️  No team members — left untouched.'); return; }
  const cardsHtml = team.map(buildCard).join('\n\n');
  const before = html.split(START_MARKER)[0];
  const after = html.split(END_MARKER)[1];
  html = `${before}${START_MARKER}\n${cardsHtml}\n    ${END_MARKER}${after}`;
  fs.writeFileSync(ABOUT_HTML, html);
  console.log(`✅ Founding Team updated with ${team.length} member(s).`);
}
main();
