import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { displayName } from "@/domain/documents/library";
import { startingContent } from "@/domain/sops/sops";

export interface NewSopInput {
  title: string;
  category: string;
  content: string;
  /** True when the text came from a file, so the editor need not open. */
  fromFile: boolean;
}

/** Upload the procedure you already have, or start a blank one and write it here. */
export function NewSopDialog({
  open,
  onOpenChange,
  categories,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  onCreate: (input: NewSopInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "");
  const [newCategory, setNewCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setCategory(categories[0] ?? "");
    setNewCategory("");
    setFile(null);
    setText(null);
  }, [open, categories]);

  const chosenCategory = category === "__new__" ? newCategory.trim() : category;
  const problem = title.trim() ? (chosenCategory ? null : "Pick a category.") : "Give it a title.";
  const take = async (f: File | null) => {
    setFile(f);
    if (!f) return;
    if (!title.trim()) setTitle(displayName(f.name));
    setText(/\.(txt|md)$/i.test(f.name) && f.size < 200_000 ? await f.text() : null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New SOP</DialogTitle>
          <DialogDescription>Upload the procedure you already have, or start a blank one and write it here.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <input
            ref={input}
            type="file"
            className="hidden"
            aria-label="Choose the SOP file"
            accept=".pdf,.doc,.docx,.txt,.md"
            onChange={(e) => void take(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void take(e.dataTransfer.files?.[0] ?? null);
            }}
            className="flex w-full flex-col items-center gap-1 rounded-[10px] border border-dashed border-[var(--hairline)] bg-[var(--paper-sunken)] px-4 py-5 text-center transition-colors hover:border-primary"
          >
            <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {file ? (
              <span className="text-[13px] font-medium">{file.name}</span>
            ) : (
              <>
                <span className="text-[13px] font-medium">Drop the file here, or click to choose</span>
                <span className="text-[12px] text-muted-foreground">PDF, Word, or text. Optional — you can write it instead.</span>
              </>
            )}
          </button>
          <div className="space-y-1">
            <Label htmlFor="sop-title" className="text-[12px] font-medium">Title</Label>
            <Input id="sop-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fall Prevention" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sop-cat" className="text-[12px] font-medium">Category</Label>
            <select id="sop-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__new__">New category…</option>
            </select>
            {category === "__new__" && (
              <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Name the category" className="mt-1.5" />
            )}
          </div>
          {problem && title && <p className="m-0 text-[12.5px] text-[#B42318]">{problem}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!!problem}
            onClick={() => {
              if (problem) return;
              onCreate({ title: title.trim(), category: chosenCategory, content: startingContent({ fileName: file?.name ?? null, text }), fromFile: !!text });
              onOpenChange(false);
            }}
          >
            {file ? "Add SOP" : "Start writing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
