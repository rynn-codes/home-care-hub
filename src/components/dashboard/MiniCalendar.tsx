import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { useData } from "@/context/DataProvider";
import { isSameDay } from "date-fns";

export function MiniCalendar() {
  const { shifts } = useData();
  const [date, setDate] = useState<Date | undefined>(new Date());

  const shiftDays = shifts.map((s) => new Date(s.start));
  const dayShifts = date ? shifts.filter((s) => isSameDay(new Date(s.start), date)) : [];

  return (
    <Card className="p-3 overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm">Calendar</h3>
        <span className="text-xs text-muted-foreground">{dayShifts.length} shifts</span>
      </div>
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          className="p-0 pointer-events-auto"
          modifiers={{ hasShift: shiftDays }}
          modifiersClassNames={{
            hasShift: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
          }}
        />
      </div>
    </Card>
  );
}
