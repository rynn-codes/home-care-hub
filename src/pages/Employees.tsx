import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { useData } from "@/context/DataProvider";
import { initials } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export default function Employees() {
  const { employees } = useData();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");

  const filtered = employees.filter((e) =>
    (role === "all" || e.role === role) &&
    e.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Employees"
        description={`${employees.length} caregivers and staff`}
        actions={<Button><Plus className="h-4 w-4 mr-1.5" />Add Employee</Button>}
      />
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employees…" className="pl-9" />
          </div>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="Caregiver">Caregiver</SelectItem>
              <SelectItem value="RN">RN</SelectItem>
              <SelectItem value="LPN">LPN</SelectItem>
              <SelectItem value="Coordinator">Coordinator</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Hours/wk</TableHead>
              <TableHead>Credentials</TableHead>
              <TableHead className="text-right">Clients</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e) => {
              const expiringSoon = e.credentials.some((c) => new Date(c.expires).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 30);
              return (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">{initials(e.name)}</AvatarFallback></Avatar>
                      <div>
                        <p className="font-medium">{e.name}</p>
                        <p className="text-xs text-muted-foreground">{e.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{e.role}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("capitalize", e.status === "active" ? "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]" : "bg-muted")}>
                      {e.status.replace("-", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{e.hoursThisWeek}</TableCell>
                  <TableCell>
                    {expiringSoon ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--warning))]"><AlertTriangle className="h-3 w-3" />Expiring soon</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">All current</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">{e.assignedClientIds.length}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
