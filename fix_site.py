"""
SAMARPAN Website Fix Script
-----------------------------
Fixes everything flagged by audit_site.py:
  1. Subfolder navigation links (media/, retreats/, templates/) pointing to
     root pages without the correct path -> fixed to /page.html
  2. Creates a real manifest.json (PWA support)
  3. Fixes /site.webmanifest reference -> points to manifest.json
  4. Fixes form.html link in trips.html -> booking.html
  5. Creates "Coming Soon" placeholder pages for missing content pages
  6. Adds alt text to images missing it
  7. Adds missing public pages to sitemap.xml
  8. Compresses oversized images IN PLACE (same filename, smaller size,
     no HTML changes needed -- safest option)

SAFETY: This folder is a git repo. After running, use:
    git diff          -> review every change before committing
    git checkout .     -> undo everything if something looks wrong

USAGE:
    cd Desktop\\theharshranjan.github.io
    python fix_site.py

Requires: beautifulsoup4, Pillow
Install with:
    pip install beautifulsoup4 Pillow
"""

import os
import re
import sys
from pathlib import Path

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing dependency. Run: pip install beautifulsoup4 Pillow")
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("Missing dependency. Run: pip install Pillow")
    sys.exit(1)

ROOT = Path(".").resolve()
LARGE_IMAGE_THRESHOLD_MB = 1.0
MAX_IMAGE_DIMENSION = 1920  # px, longest side
JPEG_QUALITY = 78
WEBP_QUALITY = 78
PNG_OPTIMIZE = True

BRAND_ORANGE = "#D95D39"
BRAND_CREAM = "#FDFBF7"

SUBFOLDER_LINK_FIX_FOLDERS = {"media", "retreats", "templates"}
SUBFOLDER_LINK_TARGETS = {
    "about.html", "journal.html", "sessions.html", "ayurveda.html",
    "community.html", "index.html", "booking.html",
    "privacy-policy.html", "terms-of-service.html",
}

COMING_SOON_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{title} | SAMARPAN - Holistic Wellness</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {{
    font-family: Georgia, 'Times New Roman', serif;
    background: {cream};
    color: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
    text-align: center;
    padding: 2rem;
  }}
  .box {{ max-width: 480px; }}
  h1 {{ color: {orange}; font-size: 1.8rem; margin-bottom: 0.5rem; }}
  p {{ font-size: 1.05rem; line-height: 1.6; }}
  a {{ color: {orange}; text-decoration: none; font-weight: bold; }}
  a:hover {{ text-decoration: underline; }}
</style>
</head>
<body>
  <div class="box">
    <h1>{title}</h1>
    <p>This piece is currently being written. Please check back soon.</p>
    <p><a href="/journal.html">&larr; Back to the Journal</a></p>
  </div>
