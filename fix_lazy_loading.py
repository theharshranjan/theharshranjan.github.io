"""
Adds loading="lazy" to 5 below-the-fold images in index.html that are
missing it (every other image on the page already has it). Purely
additive — inserts one attribute into each <img> tag, changes nothing
else. Run from the same folder as index.html.
"""
import re

FILE = "index.html"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    ('<img src="1 Ancient Wisdom.webp" alt="Ancient Wisdom">',
     '<img src="1 Ancient Wisdom.webp" loading="lazy" alt="Ancient Wisdom">'),
    ('<img src="2 modern research laboratory.webp" alt="Modern Evidence">',
     '<img src="2 modern research laboratory.webp" loading="lazy" alt="Modern Evidence">'),
    ('<img src="lifestyle.webp" alt="Lifestyle Medicine">',
     '<img src="lifestyle.webp" loading="lazy" alt="Lifestyle Medicine">'),
    ('<img src="health-camp.webp" alt="Community Wellness">',
     '<img src="health-camp.webp" loading="lazy" alt="Community Wellness">'),
    ('<img src="g1.webp" alt="Samarpan" style="width:100%;height:100%;object-fit:cover;">',
     '<img src="g1.webp" loading="lazy" alt="Samarpan" style="width:100%;height:100%;object-fit:cover;">'),
]

applied = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        applied += 1
        print(f"  [OK] added loading=lazy: ...{old[:50]}...")
    else:
        print(f"  [SKIP] pattern not found (may already be fixed): ...{old[:50]}...")

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\nDone. {applied} replacement(s) applied to {FILE}.")
print("Run 'git diff index.html' to review.")
