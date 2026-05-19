import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, MapPin } from "lucide-react";
import { useMemo } from "react";

const conditions = [
  { label: "Sunny", icon: Sun, temp: 74 },
  { label: "Partly Cloudy", icon: CloudSun, temp: 68 },
  { label: "Cloudy", icon: Cloud, temp: 61 },
  { label: "Light Rain", icon: CloudRain, temp: 57 },
  { label: "Snow", icon: CloudSnow, temp: 30 },
];

export function WeatherWidget({ city = "Springfield" }: { city?: string }) {
  const { label, icon: Icon, temp } = useMemo(() => {
    const idx = new Date().getDate() % conditions.length;
    return conditions[idx];
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card/80 backdrop-blur px-4 py-2.5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
        <Icon className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-xl font-bold">{temp}°</span>
          <span className="text-xs text-muted-foreground">F</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {city} · {label}
        </div>
      </div>
    </div>
  );
}
