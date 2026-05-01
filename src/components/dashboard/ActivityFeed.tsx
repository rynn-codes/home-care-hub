import { Card } from "@/components/ui/card";
import { useData } from "@/context/DataProvider";
import { UserPlus, Clock, FileUp, Target, BookOpen } from "lucide-react";
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
    <Card className="p-5">
      <h3 className="font-semibold mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {activity.map((a) => {
          const Icon = icons[a.kind];
          return (
            <div key={a.id} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary-soft text-primary flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{a.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(a.at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
