/**
 * SAMARPAN — Media Centre Videos Auto-Builder
 * ---------------------------------
 * Add to the deploy build command:
 * "... && node scripts/build-faqs.js && node scripts/build-videos.js"
 *
 * Reads content/videos/*.md and rebuilds the Media Centre video grid
 * in index.html between CMS:VIDEOS:START / CMS:VIDEOS:END markers.
 * Matches the site's real .vid-testi-card / .video-wrapper markup.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'videos');
const INDEX_HTML = path.join(ROOT, 'index.html');

const START_MARKER = '<!-- CMS:VIDEOS:START -->';
const END_MARKER = '<!-- CMS:VIDEOS:END -->';

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readVideos() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.log('No content/videos folder yet — skipping videos build.');
    return [];
  }
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  return files
    .map(file => {
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
      const { data } = matter(raw);
      return { ...data, slug: file.replace(/\.md$/, '') };
    })
    .filter(v => v.title && v.youtubeId && v.featured !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

// Exact same markup/embed-param pattern as the original hand-written cards.
function buildVideoCard(v) {
  const id = escapeHtml(v.youtubeId);
  return `<div class="vid-testi-card">
  <div class="video-wrapper">
    <iframe
      src="https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=1&rel=0&playsinline=1&loop=1&playlist=${id}"
      title="${escapeHtml(v.title)}"
      loading="lazy"
      allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"
      allowfullscreen>
    </iframe>
  </div>
  <div class="p-4">
    <p class="font-serif text-base" style="color:var(--text);">${escapeHtml(v.title)}</p>
    <p class="font-sans text-xs mt-1" style="color:var(--text-muted);">${escapeHtml(v.subtitle || '')}</p>
  </div>
</div>`;
}

function updateVideosSection(videos) {
  if (!fs.existsSync(INDEX_HTML)) return;
  let html = fs.readFileSync(INDEX_HTML, 'utf8');

  if (!html.includes(START_MARKER) || !html.includes(END_MARKER)) {
    console.log(`⚠️  Could not find ${START_MARKER} / ${END_MARKER} markers in index.html — add them once, manually, around the .vid-testi-card blocks inside #media-centre.`);
    return;
  }
  if (!videos.length) {
    console.log('ℹ️  No videos found in content/videos/ — section left untouched.');
    return;
  }

  const cardsHtml = videos.map(buildVideoCard).join('\n\n');
  const before = html.split(START_MARKER)[0];
  const after = html.split(END_MARKER)[1];
  html = `${before}${START_MARKER}\n${cardsHtml}\n${END_MARKER}${after}`;

  fs.writeFileSync(INDEX_HTML, html);
  console.log(`✅ Media Centre videos updated with ${videos.length} item(s).`);
}

function main() {
  const videos = readVideos();
  console.log(`Found ${videos.length} video(s) in content/videos/`);
  updateVideosSection(videos);
  console.log('✅ Videos build complete.');
}

main();
