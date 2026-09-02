/**
 * indexnow-ping.js
 *
 * Submits every URL in sitemap.xml to IndexNow, which pushes them to Bing,
 * Yandex, Naver, and DuckDuckGo (via Bing's index). This does NOT reach
 * Google - Google has never adopted IndexNow. For Google, sitemap.xml plus
 * Search Console remains the only supported path.
 *
 * Because this reads straight from sitemap.xml, run build-sitemap.js first
 * (or as part of the same commit) so the exclusion list stays in sync -
 * nothing gets submitted here that isn't also meant to be indexed.
 *
 * One-time setup (already done for you):
 *   - A key file <KEY>.txt has been generated and must sit at the repo
 *     root, publicly reachable at https://thesamarpan.co.in/<KEY>.txt
 *   - Its content must be exactly the key string, nothing else
 *
 * Usage (from the repo root, after build-sitemap.js):
 *   node scripts/indexnow-ping.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITE_URL = 'https://thesamarpan.co.in';
const HOST = 'thesamarpan.co.in';

// Must match the key file's name (without .txt) and its content.
const INDEXNOW_KEY = '22992c89ee560f794ffc563da0c1ab55';
const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

function getUrlsFromSitemap() {
  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)];
  return matches.map(m => m[1]);
}

function submit(urlList) {
  const payload = JSON.stringify({
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  });

  const options = {
    hostname: 'api.indexnow.org',
    path: '/indexnow',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(SITEMAP_PATH)) {
    console.error('sitemap.xml not found - run node scripts/build-sitemap.js first.');
    process.exit(1);
  }

  const urls = getUrlsFromSitemap();
  console.log(`Submitting ${urls.length} URLs to IndexNow (Bing, Yandex, Naver, DuckDuckGo)...`);

  const result = await submit(urls);
  console.log(`Response: ${result.status}`);
  // 200 = accepted, 202 = accepted (key not yet verified but queued),
  // 400 = bad request, 403 = key not found/invalid, 422 = URLs don't belong to host
  if (result.status === 200 || result.status === 202) {
    console.log('Success. Bing/Yandex/Naver will re-crawl these URLs shortly.');
  } else {
    console.log('Response body:', result.body || '(empty)');
    console.log('Check that the key file is live at:', KEY_LOCATION);
  }
}

main();
