"""
Safe Alt-Text Fix (surgical version)
--------------------------------------
Fixes ONLY the exact <img> tags missing alt text, using regex on the raw
text. Does NOT re-parse or reformat the rest of the file, unlike the
BeautifulSoup approach in fix_site.py -- so nothing else in the file changes.

USAGE:
    cd Desktop\\theharshranjan.github.io
    python fix_alt_text_safe.py
"""

import re
from pathlib import Path

ROOT = Path(".").resolve()

# Only touch these 3 files (the ones flagged by the audit)
TARGET_FILES = ["blog.html", "nutrition.html", "yoga-session.html"]

ALT_TEXT_GUESSES = {
    "photo-1600618528240": "Wellness blog article image",
    "photo-1512621776951": "Nutrition and healthy eating",
    "photo-1597655601841": "Fresh ingredients for a balanced diet",
    "photo-1506126613408": "Yoga session in progress",
    "photo-1593811167562": "Group yoga practice",
    "photo-1515023115689": "Yoga instructor demonstrating a pose",
}

# Matches an <img ...> tag that has NO alt attribute at all
IMG_NO_ALT_PATTERN = re.compile(
    r'<img\b(?![^>]*\balt=)([^>]*?)(/?)>',
    re.IGNORECASE
)
# Matches an <img ...> tag that HAS alt="" (empty)
IMG_EMPTY_ALT_PATTERN = re.compile(
    r'(<img\b[^>]*?\salt=)(["\'])\2([^>]*?/?>)',
    re.IGNORECASE
)


def guess_alt(img_tag_text):
    src_match = re.search(r'src=["\']([^"\']+)["\']', img_tag_text)
    src = src_match.group(1) if src_match else ""
    for key, text in ALT_TEXT_GUESSES.items():
        if key in src:
            return text
    name = Path(src.split("?")[0]).stem.replace("-", " ").replace("_", " ")
    return name.strip().capitalize() or "Image"


def fix_file(path):
    content = path.read_text(encoding="utf-8")
    original = content
    changed_count = 0

    def replace_no_alt(m):
        nonlocal changed_count
        full_tag = m.group(0)
        attrs = m.group(1)
        self_close = m.group(2)
        alt = guess_alt(full_tag)
        changed_count += 1
        return f'<img{attrs} alt="{alt}"{self_close}>'

    content = IMG_NO_ALT_PATTERN.sub(replace_no_alt, content)

    def replace_empty_alt(m):
        nonlocal changed_count
        full_tag = m.group(0)
        alt = guess_alt(full_tag)
        changed_count += 1
        return f'{m.group(1)}"{alt}"{m.group(3)}'

    content = IMG_EMPTY_ALT_PATTERN.sub(replace_empty_alt, content)

    if content != original:
        path.write_text(content, encoding="utf-8")
        print(f"  [FIXED] {path.name} -- {changed_count} image(s) updated")
    else:
        print(f"  [OK] {path.name} -- nothing to fix")


def main():
    print("Applying surgical alt-text fixes (no reformatting)...\n")
    for filename in TARGET_FILES:
        path = ROOT / filename
        if path.exists():
            fix_file(path)
        else:
            print(f"  [SKIP] {filename} not found")
    print("\nDone. Run 'git diff' to confirm only alt= attributes changed.")


if __name__ == "__main__":
    main()
