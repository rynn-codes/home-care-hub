import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "@/context/DemoDataProvider";
import { useAgencySettings } from "@/lib/agencyStore";
import { latestUndoable, undoDeadline, type ProfileChangeKind } from "@/domain/records/profileChanges";

/**
 * "Changed an hour ago by Karynn V · Undo until Wed 3:10 PM", under a record's
 * header, for as long as the agency's undo window allows.
 *
 * Karynn, 29 September: changes to a client or employee profile "stay for 72
 * hours in case we need to undo a change. We still would keep an audited
 * trail of info changed."
 *
 * Blue, not amber: nothing is owed. It is information with a door in it. The
 * banner shows only the newest change to this record, because undoing an
 * older one would also wipe the newer — see domain/records/profileChanges.
 * Undo writes its own audit line; the original stays.
 */
export function UndoChangeBanner({
  kind,
  entityId,
  mayWrite,
}: {
  kind: ProfileChangeKind;
  entityId: string;
  mayWrite: boolean;
}) {
  const { profileChanges, undoProfileChange } = useDemo();
  const { profileUndoHours } = useAgencySettings();
  const now = new Date().toISOString();
  const change = latestUndoable(profileChanges, kind, entityId, profileUndoHours, now);
  if (!change) return null;

  const deadline = new Date(undoDeadline(change, profileUndoHours));
  const when = new Date(change.changedAt);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const fmt = (d: Date) =>
    sameDay(d, new Date(now))
      ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div
      role="status"
      className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-[#D9DDFB] bg-[#EEF0FE] px-4 py-2.5 text-[12.5px] text-[var(--ink-body)]"
    >
      <span className="min-w-0 flex-1 [text-wrap:pretty]">
        <span className="font-medium text-foreground">
          {change.what === "status" ? "Status changed" : "Profile changed"}
        </span>{" "}
        {fmt(when)} by {change.changedBy} · {change.summary}.{" "}
        <span className="text-muted-foreground">Can be undone until {fmt(deadline)}.</span>
      </span>
      {mayWrite && (
        <button
          type="button"
          onClick={() => {
            undoProfileChange(change.id);
            toast(`${change.name}'s ${change.what === "status" ? "status" : "profile"} put back`, {
              description: "The audit trail keeps both the change and the undo.",
            });
          }}
          className="flex h-[30px] flex-none items-center gap-1.5 rounded-[8px] border border-[#C7CCF7] bg-[var(--paper)] px-2.5 text-[12.5px] font-medium text-primary transition-colors hover:bg-white"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          Undo
        </button>
      )}
    </div>
  );
}
