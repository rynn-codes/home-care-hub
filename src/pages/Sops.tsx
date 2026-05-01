import { useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useData } from "@/context/DataProvider";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Plus, History, Save, Bold, Italic, List, ListOrdered, Heading2 } from "lucide-react";
import type { Sop } from "@/lib/mockData";

function Toolbar({ editor }: { editor: any }) {
  if (!editor) return null;
  const btn = (active: boolean, onClick: () => void, Icon: any) => (
    <Button type="button" size="icon" variant={active ? "default" : "ghost"} className="h-8 w-8" onClick={onClick}>
      <Icon className="h-4 w-4" />
    </Button>
  );
  return (
    <div className="flex gap-1 border-b p-2">
      {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2)}
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), Bold)}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), Italic)}
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), List)}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered)}
    </div>
  );
}

export default function Sops() {
  const { sops, employees, setSops } = useData();
  const categories = useMemo(() => Array.from(new Set(sops.map((s) => s.category))), [sops]);
  const [category, setCategory] = useState(categories[0]);
  const [selectedId, setSelectedId] = useState<string>(sops[0].id);
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState(false);

  const selected = sops.find((s) => s.id === selectedId)!;
  const latest = selected.versions[selected.versions.length - 1];
  const owner = employees.find((e) => e.id === selected.ownerId);

  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: latest.content,
      editable: editing,
      editorProps: { attributes: { class: "prose prose-sm max-w-none focus:outline-none p-4 min-h-[400px]" } },
    },
    [selectedId, editing]
  );

  const save = () => {
    if (!editor) return;
    const newContent = editor.getHTML();
    const next: Sop = {
      ...selected,
      updatedAt: new Date().toISOString(),
      versions: [
        ...selected.versions,
        { version: latest.version + 1, updatedAt: new Date().toISOString(), updatedBy: selected.ownerId, content: newContent },
      ],
    };
    setSops(sops.map((s) => s.id === selected.id ? next : s));
    setEditing(false);
  };

  const filteredSops = sops.filter((s) => s.category === category);

  return (
    <>
      <PageHeader title="SOPs" description="Standard operating procedures with versioning." actions={<Button><Plus className="h-4 w-4 mr-1.5" />New SOP</Button>} />
      <div className="grid gap-4 lg:grid-cols-[200px_260px_1fr] h-[calc(100vh-220px)]">
        <Card className="p-2 overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground uppercase px-2 py-2">Categories</p>
          <ScrollArea className="h-full">
            {categories.map((c) => (
              <button key={c}
                className={cn("w-full text-left px-3 py-2 text-sm rounded-md hover:bg-surface-muted", category === c && "bg-primary-soft text-primary font-medium")}
                onClick={() => { setCategory(c); const first = sops.find((s) => s.category === c); if (first) { setSelectedId(first.id); setEditing(false); } }}
              >{c}</button>
            ))}
          </ScrollArea>
        </Card>
        <Card className="p-2 overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground uppercase px-2 py-2">{category}</p>
          <ScrollArea className="h-full">
            {filteredSops.map((s) => (
              <button key={s.id}
                className={cn("w-full text-left px-3 py-2 rounded-md hover:bg-surface-muted", selectedId === s.id && "bg-primary-soft")}
                onClick={() => { setSelectedId(s.id); setEditing(false); setShowHistory(false); }}
              >
                <p className="text-sm font-medium truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground">v{s.versions.length} · {format(new Date(s.updatedAt), "MMM d")}</p>
              </button>
            ))}
          </ScrollArea>
        </Card>
        <Card className="overflow-hidden flex flex-col">
          <div className="border-b p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-lg truncate">{selected.title}</h2>
              <p className="text-xs text-muted-foreground">{owner?.name} · v{latest.version} · Updated {format(new Date(latest.updatedAt), "MMM d, yyyy")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selected.category}</Badge>
              <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}><History className="h-4 w-4 mr-1.5" />History</Button>
              {editing ? (
                <Button size="sm" onClick={save}><Save className="h-4 w-4 mr-1.5" />Save</Button>
              ) : (
                <Button size="sm" variant="default" onClick={() => setEditing(true)}>Edit</Button>
              )}
            </div>
          </div>
          <div className="flex-1 grid grid-cols-[1fr_auto] overflow-hidden">
            <div className="overflow-y-auto">
              {editing && <Toolbar editor={editor} />}
              <EditorContent editor={editor} />
            </div>
            {showHistory && (
              <div className="w-64 border-l p-3 overflow-y-auto bg-surface-muted">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Version history</p>
                {[...selected.versions].reverse().map((v) => (
                  <div key={v.version} className="p-2 rounded-md hover:bg-surface mb-1">
                    <p className="text-sm font-medium">Version {v.version}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(v.updatedAt), "MMM d, yyyy h:mm a")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
