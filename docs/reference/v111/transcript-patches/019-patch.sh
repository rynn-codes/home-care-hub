cd /home/claude/joy && python3 - <<'EOF'
def patch(p, pairs):
    s=open(p).read()
    for old,new in pairs:
        assert s.count(old)==1,(p,old[:60],s.count(old))
        s=s.replace(old,new)
    open(p,'w').write(s)

patch('src/domain/agency/settings.ts', [
('''  profileUndoHours: number;
  /**
   * Who sees gross and net profit on the scheduling screens.''','''  profileUndoHours: number;
  /**
   * The tags each form offers. Karynn, 29 September: pre-populated in
   * settings "so that there aren't a thousand random tags." See
   * domain/agency/tagPresets.
   */
  tagPresets: Record<TagArea, string[]>;
  /**
   * Who sees gross and net profit on the scheduling screens.'''),
('''  profileUndoHours: DEFAULT_PROFILE_UNDO_HOURS,
  profitVisibleTo:''','''  profileUndoHours: DEFAULT_PROFILE_UNDO_HOURS,
  tagPresets: { employees: [...DEFAULT_TAG_PRESETS.employees], documents: [...DEFAULT_TAG_PRESETS.documents] },
  profitVisibleTo:'''),
])
s=open('src/domain/agency/settings.ts').read()
# add import at top
first_import_end = s.index('\n', s.index('import '))
s = s.replace('import ', 'import { DEFAULT_TAG_PRESETS, type TagArea } from "@/domain/agency/tagPresets";\nimport ', 1)
open('src/domain/agency/settings.ts','w').write(s)

patch('src/lib/agencyStore.ts', [
('''      profitVisibleTo: Array.isArray(parsed.profitVisibleTo)''','''      tagPresets: {
        employees: Array.isArray(parsed.tagPresets?.employees)
          ? parsed.tagPresets.employees
          : [...DEFAULT_AGENCY.tagPresets.employees],
        documents: Array.isArray(parsed.tagPresets?.documents)
          ? parsed.tagPresets.documents
          : [...DEFAULT_AGENCY.tagPresets.documents],
      },
      profitVisibleTo: Array.isArray(parsed.profitVisibleTo)'''),
('''export function setNotification<''','''export function setTagPresets(area: TagArea, list: string[]): void {
  commit({ ...current, tagPresets: { ...current.tagPresets, [area]: list } });
}

export function setNotification<'''),
('''import {
  AGENCY_SWITCHES,
  DEFAULT_AGENCY,
  type AgencyProfile,
  type AgencySettings,
} from "@/domain/agency/settings";''','''import {
  AGENCY_SWITCHES,
  DEFAULT_AGENCY,
  type AgencyProfile,
  type AgencySettings,
} from "@/domain/agency/settings";
import type { TagArea } from "@/domain/agency/tagPresets";'''),
])

# AgencyTab: a Tags section after Calendar and care plan
patch('src/components/settings/AgencyTab.tsx', [
('''import {
  setAgencyField,
  setAgencyProfileField,
  setAgencySwitch,
  setNotification,
  useAgencySettings,
} from "@/lib/agencyStore";''','''import {
  setAgencyField,
  setAgencyProfileField,
  setAgencySwitch,
  setNotification,
  setTagPresets,
  useAgencySettings,
} from "@/lib/agencyStore";
import { TAG_AREAS, TAG_AREA_HINTS, TAG_AREA_LABELS, addPreset, removePreset } from "@/domain/agency/tagPresets";
import { useState } from "react";
import { X } from "lucide-react";'''),
('''export function AgencyTab() {
  const agency = useAgencySettings();
''','''export function AgencyTab() {
  const agency = useAgencySettings();
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});
'''),
('''      {/* ------------------------------------------------ clocking in early -- */}''','''      {/* ------------------------------------------------------------ tags -- */}
      {/*
        Karynn, 29 September: "Under tags for employees, can we have some
        auto-populated tags? Maybe set that up in settings or something? Bc
        anybody can put tags up and if they havent been used previously, tags
        would be useless." The forms offer these and nothing else; this is the
        one place the lists change. See domain/agency/tagPresets.
      */}
      <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-6">
        <h2 className="m-0 text-[15px] font-semibold tracking-[-.01em]">Tags</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          The tags people can pick from. Forms offer these lists and nothing else, so a search for
          &ldquo;Weekends&rdquo; finds everybody who works weekends rather than the ones who spelt it the same way.
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {TAG_AREAS.map((area) => {
            const list = agency.tagPresets[area];
            const draft = tagDraft[area] ?? "";
            const add = () => {
              setTagPresets(area, addPreset(list, draft));
              setTagDraft((d) => ({ ...d, [area]: "" }));
            };
            return (
              <div key={area} className="flex flex-col gap-2">
                <Label htmlFor={`agency-tag-${area}`} className="text-[12.5px]">
                  {TAG_AREA_LABELS[area]}
                </Label>
                <p className="m-0 text-[12px] leading-[1.5] text-muted-foreground">{TAG_AREA_HINTS[area]}</p>
                <div className="flex flex-wrap gap-1.5">
                  {list.length === 0 && <span className="text-[12.5px] text-muted-foreground">None yet.</span>}
                  {list.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--paper)] px-2.5 py-[3px] text-[12px]"
                    >
                      {t}
                      <button
                        type="button"
                        aria-label={`Remove ${t} from ${TAG_AREA_LABELS[area].toLowerCase()}`}
                        onClick={() => setTagPresets(area, removePreset(list, t))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    id={`agency-tag-${area}`}
                    value={draft}
                    onChange={(e) => setTagDraft((d) => ({ ...d, [area]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        add();
                      }
                    }}
                    placeholder={area === "employees" ? "Add a tag — e.g. Overnights" : "Add a tag — e.g. survey 2027"}
                    className="h-9 min-w-0 flex-1 rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={add}
                    className="h-9 flex-none rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] font-medium text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)]"
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] leading-[1.5] text-muted-foreground">
          Taking a tag off the list does not strip it from records that already carry it — they show it as
          &ldquo;no longer on the list&rdquo; until somebody removes it there.
        </p>
      </section>

      {/* ------------------------------------------------ clocking in early -- */}'''),
])

