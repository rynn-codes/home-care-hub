import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Users, UserCog, Clock } from "lucide-react";
import { useData } from "@/context/DataProvider";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { initials } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Client } from "@/lib/mockData";

const statusColor: Record<string, string> = {
  active: "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]",
  "on-hold": "bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]",
  discharged: "bg-muted text-muted-foreground",
};

export default function Clients() {
  const { clients, employees } = useData();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Client | null>(null);

  const filtered = clients.filter((c) =>
    (status === "all" || c.status === status) &&
    (c.name.toLowerCase().includes(q.toLowerCase()) || c.address.toLowerCase().includes(q.toLowerCase()))
  );

  const activeClients = clients.filter((c) => c.status === "active").length;
  const activeCaregivers = employees.filter((e) => e.status === "active").length;
  const weeklyHours = Math.round(employees.reduce((s, e) => s + (e.hoursThisWeek ?? 0), 0));

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${clients.length} total · ${activeClients} active`}
        actions={<Button><Plus className="h-4 w-4 mr-1.5" />Add Client</Button>}
      />
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <KpiCard label="Active Clients" value={activeClients} icon={Users} accent="primary" />
        <KpiCard label="Active Caregivers" value={activeCaregivers} icon={UserCog} accent="info" />
        <KpiCard label="Weekly Hours" value={weeklyHours} icon={Clock} accent="warning" />
      </div>
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on-hold">On Hold</SelectItem>
              <SelectItem value="discharged">Discharged</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Care Plan</TableHead>
              <TableHead>Primary Caregiver</TableHead>
              <TableHead className="text-right">Hours/wk</TableHead>
              <TableHead className="hidden md:table-cell">Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => {
              const cg = employees.find((e) => e.id === c.primaryCaregiverId);
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">{initials(c.name)}</AvatarFallback></Avatar>
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge className={cn("capitalize", statusColor[c.status])} variant="secondary">{c.status.replace("-", " ")}</Badge></TableCell>
                  <TableCell className="text-sm">{c.carePlan}</TableCell>
                  <TableCell className="text-sm">{cg?.name ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{c.hoursPerWeek}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{c.address}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
              </SheetHeader>
              <Tabs defaultValue="profile" className="mt-4">
                <TabsList>
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="care">Care Plan</TabsTrigger>
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                  <TabsTrigger value="docs">Documents</TabsTrigger>
                  <TabsTrigger value="billing">Billing</TabsTrigger>
                </TabsList>
                <TabsContent value="profile" className="space-y-3 mt-4 text-sm">
                  <div><span className="text-muted-foreground">Email: </span>{selected.email}</div>
                  <div><span className="text-muted-foreground">Phone: </span>{selected.phone}</div>
                  <div><span className="text-muted-foreground">Address: </span>{selected.address}</div>
                  <div><span className="text-muted-foreground">DOB: </span>{new Date(selected.dob).toLocaleDateString()}</div>
                </TabsContent>
                <TabsContent value="care" className="text-sm mt-4">
                  <p className="text-muted-foreground mb-2">Plan</p>
                  <p className="font-medium">{selected.carePlan} · {selected.hoursPerWeek}h/wk</p>
                </TabsContent>
                <TabsContent value="schedule" className="text-sm mt-4 text-muted-foreground">View on Scheduling page.</TabsContent>
                <TabsContent value="docs" className="text-sm mt-4 text-muted-foreground">No client-specific documents yet.</TabsContent>
                <TabsContent value="billing" className="text-sm mt-4 text-muted-foreground">View on Billing page.</TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
