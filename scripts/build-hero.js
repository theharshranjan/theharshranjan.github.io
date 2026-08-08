/**
 * SAMARPAN — Homepage Hero Auto-Builder
 * Add to build command: "... && node scripts/build-hero.js"
 *
 * Reads content/hero.md (a SINGLE file, not a folder — the Hero
 * section is a singleton, not a list) and rebuilds the video/image
 * background block in index.html between CMS:HERO:START/END markers.
 *
 * Handles both modes:
 *  - heroType: "video" -> <video> with poster + source, same as the
 *    original hand-written markup, still falls back to the desktop
 *    image via onerror if the video fails to load.
 *  - heroType: "image" -> skips the <video> tag entirely, just shows
 *    the desktop/mobile images (faster page load).
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const HERO_FILE = path.join(ROOT, 'content', 'hero.md');
const INDEX_HTML = path.join(ROOT, 'index.html');
const START_MARKER = '<!-- CMS:HERO:START -->';
const END_MARKER = '<!-- CMS:HERO:END -->';

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readHero() {
  if (!fs.existsSync(HERO_FILE)) {
    console.log('No content/hero.md yet — skipping hero build.');
    return null;
  }
  const raw = fs.readFileSync(HERO_FILE, 'utf8');
  const { data } = matter(raw);
  return data;
}

function buildHeroBlock(hero) {
  const alt = escapeHtml(hero.altText || 'Samarpan');
  const desktopImg = escapeHtml(hero.desktopImage || 'hero-desktop.webp');
  const mobileImg = escapeHtml(hero.mobileImage || 'hero-mobile.webp');

  if (hero.heroType === 'image' || !hero.desktopVideo) {
    // Image-only mode: no <video> tag at all, desktop image always shows
    // (the CSS media-query classes still control mobile vs desktop swap).
    return `<img src="${desktopImg}"
         alt="${alt}" loading="eager" fetchpriority="high"
         width="1920" height="960"
         class="w-full h-full object-cover hero-img hero-desktop-fallback" style="display:block;">
    <img src="${mobileImg}"
         alt="${alt}" loading="eager" fetchpriority="high"
         width="1000" height="1333"
         class="w-full h-full object-cover hero-img hero-mobile-img">`;
  }

  const video = escapeHtml(hero.desktopVideo);
  return `<video class="w-full h-full hero-video" autoplay muted loop playsinline preload="auto" poster="${desktopImg}"
           onerror="this.style.display='none';document.querySelector('.hero-desktop-fallback').style.display='block';">
      <source src="${video}" type="video/mp4">
    </video>
    <img src="${desktopImg}"
         alt="${alt}" loading="eager" fetchpriority="high"
         width="1920" height="960"
         class="w-full h-full object-cover hero-img hero-desktop-fallback">
    <img src="${mobileImg}"
         alt="${alt}" loading="eager" fetchpriority="high"
         width="1000" height="1333"
         class="w-full h-full object-cover hero-img hero-mobile-img">`;
}

function main() {
  const hero = readHero();
  if (!hero) return;
  if (!fs.existsSync(INDEX_HTML)) { console.log('index.html not found — skipping.'); return; }
  let html = fs.readFileSync(INDEX_HTML, 'utf8');

  if (!html.includes(START_MARKER) || !html.includes(END_MARKER)) {
    console.log(`⚠️  Markers not found — add ${START_MARKER}/${END_MARKER} once, manually, around the hero <video>/<img> block inside <div class="absolute inset-0 z-0">.`);
    return;
  }

  const block = buildHeroBlock(hero);
  const before = html.split(START_MARKER)[0];
  const after = html.split(END_MARKER)[1];
  html = `${before}${START_MARKER}\n    ${block}\n    ${END_MARKER}${after}`;

  fs.writeFileSync(INDEX_HTML, html);
  console.log(`✅ Hero updated (mode: ${hero.heroType || 'video'}).`);
}

main();
