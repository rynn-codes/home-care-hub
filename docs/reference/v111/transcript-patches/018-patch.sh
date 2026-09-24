cd /home/claude/joy && python3 - <<'EOF'
p='src/components/layout/TagPicker.tsx'
s=open(p).read()
s=s.replace('import { isPreset, orphanTags } from "@/domain/agency/tagPresets";','import { orphanTags } from "@/domain/agency/tagPresets";')
old='''      {/* Keeps the compiler honest that the helper is used for something. */}
      <span className="sr-only">{value.filter((v) => isPreset(presets, v)).length} chosen from the list</span>
'''
assert s.count(old)==1
s=s.replace(old,'')
open(p,'w').write(s)
EOF
grep -n "searchParams\|defaultValue\|useState" src/pages/Settings.tsx | head