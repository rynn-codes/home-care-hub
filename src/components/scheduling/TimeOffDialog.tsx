import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JoySuggests, fmtDay } from "@/components/scheduling/joy";
import { seedEmployees } from "@/lib/employeesSeed";
import type { Visit } from "@/domain/scheduling/conflicts";
import { validateTimeOff, visitsAffected } from "@/domain/scheduling/timeOff";

export function TimeOffDialog({
  open,
  onOpenChange,
  visits,
  onRecord,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visits: readonly Visit[];
  onRecord: (draft: { caregiverName: string; from: string; to: string; reason: string }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [who, setWho] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setWho("");
      setFrom(today);
      setTo(today);
      setReason("");
    }
  }, [open, today]);

  const caregivers = useMemo(() => seedEmployees.filter((e) => e.role !== "office" && e.status === "active"), []);
  const problem = validateTimeOff({ caregiverName: who, from, to, reason });
  const affected = problem ? [] : visitsAffected(visits, { caregiverName: who, from, to });
  const hours = affected.reduce((sum, v) => sum + (Date.parse(v.endsAt) - Date.parse(v.startsAt)) / 3_600_000, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request off</DialogTitle>
          <DialogDescription>Their shifts on those days open up for somebody else, with their name kept on them.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="off-who" className="text-[12px] font-medium">
              Who
            </Label>
            <select id="off-who" value={who} onChange={(e) => setWho(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Choose a caregiver</option>
              {caregivers.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="off-from" className="text-[12px] font-medium">
                First day off
              </Label>
              <Input id="off-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="off-to" className="text-[12px] font-medium">
                Last day off
              </Label>
              <Input id="off-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="off-why" className="text-[12px] font-medium">
              Reason (optional)
            </Label>
            <Input id="off-why" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Family wedding · appointment · sick" />
          </div>
          {problem ? (
            <p className="m-0 text-[12.5px] leading-[1.5] text-muted-foreground">{problem}</p>
          ) : (
            <JoySuggests
              headline={
                affected.length === 0
                  ? `${who} has nothing scheduled on those days. Nothing needs covering.`
                  : `${affected.length} of ${who}'s ${affected.length === 1 ? "shift opens" : "shifts open"} up.`
              }
              rows={
                affected.length === 0
                  ? []
                  : [
                      { label: "Clients", tone: "warn", value: [...new Set(affected.map((v) => v.clientName))].join(", ") },
                      { label: "Days", tone: "plain", value: [...new Set(affected.map((v) => fmtDay(v.startsAt)))].join(", ") },
                      { label: "Hours", tone: "plain", value: `${hours.toFixed(1).replace(/\.0$/, "")} hrs off the board` },
                    ]
              }
              note={affected.length === 0 ? undefined : "They come back on the board as open shifts with her name kept on them, and Joy suggests who can take each one."}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!!problem}
            onClick={() => {
              if (problem) return;
              onRecord({ caregiverName: who, from, to, reason: reason.trim() });
              onOpenChange(false);
            }}
          >
            Record time off
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
