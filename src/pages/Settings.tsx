import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your organization, branding, roles, and integrations." />
      <Tabs defaultValue="org">
        <TabsList>
          <TabsTrigger value="org">Organization</TabsTrigger>
          <TabsTrigger value="brand">Branding</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="notify">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="plan">Billing Plan</TabsTrigger>
        </TabsList>
        <TabsContent value="org" className="mt-4">
          <Card className="p-6 max-w-2xl space-y-4">
            <div><Label>Company name</Label><Input defaultValue="CareHub Home Care" /></div>
            <div><Label>Address</Label><Input defaultValue="123 Main St, Springfield" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Phone</Label><Input defaultValue="555-0100" /></div>
              <div><Label>Tax ID</Label><Input defaultValue="12-3456789" /></div>
            </div>
            <div><Label>About</Label><Textarea defaultValue="Compassionate in-home care since 2010." /></div>
            <Button>Save changes</Button>
          </Card>
        </TabsContent>
        <TabsContent value="brand" className="mt-4">
          <Card className="p-6 max-w-2xl space-y-4">
            <div><Label>Brand color</Label><Input type="color" defaultValue="#0e8a99" className="h-10 w-20" /></div>
            <div><Label>Logo URL</Label><Input placeholder="https://…" /></div>
            <Button>Save</Button>
          </Card>
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <Card className="p-6 max-w-2xl space-y-3">
            {["Admin", "Scheduler", "Caregiver", "Billing", "HR"].map((r) => (
              <div key={r} className="flex items-center justify-between border-b last:border-0 py-3">
                <div><p className="font-medium">{r}</p><p className="text-sm text-muted-foreground">Default permissions for {r.toLowerCase()} users.</p></div>
                <Button variant="outline" size="sm">Edit</Button>
              </div>
            ))}
          </Card>
        </TabsContent>
        <TabsContent value="notify" className="mt-4">
          <Card className="p-6 max-w-2xl space-y-4">
            {["Email digest", "Missed clock-in alerts", "Weekly hours summary", "Document uploads"].map((n) => (
              <div key={n} className="flex items-center justify-between"><Label>{n}</Label><Switch defaultChecked /></div>
            ))}
            <Button>Save</Button>
          </Card>
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <Card className="p-6 max-w-2xl space-y-3">
            {["QuickBooks", "Stripe", "Google Calendar", "Slack"].map((i) => (
              <div key={i} className="flex items-center justify-between border-b last:border-0 py-3">
                <p className="font-medium">{i}</p><Button variant="outline" size="sm">Connect</Button>
              </div>
            ))}
          </Card>
        </TabsContent>
        <TabsContent value="plan" className="mt-4">
          <Card className="p-6 max-w-2xl">
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="font-display text-2xl font-bold mt-1">Growth · $199/mo</p>
            <p className="text-sm text-muted-foreground mt-2">Up to 50 caregivers · unlimited clients</p>
            <div className="flex gap-2 mt-4"><Button>Upgrade</Button><Button variant="outline">View invoices</Button></div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
