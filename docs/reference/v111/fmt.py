#!/usr/bin/env python3
"""Light pretty-printer for minified JS: newline + indent on { } ; outside strings/templates."""
import sys
src=open(sys.argv[1]).read()
out=[];depth=0;i=0;n=len(src);stack=[]
def nl(): out.append('\n'+'  '*depth)
while i<n:
    c=src[i]; top=stack[-1] if stack else None
    if top in('"',"'"):
        out.append(c)
        if c=='\\': out.append(src[i+1]); i+=2; continue
        if c==top: stack.pop()
    elif top=='t':
        out.append(c)
        if c=='\\': out.append(src[i+1]); i+=2; continue
        if c=='`': stack.pop()
        elif c=='$' and src[i+1]=='{': out.append('{'); stack.append('b'); i+=1
    elif top=='b' and c=='}':
        stack.pop(); out.append(c)
    else:
        if c in('"',"'"): stack.append(c); out.append(c)
        elif c=='`': stack.append('t'); out.append(c)
        elif c=='{':
            depth+=1; out.append(c); nl()
        elif c=='}':
            depth=max(0,depth-1); nl(); out.append(c)
        elif c==';':
            out.append(c); nl()
        else: out.append(c)
    i+=1
open(sys.argv[2],'w').write(''.join(out))
