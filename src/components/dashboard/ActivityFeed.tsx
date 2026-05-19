import { Card } from "@/components/ui/card";
import { useData } from "@/context/DataProvider";
import { UserPlus, Clock, FileUp, Target, BookOpen, Activity } from "lucide-react";
import { timeAgo } from "@/lib/formatters";

const icons = {
  client: UserPlus,
  shift: Clock,
  document: FileUp,
  goal: Target,
  sop: BookOpen,
};

export function ActivityFeed() {
  const { activity } = useData();
  return (
    <Card className="p-6 rounded-3xl bg-foreground text-background border-0 shadow-lg relative overflow-hidden">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-background/10 flex items-center justify-center">
            <Activity className="h-4 w-4" />
          </div>
          <h3 className="font-semibold">Recent Activity</h3>
        </div>
        <span className="text-xs opacity-60">{activity.length} updates</span>
      </div>
      <div className="relative space-y-4">
        {activity.map((a) => {
          const Icon = icons[a.kind];
          return (
            <div key={a.id} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-background/10 text-background flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">{a.message}</p>
                <p className="text-xs opacity-60 mt-0.5">{timeAgo(a.at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
