import { upcomingDeadlines } from "@/lib/joySeed";

/**
 * Upcoming Deadlines, to the approved mock's values: a 52px date column,
 * hairline-separated rows, and a light "in N days" distance on the right.
 */
export function UpcomingDeadlines() {
  return (
    <section>
      <h2 className="m-0 mb-2.5 text-[17px] font-medium tracking-[-.02em]">Upcoming Deadlines</h2>
      {upcomingDeadlines.map((d) => (
        <div key={d.label} className="flex gap-[18px] border-t border-black/[.05] py-[15px]">
          <span className="w-[52px] flex-none text-[12.5px] text-muted-foreground">{d.date}</span>
          <span className="flex-1 text-[13.5px] font-normal">{d.label}</span>
          <span className="text-[12.5px] font-light text-muted-foreground">{d.inDays}</span>
        </div>
      ))}
    </section>
  );
}
