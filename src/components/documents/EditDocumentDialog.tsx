import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagPicker } from "@/components/layout/TagPicker";
import { useAgencySettings } from "@/lib/agencyStore";
import { displayName, type LibraryDocument } from "@/domain/documents/library";

/** Rename it, move it, or change its tags. */
export function EditDocumentDialog({
  document,
  folders,
  onOpenChange,
  onSave,
}: {
  document: LibraryDocument | null;
  folders: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (patch: { name: string; folder: string; tags: string[] }) => void;
}) {
  const [name, setName] = useState("");
  const [folder, setFolder] = useState(folders[0] ?? "");
  const [tags, setTags] = useState<string[]>([]);
  const { tagPresets } = useAgencySettings();
  useEffect(() => {
    if (!document) return;
    setName(displayName(document.name));
    setFolder(document.folder);
    setTags(document.tags);
  }, [document]);
  const ext = document && document.name.lastIndexOf(".") > 0 ? document.name.slice(document.name.lastIndexOf(".")) : "";

  return (
    <Dialog open={document !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit</DialogTitle>
          <DialogDescription>Rename it, move it, or change its tags.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="edit-name" className="text-[12px] font-medium">Name</Label>
            <div className="flex items-center gap-1.5">
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1" />
              {ext && <span className="flex-none text-[12.5px] text-muted-foreground">{ext}</span>}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-folder" className="text-[12px] font-medium">Folder</Label>
            <select id="edit-folder" value={folder} onChange={(e) => setFolder(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {folders.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <p className="m-0 text-[12px] font-medium">Tags</p>
            <TagPicker presets={tagPresets.documents} value={tags} onChange={setTags} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onSave({ name: `${name.trim()}${ext}`, folder, tags });
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
