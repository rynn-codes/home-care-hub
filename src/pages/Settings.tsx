import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABELS } from "@/domain/consents/witness";
import logo from "@/assets/logo.png";

/**
 * Settings — Joy's own identity and wiring, stated honestly.
 *
 * This page shipped from the original scaffold with somebody else's company
 * on it: "CareHub Home Care, 123 Main St, Springfield", a teal brand color,
 * QuickBooks and Slack integrations, and a "$199/mo Growth plan" — Joy is
 * Karynn's own operations platform, not a SaaS subscription she buys. All
 * of that is gone. What remains is what is true: Joy Health's identity, the
 * real brand color, the real roles the domain enforces, and the four
 * integrations the design brief assigns — each marked not-connected until
 * the developer wires it.
 */

/** The brief's integration table — each system and what it owns. */
const INTEGRATIONS = [
  { name: "GoHighLevel", owns: "Recruiting, marketing, automations" },
  { name: "Gusto", owns: "HR onboarding, payroll" },
  { name: "Spruce", owns: "Messaging — clients, families, caregivers" },
  { name: "Stripe", owns: "Card and ACH payments (plumbing ready)" },
];

const NOTIFICATIONS = [
  "Open shift reminders",
  "Missed clock-in alerts",
  "Credential expiry warnings",
  "Payment and dunning notices",
];

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" description="Joy's identity, roles, and the systems it talks to." />
      <Tabs defaultValue="org">
        <TabsList>
          <TabsTrigger value="org">Organization</TabsTrigger>
          <TabsTrigger value="brand">Branding</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="notify">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="org" className="mt-4">
          <div className="max-w-2xl space-y-4 rounded-[14px] border border-[#ECECF1] bg-white p-6">
            <div>
              <Label htmlFor="org-name">Company name</Label>
              <Input id="org-name" defaultValue="Joy Health" />
            </div>
            <div>
              <Label htmlFor="org-address">Address</Label>
              <Input id="org-address" placeholder="Add the office address" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="org-phone">Phone</Label>
                <Input id="org-phone" placeholder="Add the office phone" />
              </div>
              <div>
                <Label htmlFor="org-tax">Tax ID</Label>
                <Input id="org-tax" placeholder="Add the EIN" />
              </div>
            </div>
            <div>
              <Label htmlFor="org-about">About</Label>
              <Textarea
                id="org-about"
                defaultValue="Private duty home care in Houston. Joy runs the operations; people run the care."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Nothing here saves yet — the organizations table carries this once the database is
              connected. Real details go in then, not into a seed file.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="brand" className="mt-4">
          <div className="max-w-2xl space-y-4 rounded-[14px] border border-[#ECECF1] bg-white p-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Joy Health logo" className="h-10 w-10 rounded-full object-contain" />
              <div>
                <p className="m-0 text-sm font-medium">Joy Health</p>
                <p className="m-0 text-xs text-muted-foreground">The logo the app and portals use.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-[#F3F3F6] pt-4">
              <span className="h-10 w-10 rounded-[10px] bg-primary" aria-hidden="true" />
              <div>
                <p className="m-0 text-sm font-medium">#1407A2 — Joy Royal Blue</p>
                <p className="m-0 text-xs text-muted-foreground">
                  The design brief's brand primary. Fixed in the design tokens, not editable per
                  user — one brand, everywhere.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <div className="max-w-2xl rounded-[14px] border border-[#ECECF1] bg-white p-6">
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4 border-b border-[#F3F3F6] py-3 last:border-0">
                <div>
                  <p className="m-0 text-sm font-medium">{label}</p>
                  <p className="m-0 text-[12.5px] text-muted-foreground">
                    {key === "ceo_admin"
                      ? "Everything, including approvals with money on both sides."
                      : key === "rn_clinical"
                        ? "Assessments, care plans, supervisory visits — and one of two roles that can take a client's signature."
                        : "Referrals, intake and scheduling. No clinical sign-off, no rates."}
                  </p>
                </div>
                <span className="whitespace-nowrap rounded-full bg-[#F3F3F6] px-2.5 py-1 text-[11.5px] font-medium text-[#5B6274]">
                  From the database
                </span>
              </div>
            ))}
            <p className="mb-0 mt-3 text-xs text-muted-foreground">
              The grants themselves live in the migrations (row-level security, tested per role) —
              this screen reads them, it never edits them. The header's "view as" switch shows each
              role's world in the prototype.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="notify" className="mt-4">
          <div className="max-w-2xl rounded-[14px] border border-[#ECECF1] bg-white p-6">
            {NOTIFICATIONS.map((n) => (
              <div key={n} className="flex items-center justify-between gap-4 border-b border-[#F3F3F6] py-3 last:border-0">
                <p className="m-0 text-sm">{n}</p>
                <span className="whitespace-nowrap rounded-full bg-[#F3F3F6] px-2.5 py-1 text-[11.5px] font-medium text-[#5B6274]">
                  Arrives with Spruce
                </span>
              </div>
            ))}
            <p className="mb-0 mt-3 text-xs text-muted-foreground">
              No toggles yet on purpose: nothing sends today, and a switch that saves a preference
              for a message that cannot be sent would be the screen lying about what Joy does.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <div className="max-w-2xl rounded-[14px] border border-[#ECECF1] bg-white p-6">
            {INTEGRATIONS.map((i) => (
              <div key={i.name} className="flex items-center justify-between gap-4 border-b border-[#F3F3F6] py-3 last:border-0">
                <div>
                  <p className="m-0 text-sm font-medium">{i.name}</p>
                  <p className="m-0 text-[12.5px] text-muted-foreground">{i.owns}</p>
                </div>
                <span className="whitespace-nowrap rounded-full bg-[#F3F3F6] px-2.5 py-1 text-[11.5px] font-medium text-[#5B6274]">
                  Not connected
                </span>
              </div>
            ))}
            <p className="mb-0 mt-3 text-xs text-muted-foreground">
              The division of labour is the design brief's: each system keeps what it owns, and Joy
              never rebuilds it. Connecting them is the developer's work at handoff.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Which build am I looking at? A cached page is indistinguishable from a
          current one in a screenshot, so the page says so itself. */}
      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Prototype build <span className="font-medium tabular-nums text-foreground">{__BUILD_STAMP__}</span>.
        If this is older than you expect, the page is cached — reload with Cmd/Ctrl + Shift + R.
      </p>
    </>
  );
}
