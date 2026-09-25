import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { displayName, type LibraryDocument } from "@/domain/documents/library";
import { recallFile } from "@/lib/fileCache";
import { sampleText } from "@/lib/sampleFiles";

/**
 * Open a document without leaving the page.
 *
 * Three cases, each said plainly: a seeded document with sample wording
 * shows the wording; a file added this session shows the image or PDF
 * itself; anything else has no copy to show, because the prototype has no
 * file storage and the screen would rather say so than open a blank tab.
 */
export function DocumentPreviewDialog({ document, onOpenChange }: { document: LibraryDocument | null; onOpenChange: (open: boolean) => void }) {
  const file = document ? recallFile(document.id) : null;
  const sample = document ? sampleText(document.id) : null;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const showsFile = !!file && !!url && (document?.kind === "image" || document?.kind === "pdf");

  return (
    <Dialog open={document !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{document ? displayName(document.name) : ""}</DialogTitle>
          <DialogDescription>
            {sample
              ? "Sample wording for a test document. There is no file behind it."
              : showsFile
                ? "The file you added this session."
                : "No copy to show."}
          </DialogDescription>
        </DialogHeader>

        {sample ? (
          <article className="max-h-[60vh] space-y-3 overflow-y-auto rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-5 py-4 text-[13.5px] leading-[1.6] text-[var(--ink-body)]">
            <p className="m-0 rounded-[8px] bg-[#FFFAEB] px-3 py-2 text-[12px] font-medium text-[#B54708]">Test document. Not an agreement.</p>
            {sample.paragraphs.map((p, i) => (
              <p key={i} className="m-0">
                {p}
              </p>
            ))}
          </article>
        ) : showsFile ? (
          document?.kind === "image" ? (
            <img src={url ?? undefined} alt={displayName(document.name)} className="max-h-[60vh] w-full rounded-[10px] object-contain" />
          ) : (
            <iframe src={url ?? undefined} title={displayName(document?.name ?? "")} className="h-[60vh] w-full rounded-[10px] border border-[var(--hairline)]" />
          )
        ) : (
          <p className="m-0 rounded-[10px] border border-dashed border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 py-2.5 text-[12.5px] leading-[1.5] text-muted-foreground">
            {file
              ? "This kind of file cannot be shown here. Download it from the file's menu instead."
              : "The prototype keeps a file only for the session it was added in, and the seeded library is names only. Once Joy is connected to file storage, every file opens here."}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