</body>
</html>
"""

# path (relative to root) -> display title
PLACEHOLDER_PAGES = {
    "advaita-self-vedanta-neuroscience.html": "Advaita, the Self, and Vedanta Neuroscience",
    "journal/issues/womens-health-reconsidered.html": "Women's Health, Reconsidered",
    "journal/issues/nervous-system-issue.html": "The Nervous System Issue",
    "journal/issues/foundations-of-agni.html": "Foundations of Agni",
}

MANIFEST_JSON = """{
  "name": "SAMARPAN - Holistic Wellness",
  "short_name": "SAMARPAN",
  "description": "Healing Individuals. Strengthening Communities. Advancing Holistic Health.",
  "start_url": "/index.html",
  "display": "standalone",
  "background_color": "#FDFBF7",
  "theme_color": "#D95D39",
  "icons": [
    { "src": "/favicon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/favicon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
"""

# ALT text guesses based on filename/context -- review and adjust as needed
ALT_TEXT_GUESSES = {
    "photo-1600618528240": "Wellness blog article image",
    "photo-1512621776951": "Nutrition and healthy eating",
    "photo-1597655601841": "Fresh ingredients for a balanced diet",
    "photo-1506126613408": "Yoga session in progress",
    "photo-1593811167562": "Group yoga practice",
    "photo-1515023115689": "Yoga instructor demonstrating a pose",
}


def find_html_files(root):
    html_files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules", "__pycache__"}]
        for f in filenames:
            if f.endswith(".html"):
                html_files.append(Path(dirpath) / f)
    return html_files


def fix_subfolder_links():
    print("\n=== FIXING SUBFOLDER NAVIGATION LINKS ===")
    fixed_count = 0
    for folder in SUBFOLDER_LINK_FIX_FOLDERS:
        folder_path = ROOT / folder
        if not folder_path.exists():
            continue
        for html_file in folder_path.rglob("*.html"):
            try:
                content = html_file.read_text(encoding="utf-8")
            except Exception as e:
                print(f"  [SKIP] {html_file}: {e}")
                continue
            original = content
            for target in SUBFOLDER_LINK_TARGETS:
                pattern = re.compile(
                    r'href=(["\'])(?!/|\.\./|https?://)' + re.escape(target)
                )
                content = pattern.sub(r'href=\1/' + target, content)
            if content != original:
                html_file.write_text(content, encoding="utf-8")
                print(f"  [FIXED] {html_file.relative_to(ROOT)}")
                fixed_count += 1
    print(f"  Files updated: {fixed_count}")


def create_manifest():
    print("\n=== CREATING manifest.json ===")
    manifest_path = ROOT / "manifest.json"
    if manifest_path.exists():
        print("  manifest.json already exists -- skipping.")
        return
    manifest_path.write_text(MANIFEST_JSON, encoding="utf-8")
    print("  Created manifest.json")


def fix_webmanifest_reference():
    print("\n=== FIXING /site.webmanifest REFERENCE ===")
    trips_path = ROOT / "trips.html"
    if not trips_path.exists():
        print("  trips.html not found -- skipping.")
        return
    content = trips_path.read_text(encoding="utf-8")
    new_content = content.replace('href="/site.webmanifest"', 'href="/manifest.json"')
    if new_content != content:
        trips_path.write_text(new_content, encoding="utf-8")
        print("  Fixed in trips.html")
    else:
        print("  No matching reference found -- skipping.")


def fix_form_link():
    print("\n=== FIXING form.html LINK ===")
    trips_path = ROOT / "trips.html"
    if not trips_path.exists():
        print("  trips.html not found -- skipping.")
        return
    content = trips_path.read_text(encoding="utf-8")
    new_content = re.sub(r'href=(["\'])form\.html\1', r'href=\1/booking.html\1', content)
    if new_content != content:
        trips_path.write_text(new_content, encoding="utf-8")
        print("  Fixed in trips.html -> now points to booking.html")
    else:
        print("  No matching reference found -- skipping.")


def create_placeholder_pages():
    print("\n=== CREATING PLACEHOLDER PAGES ===")
    for rel_path, title in PLACEHOLDER_PAGES.items():
        full_path = ROOT / rel_path
        if full_path.exists():
            print(f"  {rel_path} already exists -- skipping.")
            continue
        full_path.parent.mkdir(parents=True, exist_ok=True)
        html = COMING_SOON_TEMPLATE.format(title=title, cream=BRAND_CREAM, orange=BRAND_ORANGE)
        full_path.write_text(html, encoding="utf-8")
        print(f"  Created {rel_path}")


def add_alt_text():
    print("\n=== ADDING ALT TEXT TO IMAGES ===")
    html_files = find_html_files(ROOT)
    fixed = 0
    for html_file in html_files:
        try:
            content = html_file.read_text(encoding="utf-8")
        except Exception:
            continue
        soup = BeautifulSoup(content, "html.parser")
        changed = False
        for img in soup.find_all("img"):
            alt = img.get("alt")
            src = img.get("src", "")
            if alt is None or alt.strip() == "":
                guess = None
                for key, text in ALT_TEXT_GUESSES.items():
                    if key in src:
                        guess = text
                        break
                if guess is None:
                    name = Path(src.split("?")[0]).stem.replace("-", " ").replace("_", " ")
                    guess = name.strip().capitalize() or "Image"
                img["alt"] = guess
                changed = True
        if changed:
            html_file.write_text(str(soup), encoding="utf-8")
            print(f"  [UPDATED] {html_file.relative_to(ROOT)}")
            fixed += 1
    print(f"  Files updated: {fixed}")
    print("  NOTE: alt text is a best-effort guess -- review and refine manually where it matters most.")


def update_sitemap():
    print("\n=== UPDATING sitemap.xml ===")
    sitemap_path = ROOT / "sitemap.xml"
    if not sitemap_path.exists():
        print("  sitemap.xml not found -- skipping.")
        return

    EXCLUDE_KEYWORDS = ["admin", "assign-task", "task-checkin", "weekly-report",
                        "client-admin", "clientadmi", "intern-portal", "register.html",
                        "update.html"]

    content = sitemap_path.read_text(encoding="utf-8")
    existing_locs = set(re.findall(r"<loc>(.*?)</loc>", content))

    base_url = None
    if existing_locs:
        sample = next(iter(existing_locs))
        m = re.match(r"(https?://[^/]+)/", sample)
        if m:
            base_url = m.group(1)
    if not base_url:
        base_url = "https://thesamarpan.co.in"

    html_files = find_html_files(ROOT)
    existing_names = {loc.rstrip("/").split("/")[-1] for loc in existing_locs}

    new_entries = []
    for html_file in html_files:
        rel = str(html_file.relative_to(ROOT)).replace("\\", "/")
        name = html_file.name
        if any(kw in rel.lower() for kw in EXCLUDE_KEYWORDS):
            continue
        if name in ("404.html",):
            continue
        if name in existing_names:
            continue
        new_entries.append(rel)

    if not new_entries:
        print("  Nothing to add.")
        return

    insert_block = ""
    for rel in new_entries:
        url = f"{base_url}/{rel}"
        insert_block += f"  <url>\n    <loc>{url}</loc>\n  </url>\n"

    if "</urlset>" in content:
        new_content = content.replace("</urlset>", insert_block + "</urlset>")
        sitemap_path.write_text(new_content, encoding="utf-8")
        print(f"  Added {len(new_entries)} pages to sitemap.xml")
        for r in new_entries:
            print(f"    + {r}")
    else:
        print("  Could not find </urlset> tag -- please add manually.")


def compress_images():
    print(f"\n=== COMPRESSING IMAGES OVER {LARGE_IMAGE_THRESHOLD_MB} MB (in place) ===")
    threshold_bytes = LARGE_IMAGE_THRESHOLD_MB * 1024 * 1024
    img_extensions = {".png", ".jpg", ".jpeg", ".webp"}
    total_saved = 0
    count = 0

    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules", "__pycache__"}]
        for f in filenames:
            ext = Path(f).suffix.lower()
            if ext not in img_extensions:
                continue
            full_path = Path(dirpath) / f
            try:
                size_before = full_path.stat().st_size
            except Exception:
                continue
            if size_before <= threshold_bytes:
                continue

            try:
                img = Image.open(full_path)

                if max(img.size) > MAX_IMAGE_DIMENSION:
                    ratio = MAX_IMAGE_DIMENSION / max(img.size)
                    new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                    img = img.resize(new_size, Image.LANCZOS)

                if ext in (".jpg", ".jpeg"):
                    if img.mode in ("RGBA", "P"):
                        img = img.convert("RGB")
                    img.save(full_path, "JPEG", quality=JPEG_QUALITY, optimize=True)
                elif ext == ".png":
                    img.save(full_path, "PNG", optimize=PNG_OPTIMIZE)
                elif ext == ".webp":
                    img.save(full_path, "WEBP", quality=WEBP_QUALITY)

                size_after = full_path.stat().st_size
                saved = size_before - size_after
                total_saved += max(saved, 0)
                count += 1
                print(f"  [COMPRESSED] {full_path.relative_to(ROOT)}: "
                      f"{size_before/1024/1024:.2f} MB -> {size_after/1024/1024:.2f} MB")
            except Exception as e:
                print(f"  [SKIP] {full_path.relative_to(ROOT)}: {e}")

    print(f"\n  Images processed: {count}")
    print(f"  Total space saved: {total_saved/1024/1024:.2f} MB")


def main():
    print(f"Fixing site at: {ROOT}")
    print("Remember: this is a git repo. Run 'git diff' after to review changes,")
    print("or 'git checkout .' to undo everything if needed.\n")

    fix_subfolder_links()
    create_manifest()
    fix_webmanifest_reference()
    fix_form_link()
    create_placeholder_pages()
    add_alt_text()
    update_sitemap()
    compress_images()

    print("\n" + "=" * 50)
    print("ALL FIXES COMPLETE")
    print("Next steps:")
    print("  git status   -> see everything that changed")
    print("  git diff     -> review changes in detail")
    print("  git add .")
    print("  git commit -m \"Fix broken links, add alt text, compress images, update sitemap\"")
    print("  git push")
    print("=" * 50)


if __name__ == "__main__":
    main()
