import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, FolderInput, Heading2, History, Italic, List, ListOrdered, MoreHorizontal, MoreVertical, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDeleteDialog } from "@/components/records/ConfirmDeleteDialog";
import { NewSopDialog } from "@/components/sops/NewSopDialog";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { canWrite } from "@/domain/access/roles";
import { categoriesOf, latestVersion, sopsIn, whyNotCategoryName, whyNotSopTitle, type Sop } from "@/domain/sops/sops";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const btn = (active: boolean, run: () => void, Icon: typeof Bold, label: string) => (
    <Button type="button" size="icon" variant={active ? "default" : "ghost"} className="h-8 w-8" onClick={run} aria-label={label}>
      <Icon className="h-4 w-4" />
    </Button>
  );
  return (
    <div className="flex gap-1 border-b border-[var(--hairline)] p-2">
      {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2, "Heading")}
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), Bold, "Bold")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), Italic, "Italic")}
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), List, "Bulleted list")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered, "Numbered list")}
    </div>
  );
}

const MENU_BTN = "flex h-6 w-6 flex-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--hairline-soft)] hover:text-foreground";

/**
 * SOPs — standard operating procedures, with their version history.
 *
 * Three columns: categories, the procedures in one, the procedure itself.
 * Editing writes a new version rather than changing the old one; categories
 * are renamed or emptied, never deleted with anything inside.
 */
