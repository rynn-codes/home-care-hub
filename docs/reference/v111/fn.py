#!/usr/bin/env python3
"""Extract the enclosing top-level `function NAME(...){...}` from the minified V111 bundle.

fn.py "needle" [nth] [--to FILE]
"""
import sys, re
js = open('/home/claude/home-care-hub/docs/reference/v111/bundle.js').read()
args = [a for a in sys.argv[1:] if not a.startswith('--')]
needle = args[0]
nth = int(args[1]) if len(args) > 1 else 0
out = None
if '--to' in sys.argv:
    out = sys.argv[sys.argv.index('--to') + 1]
i = -1
for _ in range(nth + 1):
    i = js.find(needle, i + 1)
    if i < 0:
        print("NOT FOUND"); sys.exit(1)

def balanced_end(start):
    """Index just past the brace that closes js[start] == '{', honouring strings, templates and regex-free code."""
    stack = []  # entries: 'b' brace, or a quote char for a string, 't' template
    j = start
    n = len(js)
    while j < n:
        c = js[j]
        top = stack[-1] if stack else None
        if top in ('"', "'"):
            if c == '\\': j += 2; continue
            if c == top: stack.pop()
        elif top == 't':
            if c == '\\': j += 2; continue
            if c == '`': stack.pop()
            elif c == '$' and j + 1 < n and js[j + 1] == '{':
                stack.append('b'); j += 1
        else:
            if c in ('"', "'"): stack.append(c)
            elif c == '`': stack.append('t')
            elif c == '{': stack.append('b')
            elif c == '}':
                if top == 'b': stack.pop()
                if not stack: return j + 1
        j += 1
    return n

best = None
lo = max(0, i - 150000)
for m in re.finditer(r'(?<![A-Za-z0-9_$.])function [A-Za-z0-9_$]*\([^)]*\)\{', js[lo:i + 1]):
    start = lo + m.start()
    brace = js.find('{', start + 9 + len(m.group(0)) - len(m.group(0)))  # first '{' after 'function'
    brace = start + m.group(0).rfind('{')
    end = balanced_end(brace)
    if end > i and (best is None or (end - start) < (best[1] - best[0])):
        best = (start, end)
if best:
    text = js[best[0]:best[1]]
    header = f"@{best[0]}..{best[1]} ({best[1]-best[0]} chars)"
else:
    text = js[max(0, i - 2000): i + 4000]
    header = "no enclosing function; window"
if out:
    open(out, 'w').write(text)
    print(header, "->", out)
else:
    print(header)
    print(text)
