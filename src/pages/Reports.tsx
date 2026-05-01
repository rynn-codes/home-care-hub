import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis } from "recharts";
import { useData } from "@/context/DataProvider";
import { Download } from "lucide-react";

export default function Reports() {
  const { employees, clients, shifts } = useData();

  const hoursData = employees.slice(0, 8).map((e) => ({ name: e.name.split(" ")[0], hours: e.hoursThisWeek }));
  const revenueData = clients.slice(0, 7).map((c, i) => ({ name: c.name.split(" ")[0], revenue: 800 + ((i * 200) % 1800) }));
  const compliance = [
    { name: "On time", value: shifts.filter((s) => s.status === "completed").length },
    { name: "Missed", value: shifts.filter((s) => s.status === "missed").length },
    { name: "Cancelled", value: shifts.filter((s) => s.status === "cancelled").length },
  ];
  const colors = ["hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

  return (
    <>
      <PageHeader title="Reports" description="Operational and financial insights." actions={<Button variant="outline"><Download className="h-4 w-4 mr-1.5" />Export</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Hours by Caregiver</h3>
          <ChartContainer config={{ hours: { label: "Hours", color: "hsl(var(--primary))" } }} className="h-64">
            <BarChart data={hoursData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Revenue by Client</h3>
          <ChartContainer config={{ revenue: { label: "Revenue", color: "hsl(var(--success))" } }} className="h-64">
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ChartContainer>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Visit Compliance</h3>
          <ChartContainer config={{}} className="h-64">
            <PieChart>
              <Pie data={compliance} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {compliance.map((_, i) => <Cell key={i} fill={colors[i]} />)}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Overtime Trends</h3>
          <ChartContainer config={{ ot: { label: "OT hrs", color: "hsl(var(--warning))" } }} className="h-64">
            <BarChart data={[
              { week: "W1", ot: 18 }, { week: "W2", ot: 22 }, { week: "W3", ot: 14 },
              { week: "W4", ot: 27 }, { week: "W5", ot: 19 }, { week: "W6", ot: 11 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="week" fontSize={12} />
              <YAxis fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="ot" fill="hsl(var(--warning))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>
      </div>
    </>
  );
}
