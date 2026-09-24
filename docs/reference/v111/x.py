#!/usr/bin/env python3
"""Print the minified V111 bundle around a string: x.py "needle" [before] [after] [nth]."""
import sys
js = open('/home/claude/home-care-hub/docs/reference/v111/bundle.js').read()
needle = sys.argv[1]
before = int(sys.argv[2]) if len(sys.argv) > 2 else 400
after = int(sys.argv[3]) if len(sys.argv) > 3 else 1200
nth = int(sys.argv[4]) if len(sys.argv) > 4 else 0
i = -1
for _ in range(nth + 1):
    i = js.find(needle, i + 1)
    if i < 0:
        print("NOT FOUND"); sys.exit(1)
print(f"@{i} of {js.count(needle)} occurrences")
print(js[max(0, i - before): i + after])
