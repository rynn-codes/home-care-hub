import { format } from "date-fns";
import { CloudSun } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { motivationalLines } from "@/lib/joySeed";

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The personalised header.
 *
 * Revision 3 is specific that this stays compact: a greeting, the date, one
 * motivational line and small weather. It is explicitly not a hero banner, and
 * the weather must stay secondary to the operational work — no large weather
 * card, no multi-day forecast.
 */
export function GreetingBand() {
  const { firstName } = useCurrentUser();
  const now = new Date();
  const line = motivationalLines[now.getDate() % motivationalLines.length];

  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greetingFor(now.getHours())}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{format(now, "EEEE, MMMM d")}</p>
        <p className="mt-2 text-sm italic text-muted-foreground">{line}</p>
      </div>

      {/* Weather is deliberately a single quiet line, not a card. */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground sm:pt-1">
        <CloudSun className="h-4 w-4" aria-hidden="true" />
        <span className="font-medium text-foreground">Houston 92°F</span>
        <span className="hidden sm:inline">· Partly cloudy, H 96° L 78°</span>
      </div>
    </header>
  );
}
