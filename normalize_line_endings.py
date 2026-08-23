"""
Normalizes every line ending in index.html to Windows-style CRLF, so the
whole file is consistent (fixes the ^M markers git diff was showing on
the 5 lines the previous script touched). Purely a line-ending cleanup —
does not change any actual content, tags, or text.
"""
FILE = "index.html"

with open(FILE, "rb") as f:
    raw = f.read()

# Normalize everything to \n first (handles \r\n, \r, or \n uniformly),
# then convert every \n to \r\n — guarantees one consistent style throughout.
normalized = raw.replace(b"\r\n", b"\n").replace(b"\r", b"\n").replace(b"\n", b"\r\n")

if normalized == raw:
    print("No change needed — line endings were already consistent.")
else:
    with open(FILE, "wb") as f:
        f.write(normalized)
    print("Done. All line endings in index.html normalized to CRLF.")

print("Run 'git diff index.html' — it should now show 0 changes (or only whitespace-only, harmless).")