# EmployeeForm: TagPicker instead of free text
patch('src/components/employees/EmployeeForm.tsx', [
('''import { changedFieldLabels } from "@/domain/records/profileChanges";''','''import { changedFieldLabels } from "@/domain/records/profileChanges";
import { TagPicker } from "@/components/layout/TagPicker";
import { useAgencySettings } from "@/lib/agencyStore";'''),
('''  const [tagDraft, setTagDraft] = useState("");
  const [languageDraft, setLanguageDraft] = useState("");''','''  const [languageDraft, setLanguageDraft] = useState("");
  const { tagPresets } = useAgencySettings();'''),
('''    setShowSsn(false);
    setTagDraft("");
    setLanguageDraft("");''','''    setShowSsn(false);
    setLanguageDraft("");'''),
('''  const addTag = () => {
    const t = tagDraft.trim();
    if (t && !p.tags.includes(t)) set("tags", [...p.tags, t]);
    setTagDraft("");
  };

''',''''''),
('''            <Field label="Tags" htmlFor="emp-tags">
              <div className="flex items-center gap-1.5">
                <Input
                  id="emp-tags"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Weekends only, nights…"
                  className="min-w-0 flex-1"
                />
                <Button type="button" variant="outline" onClick={addTag} className="h-10 flex-none">Add</Button>
              </div>
              {p.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {p.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-2.5 py-[3px] text-[12px]">
                      {t}
                      <button type="button" aria-label={`Remove ${t}`} onClick={() => set("tags", p.tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Field>''','''            {/* Karynn, 29 September: tags are picked from the list in Settings, not typed. */}
            <Field label="Tags">
              <TagPicker presets={tagPresets.employees} value={p.tags} onChange={(tags) => set("tags", tags)} />
            </Field>'''),
])

# Documents: AddFilesDialog and EditDocumentDialog pick from presets
patch('src/components/documents/AddFilesDialog.tsx', [
('''import {
  displayName,
  normalizeTag,
  whyNotUpload,
  type DocumentFolder,
} from "@/domain/documents/library";''','''import {
  displayName,
  whyNotUpload,
  type DocumentFolder,
} from "@/domain/documents/library";
import { TagPicker } from "@/components/layout/TagPicker";
import { useAgencySettings } from "@/lib/agencyStore";'''),
('''import { FolderPlus, Plus, Save, UploadCloud, X } from "lucide-react";''','''import { FolderPlus, Save, UploadCloud, X } from "lucide-react";'''),
('''  const [tags, setTags] = useState<string[]>([]);
  const [typing, setTyping] = useState("");
  const [adminsOnly, setAdminsOnly] = useState(false);''','''  const [tags, setTags] = useState<string[]>([]);
  const [adminsOnly, setAdminsOnly] = useState(false);
  const { tagPresets } = useAgencySettings();'''),
('''    setTags([]);
    setTyping("");
    setAdminsOnly(false);''','''    setTags([]);
    setAdminsOnly(false);'''),
('''  const addTag = () => {
    const t = normalizeTag(typing);
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTyping("");
  };

''',''''''),
('''          <div className="space-y-1">
            <Label htmlFor="add-tags" className="text-[12px] font-medium">Tags</Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="add-tags"
                value={typing}
                onChange={(e) => setTyping(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tags (e.g. survey 2026, handbook)"
                className="min-w-0 flex-1"
              />
              <Button type="button" size="icon" variant="outline" aria-label="Add tag" onClick={addTag} className="h-10 w-10 flex-none">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-2.5 py-[3px] text-[12px]">
                    {t}
                    <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>''','''          <div className="space-y-1">
            <p className="m-0 text-[12px] font-medium">Tags</p>
            {/* Karynn, 29 September: picked from the list in Settings, not typed. */}
            <TagPicker presets={tagPresets.documents} value={tags} onChange={setTags} />
          </div>'''),
('''                tags: pending && !tags.includes(pending) ? [...tags, pending] : tags,''','''                tags,'''),
])
EOF
grep -n "pending" src/components/documents/AddFilesDialog.tsx | head