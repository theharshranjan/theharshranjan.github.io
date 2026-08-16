"""
SAMARPAN Website Audit Script
------------------------------
Run this from inside your website folder to check for common issues:
- Broken internal links (pages that don't exist)
- Broken external links (dead outbound URLs) -- optional, slower
- Images missing alt text
- Oversized images that may slow page loads
- Pages missing from sitemap.xml

USAGE:
    cd Desktop\\theharshranjan.github.io
    python audit_site.py

Requires: beautifulsoup4, requests
Install with:
    pip install beautifulsoup4 requests
"""

import os
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing dependency. Run: pip install beautifulsoup4 requests")
    sys.exit(1)

SITE_ROOT = Path(".").resolve()
CHECK_EXTERNAL_LINKS = False  # set True to also check external URLs (slower, needs internet)
LARGE_IMAGE_THRESHOLD_MB = 1.0  # flag images bigger than this

IMG_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
SKIP_DIRS = {".git", "node_modules", "__pycache__"}


def find_html_files(root):
    html_files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for f in filenames:
            if f.endswith(".html"):
                html_files.append(Path(dirpath) / f)
    return html_files


def check_broken_internal_links(html_files, root):
    print("\n=== CHECKING INTERNAL LINKS ===")
    issues = 0
    all_paths = {str(p.relative_to(root)).replace("\\", "/") for p in html_files}
    # also allow any file (images, etc.) as valid link targets
    all_files = set()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for f in filenames:
            rel = str((Path(dirpath) / f).relative_to(root)).replace("\\", "/")
            all_files.add(rel)

    for html_file in html_files:
        try:
            content = html_file.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            print(f"  [SKIP] Could not read {html_file}: {e}")
            continue

        soup = BeautifulSoup(content, "html.parser")
        for tag in soup.find_all(["a", "link"]):
            href = tag.get("href")
            if not href:
                continue
            if href.startswith(("http://", "https://", "mailto:", "tel:", "#", "javascript:", "data:")):
                continue
            clean_href = href.split("#")[0].split("?")[0]
            if not clean_href:
                continue
            if clean_href.startswith("/"):
                # absolute path -- resolve from site root
                target = (root / clean_href.lstrip("/")).resolve()
            else:
                # relative path -- resolve from the current file's folder
                target = (html_file.parent / clean_href).resolve()
            try:
                rel_target = str(target.relative_to(root)).replace("\\", "/")
            except ValueError:
                continue  # points outside site root
            if rel_target not in all_files and (rel_target + "/index.html") not in all_files:
                print(f"  [BROKEN] {html_file.relative_to(root)} -> {href}")
                issues += 1

    if issues == 0:
        print("  No broken internal links found.")
    else:
        print(f"  Total broken internal links: {issues}")
    return issues


def check_missing_alt_text(html_files, root):
    print("\n=== CHECKING IMAGE ALT TEXT ===")
    issues = 0
    for html_file in html_files:
        try:
            content = html_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        soup = BeautifulSoup(content, "html.parser")
        for img in soup.find_all("img"):
            alt = img.get("alt")
            src = img.get("src", "unknown")
            if alt is None or alt.strip() == "":
                print(f"  [MISSING ALT] {html_file.relative_to(root)} -> {src}")
                issues += 1
    if issues == 0:
        print("  All images have alt text.")
    else:
        print(f"  Total images missing alt text: {issues}")
    return issues


def check_oversized_images(root):
    print(f"\n=== CHECKING FOR IMAGES OVER {LARGE_IMAGE_THRESHOLD_MB} MB ===")
    issues = 0
    threshold_bytes = LARGE_IMAGE_THRESHOLD_MB * 1024 * 1024
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for f in filenames:
            ext = Path(f).suffix.lower()
            if ext in IMG_EXTENSIONS:
                full_path = Path(dirpath) / f
                size = full_path.stat().st_size
                if size > threshold_bytes:
                    rel = full_path.relative_to(root)
                    print(f"  [LARGE] {rel} -> {size / (1024*1024):.2f} MB")
                    issues += 1
    if issues == 0:
        print("  No oversized images found.")
    else:
        print(f"  Total large images: {issues}")
        print("  Tip: convert large .png/.jpg files to .webp to cut size significantly.")
    return issues


def check_sitemap_coverage(html_files, root):
    print("\n=== CHECKING SITEMAP COVERAGE ===")
    sitemap_path = root / "sitemap.xml"
    if not sitemap_path.exists():
        print("  No sitemap.xml found.")
        return 1

    sitemap_content = sitemap_path.read_text(encoding="utf-8", errors="ignore")
    urls_in_sitemap = set(re.findall(r"<loc>(.*?)</loc>", sitemap_content))
    sitemap_pages = {urlparse(u).path.strip("/").split("/")[-1] for u in urls_in_sitemap}

    missing = []
    for html_file in html_files:
        name = html_file.name
        if name in ("404.html",) or "admin" in str(html_file):
            continue
        if name not in sitemap_pages and name.replace("index.html", "") not in sitemap_pages:
            missing.append(html_file.relative_to(root))

    if missing:
        print(f"  Pages not found in sitemap.xml ({len(missing)}):")
        for m in missing[:30]:
            print(f"    - {m}")
        if len(missing) > 30:
            print(f"    ...and {len(missing) - 30} more")
    else:
        print("  All pages appear to be covered in sitemap.xml.")
    return len(missing)


def check_external_links(html_files, root):
    if not CHECK_EXTERNAL_LINKS:
        return 0
    import requests
    print("\n=== CHECKING EXTERNAL LINKS (this may take a while) ===")
    checked = set()
    issues = 0
    for html_file in html_files:
        try:
            content = html_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        soup = BeautifulSoup(content, "html.parser")
        for tag in soup.find_all("a", href=True):
            href = tag["href"]
            if not href.startswith(("http://", "https://")):
                continue
            if href in checked:
                continue
            checked.add(href)
            try:
                resp = requests.head(href, timeout=5, allow_redirects=True)
                if resp.status_code >= 400:
                    print(f"  [DEAD {resp.status_code}] {href} (found in {html_file.relative_to(root)})")
                    issues += 1
            except Exception as e:
                print(f"  [ERROR] {href} -> {e}")
                issues += 1
    if issues == 0:
        print("  All external links responded OK.")
    return issues


def main():
    print(f"Auditing site at: {SITE_ROOT}")
    html_files = find_html_files(SITE_ROOT)
    print(f"Found {len(html_files)} HTML files.")

    total_issues = 0
    total_issues += check_broken_internal_links(html_files, SITE_ROOT)
    total_issues += check_missing_alt_text(html_files, SITE_ROOT)
    total_issues += check_oversized_images(SITE_ROOT)
    total_issues += check_sitemap_coverage(html_files, SITE_ROOT)
    total_issues += check_external_links(html_files, SITE_ROOT)

    print("\n" + "=" * 50)
    print(f"AUDIT COMPLETE -- {total_issues} total issues flagged")
    print("=" * 50)


if __name__ == "__main__":
    main()
