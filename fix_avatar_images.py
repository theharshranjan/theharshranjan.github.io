"""
Fix Backwards Avatar Image Loading (index.html)
--------------------------------------------------
On the homepage, small 76x76px circular avatar thumbnails (Dr. Lella
and Dr. Bhuvaneswari) were loading the HEAVY original .png files
(1.5-1.9 MB) for the tiny visible thumbnail, while the lightweight
.webp files (60-210 KB) were reserved only for the zoom/lightbox view
that most visitors never open.

This script swaps them the RIGHT way round:
  - The visible <img src="..."> thumbnail now loads the light .webp
  - The onclick zoom/lightbox now opens the full-quality .png

This should noticeably speed up homepage load for most visitors,
since the heavy files are now only fetched if someone actually
clicks to zoom in.

Only touches index.html. Does not touch about.html (where the same
images are used at full width/340px height for detail -- keeping
.png there is appropriate).

USAGE:
    cd Desktop\\theharshranjan.github.io
    python fix_avatar_images.py
"""

from pathlib import Path

FILE = Path("index.html")

# (thumbnail line to fix, lightbox line to fix) pairs
REPLACEMENTS = [
    (
        '<img src="drleela.png" loading="lazy" alt="Dr. Lella Naga Durga Bhavani, BAMS, Founding Member of Samarpan">',
        '<img src="drleela.webp" loading="lazy" alt="Dr. Lella Naga Durga Bhavani, BAMS, Founding Member of Samarpan">',
    ),
    (
        "onclick=\"openExpertLightbox('drleela.webp','Dr. Lella Naga Durga Bhavani — Founding Member, BAMS Gold Medallist')\"",
        "onclick=\"openExpertLightbox('drleela.png','Dr. Lella Naga Durga Bhavani — Founding Member, BAMS Gold Medallist')\"",
    ),
    (
        '<img src="about3.png" loading="lazy" alt="Dr. Padigireddy Bhuvaneswari, BAMS Ayurvedacharya, Core Member of Samarpan">',
        '<img src="about3.webp" loading="lazy" alt="Dr. Padigireddy Bhuvaneswari, BAMS Ayurvedacharya, Core Member of Samarpan">',
    ),
    (
        "onclick=\"openExpertLightbox('about3.webp','Dr. Padigireddy Bhuvaneswari — Ayurvedic Physician & Core Member')\"",
        "onclick=\"openExpertLightbox('about3.png','Dr. Padigireddy Bhuvaneswari — Ayurvedic Physician & Core Member')\"",
    ),
]

def main():
    if not FILE.exists():
        print("index.html not found in current folder.")
        return

    text = FILE.read_text(encoding="utf-8")
    original = text
    applied = 0

    for old, new in REPLACEMENTS:
        count = text.count(old)
        if count == 1:
            text = text.replace(old, new)
            applied += 1
            print(f"  [OK] swapped: ...{old[-60:]}")
        elif count == 0:
            print(f"  [SKIP] pattern not found (may already be fixed): ...{old[-60:]}")
        else:
            print(f"  [WARN] pattern found {count} times (expected 1), skipping to be safe: ...{old[-60:]}")

    if text != original:
        FILE.write_text(text, encoding="utf-8")
        print(f"\nDone. {applied} replacement(s) applied to index.html.")
        print("Run 'git diff index.html' to review.")
    else:
        print("\nNo changes made.")

if __name__ == "__main__":
    main()
