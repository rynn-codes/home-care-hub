import { useEffect, useMemo, useRef, useState } from "react";
import { FolderPlus, Save, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagPicker } from "@/components/layout/TagPicker";
import { cn } from "@/lib/utils";
import { useAgencySettings } from "@/lib/agencyStore";
import { formatFileSize } from "@/lib/fileCache";
import { displayName, whyNotUpload } from "@/domain/documents/library";

export const MAX_FILES = 10;

export interface AddDocumentsInput {
  files: File[];
  /** The typed name (with extension) when one file was chosen; null otherwise. */
  name: string | null;
  folder: string;
  tags: string[];
  adminsOnly: boolean;
  /** File it away, or file it and go straight to placing signature boxes on it. */
  purpose: "file" | "sign";
}

/** Choose the file, say where it files and what to tag it with. */
export function AddDocumentsDialog({
  files,
  folders,
  onOpenChange,
  onAdd,
}: {
  /** null = closed; [] = open with nothing chosen yet; files = dropped on the list. */
  files: File[] | null;
  folders: string[];
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddDocumentsInput) => void;
}) {
  const [chosen, setChosen] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [folder, setFolder] = useState(folders[0] ?? "");
  const [tags, setTags] = useState<string[]>([]);
  const [adminsOnly, setAdminsOnly] = useState(false);
  const [purpose, setPurpose] = useState<"file" | "sign">("file");
  const { tagPresets } = useAgencySettings();
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (files === null) return;
    setChosen(files);
    setName(files.length === 1 ? displayName(files[0].name) : "");
    setFolder(folders[0] ?? "");
    setTags([]);
    setAdminsOnly(false);
    setPurpose("file");
    setDragging(false);
  }, [files, folders]);

  const single = chosen.length === 1 ? chosen[0] : null;
  const ext = useMemo(() => {
    if (!single) return "";
    const dot = single.name.lastIndexOf(".");
    return dot > 0 ? single.name.slice(dot) : "";
  }, [single]);

  const take = (list: FileList | null) => {
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) if (!whyNotUpload({ name: f.name, size: f.size })) ok.push(f);
    setChosen((prev) => {
      const next = [...prev, ...ok.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))].slice(0, MAX_FILES);
      if (next.length === 1) setName(displayName(next[0].name));
      return next;
    });
  };
  const canSign = single !== null && single.name.toLowerCase().endsWith(".pdf");
  const problem = chosen.length === 0 ? "Choose a file." : single && !name.trim() ? "The file needs a name." : purpose === "sign" && !canSign ? "Signing needs one PDF." : null;

  return (
    <Dialog open={files !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
            Add to Documents
          </DialogTitle>
          <DialogDescription>Choose the file, say where it files and what to tag it with.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="What is this for">
            {(
              [
                ["file", "Add a file", "File it in Documents."],
                ["sign", "Set up for signing", "One PDF. Place the boxes next."],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={purpose === value}
                onClick={() => setPurpose(value)}
                className={cn(
                  "rounded-[10px] border px-3 py-2 text-left transition-colors",
                  purpose === value ? "border-[#1407A2]/30 bg-[#EFEDFB]" : "border-[var(--hairline)] bg-[var(--paper)] hover:border-primary",
                )}
              >
                <span className={cn("block text-[13px] font-medium", purpose === value && "text-primary")}>{label}</span>
                <span className="block text-[11.5px] text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
          <input
            ref={input}
            type="file"
            multiple
            className="hidden"
            aria-label="Choose files"
            onChange={(e) => {
              take(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              take(e.dataTransfer.files);
            }}
            className={cn(
              "flex w-full flex-col items-center gap-1 rounded-[10px] border border-dashed px-4 py-6 text-center transition-colors",
              dragging ? "border-primary bg-[#F7F8FE]" : "border-[var(--hairline)] bg-[var(--paper-sunken)] hover:border-primary",
            )}
          >
            <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <span className="text-[13.5px] font-medium">{chosen.length === 0 ? "Select a file or drag and drop here" : "Add another"}</span>
            <span className="text-[12px] text-muted-foreground">PDF, Word, Excel or an image — up to {MAX_FILES} files</span>
          </button>
          {chosen.length > 0 && (
            <ul className="m-0 max-h-32 list-none space-y-1 overflow-y-auto p-0">
              {chosen.map((f) => (
                <li key={f.name + f.size} className="flex items-center gap-2 rounded-[8px] bg-[var(--paper-sunken)] px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[13px]" title={f.name}>{displayName(f.name)}</span>
                  <span className="flex-none text-[11.5px] text-muted-foreground">{formatFileSize(f.size)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setChosen((prev) => prev.filter((p) => !(p.name === f.name && p.size === f.size)))}
                    className="flex-none text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={cn("grid gap-3", single ? "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" : "grid-cols-1")}>
            {single && (
              <div className="min-w-0 space-y-1">
                <Label htmlFor="add-name" className="text-[12px] font-medium">File name</Label>
                <div className="flex items-center gap-1.5">
                  <Input id="add-name" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1" />
                  {ext && <span className="flex-none text-[12.5px] text-muted-foreground">{ext}</span>}
                </div>
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <Label htmlFor="add-folder" className="text-[12px] font-medium">Folder</Label>
              <select id="add-folder" value={folder} onChange={(e) => setFolder(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {folders.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <p className="m-0 text-[12px] font-medium">Tags</p>
            <TagPicker presets={tagPresets.documents} value={tags} onChange={setTags} />
          </div>
          <div className="space-y-1">
            <p className="m-0 text-[12px] font-medium">Who can open it</p>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={adminsOnly} onChange={(e) => setAdminsOnly(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              Only administrators
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!!problem}
            onClick={() => {
              if (problem) return;
              onAdd({ files: chosen, name: single ? `${name.trim()}${ext}` : null, folder, tags, adminsOnly, purpose });
              onOpenChange(false);
            }}
          >
            <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {purpose === "sign" ? "Save and place boxes" : `Save to ${folder}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
