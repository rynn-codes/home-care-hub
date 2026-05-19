import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { useData } from "@/context/DataProvider";
import { isSameDay } from "date-fns";
import { CalendarDays } from "lucide-react";

export function MiniCalendar() {
  const { shifts } = useData();
  const [date, setDate] = useState<Date | undefined>(new Date());

  const shiftDays = shifts.map((s) => new Date(s.start));
  const dayShifts = date ? shifts.filter((s) => isSameDay(new Date(s.start), date)) : [];

  return (
    <Card className="p-4 rounded-3xl bg-primary-soft border-0 shadow-md">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-background flex items-center justify-center">
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-semibold text-sm text-primary">Calendar</h3>
        </div>
        <span className="text-xs font-medium text-primary/70">{dayShifts.length} shifts</span>
      </div>
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        className="p-0 pointer-events-auto w-full"
        classNames={{
          months: "w-full",
          month: "w-full space-y-3",
          table: "w-full border-collapse",
          head_row: "flex w-full",
          head_cell: "text-primary/60 rounded-md flex-1 font-medium text-xs",
          row: "flex w-full mt-1.5",
          cell: "flex-1 aspect-square text-center text-sm p-0 relative [&:has([aria-selected])]:bg-transparent",
          day: "h-full w-full p-0 font-medium rounded-lg hover:bg-background/60 aria-selected:opacity-100",
          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
          day_today: "bg-background text-primary",
        }}
        modifiers={{ hasShift: shiftDays }}
        modifiersClassNames={{
          hasShift: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
        }}
      />
    </Card>
  );
}
