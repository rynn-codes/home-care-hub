import { format } from "date-fns";
import { useCurrentUser } from "@/hooks/use-current-user";

function greetingFor(hour: number): { before: string; accent: string } {
  if (hour < 12) return { before: "Good", accent: "morning" };
  if (hour < 18) return { before: "Good", accent: "afternoon" };
  return { before: "Good", accent: "evening" };
}

/**
 * The greeting, exactly as the approved dashboard mock draws it
 * (docs/mockups/11-brief-band.png): the time of day carries the accent colour,
 * the wave is part of the welcome, and beneath it one quiet line — the date,
 * the city, the weather — with hairline dots between.
 *
 * The weather is seeded demo copy until a weather source is wired; it reads as
 * ambience, never as data anybody would act on.
 */
export function GreetingBand() {
  const { firstName } = useCurrentUser();
  const now = new Date();
  const { before, accent } = greetingFor(now.getHours());

  return (
    <header className="mb-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        {before} <span className="text-primary">{accent}</span>
        {firstName ? `, ${firstName}` : ""}.{" "}
        <span aria-hidden="true">👋</span>
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {format(now, "EEEE, MMMM d")}
        <span aria-hidden="true"> · </span>Houston 92°
        <span aria-hidden="true"> · </span>Partly cloudy, H 96° L 78°
      </p>
    </header>
  );
}
