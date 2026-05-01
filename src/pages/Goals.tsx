import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChevronDown, Plus, Target } from "lucide-react";
import { useData } from "@/context/DataProvider";
import { initials } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { GoalStatus } from "@/lib/mockData";

const statusColor: Record<GoalStatus, string> = {
  "on-track": "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]",
  "at-risk": "bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]",
  "off-track": "bg-destructive/15 text-destructive",
  done: "bg-primary-soft text-primary",
};

export default function Goals() {
  const { goals, employees, setGoals } = useData();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("all");

  const filtered = goals.filter((g) => filter === "all" || g.status === filter);

  const toggleMilestone = (gid: string, mid: string) => {
    setGoals(goals.map((g) => g.id === gid ? {
      ...g,
      milestones: g.milestones.map((m) => m.id === mid ? { ...m, done: !m.done } : m),
    } : g));
  };

  return (
    <>
      <PageHeader title="Goal Tracker" description="Company objectives, milestones, and progress." actions={
        <Dialog>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" />New Goal</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create new goal</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input placeholder="Goal title" /></div>
              <div><Label>Description</Label><Textarea placeholder="Describe the goal…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Owner</Label><Input placeholder="Owner name" /></div>
                <div><Label>Target date</Label><Input type="date" /></div>
              </div>
            </div>
            <DialogFooter><Button>Create goal</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <div className="mb-4 flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="on-track">On Track</SelectItem>
            <SelectItem value="at-risk">At Risk</SelectItem>
            <SelectItem value="off-track">Off Track</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-3">
        {filtered.map((g) => {
          const owner = employees.find((e) => e.id === g.ownerId);
          const isOpen = open[g.id];
          return (
            <Card key={g.id} className="p-5">
              <button className="w-full flex items-start gap-4 text-left" onClick={() => setOpen({ ...open, [g.id]: !isOpen })}>
                <div className="h-10 w-10 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0"><Target className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{g.title}</h3>
                    <Badge variant="secondary" className={cn("capitalize", statusColor[g.status])}>{g.status.replace("-", " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{g.description}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <Progress value={g.progress} className="h-2 flex-1" />
                    <span className="text-sm font-semibold w-10 text-right">{g.progress}%</span>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <Avatar className="h-5 w-5"><AvatarFallback className="text-[10px]">{owner ? initials(owner.name) : "?"}</AvatarFallback></Avatar>
                    {owner?.name} · Due {format(new Date(g.dueDate), "MMM d, yyyy")}
                  </div>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="mt-4 ml-14 pt-4 border-t space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Milestones</p>
                  {g.milestones.map((m) => (
                    <label key={m.id} className="flex items-center gap-3 py-1 cursor-pointer">
                      <Checkbox checked={m.done} onCheckedChange={() => toggleMilestone(g.id, m.id)} />
                      <span className={cn("text-sm flex-1", m.done && "line-through text-muted-foreground")}>{m.title}</span>
                      <span className="text-xs text-muted-foreground">Due {format(new Date(m.due), "MMM d")}</span>
                    </label>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
