import { useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/records/ConfirmDeleteDialog";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { canWrite } from "@/domain/access/roles";
import {
  DEFAULT_RECOVERY_DAYS,
  KIND_LABELS,
  daysLeft,
  daysLeftLabel,
  purgeDate,
  type DeletedRecord,
} from "@/domain/records/deletion";

function DeletedRow({
  record,
  now,
  canEdit,
  onRestore,
  onPurge,
}: {
  record: DeletedRecord;
  now: string;
  canEdit: boolean;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const soon = daysLeft(record, now) <= 7;
  return (
    <li className="flex flex-wrap items-start gap-3 border-b border-[var(--hairline-soft)] px-[18px] py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{record.label}</span>
          <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--hairline-soft)] px-2 py-[2px] text-[10.5px] font-medium text-[var(--ink-body)]">
            {KIND_LABELS[record.kind]}
          </span>
          <span
            className={cn(
              "inline-flex whitespace-nowrap rounded-full px-2 py-[2px] text-[10.5px] font-medium",
              soon ? "bg-[#FDF0E7] text-[#C2410C]" : "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
            )}
          >
            {daysLeftLabel(record, now)}
          </span>
        </p>
        <p className="m-0 mt-[3px] text-[12.5px] text-[var(--ink-body)]">{record.sublabel}</p>
        <p className="m-0 mt-[2px] text-[11.5px] text-muted-foreground">
          Deleted by {record.deletedBy} on {new Date(record.deletedAt).toLocaleDateString([], { month: "long", day: "numeric" })}
          {record.reason ? ` · ${record.reason}` : ""} · goes for good{" "}
          {new Date(`${purgeDate(record)}T00:00:00`).toLocaleDateString([], { month: "long", day: "numeric" })}
        </p>
      </div>
      {canEdit && (
        <div className="flex flex-none items-center gap-2">
          <Button size="sm" variant="outline" onClick={onRestore}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Put it back
          </Button>
          <Button size="sm" variant="ghost" className="text-[#B42318] hover:text-[#B42318]" onClick={onPurge}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Delete now
          </Button>
        </div>
      )}
    </li>
  );
}

/** The bin. Everything deleted anywhere in Joy, until its window closes. */
export function DeletedItems() {
  const { deletedRecords, currentUser, restoreDeleted, purgeDeleted } = useDemo();
  const [purging, setPurging] = useState<DeletedRecord | null>(null);
  const now = useMemo(() => new Date().toISOString(), []);
  const canEdit = canWrite(currentUser.role);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
        <div className="border-b border-[var(--hairline-soft)] px-[18px] py-4">
          <h2 className="m-0 text-[15px] font-semibold tracking-[-.01em]">Deleted items</h2>
          <p className="m-0 mt-1 text-[12.5px] leading-[1.5] text-muted-foreground">
            Anything deleted anywhere in Joy waits here — {DEFAULT_RECOVERY_DAYS} days for most things, 60 for an employee or a
            client — and can be put back exactly as it was. After that it goes for good, on its own.
          </p>
        </div>
        {deletedRecords.length === 0 ? (
          <p className="m-0 px-[18px] py-10 text-center text-[13px] text-muted-foreground">Nothing has been deleted.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {deletedRecords.map((r) => (
              <DeletedRow
                key={`${r.kind}-${r.id}`}
                record={r}
                now={now}
                canEdit={canEdit}
                onRestore={() => {
                  restoreDeleted(r.id);
                  toast.success(`${r.label} is back`);
                }}
                onPurge={() => setPurging(r)}
              />
            ))}
          </ul>
        )}
      </div>
      <p className="m-0 text-[12px] leading-[1.55] text-muted-foreground">
        Admitted clients are not deletable. Once care has started their file is a clinical record the agency has to keep, so
        it is discharged rather than deleted.
      </p>
      <ConfirmDeleteDialog
        open={!!purging}
        onOpenChange={(o) => !o && setPurging(null)}
        title="Delete permanently?"
        subject={purging ? `${purging.label} · ${purging.sublabel}` : ""}
        consequences={
          purging
            ? [`${KIND_LABELS[purging.kind]} and everything stored with it`, `It had ${daysLeft(purging, now)} days left to be recovered. Those end now.`]
            : []
        }
        permanent
        confirmLabel="Delete for good"
        onConfirm={() => {
          if (!purging) return;
          purgeDeleted(purging.id);
          setPurging(null);
          toast(`${purging.label} deleted permanently`);
        }}
      />
    </div>
  );
}
