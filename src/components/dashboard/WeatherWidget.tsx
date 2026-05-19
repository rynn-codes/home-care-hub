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
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="h-4 w-4 text-foreground/70" />
      <span className="font-medium text-foreground">{temp}°</span>
      <span className="hidden sm:inline">·</span>
      <span className="hidden sm:inline">{label}</span>
      <span className="hidden md:inline-flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        {city}
      </span>
    </div>
  );
}
