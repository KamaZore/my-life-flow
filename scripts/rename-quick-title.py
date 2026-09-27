# -*- coding: utf-8 -*-
"""Rename the KM 'quick.title' savings-box key to quick.moneyTitle."""
import io

PATH = "src/lib/i18n.tsx"

with io.open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

OLD = '"quick.title": "\u1794\u17d2\u179a\u17b6\u1780\u17cb\u1785\u17bc\u179b/\u1785\u17c1\u1789\u179a\u17a0\u17b6\u179f"'
if OLD not in src:
    print("KM quick.title savings key not found")
    raise SystemExit(1)
if src.count(OLD) != 1:
    print("expected exactly 1 occurrence, got", src.count(OLD))
    raise SystemExit(1)

src = src.replace(OLD, '"quick.moneyTitle"' + OLD[len('"quick.title"'):], 1)

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

print("renamed OK")
