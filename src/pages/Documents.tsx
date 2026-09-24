import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Copy, Download, File, FileImage, FileSpreadsheet, FileText, Folder, FolderInput, FolderPlus, MoreHorizontal,
  MoreVertical, Pencil, RefreshCw, Search, Trash2, Upload,
} from "lucide-react";
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
import { AddDocumentsDialog } from "@/components/documents/AddDocumentsDialog";
import { EditDocumentDialog } from "@/components/documents/EditDocumentDialog";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { canWrite } from "@/domain/access/roles";
import {
  cleanFolderName, countInFolder, displayName, filterDocuments, kindOf, reconcileFolders, tagsInUse, whyNotDeleteFolder,
  whyNotFolderName, whyNotUpload, type DocumentKind, type LibraryDocument,
} from "@/domain/documents/library";
import { copyFileHandle, downloadFile, formatFileSize, recallFile, rememberFile } from "@/lib/fileCache";

const KIND_ICON: Record<DocumentKind, typeof File> = { pdf: FileText, docx: FileText, xlsx: FileSpreadsheet, image: FileImage, other: File };
const KIND_LABEL: Record<DocumentKind, string> = { pdf: "PDF", docx: "Word", xlsx: "Spreadsheet", image: "Image", other: "File" };

/**
 * Documents — the agency's library, by folder and tag.
 *
 * Files added here are real for the session (they download) and their
 * records survive a refresh; the bytes do not, and the screen says so
 * rather than pretending. Folders are created, renamed and emptied on the
 * rail; a file's menu moves, renames, tags, replaces, duplicates, deletes.
 */