export default function Sops() {
  const { sops, currentUser, addSop, updateSop, saveSopVersion, deleteSop, renameSopCategory, moveSopCategory, restoreDeleted } = useDemo();
  const mayWrite = canWrite(currentUser.role);
  const categories = useMemo(() => categoriesOf(sops), [sops]);
  const [category, setCategory] = useState(categories[0] ?? "");
  const [selectedId, setSelectedId] = useState(sops[0]?.id ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState<{ from: string; to: string } | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<{ name: string; to: string } | null>(null);
  const [renamingSop, setRenamingSop] = useState<{ sop: Sop; title: string } | null>(null);
  const [deletingSop, setDeletingSop] = useState<Sop | null>(null);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) setCategory(categories[0]);
  }, [categories, category]);

  const inCategory = useMemo(() => sopsIn(sops, category), [sops, category]);
  const selected = sops.find((s) => s.id === selectedId) ?? inCategory[0] ?? sops[0] ?? null;
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const current = selected ? latestVersion(selected) : null;
  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: current?.content ?? "",
      editable: editing,
      editorProps: { attributes: { class: "prose prose-sm max-w-none focus:outline-none p-4 min-h-[400px]" } },
    },
    [selected?.id, editing],
  );

  const open = (id: string) => {
    setSelectedId(id);
    setEditing(false);
    setShowHistory(false);
  };
  const create = (input: { title: string; category: string; content: string; fromFile: boolean }) => {
    const id = addSop({ title: input.title, category: input.category, ownerName: currentUser.name, content: input.content });
    setCategory(input.category);
    open(id);
    setEditing(!input.fromFile);
    toast.success(`${input.title} added`, { description: input.fromFile ? "Version 1, from the file." : "Version 1. Write the procedure and save." });
  };

  const header = (
    <PageHeader
      parents={[{ label: "The Brain", to: "/brain" }]}
      title="SOPs"
      description="Standard operating procedures, with their version history."
      actions={
        mayWrite ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New SOP
          </Button>
        ) : undefined
      }
    />
  );

  if (!selected || !current) {
    return (
      <>
        {header}
        <p className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] px-4 py-12 text-center text-[13px] text-muted-foreground">
          No procedures yet. Add the first one.
        </p>
        <NewSopDialog open={creating} onOpenChange={setCreating} categories={categories} onCreate={create} />
      </>
    );
  }

  const categoryProblem = renamingCategory ? whyNotCategoryName({ from: renamingCategory.from, to: renamingCategory.to, categories }) : null;

  return (
    <>
      {header}
      <div className="grid h-[calc(100vh-240px)] gap-4 lg:grid-cols-[210px_270px_1fr]">
        <div className="overflow-y-auto rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-2">
          <p className="m-0 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Categories</p>
          {categories.map((c) => (
            <div key={c} className={cn("group flex items-center gap-1 rounded-[8px] pr-1 transition-colors hover:bg-[var(--wash)]", category === c && "bg-[#EEF0FE]")}>
              <button
                type="button"
                onClick={() => {
                  setCategory(c);
                  const first = sopsIn(sops, c)[0];
                  if (first) open(first.id);
                }}
                className={cn("min-w-0 flex-1 truncate px-2 py-2 text-left text-[13px]", category === c && "font-medium text-primary")}
              >
                {c}
                <span className="ml-1.5 text-[11.5px] text-muted-foreground">{sopsIn(sops, c).length}</span>
              </button>
              {mayWrite && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={`More for ${c}`} className={MENU_BTN}>
                      <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[190px]">
                    <DropdownMenuItem onSelect={() => setRenamingCategory({ from: c, to: c })}>
                      <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-[#B42318] focus:text-[#B42318]"
                      disabled={categories.length < 2}
                      onSelect={() => setDeletingCategory({ name: c, to: categories.find((x) => x !== c) ?? "" })}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>

        <div className="overflow-y-auto rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-2">
          <p className="m-0 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">{category}</p>
          {inCategory.map((s) => (
            <div key={s.id} className={cn("group flex items-center gap-1 rounded-[8px] pr-1 transition-colors hover:bg-[var(--wash)]", selected.id === s.id && "bg-[#EEF0FE]")}>
              <button type="button" onClick={() => open(s.id)} className="min-w-0 flex-1 px-2 py-2 text-left">
                <p className="m-0 truncate text-[13px] font-medium">{s.title}</p>
                <p className="m-0 text-[11.5px] text-muted-foreground">v{s.versions.length} · {fmtDate(s.updatedAt)}</p>
              </button>
              {mayWrite && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={`More for ${s.title}`} className={MENU_BTN}>
                      <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[190px]">
                    <DropdownMenuItem onSelect={() => setRenamingSop({ sop: s, title: s.title })}>
                      <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <FolderInput className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                        Move to
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {categories.filter((c) => c !== s.category).map((c) => (
                          <DropdownMenuItem
                            key={c}
                            onSelect={() => {
                              updateSop(s.id, { category: c });
                              toast.success(`Moved to ${c}`);
                            }}
                          >
                            {c}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-[#B42318] focus:text-[#B42318]" onSelect={() => setDeletingSop(s)}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          {inCategory.length === 0 && <p className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">Nothing in this category.</p>}
        </div>

        <div className="flex flex-col overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] p-4">
            <div className="min-w-0">
              <h2 className="m-0 truncate text-lg font-semibold">{selected.title}</h2>
              <p className="m-0 text-xs text-muted-foreground">
                {selected.ownerName} · v{current.version} · Updated {fmtDate(current.updatedAt)}
              </p>
            </div>
            <div className="flex flex-none items-center gap-2">
              <span className="rounded-full bg-[var(--hairline-soft)] px-2.5 py-1 text-[11.5px] text-[var(--ink-body)]">{selected.category}</span>
              <Button variant="outline" size="sm" onClick={() => setShowHistory((h) => !h)}>
                <History className="mr-1.5 h-4 w-4" />
                History
              </Button>
              {mayWrite &&
                (editing ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!editor) return;
                      saveSopVersion(selected.id, editor.getHTML());
                      setEditing(false);
                      toast.success("Saved as a new version");
                    }}
                  >
                    <Save className="mr-1.5 h-4 w-4" />
                    Save
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>
                ))}
            </div>
          </div>
          <div className="grid flex-1 grid-cols-[1fr_auto] overflow-hidden">
            <div className="overflow-y-auto">
              {editing && <Toolbar editor={editor} />}
              <EditorContent editor={editor} />
            </div>
            {showHistory && (
              <div className="w-64 overflow-y-auto border-l border-[var(--hairline)] bg-[var(--paper-sunken)] p-3">
                <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Version history</p>
                {[...selected.versions].reverse().map((v) => (
                  <div key={v.version} className="mb-1 rounded-[8px] p-2 hover:bg-[var(--paper)]">
                    <p className="m-0 text-sm font-medium">Version {v.version}</p>
                    <p className="m-0 text-xs text-muted-foreground">{fmtDate(v.updatedAt)} · {v.updatedBy}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <NewSopDialog open={creating} onOpenChange={setCreating} categories={categories} onCreate={create} />

      <Dialog open={renamingCategory !== null} onOpenChange={(o) => !o && setRenamingCategory(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename category</DialogTitle>
            <DialogDescription>The new name goes onto {renamingCategory ? sopsIn(sops, renamingCategory.from).length : 0} procedures.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="cat-name" className="text-[12px] font-medium">Name</Label>
            <Input id="cat-name" autoFocus value={renamingCategory?.to ?? ""} onChange={(e) => setRenamingCategory((r) => r && { ...r, to: e.target.value })} />
            {categoryProblem && <p className="m-0 pt-1 text-[12.5px] text-[#B42318]">{categoryProblem}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenamingCategory(null)}>Cancel</Button>
            <Button
              disabled={!renamingCategory || !!categoryProblem}
              onClick={() => {
                if (!renamingCategory) return;
                const { from, to } = renamingCategory;
                renameSopCategory(from, to);
                setCategory(to.trim().replace(/\s+/g, " "));
                setRenamingCategory(null);
                toast.success(`${from} is now ${to.trim()}`);
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletingCategory !== null} onOpenChange={(o) => !o && setDeletingCategory(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {deletingCategory?.name}?</DialogTitle>
            <DialogDescription>
              A category is just where procedures are filed, so its {deletingCategory ? sopsIn(sops, deletingCategory.name).length : 0} procedures move
              somewhere else and the name stops appearing. Nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="cat-move" className="text-[12px] font-medium">Move the procedures to</Label>
            <select
              id="cat-move"
              value={deletingCategory?.to ?? ""}
              onChange={(e) => setDeletingCategory((d) => d && { ...d, to: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {categories.filter((c) => c !== deletingCategory?.name).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletingCategory(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!deletingCategory?.to}
              onClick={() => {
                if (!deletingCategory) return;
                const { name, to } = deletingCategory;
                moveSopCategory(name, to);
                setCategory(to);
                setDeletingCategory(null);
                toast.success(`${name} removed`, { description: `Its procedures are in ${to}.` });
              }}
            >
              Delete category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renamingSop !== null} onOpenChange={(o) => !o && setRenamingSop(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename procedure</DialogTitle>
            <DialogDescription>Its version history stays with it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="sop-rename" className="text-[12px] font-medium">Title</Label>
            <Input id="sop-rename" autoFocus value={renamingSop?.title ?? ""} onChange={(e) => setRenamingSop((r) => r && { ...r, title: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenamingSop(null)}>Cancel</Button>
            <Button
              disabled={!renamingSop || !!whyNotSopTitle(renamingSop.title)}
              onClick={() => {
                if (!renamingSop) return;
                updateSop(renamingSop.sop.id, { title: renamingSop.title.trim() });
                setRenamingSop(null);
                toast.success("Renamed");
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deletingSop}
        onOpenChange={(o) => !o && setDeletingSop(null)}
        title="Delete this procedure?"
        subject={deletingSop ? `${deletingSop.title} · ${deletingSop.category}` : ""}
        consequences={deletingSop ? [`The procedure and all ${deletingSop.versions.length} of its versions`] : []}
        confirmLabel="Delete procedure"
        onConfirm={() => {
          if (!deletingSop) return;
          const { id, title } = deletingSop;
          deleteSop(id);
          setDeletingSop(null);
          toast(`${title} deleted`, { description: "In Settings → Deleted items for 30 days.", action: { label: "Undo", onClick: () => restoreDeleted(id) } });
        }}
      />
    </>
  );
}
