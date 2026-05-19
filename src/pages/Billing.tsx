import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useData } from "@/context/DataProvider";
import { formatMoney } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Download, Plus, DollarSign, Clock } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { format } from "date-fns";
import type { InvoiceStatus } from "@/lib/mockData";

const invoiceColor: Record<InvoiceStatus, string> = {
  paid: "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]",
  sent: "bg-[hsl(var(--info)/0.15)] text-[hsl(var(--info))]",
  draft: "bg-muted text-muted-foreground",
  overdue: "bg-destructive/15 text-destructive",
};

export default function Billing() {
  const { invoices, clients, employees } = useData();
  const outstanding = invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + i.amount, 0);
  const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const payroll = employees.reduce((s, e) => s + e.hoursThisWeek * 22, 0);
  const weeklyRevenue = invoices.filter((i) => i.status === "paid" || i.status === "sent").reduce((s, i) => s + i.amount, 0);
  const weeklyHours = Math.round(employees.reduce((s, e) => s + (e.hoursThisWeek ?? 0), 0));

  return (
    <>
      <PageHeader title="Billing" description="Invoices, payroll, and payers." actions={<Button><Plus className="h-4 w-4 mr-1.5" />New Invoice</Button>} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
        <KpiCard label="Weekly Revenue" value={formatMoney(weeklyRevenue)} icon={DollarSign} accent="success" />
        <KpiCard label="Weekly Hours" value={weeklyHours} icon={Clock} accent="warning" />
        <Card className="p-5"><p className="text-sm text-muted-foreground">Outstanding</p><p className="font-display text-2xl font-bold mt-2">{formatMoney(outstanding)}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Paid this month</p><p className="font-display text-2xl font-bold mt-2 text-[hsl(var(--success))]">{formatMoney(paid)}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Upcoming payroll</p><p className="font-display text-2xl font-bold mt-2">{formatMoney(payroll)}</p></Card>
      </div>
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="payers">Payers</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices" className="mt-4">
          <Card className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Client</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {invoices.map((i) => {
                  const c = clients.find((x) => x.id === i.clientId);
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-sm">{i.number}</TableCell>
                      <TableCell>{c?.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(i.periodStart), "MMM d")} – {format(new Date(i.periodEnd), "MMM d")}</TableCell>
                      <TableCell><Badge variant="secondary" className={cn("capitalize", invoiceColor[i.status])}>{i.status}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(i.amount)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="payroll" className="mt-4">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-muted-foreground">Pay period: current week</p>
              <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1.5" />Export</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Hours</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Pay</TableHead></TableRow></TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-sm">{e.role}</TableCell>
                    <TableCell className="text-right">{e.hoursThisWeek}</TableCell>
                    <TableCell className="text-right">$22.00</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(e.hoursThisWeek * 22)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="payers" className="mt-4">
          <Card className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead>Payer</TableHead><TableHead>Type</TableHead><TableHead>Contact</TableHead><TableHead className="text-right">Rate</TableHead></TableRow></TableHeader>
              <TableBody>
                {[
                  ["Medicare", "Government", "claims@medicare.gov", "$28/hr"],
                  ["Medicaid", "Government", "support@medicaid.gov", "$24/hr"],
                  ["Aetna", "Private Insurance", "providers@aetna.com", "$32/hr"],
                  ["BlueCross BlueShield", "Private Insurance", "claims@bcbs.com", "$30/hr"],
                  ["Private Pay", "Self-pay", "—", "$35/hr"],
                ].map(([name, type, contact, rate]) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-sm">{type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{contact}</TableCell>
                    <TableCell className="text-right font-medium">{rate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
