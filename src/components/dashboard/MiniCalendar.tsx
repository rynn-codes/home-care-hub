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
          classNames={{
            head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.7rem]",
            cell: "h-8 w-8 text-center text-xs p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: "h-8 w-8 p-0 font-normal text-xs rounded-md hover:bg-accent aria-selected:opacity-100",
            caption_label: "text-xs font-medium",
          }}
          modifiers={{ hasShift: shiftDays }}
          modifiersClassNames={{
            hasShift: "relative after:content-[''] after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
          }}
        />
      </div>
    </Card>
  );
}
