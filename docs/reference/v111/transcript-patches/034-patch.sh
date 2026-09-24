cd /root/.claude/projects/-home-claude && python3 - <<'EOF'
# Recover every file-writing tool call from this session's transcript: Write tool contents,
# and the python heredoc patches inside Bash commands, in order, with timestamps.
import json, os
out='/home/claude/home-care-hub/docs/reference/v111/transcript-patches'
os.makedirs(out, exist_ok=True)
i=0
with open('d2433efc-dba1-5080-a930-43a82e41e69f.jsonl') as f:
    for line in f:
        try: d=json.loads(line)
        except: continue
        m=d.get('message',{})
        c=m.get('content') if isinstance(m,dict) else None
        if not isinstance(c,list): continue
        for b in c:
            if b.get('type')!='tool_use': continue
            inp=b.get('input',{}); name=b['name']
            if name=='Write' and inp.get('file_path','').startswith('/home/claude/joy/src'):
                i+=1
                p=inp['file_path'].replace('/home/claude/joy/','')
                fn=f"{i:03d}-write-{p.replace('/','__')}"
                open(os.path.join(out,fn),'w').write(inp['content'])
            elif name=='Bash' and 'python3 - <<' in inp.get('command','') and "open(p,'w')" in inp.get('command','') or (name=='Bash' and 'patch(' in inp.get('command','')):
                i+=1
                fn=f"{i:03d}-patch.sh"
                open(os.path.join(out,fn),'w').write(inp['command'])
print(i, "recovered")
print(sorted(os.listdir(out)))
EOF