export default function Documents() {
  const {
    documents, documentFolders, currentUser, uploadDocument, updateDocument, duplicateDocument, deleteDocument, restoreDeleted,
    addDocumentFolder, renameDocumentFolder, deleteDocumentFolder,
  } = useDemo();
  const mayWrite = canWrite(currentUser.role);
  const [folder, setFolder] = useState("all");
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<File[] | null>(null);
  const [editing, setEditing] = useState<LibraryDocument | null>(null);
  const [deleting, setDeleting] = useState<LibraryDocument | null>(null);
  const [replacing, setReplacing] = useState<LibraryDocument | null>(null);
  const [dragging, setDragging] = useState(false);
  const [folderDialog, setFolderDialog] = useState<{ from: string | null; to: string } | null>(null);
  const [folderDelete, setFolderDelete] = useState<{ name: string; to: string } | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const folders = useMemo(() => reconcileFolders(documentFolders, documents), [documentFolders, documents]);
  const tags = useMemo(() => tagsInUse(documents), [documents]);
  const visible = useMemo(
    () => filterDocuments(documents, { folder, tag, query }).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    [documents, folder, tag, query],
  );
  const count = (f: string) => (f === "all" ? documents.length : countInFolder(documents, f));

  useEffect(() => {
    if (folder !== "all" && !folders.includes(folder)) setFolder("all");
  }, [folders, folder]);

  const folderProblem = folderDialog ? whyNotFolderName({ name: folderDialog.to, folders, from: folderDialog.from ?? undefined }) : null;

  const takeFiles = (list: FileList | null) => {
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      const why = whyNotUpload({ name: f.name, size: f.size });
      if (why) toast.error(`${f.name || "That file"} was not added`, { description: why });
      else ok.push(f);
    }
    if (ok.length) setAdding(ok);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (mayWrite) takeFiles(e.dataTransfer.files);
  };
  const saveFolder = () => {
    if (!folderDialog || folderProblem) return;
    const name = cleanFolderName(folderDialog.to);
    if (folderDialog.from) {
      renameDocumentFolder(folderDialog.from, name);
      if (folder === folderDialog.from) setFolder(name);
      toast.success(`${folderDialog.from} is now ${name}`);
    } else {
      addDocumentFolder(name);
      setFolder(name);
      toast.success(`${name} added`, { description: "Drop a file on the list to file it here." });
    }
    setFolderDialog(null);
  };
  const download = (doc: LibraryDocument) => {
    const file = recallFile(doc.id);
    if (file) downloadFile(file, doc.name);
    else
      toast("No copy to download", {
        description: "The prototype keeps the file itself only for files added in this session. Once Joy is connected, every file downloads.",
      });
  };

  return (
    <>
      <PageHeader
        parents={[{ label: "The Brain", to: "/brain" }]}
        title="Documents"
        actions={
          mayWrite ? (
            <>
              <input
                ref={replaceInput}
                type="file"
                className="hidden"
                aria-label="Choose the replacement file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && replacing) {
                    updateDocument(replacing.id, { name: file.name, size: file.size, kind: kindOf(file.name) });
                    rememberFile(replacing.id, file);
                    toast.success(`${displayName(replacing.name)} replaced`, { description: `Now ${displayName(file.name)} · ${formatFileSize(file.size)}` });
                  }
                  setReplacing(null);
                  e.target.value = "";
                }}
              />
              <Button onClick={() => setAdding([])}>
                <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Upload
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-3.5">
          <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-2">
            <p className="m-0 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Folders</p>
            <button
              type="button"
              onClick={() => setFolder("all")}
              className={cn(
                "flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left text-[13px] transition-colors hover:bg-[var(--wash)]",
                folder === "all" && "bg-[#EEF0FE] font-medium text-primary",
              )}
            >
              <Folder className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              All files
              <span className="ml-auto text-[11.5px] text-muted-foreground">{count("all")}</span>
            </button>
            {folders.map((f) => (
              <div key={f} className={cn("flex items-center gap-1 rounded-[8px] pr-1 transition-colors hover:bg-[var(--wash)]", folder === f && "bg-[#EEF0FE]")}>
                <button
                  type="button"
                  onClick={() => setFolder(f)}
                  className={cn("flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-[13px]", folder === f && "font-medium text-primary")}
                >
                  <Folder className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate" title={f}>{f}</span>
                  <span className="flex-none text-[11.5px] text-muted-foreground">{count(f)}</span>
                </button>
                {mayWrite && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`More for ${f}`}
                        className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--hairline-soft)] hover:text-foreground"
                      >
                        <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[190px]">
                      <DropdownMenuItem onSelect={() => setFolderDialog({ from: f, to: f })}>
                        <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-[#B42318] focus:text-[#B42318]"
                        disabled={!!whyNotDeleteFolder({ folders })}
                        onSelect={() => setFolderDelete({ name: f, to: folders.find((x) => x !== f) ?? "" })}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
            {mayWrite && (
              <button
                type="button"
                onClick={() => setFolderDialog({ from: null, to: "" })}
                className="flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-[var(--wash)] hover:text-foreground"
              >
                <FolderPlus className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                New folder
              </button>
            )}
          </section>
          {tags.length > 0 && (
            <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-3">
              <p className="m-0 px-1 pb-2 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tag === t}
                    onClick={() => setTag(tag === t ? null : t)}
                    className={cn(
                      "rounded-full border px-2.5 py-[3px] text-[12px] transition-colors",
                      tag === t ? "border-primary bg-[#EEF0FE] font-medium text-primary" : "border-[var(--hairline)] hover:bg-[var(--wash)]",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <section
          onDragOver={(e) => {
            e.preventDefault();
            if (mayWrite) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn("relative overflow-hidden rounded-[14px] border bg-[var(--paper)] transition-colors", dragging ? "border-primary bg-[#F7F8FE]" : "border-[var(--hairline)]")}
        >
          {dragging && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#F7F8FE]/90 text-[15px] font-medium text-primary">
              Drop to add to the library
            </div>
          )}
          <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-4 py-3">
            <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files and tags"
              aria-label="Search documents"
              className="h-8 border-none bg-transparent px-1 shadow-none focus-visible:ring-0"
            />
            {(tag || folder !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setTag(null);
                  setFolder("all");
                }}
                className="ml-auto whitespace-nowrap text-[12.5px] text-primary hover:underline"
              >
                Show everything
              </button>
            )}
          </div>
          {visible.length === 0 ? (
            <p className="px-4 py-12 text-center text-[13px] text-muted-foreground">
              {documents.length === 0
                ? "Nothing here yet. Drop a file on this list, or upload one."
                : folder !== "all" && !tag && !query.trim() && count(folder) === 0
                  ? `${folder} is empty. Drop a file here, or upload one.`
                  : "Nothing matches that."}
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {visible.map((doc) => {
                const Icon = KIND_ICON[doc.kind];
                return (
                  <li key={doc.id} className="flex items-center gap-3.5 border-b border-[var(--hairline-soft)] px-4 py-3 last:border-b-0">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] bg-[var(--paper-sunken)]">
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[13.5px] font-medium" title={doc.name}>{displayName(doc.name)}</p>
                      <p className="m-0 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
                        <span>
                          {KIND_LABEL[doc.kind]} · {doc.folder} · {formatFileSize(doc.size)} ·{" "}
                          {new Date(doc.uploadedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                        {doc.tags.map((t) => (
                          <span key={t} className="rounded-full bg-[var(--hairline-soft)] px-2 py-[1px] text-[11px] text-[var(--ink-body)]">{t}</span>
                        ))}
                      </p>
                    </div>
                    {mayWrite && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`More for ${displayName(doc.name)}`}
                            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--hairline-soft)] hover:text-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px]">
                          <DropdownMenuItem onSelect={() => download(doc)}>
                            <Download className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              duplicateDocument(doc.id);
                              toast.success(`${displayName(doc.name)} duplicated`);
                            }}
                          >
                            <Copy className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <FolderInput className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                              Move to
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {folders.filter((f) => f !== doc.folder).map((f) => (
                                <DropdownMenuItem
                                  key={f}
                                  onSelect={() => {
                                    updateDocument(doc.id, { folder: f });
                                    toast.success(`Moved to ${f}`);
                                  }}
                                >
                                  {f}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuItem
                            onSelect={() => {
                              setReplacing(doc);
                              setTimeout(() => replaceInput.current?.click(), 0);
                            }}
                          >
                            <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                            Replace
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setEditing(doc)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                            Rename & tags
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-[#B42318] focus:text-[#B42318]" onSelect={() => setDeleting(doc)}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <AddDocumentsDialog
        files={adding}
        folders={folders}
        onOpenChange={(o) => !o && setAdding(null)}
        onAdd={({ files, name, folder: into, tags: picked, adminsOnly }) => {
          for (const file of files) {
            const fileName = files.length === 1 && name ? name : file.name;
            const id = uploadDocument({ name: fileName, folder: into, kind: kindOf(fileName), size: file.size, tags: picked, permission: adminsOnly ? "admins" : "everyone" });
            rememberFile(id, file);
          }
          setFolder(into);
          toast.success(files.length === 1 ? `${displayName(name ?? files[0].name)} added to ${into}` : `${files.length} files added to ${into}`);
        }}
      />
      <EditDocumentDialog
        document={editing}
        folders={folders}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={(patch) => {
          if (editing) {
            updateDocument(editing.id, patch);
            toast.success("Saved");
          }
        }}
      />

      <Dialog open={folderDialog !== null} onOpenChange={(o) => !o && setFolderDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{folderDialog?.from ? "Rename folder" : "New folder"}</DialogTitle>
            <DialogDescription>
              {folderDialog?.from
                ? `The new name goes onto the ${countInFolder(documents, folderDialog.from)} files filed here.`
                : "It appears on the rail straight away, ready for the first file."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="folder-name" className="text-[12px] font-medium">Name</Label>
            <Input
              id="folder-name"
              autoFocus
              value={folderDialog?.to ?? ""}
              onChange={(e) => setFolderDialog((d) => d && { ...d, to: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !folderProblem) saveFolder();
              }}
              placeholder="Insurance"
            />
            {folderDialog?.to.trim() && folderProblem && <p className="m-0 pt-1 text-[12.5px] text-[#B42318]">{folderProblem}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFolderDialog(null)}>Cancel</Button>
            <Button disabled={!!folderProblem} onClick={saveFolder}>{folderDialog?.from ? "Rename" : "Create folder"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={folderDelete !== null} onOpenChange={(o) => !o && setFolderDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {folderDelete?.name}?</DialogTitle>
            <DialogDescription>
              {folderDelete && countInFolder(documents, folderDelete.name) > 0
                ? `The folder goes. Its ${countInFolder(documents, folderDelete.name)} ${countInFolder(documents, folderDelete.name) === 1 ? "file moves" : "files move"} to the folder you pick — no file is deleted.`
                : "The folder is empty, so nothing moves."}
            </DialogDescription>
          </DialogHeader>
          {folderDelete && countInFolder(documents, folderDelete.name) > 0 && (
            <div className="space-y-1">
              <Label htmlFor="folder-move" className="text-[12px] font-medium">Move the files to</Label>
              <select
                id="folder-move"
                value={folderDelete.to}
                onChange={(e) => setFolderDelete((d) => d && { ...d, to: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {folders.filter((f) => f !== folderDelete.name).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFolderDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!folderDelete?.to}
              onClick={() => {
                if (!folderDelete) return;
                const { name, to } = folderDelete;
                const n = countInFolder(documents, name);
                deleteDocumentFolder(name, to);
                setFolderDelete(null);
                toast.success(`${name} deleted`, { description: n > 0 ? `${n} ${n === 1 ? "file is" : "files are"} in ${to}.` : "It was empty." });
              }}
            >
              Delete folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this file?"
        subject={deleting ? `${displayName(deleting.name)} · ${deleting.folder}` : ""}
        consequences={["The file and its tags"]}
        confirmLabel="Delete file"
        onConfirm={() => {
          if (!deleting) return;
          const { id, name } = deleting;
          const file = recallFile(id);
          deleteDocument(id);
          setDeleting(null);
          toast(`${displayName(name)} deleted`, {
            description: "In Settings → Deleted items for 30 days.",
            action: {
              label: "Undo",
              onClick: () => {
                restoreDeleted(id);
                if (file) copyFileHandle(id, id);
              },
            },
          });
        }}
      />
    </>
  );
}
