import { useNow } from "@/hooks/use-now";
import { todaysWeather } from "@/lib/weatherSeed";

/**
 * The date, the time and today's high, on the left of the top bar. The
 * forecast is the seeded one — no weather service is connected — and the
 * tooltip says so.
 */
export function HeaderClock() {
  const now = useNow();
  return (
    <div className="mr-auto hidden items-center gap-4 whitespace-nowrap lg:flex">
      <span className="text-[13.5px] font-medium tracking-[-.01em]">
        {now.toLocaleDateString([], { weekday: "short", month: "long", day: "numeric" })}
      </span>
      <span className="text-[13px] text-[#8A8A92]">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      <span
        className="flex items-center gap-[7px] text-[13px] text-[#8A8A92]"
        title="Demo forecast — no weather service is connected yet"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#D97706" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
          <circle cx="8" cy="8" r="2.8" />
          <path d="M8 1.6v1.4M8 13v1.4M1.6 8h1.4M13 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M12.4 3.6l-1 1M4.6 11.4l-1 1" />
        </svg>
        {todaysWeather.high}°F
      </span>
      <span className="text-[13px] text-[#8A8A92]">Houston, TX</span>
    </div>
  );
}
